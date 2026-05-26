function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS owner_statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      cost_method TEXT NOT NULL DEFAULT 'wacc',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      locked_at TEXT,
      locked_by INTEGER,
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(locked_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS owner_statement_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(statement_id) REFERENCES owner_statements(id) ON DELETE CASCADE,
      UNIQUE(statement_id, metric_key)
    );

    CREATE TABLE IF NOT EXISTS owner_statement_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statement_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      row_json TEXT NOT NULL,
      FOREIGN KEY(statement_id) REFERENCES owner_statements(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_owner_statements_period ON owner_statements(period_start, period_end);
    CREATE INDEX IF NOT EXISTS idx_owner_statement_rows_statement ON owner_statement_rows(statement_id, metric_key);
  `);
}

module.exports = { up };
