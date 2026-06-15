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

  test("per-line discount reduces the stored total", () => {
    // line_total = 2*100 - 30 = 170, no header discount → total must be 170 (not 200)
    const inv = createInvoice({
      lines: [{ item_id: 1, quantity: 2, unit_price: 100, discount: 30 }],
      discount: 0,
      payment_type: "cash",
    });
    expect(inv.total).toBe(170);
  });

  test("promotion_discount reduces the stored total and is folded into discount", () => {
    // line_total = 200, promotion 20 → total 180; stored discount = header(0) + promo(20)
    const inv = createInvoice({
      lines: [{ item_id: 1, quantity: 2, unit_price: 100 }],
      discount: 0,
      promotion_discount: 20,
      payment_type: "cash",
    });
    const db = getDb();
    const row = db.prepare("SELECT total, discount FROM invoices WHERE id = ?").get(inv.id);
    expect(row.total).toBe(180);
    expect(row.discount).toBe(20);
  });

  test("line discount + header discount + promotion all apply to total", () => {
    // line_total = 2*100 - 30 = 170; total = 170 - header(10) - promo(20) = 140
    const inv = createInvoice({
      lines: [{ item_id: 1, quantity: 2, unit_price: 100, discount: 30 }],
      discount: 10,
      promotion_discount: 20,
      payment_type: "cash",
    });
    expect(inv.total).toBe(140);
  });

  test("default POS invoice number uses the INV prefix, not POS_", () => {
    const inv = createInvoice({ lines: [{ item_id: 1, quantity: 1, unit_price: 100 }], payment_type: "cash" });
    expect(inv.invoice_no).toMatch(/^INV-\d{8}-\d{4}$/);
  });

  test("honors the client-reserved doc_no instead of minting a second number", () => {
    const { generateDocNumber } = require("../src/utils/docNumber");
    // Simulate POST /api/documents/reserve advancing the daily sequence.
    const reserved = generateDocNumber("pos_sale");
    const inv = createInvoice({
      doc_no: reserved,
      lines: [{ item_id: 1, quantity: 1, unit_price: 100 }],
      payment_type: "cash",
    });
    // Saved number === reserved number (no off-by-one).
    expect(inv.invoice_no).toBe(reserved);
  });

  test("falls back to a fresh number when the reserved doc_no is already taken", () => {
    const taken = createInvoice({ lines: [{ item_id: 1, quantity: 1, unit_price: 100 }], payment_type: "cash" }).invoice_no;
    const inv = createInvoice({
      doc_no: taken, // collides → must not reuse
      lines: [{ item_id: 1, quantity: 1, unit_price: 100 }],
      payment_type: "cash",
    });
    expect(inv.invoice_no).not.toBe(taken);
    expect(inv.invoice_no).toMatch(/^INV-\d{8}-\d{4}$/);
  });

  test("invoice total matches client computeTotals formula", () => {
    // Mirror posStore.computeTotals: Σ(qty*price - line_discount) - (discount+promo) + increase
    const lines = [
      { item_id: 1, quantity: 3, unit_price: 100, discount: 25 },
    ];
    const discount = 15, promotion_discount = 10, increase = 5;
    const inv = createInvoice({ lines, discount, promotion_discount, increase, payment_type: "cash" });
    const clientSubtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price - (l.discount || 0), 0);
    const clientTotal = Math.max(0, clientSubtotal - (discount + promotion_discount) + increase);
    expect(inv.total).toBe(clientTotal); // 275 - 25 + 5 = 255
  });
});
