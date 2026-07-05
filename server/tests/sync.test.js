const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { initDb, getDb, setDb } = require("../src/config/database");
const { createApp } = require("../src/app");

let mockEcomServer;
let mockEcomUrl;

function startMockEcom() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");

      if (req.url === "/api/sync/status") {
        res.end(JSON.stringify({
          ok: true,
          status: {
            storeName: "Test Store",
            storeId: "store_123",
            lastSeenAt: new Date().toISOString(),
            totalProducts: 5,
            activeProducts: 3,
            totalCategories: 2,
            changesSinceLastSync: 2,
          },
        }));
      } else if (req.url.startsWith("/api/sync/available/products")) {
        res.end(JSON.stringify({
          ok: true,
          items: [
            { _id: "p1", sku: "SKU-001", name: "Product One", price: 100, stock: 20, image: "https://example.com/img1.jpg", images: ["https://example.com/img1a.jpg"], description: "Test product 1", active: true, categorySlug: "cat-1", updatedAt: new Date().toISOString() },
            { _id: "p2", sku: "SKU-002", name: "Product Two", price: 200, stock: 0, image: "", images: [], description: "Test product 2", active: true, categorySlug: "cat-1", updatedAt: new Date().toISOString() },
            { _id: "p3", sku: "SKU-003", name: "Product Three", price: 300, stock: 50, image: "https://example.com/img3.jpg", images: ["https://example.com/img3a.jpg", "https://example.com/img3b.jpg"], description: "", active: true, categorySlug: "cat-2", updatedAt: new Date().toISOString() },
          ],
          total: 3,
          page: 1,
          pages: 1,
        }));
      } else if (req.url.startsWith("/api/sync/available/categories")) {
        res.end(JSON.stringify({ ok: true, items: [] }));
      } else if (req.url.startsWith("/api/sync/available/stock")) {
        res.end(JSON.stringify({ ok: true, items: [] }));
      } else if (req.url === "/api/sync/pull/products" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const { skus } = JSON.parse(body);
          const allProducts = [
            { _id: "p1", sku: "SKU-001", name: "Product One", price: 100, stock: 20, image: "https://example.com/img1.jpg", images: ["https://example.com/img1a.jpg"], description: "Test product 1", active: true, categorySlug: "cat-1" },
            { _id: "p2", sku: "SKU-002", name: "Product Two", price: 200, stock: 0, image: "", images: [], description: "Test product 2", active: true, categorySlug: "cat-1" },
            { _id: "p3", sku: "SKU-003", name: "Product Three", price: 300, stock: 50, image: "https://example.com/img3.jpg", images: ["https://example.com/img3a.jpg", "https://example.com/img3b.jpg"], description: "", active: true, categorySlug: "cat-2" },
          ];
          const items = allProducts.filter((p) => skus.includes(p.sku));
          res.end(JSON.stringify({ ok: true, items }));
        });
      } else if (req.url === "/api/sync/apply" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const { items } = JSON.parse(body);
          res.end(JSON.stringify({ ok: true, succeeded: items.map((i) => ({ sku: i.sku, action: "updated" })), failed: [], total: items.length }));
        });
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: "Not found" }));
      }
    });

    server.listen(0, () => {
      mockEcomUrl = `http://localhost:${server.address().port}`;
      mockEcomServer = server;
      resolve();
    });
  });
}

