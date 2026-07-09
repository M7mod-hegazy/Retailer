const Database = require("better-sqlite3");

function createTestDb() {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT,
      sale_price REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      category_id INTEGER,
      unit_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS item_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      opening_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      customer_id INTEGER,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_type TEXT,
      status TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      item_id INTEGER,
      quantity REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      cost_wacc REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      symbol TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      warehouse_id INTEGER,
      quantity REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      opening_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS treasuries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      balance REAL DEFAULT 0
    );
  `);

  const unitId = Number(db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs").lastInsertRowid);
  const catId = Number(db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("مشروبات").lastInsertRowid);
  const whId = Number(db.prepare("INSERT INTO warehouses (name, is_default) VALUES (?, ?)").run("المستودع الرئيسي", 1).lastInsertRowid);
  const custId = Number(db.prepare("INSERT INTO customers (name, phone, is_active) VALUES (?, ?, ?)").run("عميل نقدي", null, 1).lastInsertRowid);
  const itemId = Number(db.prepare("INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, ?, ?)").run("عصير", "TEST-001", 200, 80, catId, unitId).lastInsertRowid);
  const expCatId = Number(db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run("تشغيل").lastInsertRowid);

  const invId = Number(db.prepare("INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("INV-TEST-1", custId, 400, 20, 380, "cash", "paid", "2026-04-01").lastInsertRowid);
  db.prepare("INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total, cost_wacc) VALUES (?, ?, ?, ?, ?, ?)").run(invId, itemId, 2, 200, 400, 80);

  db.prepare("INSERT INTO stock_levels (item_id, warehouse_id, quantity) VALUES (?, ?, ?)").run(itemId, whId, 50);
  db.prepare("INSERT INTO expenses (category_id, amount, notes, created_at) VALUES (?, ?, ?, ?)").run(expCatId, 50, "كهرباء", "2026-04-01");

  return db;
}

function getTestOpts(overrides = {}) {
  return {
    page: 1,
    pageSize: 50,
    ...overrides,
  };
}

module.exports = { createTestDb, getTestOpts };
