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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-purchaseOrders-"));
  initDb(path.join(dir, "pos.db"));
  app = createApp();
  token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  const db = getDb();
  db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("فئة");
  db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs");
  db.prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, ?)").run("مستودع رئيسي", "WH-001", 1);
  const sup = db.prepare("INSERT INTO suppliers (name, phone) VALUES (?, ?)").run("مورد PO", "0500000002");
  supplierId = sup.lastInsertRowid;
  const item = db.prepare("INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, 1, 1)").run("صنف PO", "PO-001", 50, 30);
  itemId = item.lastInsertRowid;
});

describe("Purchase Orders Routes", () => {
  let poId;

  it("GET /api/purchase-orders returns empty list", async () => {
    const res = await request(app).get("/api/purchase-orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/purchase-orders creates a PO", async () => {
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId,
        lines: [{ item_id: itemId, quantity: 5, unit_cost: 30 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    poId = res.body.data.id;
  });

  it("PATCH /api/purchase-orders/:id/approve approves the PO", async () => {
    const res = await request(app).patch(`/api/purchase-orders/${poId}/approve`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
  });

  it("PATCH /api/purchase-orders/:id/receive receives the PO and creates a purchase", async () => {
    const res = await request(app)
      .patch(`/api/purchase-orders/${poId}/receive`)
      .set("Authorization", `Bearer ${token}`)
      .send({ warehouse_id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("received");
  });
});
