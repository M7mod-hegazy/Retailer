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

  // Cash/payment flows need a treasury and a default-treasury setting.
  db.prepare("INSERT INTO treasuries (name, code, balance) VALUES ('Main Treasury', 'T1', 0)").run();
  db.prepare("UPDATE settings SET default_treasury_id = 1 WHERE id = 1").run();

  // Seed a real admin user. Routes write created_by = req.user.id into INTEGER
  // columns with FK → users(id); the "__dev__" bypass id violates that FK, so we
  // sign the token as a real admin (admin role bypasses permission checks).
  const userId = db
    .prepare(
      "INSERT INTO users (username, password_hash, role, is_active) VALUES ('edge', 'x', 'admin', 1)",
    )
    .run().lastInsertRowid;

  const app = createApp();
  const token = jwt.sign(
    { sub: userId, role: "admin" },
    process.env.JWT_SECRET || "test-secret",
  );

  return { app, db, token, dir, itemId: 1, warehouseId: 1, userId };
}

module.exports = { freshWorld };
