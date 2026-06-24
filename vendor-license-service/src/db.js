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

    CREATE TABLE IF NOT EXISTS ai_usage (
      bucket TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (bucket, day)
    );

    -- ── Dev↔Store communication (Phase 2) ──────────────────────────────
    -- One conversation per store (keyed by license id). Store identity comes
    -- from the x-license-id header the app sends (app-key authenticates the app).
    CREATE TABLE IF NOT EXISTS conversations (
      license_id TEXT PRIMARY KEY,
      store_name TEXT,
      status TEXT NOT NULL DEFAULT 'new',        -- new | seen | in_progress | resolved
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,                 -- 'store' | 'dev'
      sender_name TEXT,
      channel TEXT NOT NULL DEFAULT 'support',   -- 'support' | 'complaint' | 'suggestion'
      body TEXT,
      app_version TEXT,
      device_id TEXT,
      seen_at TEXT,                              -- read receipt (by the other side)
      edited_at TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      message_id INTEGER NOT NULL,
      actor TEXT NOT NULL,                       -- 'store' | 'dev'
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, actor, emoji),
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS message_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      kind TEXT NOT NULL,                        -- 'image' | 'file' | 'voice'
      filename TEXT,
      mime TEXT,
      size INTEGER,
      path TEXT NOT NULL,                        -- on-disk path under uploads dir
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',         -- info | critical | update
      target_kind TEXT NOT NULL DEFAULT 'all',   -- all | license | version_range
      target_license_id TEXT,                    -- when target_kind = 'license'
      version_min TEXT,                          -- when target_kind = 'version_range'
      version_max TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id INTEGER NOT NULL,
      license_id TEXT NOT NULL,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (announcement_id, license_id),
      FOREIGN KEY(announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
    CREATE INDEX IF NOT EXISTS idx_messages_license ON messages(license_id, id);
    CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(id);
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
