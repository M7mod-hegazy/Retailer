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
  const methods = ["get", "post", "put", "patch", "delete"];
  const wrapped = {};
  methods.forEach(m => {
    wrapped[m] = (url) => agent[m](url).set("Authorization", `Bearer ${_devToken}`);
  });
  return wrapped;
}

let app;
let db;
let today;
let yesterday;
let customerId;
let supplierId;
let itemId1;
let itemId2;
let treasuryId;
let bankId;

// Helper to format date
function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper to add days
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-treasury-"));
  const dbPath = path.join(dir, "treasury.db");
  initDb(dbPath);
  app = createApp();
  db = getDb();
  _devToken = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  // Set dates
  today = dateStr();
  yesterday = dateToStr(addDays(new Date(), -1));

  // Seed test data
  seedTestData();
});

function seedTestData() {
  // Insert settings
  db.exec(`
    INSERT OR REPLACE INTO settings (id, branch_code, invoice_prefix, default_treasury_id, default_warehouse_id)
    VALUES (1, 'BR1', 'INV', 1, 1)
  `);

  // Insert treasury (migration 039 pre-seeds id=1 with balance=0 — update it)
  db.exec(`
    INSERT OR IGNORE INTO treasuries (id, name, balance)
    VALUES (1, 'الخزينة الرئيسية', 0)
  `);
  db.exec(`UPDATE treasuries SET balance = 5000 WHERE id = 1`);
  treasuryId = 1;

  // Insert bank
  db.exec(`
    INSERT OR IGNORE INTO banks (id, name, balance)
    VALUES (1, 'البنك الأهلي', 10000)
  `);
  bankId = 1;

  // Insert payment methods
  db.exec(`
    INSERT OR IGNORE INTO payment_methods (id, name, type, target_id, is_active)
    VALUES 
      (1, 'نقدي', 'cash', 1, 1),
      (2, 'بطاقة بنكية', 'bank', 1, 1),
      (3, 'تحويل بنكي', 'bank_transfer', 1, 1)
  `);

  // Insert warehouse
  db.exec(`
    INSERT OR IGNORE INTO warehouses (id, name, is_default)
    VALUES (1, 'المستودع الرئيسي', 1)
  `);

  // Insert supplier
  db.exec(`
    INSERT OR IGNORE INTO suppliers (id, name, phone, opening_balance, is_active)
    VALUES (1, 'مورد اختبار', '01000000001', 0, 1)
  `);
  supplierId = 1;

  // Insert customer
  db.exec(`
    INSERT OR IGNORE INTO customers (id, name, phone, opening_balance, is_active)
    VALUES (1, 'عميل اختبار', '01000000002', 0, 1)
  `);
  customerId = 1;

  // Insert item category and unit first
  db.exec(`INSERT OR IGNORE INTO item_categories (id, name) VALUES (1, 'فئة اختبار')`);
  db.exec(`INSERT OR IGNORE INTO units (id, name, symbol) VALUES (1, 'قطعة', 'pcs')`);

  // Insert items with stock
  db.exec(`
    INSERT OR IGNORE INTO items (id, name, barcode, sale_price, purchase_price, category_id, unit_id, is_active)
    VALUES (1, 'صنف اختبار 1', '1001', 100, 50, 1, 1, 1)
  `);
  itemId1 = 1;

  db.exec(`
    INSERT OR IGNORE INTO items (id, name, barcode, sale_price, purchase_price, category_id, unit_id, is_active)
    VALUES (2, 'صنف اختبار 2', '1002', 200, 100, 1, 1, 1)
  `);
  itemId2 = 2;

  // Insert stock levels
  db.exec(`
    INSERT OR IGNORE INTO stock_levels (item_id, warehouse_id, quantity)
    VALUES (1, 1, 1000), (2, 1, 500)
  `);

  // Insert expense and revenue categories
  db.exec(`INSERT OR IGNORE INTO expense_categories (id, name) VALUES (1, 'TestCategory')`);
  db.exec(`INSERT OR IGNORE INTO revenue_categories (id, name) VALUES (1, 'TestRevenue')`);

  // Insert document sequences for doc number generation
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_sequences (type TEXT PRIMARY KEY, year INTEGER, last_seq INTEGER)
  `);
  db.exec(`
    INSERT OR IGNORE INTO document_sequences (type, year, last_seq)
    VALUES 
      ('pos_sale', 2026, 100),
      ('purchase_receipt', 2026, 100),
      ('expense', 2026, 100),
      ('revenue', 2026, 100),
      ('sales_return', 2026, 100),
      ('purchase_return', 2026, 100),
      ('payment', 2026, 100)
  `);

  // Insert settings_kv for doc prefixes
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings_kv (key TEXT PRIMARY KEY, value TEXT)
  `);
  db.exec(`
    INSERT OR IGNORE INTO settings_kv (key, value)
    VALUES 
      ('doc_prefix_pos_sale', 'INV'),
      ('doc_prefix_purchase_receipt', 'PUR'),
      ('doc_prefix_expense', 'EXP'),
      ('doc_prefix_revenue', 'REV'),
      ('doc_prefix_sales_return', 'SR'),
      ('doc_prefix_purchase_return', 'PR')
  `);
}

