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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-customers-"));
  initDb(path.join(dir, "customers.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Customers Routes", () => {
  let customerId;

  it("GET /api/customers returns empty list", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/customers creates a customer", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "أحمد محمد", phone: "0501234567", code: "CUST-001", credit_limit: 1000 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("أحمد محمد");
    customerId = res.body.data.id;
  });

  it("GET /api/customers returns the new customer", async () => {
    const res = await request(app).get("/api/customers").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBe("أحمد محمد");
  });

  it("GET /api/customers/:id/loyalty returns loyalty data", async () => {
    const res = await request(app).get(`/api/customers/${customerId}/loyalty`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.loyalty_points).toBeDefined();
    expect(res.body.data.history).toBeDefined();
  });
});
