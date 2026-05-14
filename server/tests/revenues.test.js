const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-revenues-"));
  initDb(path.join(dir, "revenues.db"));
  app = createApp();
});

describe("Revenues Routes", () => {
  let revenueId;

  it("GET /api/revenues returns empty list", async () => {
    const res = await request(app).get("/api/revenues");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/revenues creates a revenue entry", async () => {
    const res = await request(app)
      .post("/api/revenues")
      .send({ description: "بيع قطع غيار", amount: 500, payment_method: "cash" });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(500);
    revenueId = res.body.data.id;
  });

  it("GET /api/revenues shows the created revenue", async () => {
    const res = await request(app).get("/api/revenues");
    expect(res.body.data.some(r => r.id === revenueId)).toBe(true);
  });

  // No DELETE endpoint — verify unknown routes 404
  it("No DELETE endpoint responds 404", async () => {
    const res = await request(app).delete(`/api/revenues/${revenueId}`);
    expect(res.status).toBe(404);
  });
});
