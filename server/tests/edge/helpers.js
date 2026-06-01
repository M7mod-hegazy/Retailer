const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createApp } = require("../../src/app");
const { initDb, setDb, getDb } = require("../../src/config/database");

// Boot a brand-new isolated app + temp SQLite DB, seed the minimum data
// every sale needs, and return handles for driving and inspecting it.
function freshWorld() {
  setDb(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-edge-"));
  initDb(path.join(dir, "edge.db"));
  const db = getDb();

  // Base catalog seed (mirrors server/tests/invoiceService.test.js).
  db.prepare("INSERT INTO units (name) VALUES ('pcs')").run();
  db.prepare("INSERT INTO item_categories (name) VALUES ('cat')").run();
  db.prepare("INSERT INTO warehouses (name, is_default) VALUES ('Main', 1)").run();
  db.prepare(
    "INSERT INTO items (name, barcode, category_id, unit_id) VALUES ('EdgeItem', 'edge-001', 1, 1)",
  ).run();
  db.prepare(
    "INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (1, 1, 1000000)",
  ).run();

  const app = createApp();
  const token = jwt.sign({ sub: "__dev__" }, process.env.JWT_SECRET || "test-secret");

  return { app, db, token, dir, itemId: 1, warehouseId: 1 };
}

module.exports = { freshWorld };
