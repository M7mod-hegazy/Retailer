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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-suppliers-"));
  initDb(path.join(dir, "suppliers.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
});

describe("Suppliers Routes", () => {
  it("GET /api/suppliers returns empty list", async () => {
    const res = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/suppliers creates a supplier", async () => {
    const res = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "مورد المواد الغذائية", phone: "0509876543", code: "SUP-001" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("مورد المواد الغذائية");
  });

  it("GET /api/suppliers returns the new supplier", async () => {
    const res = await request(app).get("/api/suppliers").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
