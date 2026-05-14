const express = require("express");
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { requirePermission, requirePagePermission } = require("../src/middleware/permission");

describe("requirePermission middleware", () => {
  function createAppWithUser(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get("/items", requirePermission("items:view"), (_req, res) => res.json({ success: true }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ success: false, message: err.message });
    });
    return app;
  }

  it("allows request when user has the exact permission flag", async () => {
    const res = await request(createAppWithUser({ role: "manager" })).get("/items");
    expect(res.status).toBe(200);
  });

  it("allows admin with wildcard `*` to access any permission", async () => {
    const res = await request(createAppWithUser({ role: "admin" })).get("/items");
    expect(res.status).toBe(200);
  });

  it("allows access when user has module-level wildcard", async () => {
    const res = await request(createAppWithUser({ role: "manager" })).get("/items");
    expect(res.status).toBe(200);
  });

  it("denies access when user lacks the permission", async () => {
    const res = await request(createAppWithUser({ role: "viewer" })).get("/items");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/ليس لديك صلاحية/);
  });

  it("denies access with empty role", async () => {
    const res = await request(createAppWithUser({ role: "unknown" })).get("/items");
    expect(res.status).toBe(403);
  });

  it("allows access when user has permission_overrides containing the flag", async () => {
    const res = await request(
      createAppWithUser({ role: "viewer", permission_overrides: ["items:view"] }),
    ).get("/items");
    expect(res.status).toBe(200);
  });
});

describe("requirePagePermission middleware", () => {
  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-permission-page-"));
    initDb(path.join(dir, "test.db"));
  });

  function createPageApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get("/page", requirePagePermission("pos", "create"), (_req, res) => res.json({ success: true }));
    return app;
  }

  it("allows dev role to access any page", async () => {
    const res = await request(createPageApp({ id: 1, role: "dev" })).get("/page");
    expect(res.status).toBe(200);
  });

  it("allows admin role to access any page", async () => {
    const res = await request(createPageApp({ id: 1, role: "admin" })).get("/page");
    expect(res.status).toBe(200);
  });

  it("allows user with matching page permission", async () => {
    const res = await request(
      createPageApp({ id: 1, role: "cashier", page_permissions: { pos: ["create"] } }),
    ).get("/page");
    expect(res.status).toBe(200);
  });

  it("denies user without matching page permission", async () => {
    const res = await request(
      createPageApp({ id: 1, role: "viewer", page_permissions: { dashboard: ["view"] } }),
    ).get("/page");
    expect(res.status).toBe(403);
  });

  it("returns 401 when no user on request", async () => {
    const app = express();
    app.use(express.json());
    app.get("/page", requirePagePermission("pos", "create"), (_req, res) => res.json({ success: true }));
    const res = await request(app).get("/page");
    expect(res.status).toBe(401);
  });

  it("parses page_permissions from JSON string", async () => {
    const user = {
      id: 1,
      role: "cashier",
      page_permissions: JSON.stringify({ pos: ["create"] }),
    };
    const res = await request(createPageApp(user)).get("/page");
    expect(res.status).toBe(200);
  });

  it("returns empty object on parse error of page_permissions string", async () => {
    const user = {
      id: 1,
      role: "cashier",
      page_permissions: "not-valid-json{",
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get("/page", requirePagePermission("pos", "create"), (_req, res) => res.json({ success: true }));
    const res = await request(app).get("/page");
    expect(res.status).toBe(403);
  });

  it("falls back to settings_kv default_user_permissions when page_permissions is absent", async () => {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO settings_kv (key, value) VALUES (?, ?)")
      .run("default_user_permissions", JSON.stringify({ pos: ["create"] }));
    const user = { id: 1, role: "cashier" };
    const res = await request(createPageApp(user)).get("/page");
    expect(res.status).toBe(200);
  });
});
