module.exports = {
  up(db) {
    // Document sequences table for PREFIX-YYYY-NNNNN codes
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sequences (
        type TEXT PRIMARY KEY,
        year INTEGER NOT NULL DEFAULT 0,
        last_seq INTEGER NOT NULL DEFAULT 0
      );

      -- Seed defaults
      INSERT OR IGNORE INTO document_sequences (type, year, last_seq) VALUES
        ('pos_sale',         0, 0),
        ('sales_invoice',    0, 0),
        ('purchase_order',   0, 0),
        ('purchase_receipt', 0, 0),
        ('sales_return',     0, 0),
        ('purchase_return',  0, 0),
        ('expense',          0, 0),
        ('revenue',          0, 0),
        ('treasury_transfer',0, 0),
        ('customer_payment', 0, 0);

      -- Key-value store for document prefixes and other dynamic settings
      CREATE TABLE IF NOT EXISTS settings_kv (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR IGNORE INTO settings_kv (key, value) VALUES
        ('doc_prefix_pos_sale',          'SEL'),
        ('doc_prefix_sales_invoice',     'INV'),
        ('doc_prefix_purchase_order',    'PO'),
        ('doc_prefix_purchase_receipt',  'PR'),
        ('doc_prefix_sales_return',      'SRET'),
        ('doc_prefix_purchase_return',   'PRET'),
        ('doc_prefix_expense',           'EXP'),
        ('doc_prefix_revenue',           'REV'),
        ('doc_prefix_treasury_transfer', 'TRF'),
        ('doc_prefix_customer_payment',  'CPAY');

      -- Daily sessions (replaces shift system)
      CREATE TABLE IF NOT EXISTS daily_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        opening_balance REAL NOT NULL DEFAULT 0,
        actual_cash REAL,
        total_withdrawals REAL DEFAULT 0,
        closing_balance REAL,
        discrepancy REAL,
        status TEXT DEFAULT 'open',
        notes TEXT,
        closed_at TEXT,
        closed_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS daily_withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER REFERENCES daily_sessions(id),
        amount REAL NOT NULL,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
    `);

    // Add doc_no column to invoices if not present
    try { db.exec(`ALTER TABLE invoices ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to purchases
    try { db.exec(`ALTER TABLE purchases ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to purchase_orders
    try { db.exec(`ALTER TABLE purchase_orders ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to expenses
    try { db.exec(`ALTER TABLE expenses ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to revenues
    try { db.exec(`ALTER TABLE revenues ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to sales_returns
    try { db.exec(`ALTER TABLE sales_returns ADD COLUMN doc_no TEXT;`); } catch(e) {}
    // Add doc_no to purchase_returns
    try { db.exec(`ALTER TABLE purchase_returns ADD COLUMN doc_no TEXT;`); } catch(e) {}
  },
  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS daily_withdrawals;
      DROP TABLE IF EXISTS daily_sessions;
      DROP TABLE IF EXISTS settings_kv;
      DROP TABLE IF EXISTS document_sequences;
    `);
  },
};
