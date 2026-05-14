module.exports = {
  name: '056_withdrawals_standalone',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS withdrawal_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_no TEXT,
        amount REAL NOT NULL,
        category_id INTEGER REFERENCES withdrawal_categories(id),
        note TEXT,
        payment_method TEXT DEFAULT 'cash',
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
    `);
  },
};
