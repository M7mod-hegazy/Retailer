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

  it("persists setup progress draft", async () => {
    const draft = { settings: { company_name: "ACME", branch_name: "Main", branch_code: "MN" } };
    const res = await request(app).post("/api/settings/setup-progress").send({ step: 2, draft });
    expect(res.status).toBe(200);
    expect(res.body.data.step).toBe(2);

    const persisted = getDb().prepare("SELECT setup_step, setup_payload_json FROM settings WHERE id = 1").get();
    expect(persisted.setup_step).toBe(2);
    expect(JSON.parse(persisted.setup_payload_json).settings.company_name).toBe("ACME");
  });
});
