module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        response_code INTEGER,
        response_body TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const syncConfigCols = db.prepare("PRAGMA table_info(sync_config)").all().map(c => c.name);
    if (!syncConfigCols.includes("webhook_secret")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN webhook_secret TEXT");
    }
    if (!syncConfigCols.includes("auto_receive_orders")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN auto_receive_orders INTEGER DEFAULT 1");
    }
    if (!syncConfigCols.includes("auto_update_stock")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN auto_update_stock INTEGER DEFAULT 0");
    }
  },
};
