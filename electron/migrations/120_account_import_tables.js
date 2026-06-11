// Account Import — import history + undo support for customers and suppliers.
// Records every committed account import as a reversible batch so it can be
// re-downloaded and (within a safe window) undone.
module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_import_batches (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('customers','suppliers')),
        file_name   TEXT,
        file_mime   TEXT,
        file_blob   BLOB,
        inserted    INTEGER DEFAULT 0,
        updated     INTEGER DEFAULT 0,
        skipped     INTEGER DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','undone')),
        created_by  INTEGER REFERENCES users(id),
        created_at  TEXT DEFAULT (datetime('now')),
        undone_at   TEXT,
        undone_by   INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS account_import_batch_rows (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id   INTEGER NOT NULL REFERENCES account_import_batches(id) ON DELETE CASCADE,
        entity_id  INTEGER NOT NULL,
        action     TEXT NOT NULL CHECK(action IN ('insert','update')),
        prior_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_account_import_batch_rows_batch ON account_import_batch_rows(batch_id);
      CREATE INDEX IF NOT EXISTS idx_account_import_batch_rows_entity ON account_import_batch_rows(entity_id);
      CREATE INDEX IF NOT EXISTS idx_account_import_batches_type ON account_import_batches(entity_type);
    `);
  },
};
