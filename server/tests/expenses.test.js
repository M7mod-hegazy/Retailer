const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-expenses-"));
  initDb(path.join(dir, "expenses.db"));
  app = createApp();
});

describe("Expenses Routes", () => {
  let expenseId;

  it("GET /api/expenses returns empty list", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/expenses creates an expense", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .send({ description: "إيجار المحل", amount: 3000, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(3000);
    expenseId = res.body.data.id;
  });

  it("GET /api/expenses shows the created expense", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.body.data.some(e => e.id === expenseId)).toBe(true);
  });

  // Expense DELETE does not exist in the route (no endpoint) — verify that correctly
  it("No DELETE endpoint responds 404 for unknown paths", async () => {
    const res = await request(app).delete(`/api/expenses/${expenseId}`);
    expect(res.status).toBe(404);
  });
});
