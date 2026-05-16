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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-revenues-"));
  initDb(path.join(dir, "revenues.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Revenues Routes", () => {
  let revenueId;

  it("GET /api/revenues returns empty list", async () => {
    const res = await request(app).get("/api/revenues").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/revenues creates a revenue entry", async () => {
    const res = await request(app)
      .post("/api/revenues")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "بيع قطع غيار", amount: 500, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(500);
    revenueId = res.body.data.id;
  });

  it("GET /api/revenues shows the created revenue", async () => {
    const res = await request(app).get("/api/revenues").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.some(r => r.id === revenueId)).toBe(true);
  });

  it("DELETE /api/revenues/:id deletes the revenue", async () => {
    const res = await request(app).delete(`/api/revenues/${revenueId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
