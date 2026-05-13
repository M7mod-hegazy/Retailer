exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      transaction_type TEXT NOT NULL, -- 'pay_in' or 'pay_out'
      amount INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id)
    );
  `);
};
