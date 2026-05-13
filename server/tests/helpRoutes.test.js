const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { initDb, getDb, setDb } = require("../src/config/database");
const { issueToken } = require("../src/middleware/auth");

describe("help routes", () => {
  let app;
  let token;
  let userId;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-help-"));
    initDb(path.join(dir, "help.db"));
    app = createApp();

    const db = getDb();
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)")
      .run("help-user", bcrypt.hashSync("secret123", 10), "admin");
    userId = Number(info.lastInsertRowid);
    token = issueToken({ id: userId, role: "admin" });
  });

  test("requires auth for state", async () => {
    const res = await request(app).get("/api/help/state");
    expect(res.status).toBe(401);
  });

  test("marks page as toured and returns it in state", async () => {
    await request(app)
      .patch("/api/help/state/tour/pos_sales")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    const res = await request(app).get("/api/help/state").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.toured_pages.pos_sales).toBe(true);
  });

  test("can disable tours and tooltips globally", async () => {
    await request(app).patch("/api/help/state/disable-tours").set("Authorization", `Bearer ${token}`).send({});
    await request(app).patch("/api/help/state/disable-tooltips").set("Authorization", `Bearer ${token}`).send({});

    const res = await request(app).get("/api/help/state").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.tours_disabled_globally).toBe(true);
    expect(res.body.data.tooltips_disabled_globally).toBe(true);
  });

  test("admin reset clears user help state", async () => {
    const db = getDb();
    db.prepare("INSERT INTO user_help_state (user_id, page_key, completed) VALUES (?, ?, 1)").run(userId, "pos_sales");

    await request(app).patch("/api/help/state/reset").set("Authorization", `Bearer ${token}`).send({ user_id: userId });

    const rows = db.prepare("SELECT * FROM user_help_state WHERE user_id = ?").all(userId);
    expect(rows.length).toBe(0);
  });
});
