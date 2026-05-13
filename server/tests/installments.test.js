const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let invoiceId;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-installments-"));
  initDb(path.join(dir, "installments.db"));
  app = createApp();

  const db = getDb();
  db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("فئة");
  db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs");
  const custInfo = db.prepare("INSERT INTO customers (name) VALUES (?)").run("عميل تقسيط");
  // Seed a credit invoice directly (bypasses invoiceService FK needs)
  const invInfo = db.prepare(
    "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run("INV-TEST-01", custInfo.lastInsertRowid, 200, 0, 200, "credit", "unpaid");
  invoiceId = invInfo.lastInsertRowid;
});

describe("Installments Routes", () => {
  let installmentId;

  it("POST /api/installments creates an installment", async () => {
    const res = await request(app)
      .post("/api/installments")
      .send({
        invoice_id: invoiceId,
        installment_amount: 100,
        due_date: "2026-05-15",
        note: "First payment"
      });
    expect(res.status).toBe(201);
    expect(res.body.data.installment_amount).toBe(100);
    installmentId = res.body.data.id;
  });

  it("GET /api/installments/:invoice_id lists installments", async () => {
    const res = await request(app).get(`/api/installments/${invoiceId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it("PATCH /api/installments/:id/pay marks installment paid", async () => {
    const res = await request(app)
      .patch(`/api/installments/${installmentId}/pay`)
      .send({ paid_at: "2026-05-16" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("paid");
  });
});