describe("Sync API", () => {
  let app;
  let token;
  let db;

  beforeAll(async () => {
    await startMockEcom();
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-sync-"));
    const dbPath = path.join(dir, "sync.db");
    initDb(dbPath);
    db = getDb();

    // Create sync tables if they don't exist (some migrations may have already run via initDb)
    const itemCols = db.prepare("PRAGMA table_info(items)").all().map((c) => c.name);
    if (!itemCols.includes("sync_status")) db.exec("ALTER TABLE items ADD COLUMN sync_status TEXT DEFAULT 'synced'");
    if (!itemCols.includes("last_synced_at")) db.exec("ALTER TABLE items ADD COLUMN last_synced_at TEXT");
    if (!itemCols.includes("ecom_id")) db.exec("ALTER TABLE items ADD COLUMN ecom_id TEXT");
    if (!itemCols.includes("store_id")) db.exec("ALTER TABLE items ADD COLUMN store_id TEXT");
    if (!itemCols.includes("stock")) db.exec("ALTER TABLE items ADD COLUMN stock INTEGER DEFAULT 0");

    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL DEFAULT 'update',
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        direction TEXT NOT NULL DEFAULT 'pull',
        status TEXT NOT NULL DEFAULT 'pending',
        flags TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        items_total INTEGER DEFAULT 0,
        items_succeeded INTEGER DEFAULT 0,
        items_failed INTEGER DEFAULT 0,
        error_details TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ecom_url TEXT NOT NULL,
        store_id TEXT NOT NULL,
        api_key TEXT NOT NULL,
        last_sync_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Seed test items
    db.prepare("INSERT INTO items (name, name_en, code, sale_price, stock, description, is_active, item_type) VALUES (?, ?, ?, ?, ?, ?, 1, 'product')").run("Old Name 1", "Old Name 1 EN", "SKU-001", 50, 10, "Old description");
    db.prepare("INSERT INTO items (name, name_en, code, sale_price, stock, description, is_active, item_type) VALUES (?, ?, ?, ?, ?, ?, 1, 'product')").run("Old Name 2", "Old Name 2 EN", "SKU-002", 150, 5, "Old desc 2");
    db.prepare("INSERT INTO items (name, name_en, code, sale_price, stock, description, is_active, item_type) VALUES (?, ?, ?, ?, ?, ?, 1, 'product')").run("Old Name 3", "Old Name 3 EN", "SKU-003", 250, 30, "Old desc 3");

    // Seed sync config (test config)
    db.prepare("INSERT INTO sync_config (ecom_url, store_id, api_key, last_sync_at) VALUES (?, ?, ?, datetime('now', '-1 day'))").run(mockEcomUrl, "store_123", "test-api-key-12345");

    app = createApp();
    token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");
  });

  afterAll(() => {
    if (mockEcomServer) mockEcomServer.close();
  });

  test("GET /api/sync/config returns configured", async () => {
    const res = await request(app).get("/api/sync/config");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.config).toBeDefined();
    expect(res.body.config.ecom_url).toBe(mockEcomUrl);
  });

  test("GET /api/sync/status returns connection and summary", async () => {
    const res = await request(app).get("/api/sync/status");
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.ecomStatus).toBeDefined();
    expect(res.body.ecomStatus.storeName).toBe("Test Store");
    expect(res.body.ecomStatus.totalProducts).toBe(5);
  });

  test("GET /api/sync/check returns available products from E-com", async () => {
    const res = await request(app).get("/api/sync/check");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.products).toHaveLength(3);
    expect(res.body.products[0].sku).toBe("SKU-001");
    expect(res.body.products[0].price).toBe(100);
  });

  test("POST /api/sync/preview-pull returns diff preview", async () => {
    const res = await request(app)
      .post("/api/sync/preview-pull")
      .send({
        skus: ["SKU-001", "SKU-002", "SKU-003"],
        fields: {
          "SKU-001": { name: true, price: true, stock: true, description: true },
          "SKU-002": { name: true, price: true, stock: true, description: true },
          "SKU-003": { name: true, price: true, stock: false, description: true },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.previews).toHaveLength(3);
    expect(res.body.total).toBe(3);

    const p1 = res.body.previews.find((p) => p.sku === "SKU-001");
    expect(p1.current.name).toBe("Old Name 1");
    expect(p1.incoming.name).toBe("Product One");
    expect(p1.diff.name).toBe(true);
    expect(p1.diff.price).toBe(true);
    expect(p1.diff.stock).toBe(true);
    expect(p1.fields.name).toBe(true);
    expect(p1.hasImages).toBe(true);

    const p3 = res.body.previews.find((p) => p.sku === "SKU-003");
    expect(p3.diff.stock).toBe(false);
    expect(p3.fields.stock).toBe(false);
  });

  test("POST /api/sync/pull pulls products with field selection", async () => {
    const res = await request(app)
      .post("/api/sync/pull")
      .send({
        skus: ["SKU-001", "SKU-002", "SKU-003"],
        fields: {
          "SKU-001": { name: true, price: true, stock: true, description: true },
          "SKU-002": { name: false, price: false, stock: false, description: false },
          "SKU-003": { name: true, price: true, stock: false, description: false },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.imported).toHaveLength(3);

    // SKU-001: all fields updated
    const item1 = db.prepare("SELECT name, sale_price as price, stock, description FROM items WHERE code = ?").get("SKU-001");
    expect(item1.name).toBe("Product One");
    expect(item1.price).toBe(100);
    expect(item1.stock).toBe(20);
    expect(item1.description).toBe("Test product 1");

    // SKU-002: all fields excluded (no changes expected, but existing data unchanged)
    const item2 = db.prepare("SELECT name, sale_price as price, stock, description FROM items WHERE code = ?").get("SKU-002");
    expect(item2.name).toBe("Old Name 2");
    expect(item2.price).toBe(150);
    expect(item2.stock).toBe(5);

    // SKU-003: name and price only, stock skipped
    const item3 = db.prepare("SELECT name, sale_price as price, stock, description FROM items WHERE code = ?").get("SKU-003");
    expect(item3.name).toBe("Product Three");
    expect(item3.price).toBe(300);
    expect(item3.stock).toBe(30);
    expect(item3.description).toBe("Old desc 3");
  });

  test("GET /api/sync/conflicts returns empty list when no local changes", async () => {
    const res = await request(app).get("/api/sync/conflicts");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.conflicts).toHaveLength(0);
  });

  test("reports conflicts when same SKU changed locally", async () => {
    // Add local change for SKU-001
    const item = db.prepare("SELECT id FROM items WHERE code = ?").get("SKU-001");
    db.prepare("INSERT INTO sync_changes (entity_type, entity_id, action, field_name, old_value, new_value, direction, status) VALUES ('item', ?, 'update', 'price', '100', '150', 'push', 'pending')").run(item.id);

    const res = await request(app).get("/api/sync/conflicts");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.conflicts.length).toBeGreaterThanOrEqual(1);

    const conflict = res.body.conflicts.find((c) => c.sku === "SKU-001");
    expect(conflict).toBeDefined();
    expect(conflict.pos.name).toBe("Product One");
    expect(conflict.ecom.name).toBe("Product One");
  });

  test("POST /api/sync/resolve-conflict with keep_ecom resolves conflict", async () => {
    const res = await request(app)
      .post("/api/sync/resolve-conflict")
      .send({ sku: "SKU-001", resolution: "keep_ecom" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.result.resolution).toBe("keep_ecom");
  });

  test("POST /api/sync/resolve-conflict validates resolution", async () => {
    const res = await request(app)
      .post("/api/sync/resolve-conflict")
      .send({ sku: "SKU-001", resolution: "invalid" });
    expect(res.status).toBe(400);
  });

  test("POST /api/sync/apply pushes pending changes", async () => {
    const item = db.prepare("SELECT id FROM items WHERE code = ?").get("SKU-003");
    db.prepare("INSERT INTO sync_changes (entity_type, entity_id, action, field_name, old_value, new_value, direction, status) VALUES ('item', ?, 'update', 'stock', '30', '45', 'push', 'pending')").run(item.id);
    db.prepare("INSERT INTO sync_changes (entity_type, entity_id, action, field_name, old_value, new_value, direction, status) VALUES ('item', ?, 'update', 'price', '300', '350', 'push', 'pending')").run(item.id);

    const res = await request(app)
      .post("/api/sync/apply")
      .send({
        items: [
          { sku: "SKU-003", fields: { stock: "45", price: "350" } },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.succeeded).toHaveLength(1);
  });

  test("GET /api/sync/logs returns sync history", async () => {
    const res = await request(app).get("/api/sync/logs?limit=10");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("GET /api/sync/pending returns pending changes", async () => {
    const res = await request(app).get("/api/sync/pending");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("PUT /api/sync/config saves new config", async () => {
    // Delete existing config first
    db.prepare("DELETE FROM sync_config").run();
    const res = await request(app)
      .put("/api/sync/config")
      .send({ ecom_url: "http://new-ecom.test", store_id: "store_456", api_key: "new-key" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
