// Smart Upload — import history + undo support.
// Records every committed item import as a reversible batch so it can be
// re-downloaded and (within 24h, if untouched) undone safely.
module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        file_name  TEXT,
        file_hash  TEXT,
        file_blob  BLOB,
        file_mime  TEXT,
        file_size  INTEGER,
        row_count  INTEGER NOT NULL DEFAULT 0,
        inserted   INTEGER NOT NULL DEFAULT 0,
        updated    INTEGER NOT NULL DEFAULT 0,
        skipped    INTEGER NOT NULL DEFAULT 0,
        failed     INTEGER NOT NULL DEFAULT 0,
        status     TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        undone_at  TEXT,
        undone_by  INTEGER
      );

      CREATE TABLE IF NOT EXISTS import_batch_items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id        INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
        item_id         INTEGER NOT NULL,
        action          TEXT NOT NULL,
        was_new         INTEGER NOT NULL DEFAULT 0,
        warehouse_id    INTEGER,
        qty_added       REAL NOT NULL DEFAULT 0,
        prior_stock     REAL,
        prior_item_json TEXT,
        ob_purchase_id  INTEGER,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_import_batch_items_batch ON import_batch_items(batch_id);
      CREATE INDEX IF NOT EXISTS idx_import_batch_items_item  ON import_batch_items(item_id);
      CREATE INDEX IF NOT EXISTS idx_import_batches_hash      ON import_batches(file_hash);
    `);
  },
};
