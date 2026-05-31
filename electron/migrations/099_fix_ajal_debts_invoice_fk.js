module.exports = {
  up(db) {
    const fks = db.prepare("PRAGMA foreign_key_list(ajal_debts)").all();
    if (!fks.some((fk) => fk.table === "invoices" && fk.from === "invoice_id")) return;

    // invoice_id was originally declared REFERENCES invoices(id), but it also stores
    // purchase IDs (source_type = 'purchase'), so the FK causes constraint failures.
    // Recreate the table without that FK, preserving all data and child tables.
    db.exec(`
      CREATE TABLE ajal_debts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER,
        customer_id INTEGER REFERENCES customers(id),
        original_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        party_type TEXT NOT NULL DEFAULT 'customer',
        supplier_id INTEGER REFERENCES suppliers(id),
        source_type TEXT NOT NULL DEFAULT 'invoice'
      );

      INSERT INTO ajal_debts_new
        SELECT id, invoice_id, customer_id, original_amount, paid_amount,
               due_date, status, notes, created_at, updated_at,
               party_type, supplier_id, source_type
        FROM ajal_debts;

      CREATE TABLE ajal_payments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES ajal_debts_new(id),
        amount REAL NOT NULL,
        payment_method_id INTEGER REFERENCES payment_methods(id),
        payment_date TEXT DEFAULT (date('now')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );

      INSERT INTO ajal_payments_new SELECT * FROM ajal_payments;

      CREATE TABLE ajal_schedules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL REFERENCES ajal_debts_new(id),
        installment_no INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_at TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO ajal_schedules_new SELECT * FROM ajal_schedules;

      DROP TABLE ajal_schedules;
      DROP TABLE ajal_payments;
      DROP TABLE ajal_debts;

      ALTER TABLE ajal_debts_new RENAME TO ajal_debts;
      ALTER TABLE ajal_payments_new RENAME TO ajal_payments;
      ALTER TABLE ajal_schedules_new RENAME TO ajal_schedules;
    `);
  },
};
