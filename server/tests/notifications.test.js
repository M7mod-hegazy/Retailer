const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const { issueToken } = require("../src/middleware/auth");

describe("Notifications Routes", () => {
  let app;
  let token;
  let userId;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-notif-"));
    initDb(path.join(dir, "notif.db"));
    app = createApp();

    const db = getDb();
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)")
      .run("notif-user", "$2a$10$hash", "admin");
    userId = Number(info.lastInsertRowid);
    token = issueToken({ id: userId, role: "admin" });
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("returns empty list initially", async () => {
    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns notifications", async () => {
    const db = getDb();
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)")
      .run(userId, "Test Notif", "Test message", 0);
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)")
      .run(userId, "Read Notif", "Read message", 1);

    const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
  });

  it("marks notification as read", async () => {
    const db = getDb();
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)")
      .run(userId, "Notif", "Msg", 0);
    const res = await request(app).post("/api/notifications/1/read").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const updated = db.prepare("SELECT is_read FROM notifications WHERE id=1").get();
    expect(updated.is_read).toBe(1);
  });

  it("marks all notifications as read", async () => {
    const db = getDb();
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)").run(userId, "N1", "M1", 0);
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)").run(userId, "N2", "M2", 0);
    const res = await request(app).post("/api/notifications/read-all").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const unread = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE is_read=0").get().c;
    expect(unread).toBe(0);
  });

  it("dismisses (deletes) a notification", async () => {
    const db = getDb();
    db.prepare("INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, ?)")
      .run(userId, "N1", "M1", 0);
    const res = await request(app).delete("/api/notifications/1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS c FROM notifications").get().c).toBe(0);
  });
});
