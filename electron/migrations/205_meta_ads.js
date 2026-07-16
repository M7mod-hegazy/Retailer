function addCol(db, table, col, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

module.exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_ads_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      app_id TEXT,
      app_secret TEXT,
      pixel_id TEXT,
      business_id TEXT,
      ad_account_id TEXT,
      enabled INTEGER DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meta_ads_audiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_audience_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      size INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ready',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meta_lead_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_form_id TEXT,
      page_id TEXT,
      page_name TEXT,
      form_name TEXT,
      status TEXT DEFAULT 'active',
      last_sync_at TEXT,
      leads_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  addCol(db, "customers", "meta_audience_id", "TEXT");
  addCol(db, "customers", "meta_lead_form_id", "TEXT");
};

module.exports.down = function (db) {
  db.exec(`DROP TABLE IF EXISTS meta_lead_forms`);
  db.exec(`DROP TABLE IF EXISTS meta_ads_audiences`);
  db.exec(`DROP TABLE IF EXISTS meta_ads_config`);
};
