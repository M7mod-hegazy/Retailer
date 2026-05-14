module.exports = {
  up(db) {
    // 1. Single treasury enforcement
    try { db.exec(`ALTER TABLE treasuries ADD COLUMN system_locked INTEGER DEFAULT 0;`); } catch(e) {}
    db.exec(`
      INSERT OR IGNORE INTO treasuries (id, name, balance, system_locked)
      VALUES (1, 'الخزينة الرئيسية', 0, 1);
      UPDATE treasuries SET system_locked = 1 WHERE id = 1;
    `);

    // 2. Payment methods: system flag + excludes_from_treasury
    try { db.exec(`ALTER TABLE payment_methods ADD COLUMN is_system INTEGER DEFAULT 0;`); } catch(e) {}
    try { db.exec(`ALTER TABLE payment_methods ADD COLUMN excludes_from_treasury INTEGER DEFAULT 0;`); } catch(e) {}
    try { db.exec(`ALTER TABLE payment_methods ADD COLUMN category TEXT DEFAULT 'cash';`); } catch(e) {}
    try { db.exec(`ALTER TABLE payment_methods ADD COLUMN icon TEXT DEFAULT '💳';`); } catch(e) {}
    try { db.exec(`ALTER TABLE payment_methods ADD COLUMN description TEXT;`); } catch(e) {}

    // Seed system methods
    db.exec(`
      INSERT OR IGNORE INTO payment_methods (id, name, is_system, excludes_from_treasury, category, icon)
      VALUES (1, 'نقدي', 1, 0, 'cash', '💵');
      INSERT OR IGNORE INTO payment_methods (id, name, is_system, excludes_from_treasury, category, icon)
      VALUES (2, 'أجل', 1, 0, 'credit', '📋');
      UPDATE payment_methods SET is_system = 1, excludes_from_treasury = 0 WHERE id IN (1, 2);
    `);

    // 3. Ajal (credit debt) tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS ajal_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER REFERENCES invoices(id),
        customer_id INTEGER REFERENCES customers(id),
        original_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ajal_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES ajal_debts(id),
        amount REAL NOT NULL,
        payment_method_id INTEGER REFERENCES payment_methods(id),
        payment_date TEXT DEFAULT (date('now')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS ajal_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES ajal_debts(id),
        installment_no INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_at TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 4. Bank transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER NOT NULL REFERENCES banks(id),
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        reference TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
    `);

    // 5. Expenses: add updated_at, attachment_url if missing
    try { db.exec(`ALTER TABLE expenses ADD COLUMN updated_at TEXT;`); } catch(e) {}
    try { db.exec(`ALTER TABLE expenses ADD COLUMN attachment_url TEXT;`); } catch(e) {}

    // 6. Revenues: same
    try { db.exec(`ALTER TABLE revenues ADD COLUMN updated_at TEXT;`); } catch(e) {}
    try { db.exec(`ALTER TABLE revenues ADD COLUMN attachment_url TEXT;`); } catch(e) {}

    // 7. Expense categories: ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER REFERENCES expense_categories(id)
      );
      INSERT OR IGNORE INTO expense_categories (id, name) VALUES (1, 'عام'), (2, 'إداري'), (3, 'تشغيلي');
    `);
  },

  down(db) {
    db.exec(`
      DROP TABLE IF EXISTS ajal_schedules;
      DROP TABLE IF EXISTS ajal_payments;
      DROP TABLE IF EXISTS ajal_debts;
      DROP TABLE IF EXISTS bank_transactions;
    `);
  },
};
