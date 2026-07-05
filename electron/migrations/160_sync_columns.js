module.exports = {
  up(db) {
    // ── Add sync columns to items table ──
    const itemCols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
    if (!itemCols.includes("sync_status")) {
      db.exec("ALTER TABLE items ADD COLUMN sync_status TEXT DEFAULT 'synced'");
    }
    if (!itemCols.includes("last_synced_at")) {
      db.exec("ALTER TABLE items ADD COLUMN last_synced_at TEXT");
    }
    if (!itemCols.includes("ecom_id")) {
      db.exec("ALTER TABLE items ADD COLUMN ecom_id TEXT");
    }
    if (!itemCols.includes("store_id")) {
      db.exec("ALTER TABLE items ADD COLUMN store_id TEXT");
    }

    // ── Add sync columns to item_categories ──
    const catCols = db.prepare("PRAGMA table_info(item_categories)").all().map(c => c.name);
    if (!catCols.includes("sync_status")) {
      db.exec("ALTER TABLE item_categories ADD COLUMN sync_status TEXT DEFAULT 'synced'");
    }
    if (!catCols.includes("last_synced_at")) {
      db.exec("ALTER TABLE item_categories ADD COLUMN last_synced_at TEXT");
    }
    if (!catCols.includes("ecom_id")) {
      db.exec("ALTER TABLE item_categories ADD COLUMN ecom_id TEXT");
    }

    // ── Create sync_changes table ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL DEFAULT 'update',
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        direction TEXT NOT NULL DEFAULT 'pull',
        status TEXT NOT NULL DEFAULT 'pending',
        flags TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── Create sync_log table ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        items_total INTEGER DEFAULT 0,
        items_succeeded INTEGER DEFAULT 0,
        items_failed INTEGER DEFAULT 0,
        error_details TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── Create sync_config table ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ecom_url TEXT NOT NULL,
        store_id TEXT NOT NULL,
        api_key TEXT NOT NULL,
        last_sync_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  },
};
