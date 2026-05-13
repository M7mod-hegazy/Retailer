function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "settings", "active_license_id", "INTEGER");

  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      key_masked TEXT NOT NULL,
      issued_to TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      hardware_id TEXT,
      expires_at TEXT,
      issued_by_user_id INTEGER,
      activated_at TEXT,
      disabled_at TEXT,
      disabled_reason TEXT,
      last_validation_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_licenses_hardware_id ON licenses(hardware_id);
  `);
}

module.exports = { up };
