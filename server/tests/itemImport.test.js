const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createApp } = require("../src/app");

const SECRET = process.env.JWT_SECRET || "test-secret";

function smartRow(payload, action = "insert", extra = {}) {
  return { action, payload, source_row: extra.source_row || 1, ...extra };
}

describe("smart item import", () => {
  let app;
  let token;
  let warehouseId;
  let unitId;
  let baselineItems;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-import-"));
    initDb(path.join(dir, "import.db"));
    const db = getDb();
    unitId = db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs").lastInsertRowid;
    warehouseId = db.prepare("INSERT INTO warehouses (name, is_default) VALUES (?, 1)").run("المخزن الرئيسي").lastInsertRowid;
    baselineItems = db.prepare("SELECT COUNT(*) AS n FROM items").get().n;
    app = createApp();
    token = jwt.sign({ sub: "__dev__" }, SECRET);
  });

  function post(body) {
    return request(app).post("/api/items/import").set("Authorization", `Bearer ${token}`).send(body);
  }

  test("dry-run reports counts and writes nothing", async () => {
    const res = await post({
      mode: "smart",
      dry_run: true,
      rows: [smartRow({ name: "Dry A", barcode: "D-1", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 3 })],
    });
    expect(res.status).toBe(200);
    expect(res.body.dry_run).toBe(true);
    expect(res.body.data.inserted).toBe(1);
    const count = getDb().prepare("SELECT COUNT(*) AS n FROM items").get().n;
    expect(count).toBe(baselineItems);
  });

  test("real import inserts item, stock, OB doc, movement and records a batch", async () => {
    const res = await post({
      mode: "smart",
      file_name: "catalog.xlsx",
      rows: [smartRow({ name: "Real A", barcode: "R-1", sale_price: 20, purchase_price: 8, warehouse_id: warehouseId, stock_quantity: 5 })],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.inserted).toBe(1);
    expect(res.body.data.batch_id).toBeGreaterThan(0);

    const db = getDb();
    const item = db.prepare("SELECT * FROM items WHERE barcode = 'R-1'").get();
    expect(item).toBeTruthy();
    expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id = ?").get(item.id).quantity).toBe(5);
    expect(db.prepare("SELECT 1 FROM purchases WHERE doc_no = ?").get(`OB-IMPORT-${item.id}`)).toBeTruthy();
    expect(db.prepare("SELECT 1 FROM stock_movements WHERE reference_type = 'item_import' AND reference_id = ?").get(item.id)).toBeTruthy();

    const batch = db.prepare("SELECT * FROM import_batches ORDER BY id DESC LIMIT 1").get();
    expect(batch.inserted).toBe(1);
    expect(batch.file_name).toBe("catalog.xlsx");
    expect(db.prepare("SELECT COUNT(*) AS n FROM import_batch_items WHERE batch_id = ?").get(batch.id).n).toBe(1);
  });

  test("all-or-nothing: one bad row rolls back the whole batch", async () => {
    const res = await post({
      mode: "smart",
      rows: [
        smartRow({ name: "Good", barcode: "G-1", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 1 }, "insert", { source_row: 1 }),
        smartRow({ name: "", barcode: "B-1", sale_price: 10 }, "insert", { source_row: 2 }),
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("validation");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM items").get().n).toBe(baselineItems);
  });

  test("negative price and non-numeric are blocked", async () => {
    const res = await post({
      mode: "smart",
      rows: [
        smartRow({ name: "Neg", sale_price: -5, warehouse_id: warehouseId }, "insert", { source_row: 1 }),
        smartRow({ name: "NaN", sale_price: "abc", warehouse_id: warehouseId }, "insert", { source_row: 2 }),
      ],
    });
    expect(res.status).toBe(400);
    const codes = res.body.rows.flatMap((r) => r.errors.map((e) => e.code));
    expect(codes).toContain("negative");
    expect(codes).toContain("non_numeric");
  });

  test("barcode belonging to a different existing product is blocked", async () => {
    const db = getDb();
    db.prepare("INSERT INTO items (code, name, barcode) VALUES (?, ?, ?)").run("X.1", "Existing", "SHARED");
    const res = await post({
      mode: "smart",
      rows: [smartRow({ code: "Y.9", name: "New Different", barcode: "SHARED", sale_price: 10 })],
    });
    expect(res.status).toBe(400);
    expect(res.body.rows[0].errors.map((e) => e.code)).toContain("barcode_conflict_existing");
  });

  test("duplicate file hash requires confirmation", async () => {
    const fileBase64 = Buffer.from("hello-file").toString("base64");
    const body = {
      mode: "smart",
      file_base64: fileBase64,
      rows: [smartRow({ name: "FileA", barcode: "F-1", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 1 })],
    };
    expect((await post(body)).status).toBe(200);
    const dup = await post(body);
    expect(dup.status).toBe(409);
    expect(dup.body.requires_confirm).toBe("duplicate_file");
    // Confirming bypasses the guard (use a fresh barcode to avoid a real unique clash).
    const confirmed = await post({
      ...body,
      confirm_duplicate: true,
      rows: [smartRow({ name: "FileB", barcode: "F-2", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 1 })],
    });
    expect(confirmed.status).toBe(200);
  });

  test("undo reverts an untouched batch within window", async () => {
    const res = await post({
      mode: "smart",
      rows: [smartRow({ name: "Undo A", barcode: "U-1", sale_price: 20, purchase_price: 8, warehouse_id: warehouseId, stock_quantity: 5 })],
    });
    const batchId = res.body.data.batch_id;
    const db = getDb();
    const item = db.prepare("SELECT id FROM items WHERE barcode = 'U-1'").get();

    const undo = await request(app).post(`/api/items/import/batches/${batchId}/undo`).set("Authorization", `Bearer ${token}`).send();
    expect(undo.status).toBe(200);
    expect(db.prepare("SELECT 1 FROM items WHERE id = ?").get(item.id)).toBeFalsy();
    expect(db.prepare("SELECT 1 FROM stock_levels WHERE item_id = ?").get(item.id)).toBeFalsy();
    expect(db.prepare("SELECT status FROM import_batches WHERE id = ?").get(batchId).status).toBe("undone");
  });

  test("undo is blocked when an imported item was sold", async () => {
    const res = await post({
      mode: "smart",
      rows: [smartRow({ name: "Sold A", barcode: "S-1", sale_price: 20, purchase_price: 8, warehouse_id: warehouseId, stock_quantity: 5 })],
    });
    const batchId = res.body.data.batch_id;
    const db = getDb();
    const item = db.prepare("SELECT id FROM items WHERE barcode = 'S-1'").get();
    const invId = db.prepare("INSERT INTO invoices (invoice_no, total) VALUES (?, ?)").run("INV-1", 20).lastInsertRowid;
    db.prepare("INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)").run(invId, item.id, 1, 20, 20);

    const undo = await request(app).post(`/api/items/import/batches/${batchId}/undo`).set("Authorization", `Bearer ${token}`).send();
    expect(undo.status).toBe(409);
    expect(undo.body.reason).toBe("activity");
    expect(undo.body.detail).toBe("sold");
    expect(db.prepare("SELECT 1 FROM items WHERE id = ?").get(item.id)).toBeTruthy();
  });

  test("undo is blocked after the 24h window", async () => {
    const res = await post({
      mode: "smart",
      rows: [smartRow({ name: "Old A", barcode: "O-1", sale_price: 20, purchase_price: 8, warehouse_id: warehouseId, stock_quantity: 5 })],
    });
    const batchId = res.body.data.batch_id;
    getDb().prepare("UPDATE import_batches SET created_at = datetime('now', '-30 hours') WHERE id = ?").run(batchId);

    const undo = await request(app).post(`/api/items/import/batches/${batchId}/undo`).set("Authorization", `Bearer ${token}`).send();
    expect(undo.status).toBe(409);
    expect(undo.body.reason).toBe("expired");
  });

  test("re-download returns the stored file bytes", async () => {
    const fileBase64 = Buffer.from("ELHEGAZI-FILE").toString("base64");
    const res = await post({
      mode: "smart",
      file_name: "src.xlsx",
      file_base64: fileBase64,
      rows: [smartRow({ name: "Dl A", barcode: "DL-1", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 1 })],
    });
    const batchId = res.body.data.batch_id;
    const file = await request(app).get(`/api/items/import/batches/${batchId}/file`).set("Authorization", `Bearer ${token}`);
    expect(file.status).toBe(200);
    expect(file.body.toString()).toBe("ELHEGAZI-FILE");
  });

  test("import history lists recent batches", async () => {
    await post({ mode: "smart", rows: [smartRow({ name: "Hist A", barcode: "H-1", sale_price: 10, purchase_price: 5, warehouse_id: warehouseId, stock_quantity: 1 })] });
    const list = await request(app).get("/api/items/import/batches").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0]).not.toHaveProperty("file_blob");
  });
});
