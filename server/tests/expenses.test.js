const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;
let token;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-expenses-"));
  initDb(path.join(dir, "expenses.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Expenses Routes", () => {
  let expenseId;

  it("GET /api/expenses returns empty list", async () => {
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/expenses creates an expense", async () => {
    const res = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "إيجار المحل", amount: 3000, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(3000);
    expenseId = res.body.data.id;
  });

  it("GET /api/expenses shows the created expense", async () => {
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.some(e => e.id === expenseId)).toBe(true);
  });

  it("DELETE /api/expenses/:id deletes the expense", async () => {
    const res = await request(app).delete(`/api/expenses/${expenseId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
