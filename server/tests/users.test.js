const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let app;
let adminToken;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-users-"));
  initDb(path.join(dir, "users.db"));
  app = createApp();

  // Seed admin user
  const db = getDb();
  const hash = bcrypt.hashSync("admin123", 10);
  const info = db.prepare("INSERT INTO users (username, full_name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)").run("admin", "Admin", hash, "admin", 1);
  adminToken = jwt.sign({ sub: info.lastInsertRowid, role: "admin" }, "test-secret");
});

describe("Users Routes", () => {
  let userId;

  it("GET /api/users requires auth", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("GET /api/users returns users list when authenticated", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/users creates a new user", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "cashier1", full_name: "كاشير تجريبي", password: "pass1234", role: "cashier" });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe("cashier1");
    userId = res.body.data.id;
  });

  it("PUT /api/users/:id updates user role", async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "branch_manager", is_active: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("branch_manager");
  });
});
