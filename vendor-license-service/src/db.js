const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let dbInstance = null;

function getVendorDbPath() {
  return process.env.VENDOR_DB_PATH || path.join(process.cwd(), "vendor-license-service", "data", "vendor-licenses.db");
}

function initDb() {
  if (dbInstance) return dbInstance;

  const dbPath = getVendorDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'standard',
      issued_at TEXT NOT NULL,
      expires_at TEXT,
      max_devices INTEGER NOT NULL DEFAULT 1,
      features_json TEXT NOT NULL DEFAULT '[]',
      grace_days INTEGER NOT NULL DEFAULT 14,
      issuer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      signed_license_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      last_refresh_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      activation_token_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(license_id, device_id),
      FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
  `);

  const hasPhoneColumn = db
    .prepare("SELECT COUNT(1) as total FROM pragma_table_info('customers') WHERE name = 'phone'")
    .get()?.total;
  if (!Number(hasPhoneColumn)) {
    db.exec("ALTER TABLE customers ADD COLUMN phone TEXT");
  }

  dbInstance = db;
  return dbInstance;
}

function getDb() {
  if (!dbInstance) return initDb();
  return dbInstance;
}

module.exports = { getDb, initDb };
