const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { adjustStock } = require("../src/services/stockService");

describe("adjustStock", () => {
  let itemId;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-stocksvc-"));
    initDb(path.join(dir, "test.db"));
    const db = getDb();
    db.prepare("INSERT INTO warehouses (id, name, is_default) VALUES (?, ?, ?)").run(1, "المستودع الرئيسي", 1);
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)").run(1, "testuser", "hash", "admin");
    const catId = Number(db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("عام").lastInsertRowid);
    const unitId = Number(db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pc").lastInsertRowid);
    itemId = Number(db.prepare(
      "INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("منتج اختبار", "TST-001", 100, 50, catId, unitId).lastInsertRowid);
  });

  it("creates a new stock_level entry when none exists", () => {
    adjustStock({ item_id: itemId, warehouse_id: 1, quantityDelta: 50, movement_type: "purchase" });
    const db = getDb();
    const level = db.prepare("SELECT * FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(itemId, 1);
    expect(level).toBeTruthy();
    expect(level.quantity).toBe(50);
  });

  it("updates existing stock_level quantity", () => {
    const db = getDb();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, 1, 30);
    adjustStock({ item_id: itemId, warehouse_id: 1, quantityDelta: 20, movement_type: "purchase" });
    const level = db.prepare("SELECT * FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(itemId, 1);
    expect(level.quantity).toBe(50);
  });

  it("handles negative quantityDelta (removing stock)", () => {
    const db = getDb();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, 1, 100);
    adjustStock({ item_id: itemId, warehouse_id: 1, quantityDelta: -30, movement_type: "sale" });
    const level = db.prepare("SELECT * FROM stock_levels WHERE item_id = ? AND warehouse_id = ?").get(itemId, 1);
    expect(level.quantity).toBe(70);
  });

  it("records a stock_movement entry", () => {
    adjustStock({
      item_id: itemId, warehouse_id: 1, quantityDelta: 25, movement_type: "purchase",
      reference_type: "purchase_order", reference_id: 42, notes: "شراء مورد", user_id: 1,
    });
    const db = getDb();
    const mov = db.prepare("SELECT * FROM stock_movements WHERE item_id = ?").get(itemId);
    expect(mov).toBeTruthy();
    expect(mov.movement_type).toBe("purchase");
    expect(mov.quantity).toBe(25);
    expect(mov.before_qty).toBe(0);
    expect(mov.after_qty).toBe(25);
    expect(mov.reference_type).toBe("purchase_order");
    expect(mov.reference_id).toBe(42);
    expect(mov.notes).toBe("شراء مورد");
    expect(mov.created_by).toBe(1);
  });

  it("records correct before_qty and after_qty on subsequent update", () => {
    const db = getDb();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, 1, 100);
    adjustStock({ item_id: itemId, warehouse_id: 1, quantityDelta: -10, movement_type: "sale" });
    const mov = db.prepare("SELECT * FROM stock_movements WHERE item_id = ? ORDER BY id DESC LIMIT 1").get(itemId);
    expect(mov.before_qty).toBe(100);
    expect(mov.after_qty).toBe(90);
    expect(mov.quantity).toBe(-10);
  });

  it("is transactional — does not create movement if level insert fails", () => {
    expect(() => {
      adjustStock({ item_id: 999, warehouse_id: 999, quantityDelta: 10, movement_type: "purchase" });
    }).toThrow();
    const db = getDb();
    const mov = db.prepare("SELECT * FROM stock_movements").all();
    expect(mov.length).toBe(0);
  });
});