// ==================== CASH SALES TESTS ====================
describe("Cash Sales", function () {
  it("should create a cash sale invoice and reflect in treasury", async function () {
    const res = await request(app)
      .post("/api/invoices")
      .send({
        customer_id: null,
        lines: [
          { item_id: itemId1, quantity: 2, unit_price: 100, warehouse_id: 1 }
        ],
        payment_type: "cash",
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(200);

    // Check treasury balance increased
    const treasury = db.prepare("SELECT balance FROM treasuries WHERE id = ?").get(treasuryId);
    expect(treasury.balance).toBe(5200); // 5000 + 200
  });

  it("should show cash sale in daily summary", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today/summary");

    expect(res.status).toBe(200);
    expect(res.body.data.pos_cash_sales).toBe(200);
    expect(res.body.data.cash_in).toBeGreaterThanOrEqual(200);
  });
});

// ==================== INSTALLMENT SALES TESTS ====================
describe("Installment Sales", function () {
  let invoiceId;

  it("should create installment sale without initial payment", async function () {
    const res = await request(app)
      .post("/api/invoices")
      .send({
        customer_id: customerId,
        lines: [
          { item_id: itemId2, quantity: 1, unit_price: 200, warehouse_id: 1 }
        ],
        payment_type: "credit",
        amount_paid: 0,
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(200);
    invoiceId = res.body.data.id;
  });

  it("should NOT count unpaid installment as cash in treasury", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    // The installment cash should be 0 since no payment was made
    expect(res.body.data.pos_installment_cash).toBe(0);
  });

  it("should create payment allocation for installment", async function () {
    // Create a payment for the installment invoice
    const res = await request(app)
      .post("/api/payments")
      .send({
        party_type: "customer",
        party_id: customerId,
        amount: 100,
        method: "cash",
        treasury_id: treasuryId,
        allocations: [{ invoice_id: invoiceId, amount: 100 }]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("should count payment allocation as cash in treasury", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    // Now installment cash should be 100
    expect(res.body.data.pos_installment_cash).toBe(100);
  });
});

// ==================== MULTI-PAYMENT TESTS ====================
describe("Multi-Payment Sales", function () {
  it("should create multi-payment invoice with cash and bank portions", async function () {
    const res = await request(app)
      .post("/api/invoices")
      .send({
        customer_id: null,
        lines: [
          { item_id: itemId1, quantity: 3, unit_price: 100, warehouse_id: 1 }
        ],
        payment_type: "multi",
        payments: [
          { method_id: 1, method: "cash", amount: 150 },  // Cash portion
          { method_id: 2, method: "bank", amount: 150 }   // Bank portion
        ],
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(300);
  });

  it("should count only cash portion of multi-payment in treasury", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    // Multi-payment cash should be 150
    expect(res.body.data.pos_multi_cash).toBe(150);
  });
});

// ==================== TRANSACTION EXPLORER TESTS ====================
describe("Transaction Explorer", function () {
  it("should show correct cash_effect for installment invoice", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today/transactions");

    expect(res.status).toBe(200);
    
    // Find installment invoice
    const installmentTx = (res.body.data || []).find(t => t.payment_type === "credit" || t.payment_type === "installments");
    if (installmentTx) {
      // Cash effect should be 100 (from payment allocation), not full invoice total
      expect(installmentTx.cash_effect).toBe(100);
    }
  });

  it("should show correct cash_effect for multi-payment invoice", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today/transactions");

    expect(res.status).toBe(200);
    
    // Find multi-payment invoice
    const multiTx = (res.body.data || []).find(t => t.payment_type === "multi");
    if (multiTx) {
      // Cash effect should be 150 (cash portion only)
      expect(multiTx.cash_effect).toBe(150);
    }
  });
});

// ==================== PURCHASES TESTS ====================
describe("Purchases", function () {
  it("should create purchase and add to supplier debt (not cash out)", async function () {
    const res = await request(app)
      .post("/api/purchases")
      .send({
        supplier_id: supplierId,
        warehouse_id: 1,
        lines: [
          { item_id: itemId1, quantity: 5, unit_cost: 50, selling_price: 120 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(250);
  });

  it("should NOT count purchases as cash out (they are credit/payable)", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    // Purchases cash should be 0
    expect(res.body.data.purchases_cash).toBe(0);
    // But purchases_payable_total should be 250
    expect(res.body.data.purchases_payable_total).toBe(250);
  });

  it("should count supplier payment as cash out", async function () {
    const res = await request(app)
      .post("/api/payments")
      .send({
        party_type: "supplier",
        party_id: supplierId,
        amount: 100,
        method: "cash",
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);

    // Check treasury balance decreased
    const treasury = db.prepare("SELECT balance FROM treasuries WHERE id = ?").get(treasuryId);
    // Should have decreased by 100
    expect(treasury.balance).toBeLessThan(5350);
  });
});

// ==================== EXPENSES & REVENUES TESTS ====================
describe("Expenses & Revenues", function () {
  it("should create cash expense and count as cash out", async function () {
    const res = await request(app)
      .post("/api/expenses")
      .send({
        category_id: 1,
        amount: 50,
        payment_method: "cash",
        description: "Test expense",
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);
  });

  it("should create cash revenue and count as cash in", async function () {
    const res = await request(app)
      .post("/api/revenues")
      .send({
        category_id: 1,
        amount: 75,
        payment_method: "cash",
        description: "Test revenue",
        treasury_id: treasuryId
      });

    expect(res.status).toBe(201);
  });

  it("should show expenses and revenues in summary", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.expenses_cash).toBe(50);
    expect(res.body.data.revenues_cash).toBe(75);
  });
});

// ==================== SALES RETURNS TESTS ====================
describe("Sales Returns", function () {
  it("should create cash sales return and count as cash out", async function () {
    const res = await request(app)
      .post("/api/invoices/general-return")
      .send({
        customer_id: null,
        refund_method: "cash_back",
        lines: [
          { item_id: itemId1, quantity: 1, unit_price: 100, warehouse_id: 1 }
        ],
        reason: "test"
      });

    expect(res.status).toBe(200);
  });

  it("should show sales return cash in summary", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.sales_returns_cash).toBe(100);
  });
});

// ==================== DAILY SESSION LIFECYCLE TESTS ====================
describe("Daily Session Lifecycle", function () {
  it("should get today's session", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today");

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe("open");
  });

  it("should not allow closing without actual cash", async function () {
    const res = await request(app)
      .post("/api/daily-sessions/today/close")
      .send({ actual_cash: null });

    expect(res.status).toBe(400);
  });

  it("should close today's session", async function () {
    const res = await request(app)
      .post("/api/daily-sessions/today/close")
      .send({ actual_cash: 5000, notes: "Test close" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should show session as closed", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("closed");
  });

  it("should allow reopening today's closed session", async function () {
    const res = await request(app)
      .post(`/api/daily-sessions/${today}/reopen`)
      .send({ reason: "Test reopen" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should show session as open after reopen", async function () {
    const res = await request(app)
      .get("/api/daily-sessions/today");

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("open");
  });
});

// ==================== TOTAL CASH CALCULATION TESTS ====================
describe("Total Cash Calculation", function () {
  it("should correctly sum all cash in sources", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    const s = res.body.data;
    
    // Verify cash_in = pos_cash + installment_cash + multi_cash + collections + revenues + purchase_returns
    const expectedCashIn = 
      (s.pos_cash_sales || 0) +
      (s.pos_installment_cash || 0) +
      (s.pos_multi_cash || 0) +
      (s.customer_cash_collections || 0) +
      (s.revenues_cash || 0) +
      (s.purchase_returns_cash || 0);

    expect(s.cash_in).toBe(expectedCashIn);
  });

  it("should correctly sum all cash out sources", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    const s = res.body.data;
    
    // Verify cash_out = supplier_payments + expenses + sales_returns_cash + withdrawals
    const expectedCashOut = 
      (s.supplier_cash_payments || 0) +
      (s.expenses_cash || 0) +
      (s.sales_returns_cash || 0) +
      (s.withdrawals || 0);

    expect(s.cash_out).toBe(expectedCashOut);
  });

  it("should calculate expected cash correctly", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    const s = res.body.data;
    
    const expectedCash = s.opening_balance + s.cash_in - s.cash_out;
    expect(s.expected_cash).toBe(expectedCash);
  });
});

// ==================== NON-CASH CALCULATIONS TESTS ====================
describe("Non-Cash Calculations", function () {
  it("should track credit sales that reduce customer debt", async function () {
    const res = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(res.status).toBe(200);
    // Credit sales should be tracked separately
    expect(res.body.data.pos_credit_sales).toBeDefined();
  });

  it("should track sales returns that increase customer debt", async function () {
    // Create a credit note return
    const res = await request(app)
      .post("/api/invoices/general-return")
      .send({
        customer_id: customerId,
        refund_method: "credit_note",
        lines: [
          { item_id: itemId1, quantity: 1, unit_price: 100, warehouse_id: 1 }
        ],
        reason: "test credit note"
      });

    expect(res.status).toBe(200);

    const summaryRes = await request(app)
      .get(`/api/daily-sessions/today/summary`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summary.sales_returns_account).toBe(100);
  });
});

// ==================== CANCELLATION EXCLUSION TESTS ====================
describe("Payment-method movements exclude cancelled invoices", function () {
  it("drops a wallet movement when its invoice is voided", async function () {
    // A non-system, active wallet method whose name we will store on the payment row.
    db.exec(`INSERT OR IGNORE INTO payment_methods (id, name, type, is_system, is_active)
             VALUES (5, 'محفظة فودافون', 'wallet', 0, 1)`);

    // Create a real invoice via the API so void() has a valid target.
    const inv = await request(app).post("/api/invoices").send({
      customer_id: null,
      lines: [{ item_id: itemId1, quantity: 1, unit_price: 100, warehouse_id: 1 }],
      payment_type: "cash",
      treasury_id: treasuryId,
    });
    const invoiceId = inv.body.data.id;

    // Attach a wallet payment row to that invoice (matched by method NAME in the endpoint).
    db.prepare(`INSERT INTO payments (party_type, party_id, amount, method, invoice_id, created_at)
                VALUES ('customer', ?, 300, 'محفظة فودافون', ?, datetime('now'))`)
      .run(customerId, invoiceId);

    const before = await request(app).get("/api/daily-sessions/today/payment-methods");
    const mBefore = (before.body.data || []).find((m) => m.id === 5);
    expect(mBefore).toBeDefined();
    expect(mBefore.in).toBe(300);

    // Void the invoice (soft: sets status='cancelled').
    const voided = await request(app).post(`/api/invoices/${invoiceId}/void`).send({ reason: "test" });
    expect(voided.status).toBe(200);

    const after = await request(app).get("/api/daily-sessions/today/payment-methods");
    const mAfter = (after.body.data || []).find((m) => m.id === 5);
    expect(mAfter.in).toBe(0);
  });
});
