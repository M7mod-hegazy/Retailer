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

  it("POST /api/purchases linked to a PO tags source and advances PO received qty/status", async () => {
    // Create a PO with 5 units
    const poRes = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ supplier_id: supplierId, warehouse_id: 1, lines: [{ item_id: itemId, quantity: 5, unit_cost: 30, unit_id: 1 }] });
    const poId = poRes.body.data.id;
    const poDetail = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    const poLineId = poDetail.body.data.lines[0].id;

    // Partially receive 2 via a purchase invoice
    const buyRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 2, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    expect(buyRes.status).toBe(201);
    expect(buyRes.body.data.source_purchase_order_id).toBe(poId);

    const afterPartial = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(afterPartial.body.data.status).toBe("partially_received");
    expect(afterPartial.body.data.lines[0].received_quantity).toBe(2);

    // Over-receive guard: receiving 99 more must be rejected
    const overRes = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 99, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    expect(overRes.status).toBe(400);

    // Receive the remaining 3 → fully received
    await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "cash",
        source_purchase_order_id: poId,
        lines: [{ item_id: itemId, quantity: 3, unit_cost: 30, purchase_order_line_id: poLineId }],
      });
    const afterFull = await request(app).get(`/api/purchase-orders/${poId}`).set("Authorization", `Bearer ${token}`);
    expect(afterFull.body.data.status).toBe("received");
  });

  it("PUT /api/purchases/:id → cash + null supplier truly detaches the supplier", async () => {
    // Credit purchase bound to the supplier.
    const created = await request(app)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: supplierId, warehouse_id: 1, payment_method: "credit",
        lines: [{ item_id: itemId, quantity: 2, unit_cost: 30 }],
      });
    expect(created.status).toBe(201);
    const purchaseId = created.body.data.id;

    // Edit → cash and explicitly remove the supplier (client sends supplier_id: null).
    const edited = await request(app)
      .put(`/api/purchases/${purchaseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        supplier_id: null, payment_method: "cash",
        lines: [{ item_id: itemId, quantity: 2, unit_cost: 30 }],
      });
    expect(edited.status).toBe(200);

    // The supplier is truly detached — not silently reverted to the original.
    const row = getDb().prepare("SELECT supplier_id FROM purchases WHERE id = ?").get(purchaseId);
    expect(row.supplier_id).toBeNull();
  });
});
