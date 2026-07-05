const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createInvoice, editInvoice } = require("../src/services/invoiceService");

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

  test("editing a partial-cash invoice's total updates the customer's owed balance", () => {
    const db = getDb();
    const custId = db.prepare("INSERT INTO customers (name) VALUES ('C')").run().lastInsertRowid;
    db.prepare("UPDATE stock_levels SET quantity = 100000 WHERE item_id = 1").run();

    // total 1000, paid 600 → owes 400
    const inv = createInvoice({
      customer_id: custId, payment_type: "cash", amount_paid: 600,
      lines: [{ item_id: 1, quantity: 1, unit_price: 1000 }],
    });
    const owes = () => db.prepare("SELECT opening_balance AS b FROM customers WHERE id = ?").get(custId).b;
    expect(owes()).toBe(400);

    // edit total → 1500 (still paid 600) → owed must move to 900 (was a no-op bug)
    editInvoice(inv.id, {
      customer_id: custId, payment_type: "cash", amount_paid: 600,
      lines: [{ item_id: 1, quantity: 1, unit_price: 1500 }],
    });
    expect(owes()).toBe(900);

    // active debt reflects the new outstanding; old one voided
    const active = db.prepare("SELECT original_amount, paid_amount FROM ajal_debts WHERE invoice_id = ? AND source_type='invoice' AND status != 'voided'").get(inv.id);
    expect(active.original_amount).toBe(900);
  });

  test("editing a multi invoice's discount reconciles the customer's credit balance (no orphaned balance)", () => {
    const db = getDb();
    const custId = db.prepare("INSERT INTO customers (name) VALUES ('M')").run().lastInsertRowid;
    db.prepare("UPDATE stock_levels SET quantity = 100000 WHERE item_id = 1").run();
    const tre = db.prepare("SELECT id FROM treasuries LIMIT 1").get()?.id;
    if (tre) db.prepare("UPDATE settings SET default_treasury_id = ? WHERE id = 1").run(tre);
    const owes = () => db.prepare("SELECT opening_balance AS b FROM customers WHERE id = ?").get(custId).b;

    // multi: subtotal 15450, no discount → total 15450 = cash 10000 + credit 5450
    const inv = createInvoice({
      customer_id: custId, payment_type: "multi",
      payments: [{ method: "cash", amount: 10000 }, { method: "credit", amount: 5450 }],
      lines: [{ item_id: 1, quantity: 1, unit_price: 15450 }],
    });
    expect(owes()).toBe(5450);

    // edit: add 1450 discount → total 14000 = cash 10000 + credit 4000 → owes 4000
    editInvoice(inv.id, {
      customer_id: custId, payment_type: "multi", discount: 1450,
      payments: [{ method: "cash", amount: 10000 }, { method: "credit", amount: 4000 }],
      lines: [{ item_id: 1, quantity: 1, unit_price: 15450 }],
    });
    expect(owes()).toBe(4000); // not 5450 (orphaned) and not 0 (lost)
    const active = db.prepare("SELECT original_amount FROM ajal_debts WHERE invoice_id = ? AND source_type='invoice' AND status != 'voided'").get(inv.id);
    expect(active.original_amount).toBe(4000);
  });

  test("editing a credit invoice to cash + null customer detaches the customer", () => {
    const db = getDb();
    const custId = db.prepare("INSERT INTO customers (name) VALUES ('Detach Me')").run().lastInsertRowid;
    db.prepare("UPDATE stock_levels SET quantity = 100000 WHERE item_id = 1").run();
    const tre = db.prepare("SELECT id FROM treasuries LIMIT 1").get()?.id;
    if (tre) db.prepare("UPDATE settings SET default_treasury_id = ? WHERE id = 1").run(tre);

    // 1. Credit invoice bound to the customer.
    const inv = createInvoice({
      customer_id: custId, payment_type: "credit",
      lines: [{ item_id: 1, quantity: 1, unit_price: 1000 }],
    });
    expect(db.prepare("SELECT customer_id FROM invoices WHERE id = ?").get(inv.id).customer_id).toBe(custId);

    // 2. Edit → cash and explicitly remove the customer (client sends customer_id: null).
    editInvoice(inv.id, {
      customer_id: null, payment_type: "cash",
      amount_paid: 1000,
      lines: [{ item_id: 1, quantity: 1, unit_price: 1000 }],
    });

    // 3. Customer is truly detached — not silently reverted to the original.
    expect(db.prepare("SELECT customer_id FROM invoices WHERE id = ?").get(inv.id).customer_id).toBeNull();
    // ...and the old credit debt is voided (no phantom balance left on the customer).
    const openDebt = db.prepare("SELECT 1 FROM ajal_debts WHERE invoice_id = ? AND source_type='invoice' AND status != 'voided'").get(inv.id);
    expect(openDebt).toBeUndefined();
    expect(db.prepare("SELECT opening_balance AS b FROM customers WHERE id = ?").get(custId).b).toBe(0);
  });

  test("editing a cash invoice to credit without a customer is rejected", () => {
    const db = getDb();
    db.prepare("UPDATE stock_levels SET quantity = 100000 WHERE item_id = 1").run();
    const tre = db.prepare("SELECT id FROM treasuries LIMIT 1").get()?.id;
    if (tre) db.prepare("UPDATE settings SET default_treasury_id = ? WHERE id = 1").run(tre);
    const inv = createInvoice({
      payment_type: "cash", amount_paid: 1000,
      lines: [{ item_id: 1, quantity: 1, unit_price: 1000 }],
    });
    expect(() =>
      editInvoice(inv.id, {
        customer_id: null, payment_type: "credit",
        lines: [{ item_id: 1, quantity: 1, unit_price: 1000 }],
      }),
    ).toThrow(/تتطلب تحديد العميل/);
  });
});
