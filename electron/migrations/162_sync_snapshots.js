module.exports = {
  up(db) {
    const logCols = db.prepare("PRAGMA table_info(sync_log)").all().map(c => c.name);
    if (!logCols.includes("snapshot_id")) {
      db.exec("ALTER TABLE sync_log ADD COLUMN snapshot_id INTEGER REFERENCES sync_snapshots(id)");
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_log_id INTEGER REFERENCES sync_log(id),
        direction TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'product',
        snapshot_data TEXT NOT NULL,
        items_count INTEGER DEFAULT 0,
        size_bytes INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
