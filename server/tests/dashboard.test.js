const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");
const { issueToken } = require("../src/middleware/auth");

describe("Dashboard Routes", () => {
  let app;
  let token;

  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-dash-"));
    initDb(path.join(dir, "dash.db"));
    app = createApp();

    const db = getDb();
    db.prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)")
      .run("dash-user", "$2a$10$hash", "admin");
    token = issueToken({ id: 1, role: "admin" });
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns dashboard metrics with zeros when empty", async () => {
    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      todaySales: 0,
      weekSales: 0,
      itemsCount: 0,
      customersCount: 0,
      upcomingInstallments: 0,
    });
  });

  it("returns real data when records exist", async () => {
    const db = getDb();
    db.prepare("INSERT INTO items (name, sale_price, purchase_price, is_active) VALUES (?, ?, ?, 1)").run("Item A", 10, 5);
    db.prepare("INSERT INTO customers (name, phone, is_active) VALUES (?, ?, 1)").run("Customer A", "123");

    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.itemsCount).toBe(1);
    expect(res.body.data.customersCount).toBe(1);
  });

  it("returns null openShift when no shifts exist", async () => {
    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.openShift).toBeNull();
  });

  it("returns open shift when exists", async () => {
    const db = getDb();
    db.prepare("INSERT INTO shifts (user_id, opened_at, status, opening_balance) VALUES (?, ?, ?, ?)")
      .run(1, new Date().toISOString(), "open", 100);
    const res = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.openShift).not.toBeNull();
    expect(res.body.data.openShift.status).toBe("open");
  });
});
