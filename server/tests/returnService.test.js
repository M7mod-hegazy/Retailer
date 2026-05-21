const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createInvoice } = require("../src/services/invoiceService");
const { createReturn, createGeneralReturn, getReturnDetails, editSalesReturn } = require("../src/services/returnService");

describe("returnService", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-return-"));
    initDb(path.join(dir, "return.db"));
    const db = getDb();
    db.prepare("INSERT INTO units (name) VALUES ('pcs')").run();
    db.prepare("INSERT INTO item_categories (name) VALUES ('cat')").run();
    db.prepare("INSERT INTO warehouses (name, is_default) VALUES ('Main', 1)").run();
    db.prepare("INSERT INTO items (name, barcode, category_id, unit_id) VALUES ('Item', 'ret-abc', 1, 1)").run();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 10)").run();
  });

  test("supports partial line-item returns", () => {
    const invoice = createInvoice({
      lines: [{ item_id: 1, quantity: 4, unit_price: 1000 }],
      discount: 0,
      payment_type: "cash",
      warehouse_id: 1,
    });

    const invoiceLine = getDb()
      .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?")
      .get(invoice.id);

    const salesReturn = createReturn(invoice.id, {
      warehouse_id: 1,
      lines: [{ invoice_line_id: invoiceLine.id, quantity: 2 }],
    });

    const stock = getDb()
      .prepare("SELECT quantity FROM stock_levels WHERE item_id = 1 AND warehouse_id = 1")
      .get();

    expect(salesReturn.total).toBe(2000);
    expect(stock.quantity).toBe(8);
  });

  test("getReturnDetails returns item_code and unit_id for each line", () => {
    const db = getDb();
    db.prepare("UPDATE items SET code = 'SKU-001' WHERE id = 1").run();

    const invoice = createInvoice({
      lines: [{ item_id: 1, quantity: 2, unit_price: 500 }],
      discount: 0,
      payment_type: "cash",
      warehouse_id: 1,
    });

    const invoiceLine = db
      .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?")
      .get(invoice.id);

    const ret = createReturn(invoice.id, {
      lines: [{ invoice_line_id: invoiceLine.id, quantity: 1 }],
    });

    const details = getReturnDetails(ret.id);
    expect(details.lines).toHaveLength(1);
    expect(details.lines[0].item_code).toBe("SKU-001");
    expect(details.lines[0].unit_id).toBe(1);
  });

  test("editSalesReturn uses per-line warehouse_id for stock adjustments", () => {
    const db = getDb();
    db.prepare("INSERT INTO warehouses (name) VALUES ('Warehouse B')").run();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 2, 5)").run();

    const ret = createGeneralReturn({
      lines: [{ item_id: 1, quantity: 2, unit_price: 500, warehouse_id: 1 }],
      refund_method: "cash_back",
    });

    expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=1").get().quantity).toBe(12);

    editSalesReturn(ret.id, {
      lines: [{ item_id: 1, quantity: 1, unit_price: 500, warehouse_id: 2 }],
      refund_method: "cash_back",
    });

    expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=1").get().quantity).toBe(10);
    expect(db.prepare("SELECT quantity FROM stock_levels WHERE item_id=1 AND warehouse_id=2").get().quantity).toBe(6);
  });
});
