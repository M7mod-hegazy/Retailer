function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "settings", "license_last_check_at", "TEXT");
  addColumnIfMissing(db, "settings", "license_last_refresh_at", "TEXT");
  addColumnIfMissing(db, "settings", "license_mode", "TEXT DEFAULT 'hybrid_signed'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS license_runtime (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      encrypted_payload TEXT,
      integrity_hash TEXT,
      last_seen_client_time TEXT,
      last_refresh_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO license_runtime (id) VALUES (1);
  `);
}

module.exports = { up };
