const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createInvoice } = require("../src/services/invoiceService");
const { createReturn } = require("../src/services/returnService");

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
});
