function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Add shift_id to invoices
  addColumnIfMissing(db, "invoices", "shift_id", "INTEGER REFERENCES shifts(id)");
  
  // Add role fields for Chapter 38 (Supervisor Rules)
  addColumnIfMissing(db, "users", "role", "TEXT DEFAULT 'cashier'");
  addColumnIfMissing(db, "users", "pin_code", "TEXT");

  // Chapter 38 Loyalty additions to customers
  addColumnIfMissing(db, "customers", "loyalty_points", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "customers", "loyalty_tier", "TEXT DEFAULT 'bronze'");
  addColumnIfMissing(db, "customers", "total_spent", "INTEGER DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER,
      transaction_type TEXT NOT NULL, -- 'earn', 'redeem', 'adjustment'
      points INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(invoice_id) REFERENCES invoices(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

module.exports = { up };
