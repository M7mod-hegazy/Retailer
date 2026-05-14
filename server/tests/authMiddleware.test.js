const express = require("express");
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { initDb, getDb, setDb } = require("../src/config/database");
const { issueToken, authRequired, requireRole, verifyPin } = require("../src/middleware/auth");
const { UserModel } = require("../src/models/user.model");

describe("issueToken", () => {
  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-issueToken-"));
    initDb(path.join(dir, "test.db"));
    UserModel.create({ username: "tokenuser", password: "pass", role: "cashier" });
  });

  it("returns a valid JWT containing user id and role", () => {
    const user = UserModel.findByUsername("tokenuser");
    const token = issueToken(user);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.sub).toBe(user.id);
    expect(decoded.role).toBe("cashier");
  });

  it("produces a string token", () => {
    const user = UserModel.findByUsername("tokenuser");
    const token = issueToken(user);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });
});

describe("authRequired middleware", () => {
  let app;

  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-authRequired-"));
    initDb(path.join(dir, "test.db"));
    UserModel.create({ username: "activeuser", password: "pass", role: "cashier" });
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(authRequired);
    app.get("/protected", (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/غير مصرح/);
  });

  it("returns 401 when token is not Bearer format", async () => {
    const res = await request(app).get("/protected").set("Authorization", "NotBearer token");
    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed token", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/غير صالح/);
  });

  it("allows request with valid token", async () => {
    const user = UserModel.findByUsername("activeuser");
    const token = issueToken(user);
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("sets req.user for authenticated requests", async () => {
    const user = UserModel.findByUsername("activeuser");
    const token = issueToken(user);
    const customApp = express();
    customApp.use(express.json());
    customApp.use(authRequired);
    customApp.get("/me", (req, res) => res.json({ user: req.user }));
    customApp.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    const res = await request(customApp).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.role).toBe("cashier");
  });

  it("returns 401 for inactive user", async () => {
    const inactive = UserModel.create({ username: "inactiveuser", password: "pass", role: "viewer" });
    UserModel.update(inactive.id, { is_active: 0 });
    const token = issueToken(inactive);
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/غير نشط/);
  });
});

describe("requireRole middleware", () => {
  function createRoleApp(role) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { role }; next(); });
    app.get("/admin", requireRole("admin"), (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    return app;
  }

  it("allows request when role matches", async () => {
    const res = await request(createRoleApp("admin")).get("/admin");
    expect(res.status).toBe(200);
  });

  it("allows admin to access any role-gated route", async () => {
    const res = await request(createRoleApp("admin")).get("/admin");
    expect(res.status).toBe(200);
  });

  it("allows dev to access any role-gated route", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { role: "dev" }; next(); });
    app.get("/admin", requireRole("admin"), (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    const res = await request(app).get("/admin");
    expect(res.status).toBe(200);
  });

  it("returns 403 when role does not match", async () => {
    const res = await request(createRoleApp("cashier")).get("/admin");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/صلاحيات أعلى/);
  });

  it("returns 403 when no user is set", async () => {
    const app = express();
    app.use(express.json());
    app.get("/admin", requireRole("admin"), (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    const res = await request(app).get("/admin");
    expect(res.status).toBe(403);
  });
});

describe("verifyPin middleware", () => {
  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-verifyPin-"));
    initDb(path.join(dir, "test.db"));
    const db = getDb();
    db.prepare("INSERT INTO users (username, password_hash, role, pin_code, is_active) VALUES (?, ?, ?, ?, ?)")
      .run("supervisor", "hash", "admin", "1234", 1);
    db.prepare("INSERT INTO users (username, password_hash, role, pin_code, is_active) VALUES (?, ?, ?, ?, ?)")
      .run("inactive-supervisor", "hash", "admin", "9999", 0);
  });

  function createPinApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 1, role: "cashier" }; next(); });
    app.get("/supervised", verifyPin, (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, code: err.code, message: err.message });
    });
    return app;
  }

  it("returns 403 when PIN header is missing", async () => {
    const res = await request(createPinApp()).get("/supervised");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SUPERVISOR_PIN_REQUIRED");
  });

  it("returns 403 for incorrect PIN", async () => {
    const res = await request(createPinApp()).get("/supervised").set("x-supervisor-pin", "wrong");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/غير صحيح/);
  });

  it("allows request with correct supervisor PIN", async () => {
    const res = await request(createPinApp()).get("/supervised").set("x-supervisor-pin", "1234");
    expect(res.status).toBe(200);
  });

  it("sets supervisorContext on req when PIN is valid", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 1, role: "cashier" }; next(); });
    app.get("/supervised", verifyPin, (req, res) => res.json({ ctx: req.supervisorContext }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    const res = await request(app).get("/supervised").set("x-supervisor-pin", "1234");
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeTruthy();
  });
});
