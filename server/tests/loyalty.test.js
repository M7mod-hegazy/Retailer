const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let customerId;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-loyalty-"));
  initDb(path.join(dir, "loyalty.db"));
  app = createApp();

  const db = getDb();
  const bcrypt = require("bcryptjs");
  const jwt = require("jsonwebtoken");
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, full_name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)").run("admin", "Admin", hash, "admin", 1);
  // Seed a customer with 100 loyalty_points (column added by migration 014)
  try {
    const custInfo = db.prepare("INSERT INTO customers (name, loyalty_points) VALUES (?, ?)").run("عميل مخلص", 100);
    customerId = custInfo.lastInsertRowid;
  } catch (e) {
    // loyalty_points column may not exist if migration hasn't run — insert without it
    const custInfo = db.prepare("INSERT INTO customers (name) VALUES (?)").run("عميل مخلص");
    customerId = custInfo.lastInsertRowid;
    db.prepare("UPDATE customers SET loyalty_points = 100 WHERE id = ?").run(customerId);
  }
});

function getAdminToken() {
  const jwt = require("jsonwebtoken");
  const db = getDb();
  const user = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  return jwt.sign({ sub: user.id, role: "admin" }, process.env.JWT_SECRET || "test-secret");
}

describe("Loyalty Routes", () => {
  it("POST /api/loyalty/redeem deducts points", async () => {
    const token = getAdminToken();
    const res = await request(app)
      .post("/api/loyalty/redeem")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_id: customerId, points: 30, note: "Redemption test" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const db = getDb();
    const cust = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
    expect(cust.loyalty_points).toBe(70);
  });

  it("POST /api/loyalty/redeem fails when insufficient points", async () => {
    const token = getAdminToken();
    const res = await request(app)
      .post("/api/loyalty/redeem")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_id: customerId, points: 99999 });
    expect(res.status).not.toBe(200);
  });

  it("POST /api/loyalty/adjust earns points (admin only)", async () => {
    const token = getAdminToken();
    const res = await request(app)
      .post("/api/loyalty/adjust")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer_id: customerId, points: 50, type: "earn", note: "Bonus" });
    expect(res.status).toBe(200);

    const db = getDb();
    const cust = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
    expect(cust.loyalty_points).toBe(120);
  });

  it("GET /api/loyalty/report returns totals", async () => {
    const token = getAdminToken();
    const res = await request(app)
      .get("/api/loyalty/report")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalCirculating).toBeDefined();
  });
});
