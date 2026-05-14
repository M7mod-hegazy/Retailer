function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_type TEXT NOT NULL,
      party_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cheques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      FOREIGN KEY(payment_id) REFERENCES payments(id)
    );

    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total INTEGER NOT NULL,
      remaining INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      opening_cash INTEGER NOT NULL DEFAULT 0,
      closing_cash INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

module.exports = { up };
