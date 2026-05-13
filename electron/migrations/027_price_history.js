function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      field TEXT NOT NULL,
      old_value REAL NOT NULL,
      new_value REAL NOT NULL,
      adjustment_type TEXT NOT NULL,
      adjustment_value REAL NOT NULL,
      category_id INTEGER,
      reason TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      operation_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_op ON price_history(operation_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(changed_at);
  `);
}

module.exports = { up };
