const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createInvoice } = require("../src/services/invoiceService");

describe("invoice service", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-invoice-"));
    initDb(path.join(dir, "invoice.db"));
    const db = getDb();
    db.prepare("INSERT INTO units (name) VALUES ('pcs')").run();
    db.prepare("INSERT INTO item_categories (name) VALUES ('cat')").run();
    db.prepare("INSERT INTO warehouses (name, is_default) VALUES ('Main', 1)").run();
    db.prepare("INSERT INTO items (name, barcode, category_id, unit_id) VALUES ('Item', 'abc', 1, 1)").run();
    db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 10)").run();
  });

  test("creates invoice transactionally", () => {
    const inv = createInvoice({ lines: [{ item_id: 1, quantity: 2, unit_price: 1000 }], discount: 0, payment_type: "cash" });
    expect(inv.id).toBeTruthy();
  });

  test("rejects discount above hard limit without supervisor override", () => {
    expect(() =>
      createInvoice({
        lines: [{ item_id: 1, quantity: 10, unit_price: 100 }],
        discount: 500, // subtotal 1000 => max 150
        payment_type: "cash",
      }),
    ).toThrow(/Supervisor override required/i);
  });

  test("accepts high discount with supervisor override", () => {
    const inv = createInvoice({
      lines: [{ item_id: 1, quantity: 10, unit_price: 100 }],
      discount: 500,
      payment_type: "cash",
      supervisor_override: true,
    });
    expect(inv.total).toBe(500);
  });
});
