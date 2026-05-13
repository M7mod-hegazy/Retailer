const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { transferStock } = require("../src/services/stockTransferService");

describe("stock transfer service", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-stock-transfer-"));
    initDb(path.join(dir, "transfer.db"));
    const db = getDb();
    db.prepare("INSERT INTO units (name) VALUES ('pcs')").run();
    db.prepare("INSERT INTO item_categories (name) VALUES ('cat')").run();
    db.prepare("INSERT INTO items (name, barcode, category_id, unit_id) VALUES ('Item', 'TRF-1', 1, 1)").run();
    db.prepare("INSERT INTO warehouses (name, code, is_default) VALUES ('W1', 'W1', 1)").run();
    db.prepare("INSERT INTO warehouses (name, code, is_default) VALUES ('W2', 'W2', 0)").run();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 10)").run();
  });

  test("transfers stock between warehouses", () => {
    const result = transferStock({ item_id: 1, from_warehouse_id: 1, to_warehouse_id: 2, quantity: 4 });
    expect(result.quantity).toBe(4);

    const db = getDb();
    const src = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = 1 AND warehouse_id = 1").get();
    const dst = db.prepare("SELECT quantity FROM stock_levels WHERE item_id = 1 AND warehouse_id = 2").get();
    expect(src.quantity).toBe(6);
    expect(dst.quantity).toBe(4);
  });

  test("rejects transfer with insufficient quantity", () => {
    expect(() =>
      transferStock({ item_id: 1, from_warehouse_id: 1, to_warehouse_id: 2, quantity: 20 }),
    ).toThrow(/Insufficient stock/);
  });

  test("rejects transfer to same warehouse", () => {
    expect(() =>
      transferStock({ item_id: 1, from_warehouse_id: 1, to_warehouse_id: 1, quantity: 1 }),
    ).toThrow(/must differ/);
  });
});
