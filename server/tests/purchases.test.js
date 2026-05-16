const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb } = require("../src/config/database");

let app;
let token;
let itemId, supplierId;

beforeAll(() => {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-purchases-"));
  initDb(path.join(dir, "purchases.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  const db = getDb();
  db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("فئة");
  db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs");
  db.prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, ?)").run("مستودع رئيسي", "WH-001", 1);
  const sup = db.prepare("INSERT INTO suppliers (name, phone) VALUES (?, ?)").run("مورد تجريبي", "0500000001");
  supplierId = sup.lastInsertRowid;
  const item = db.prepare("INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, 1, 1)").run("صنف مشتريات", "PURCH-001", 50, 30);
  itemId = item.lastInsertRowid;
});

describe("Purchases Routes", () => {
  it("GET /api/purchases returns empty list", async () => {
    const res = await request(app).get("/api/purchases").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/purchases creates a purchase", async () => {
    const res = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId,
        warehouse_id: 1,
        payment_type: "cash",
        lines: [{ item_id: itemId, quantity: 10, unit_cost: 30 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.data.total).toBe(300);
  });

  it("GET /api/purchases shows the created purchase", async () => {
    const res = await request(app).get("/api/purchases").set("Authorization", `Bearer ${token}`);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
