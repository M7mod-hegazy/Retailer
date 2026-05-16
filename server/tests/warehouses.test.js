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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-warehouses-"));
  initDb(path.join(dir, "warehouses.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Warehouses Routes", () => {
  let warehouseId;

  it("GET /api/warehouses returns a list (may or may not have seeded data)", async () => {
    const res = await request(app).get("/api/warehouses").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/warehouses creates a warehouse", async () => {
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "مستودع الفرع الرئيسي", code: "WH-001", is_default: true });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("مستودع الفرع الرئيسي");
    warehouseId = res.body.data.id;
  });

  it("POST /api/warehouses creates a second warehouse", async () => {
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "مستودع الفرع الثاني", code: "WH-002" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("مستودع الفرع الثاني");
  });

  it("GET /api/warehouses shows all warehouses", async () => {
    const res = await request(app).get("/api/warehouses").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.some(w => w.id === warehouseId)).toBe(true);
  });
});
