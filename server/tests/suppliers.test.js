const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb } = require("../src/config/database");

let app;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-suppliers-"));
  initDb(path.join(dir, "suppliers.db"));
  app = createApp();
});

describe("Suppliers Routes", () => {
  it("GET /api/suppliers returns empty list", async () => {
    const res = await request(app).get("/api/suppliers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/suppliers creates a supplier", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .send({ name: "مورد المواد الغذائية", phone: "0509876543", code: "SUP-001" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("مورد المواد الغذائية");
  });

  it("GET /api/suppliers returns the new supplier", async () => {
    const res = await request(app).get("/api/suppliers");
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
