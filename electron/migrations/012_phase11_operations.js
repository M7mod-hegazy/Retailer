exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      adjustment_type TEXT NOT NULL, -- 'incentive' or 'penalty'
      amount INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id)
    );
  `);
};
