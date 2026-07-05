module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(sync_config)").all().map(c => c.name);
    if (!cols.includes("auto_sync_enabled")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN auto_sync_enabled INTEGER DEFAULT 0");
    }
    if (!cols.includes("sync_interval_minutes")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN sync_interval_minutes INTEGER DEFAULT 30");
    }
    if (!cols.includes("last_auto_sync_at")) {
      db.exec("ALTER TABLE sync_config ADD COLUMN last_auto_sync_at TEXT");
    }
  },
};
