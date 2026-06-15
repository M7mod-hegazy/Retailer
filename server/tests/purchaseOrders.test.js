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

  it("GET /api/purchase-orders accepts search (product/code), status=open and date range without error", async () => {
    const res = await request(app)
      .get("/api/purchase-orders?search=صنف&status=open&date_from=2020-01-01&date_to=2030-12-31")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /api/purchase-orders creates a PO and persists unit_id", async () => {
    const res = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId,
        warehouse_id: 1,
        lines: [{ item_id: itemId, quantity: 5, unit_cost: 30, unit_id: 1 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    poId = res.body.data.id;
  });

  it("GET /api/purchase-orders/:id returns line unit_id, unit_name and header warehouse_id", async () => {
    const res = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lines[0].unit_id).toBe(1);
    expect(res.body.data.lines[0].unit_name).toBe("قطعة");
    expect(res.body.data.warehouse_id).toBe(1);
  });

  it("PATCH /api/purchase-orders/:id/approve approves the PO", async () => {
    const res = await request(app).patch(`/api/purchase-orders/${poId}/approve`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
  });

  it("PUT /api/purchase-orders/:id edits the order (lines replaced) before receiving", async () => {
    const res = await request(app)
      .put(`/api/purchase-orders/${poId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ supplier_id: supplierId, warehouse_id: 1, lines: [{ item_id: itemId, quantity: 9, unit_cost: 33, unit_id: 1, selling_price: 60, wholesale_price: 45 }] });
    expect(res.status).toBe(200);
    const detail = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(detail.body.data.lines.length).toBe(1);
    expect(detail.body.data.lines[0].quantity).toBe(9);
    expect(detail.body.data.lines[0].selling_price).toBe(60);
  });

  it("GET search by product returns matched_lines (name + code + quantity)", async () => {
    const res = await request(app).get("/api/purchase-orders?search=صنف").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.data.find(o => o.id === poId);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.matched_lines)).toBe(true);
    expect(found.matched_lines[0].name).toContain("صنف");
    expect(found.matched_lines[0].quantity).toBe(9);
    expect(found.matched_lines[0].code).toBeTruthy();
  });
});
