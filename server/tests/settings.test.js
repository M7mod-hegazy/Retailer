const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const { UserModel } = require("../src/models/user.model");
const jwt = require("jsonwebtoken");

let app;
let adminToken;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-settings-"));
  initDb(path.join(dir, "settings.db"));
  const admin = UserModel.create({
    username: "settings-admin",
    password: "Secret123!",
    role: "admin",
    full_name: "Settings Admin",
  });
  adminToken = jwt.sign({ sub: admin.id, role: admin.role }, process.env.JWT_SECRET || "dev-secret");
  app = createApp();
});

describe("Settings Routes", () => {
  it("rejects settings payload without auth", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(401);
  });

  it("returns settings payload for an authenticated admin", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id", 1);
  });

  it("rejects license validation when key is missing", async () => {
    const res = await request(app).post("/api/settings/validate-license").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

});
