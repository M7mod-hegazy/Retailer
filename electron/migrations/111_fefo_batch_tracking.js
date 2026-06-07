function up(db) {
  // Per-item expiry tracking toggle
  const itemCols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
  if (!itemCols.includes("track_expiry")) {
    db.prepare("ALTER TABLE items ADD COLUMN track_expiry INTEGER NOT NULL DEFAULT 0").run();
  }

  // item_batches table (may already exist from migration 058)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_batches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id      INTEGER NOT NULL REFERENCES items(id),
      warehouse_id INTEGER NOT NULL DEFAULT 1,
      batch_no     TEXT,
      expiry_date  TEXT,
      quantity     REAL NOT NULL DEFAULT 0,
      cost_price   REAL NOT NULL DEFAULT 0,
      source       TEXT DEFAULT 'purchase',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Index for FEFO queries
  try {
    db.prepare("CREATE INDEX IF NOT EXISTS idx_item_batches_fefo ON item_batches (item_id, warehouse_id, expiry_date)").run();
  } catch (_) {}
}

module.exports = { up };
