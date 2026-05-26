function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_movements (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         INTEGER NOT NULL,
      warehouse_id    INTEGER,
      occurred_at     TEXT NOT NULL,
      movement_type   TEXT NOT NULL,
      quantity        REAL NOT NULL,
      unit_cost       REAL NOT NULL,
      source_table    TEXT NOT NULL,
      source_id       INTEGER NOT NULL,
      source_line_id  INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (source_table, source_id, source_line_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cm_item_time ON cost_movements (item_id, occurred_at, id);
    CREATE INDEX IF NOT EXISTS idx_cm_source ON cost_movements (source_table, source_id);
  `);
}

module.exports = { up };
