const express = require("express");
const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { auditMutation } = require("../src/middleware/audit");
const { UserModel } = require("../src/models/user.model");

describe("auditMutation middleware", () => {
  beforeAll(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-audit-"));
    initDb(path.join(dir, "test.db"));
    UserModel.create({ username: "audituser", password: "pass", role: "cashier" });
  });

  function createApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use(auditMutation);
    app.post("/action", (req, res) => {
      req.audit(req.body.action, req.body.resource, req.body.payload, req.body.description);
      res.json({ success: true });
    });
    return app;
  }

  it("attaches req.audit function", async () => {
    const user = UserModel.findByUsername("audituser");
    const res = await request(createApp(user)).post("/action").send({ action: "test", resource: "test" });
    expect(res.status).toBe(200);
  });

  it("inserts a row into audit_logs when req.audit is called", async () => {
    const user = UserModel.findByUsername("audituser");
    const db = getDb();
    const before = db.prepare("SELECT COUNT(*) as cnt FROM audit_logs WHERE action = ?").get("create_item");
    await request(createApp(user)).post("/action").send({
      action: "create_item",
      resource: "items",
      payload: { id: 1 },
      description: "Created a new item",
    });
    const after = db.prepare("SELECT COUNT(*) as cnt FROM audit_logs WHERE action = ?").get("create_item");
    expect(Number(after.cnt)).toBe(Number(before.cnt) + 1);
  });

  it("records the correct audit data", async () => {
    const user = UserModel.findByUsername("audituser");
    const db = getDb();
    await request(createApp(user)).post("/action").send({
      action: "update_price",
      resource: "items",
      payload: { item_id: 5, old_price: 100, new_price: 120 },
      description: "Price update",
    });
    const row = db.prepare("SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1").get("update_price");
    expect(row.user_id).toBe(user.id);
    expect(row.resource).toBe("items");
    expect(JSON.parse(row.payload_json)).toEqual({ item_id: 5, old_price: 100, new_price: 120 });
    expect(row.description).toBe("Price update");
  });

  it("handles null user gracefully", async () => {
    const app = express();
    app.use(express.json());
    app.use(auditMutation);
    app.post("/action", (req, res) => {
      req.audit("system_action", "system", {});
      res.json({ success: true });
    });
    const db = getDb();
    await request(app).post("/action").send({});
    const row = db.prepare("SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1").get("system_action");
    expect(row.user_id).toBeNull();
  });

  it("handles empty payload", async () => {
    const user = UserModel.findByUsername("audituser");
    const db = getDb();
    await request(createApp(user)).post("/action").send({
      action: "view_report",
      resource: "reports",
    });
    const row = db.prepare("SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1").get("view_report");
    expect(row.user_id).toBe(user.id);
    expect(JSON.parse(row.payload_json)).toEqual({});
  });
});
