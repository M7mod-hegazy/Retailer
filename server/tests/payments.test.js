const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { initDb, setDb, getDb } = require("../src/config/database");
const { createApp } = require("../src/app");

describe("payments", () => {
  let app;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-payments-"));
    initDb(path.join(dir, "payments.db"));
    app = createApp();
    const db = getDb();
    db.prepare("INSERT INTO customers (name, opening_balance, is_active) VALUES ('Cust', 0, 1)").run();
    db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('Main Treasury', 'T1', 0)").run();
    db.prepare("UPDATE settings SET default_treasury_id = 1 WHERE id = 1").run();
  });

  test("accepts a large integer payment without fractional drift", async () => {
    const response = await request(app).post("/api/payments").send({
      party_type: "customer",
      party_id: 1,
      amount: 1000000001,
      method: "cash",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(1000000001);
  });

  test("rejects payment when allocated amount exceeds payment", async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("INV-000001", 1, 1000, 0, 1000, "credit", "unpaid");

    const response = await request(app).post("/api/payments").send({
      party_type: "customer",
      party_id: 1,
      amount: 500,
      method: "cash",
      allocations: [{ invoice_id: 1, amount: 600 }],
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cannot exceed payment amount/i);
  });

  test("auto allocates payment to oldest open invoice", async () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("INV-000001", 1, 1000, 0, 1000, "credit", "unpaid");

    const response = await request(app).post("/api/payments").send({
      party_type: "customer",
      party_id: 1,
      amount: 400,
      method: "cash",
      treasury_id: 1,
    });

    expect(response.status).toBe(201);
    const allocation = db.prepare("SELECT * FROM payment_allocations WHERE payment_id = ?").get(response.body.data.id);
    expect(allocation.amount).toBe(400);
  });
});
