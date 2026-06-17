const _request = require("supertest");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let _devToken;
function request(app) {
  const agent = _request(app);
  const wrapped = {};
  ["get", "post", "put", "patch", "delete"].forEach((m) => {
    wrapped[m] = (url) => agent[m](url).set("Authorization", `Bearer ${_devToken}`);
  });
  return wrapped;
}

let app;
let db;
let customerId;
let itemId;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-installplan-"));
  initDb(path.join(dir, "installplan.db"));
  app = createApp();
  db = getDb();
  _devToken = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  db.exec(`INSERT OR REPLACE INTO settings (id, default_treasury_id, default_warehouse_id) VALUES (1, 1, 1)`);
  db.exec(`INSERT OR IGNORE INTO treasuries (id, name, balance) VALUES (1, 'الخزينة', 0)`);
  db.exec(`INSERT OR IGNORE INTO warehouses (id, name, is_default) VALUES (1, 'المستودع', 1)`);
  db.exec(`INSERT OR IGNORE INTO item_categories (id, name) VALUES (1, 'فئة')`);
  db.exec(`INSERT OR IGNORE INTO units (id, name, symbol) VALUES (1, 'قطعة', 'pcs')`);
  db.exec(`INSERT OR IGNORE INTO customers (id, name, opening_balance, is_active) VALUES (1, 'عميل تقسيط', 0, 1)`);
  customerId = 1;
  db.exec(`INSERT OR IGNORE INTO items (id, name, sale_price, purchase_price, category_id, unit_id, is_active) VALUES (1, 'صنف', 100, 50, 1, 1, 1)`);
  itemId = 1;
  db.exec(`INSERT OR IGNORE INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 1000)`);
});

describe("POS installment plan", () => {
  it("creates ajal_schedules summing to the remaining, debt due_date = first installment", async () => {
    // total = 2 * 100 = 200, down payment 50 -> remaining 150 split into 3 x 50
    const res = await request(app).post("/api/invoices").send({
      customer_id: customerId,
      lines: [{ item_id: itemId, quantity: 2, unit_price: 100, warehouse_id: 1 }],
      payment_type: "installments",
      amount_paid: 50,
      treasury_id: 1,
      installment_plan: [
        { installment_no: 1, due_date: "2026-07-01", amount: 50 },
        { installment_no: 2, due_date: "2026-08-01", amount: 50 },
        { installment_no: 3, due_date: "2026-09-01", amount: 50 },
      ],
    });

    expect(res.status).toBe(201);
    const invoiceId = res.body.data.id;

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE invoice_id = ?").get(invoiceId);
    expect(debt).toBeTruthy();
    expect(debt.original_amount).toBe(150);
    expect(debt.due_date).toBe("2026-07-01"); // first installment

    const schedules = db.prepare("SELECT * FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(debt.id);
    expect(schedules.length).toBe(3);
    const sum = schedules.reduce((s, r) => s + Number(r.amount), 0);
    expect(sum).toBeCloseTo(150, 2);
    expect(schedules[0].due_date).toBe("2026-07-01");
  });

  it("rolls back the whole sale when the plan does not sum to the remaining", async () => {
    const debtsBefore = db.prepare("SELECT COUNT(*) AS c FROM ajal_debts").get().c;
    const schedBefore = db.prepare("SELECT COUNT(*) AS c FROM ajal_schedules").get().c;
    const invoicesBefore = db.prepare("SELECT COUNT(*) AS c FROM invoices").get().c;

    const res = await request(app).post("/api/invoices").send({
      customer_id: customerId,
      lines: [{ item_id: itemId, quantity: 2, unit_price: 100, warehouse_id: 1 }],
      payment_type: "installments",
      amount_paid: 50,
      treasury_id: 1,
      installment_plan: [
        { installment_no: 1, due_date: "2026-07-01", amount: 50 },
        { installment_no: 2, due_date: "2026-08-01", amount: 50 },
        // missing the third -> sums to 100, not 150
      ],
    });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // No orphan rows: counts unchanged (transaction rolled back).
    expect(db.prepare("SELECT COUNT(*) AS c FROM ajal_debts").get().c).toBe(debtsBefore);
    expect(db.prepare("SELECT COUNT(*) AS c FROM ajal_schedules").get().c).toBe(schedBefore);
    expect(db.prepare("SELECT COUNT(*) AS c FROM invoices").get().c).toBe(invoicesBefore);
  });

  it("due-parties only flags installment sales, not scheduled credit/آجل debts", async () => {
    // A credit (آجل) invoice whose debt was later given a schedule must NOT be
    // reported as an overdue installment.
    db.exec(`INSERT INTO customers (id, name, opening_balance, is_active) VALUES (99, 'عميل آجل', 0, 1)`);
    const inv = db.prepare("INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status) VALUES (?,?,?,?,?,?,?)")
      .run("INV-CREDIT-99", 99, 300, 0, 300, "credit", "unpaid");
    const debt = db.prepare("INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, status) VALUES (?,?,'customer','invoice',?,0,'open')")
      .run(inv.lastInsertRowid, 99, 300);
    db.prepare("INSERT INTO ajal_schedules (debt_id, installment_no, due_date, amount, status) VALUES (?,1,'2026-01-01',300,'pending')").run(debt.lastInsertRowid);

    const res = await request(app).get("/api/ajal-debts/due-parties?party_type=customer");
    expect(res.status).toBe(200);
    const ids = (res.body.data || []).map((r) => r.party_id);
    expect(ids).toContain(1);    // the installment sale from test 1
    expect(ids).not.toContain(99); // the scheduled credit debt must be excluded
  });
});
