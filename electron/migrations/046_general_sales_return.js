module.exports = {
  up(db) {
    // ── sales_returns: make invoice_id nullable, add notes column ──────────
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales_returns_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doc_no TEXT,
          invoice_id INTEGER,
          customer_id INTEGER,
          total INTEGER NOT NULL DEFAULT 0,
          reason TEXT,
          refund_method TEXT DEFAULT 'cash_back',
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(invoice_id) REFERENCES invoices(id),
          FOREIGN KEY(customer_id) REFERENCES customers(id)
        );
        INSERT INTO sales_returns_new (id, doc_no, invoice_id, customer_id, total, reason, refund_method, notes, created_at)
          SELECT id, doc_no, invoice_id, customer_id, total, reason, refund_method, NULL, created_at FROM sales_returns;
        DROP TABLE sales_returns;
        ALTER TABLE sales_returns_new RENAME TO sales_returns;
      `);
    } catch (e) {
      // Already nullable — just add notes column if missing
      try { db.exec("ALTER TABLE sales_returns ADD COLUMN notes TEXT"); } catch (_) {}
    }

    // ── sales_return_lines: make invoice_line_id nullable, add unit_price ──
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales_return_lines_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sales_return_id INTEGER NOT NULL,
          invoice_line_id INTEGER,
          item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL DEFAULT 0,
          line_total INTEGER NOT NULL,
          FOREIGN KEY(sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
          FOREIGN KEY(invoice_line_id) REFERENCES invoice_lines(id),
          FOREIGN KEY(item_id) REFERENCES items(id)
        );
        INSERT INTO sales_return_lines_new (id, sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total)
          SELECT id, sales_return_id, invoice_line_id, item_id, quantity, COALESCE(unit_price, 0), line_total FROM sales_return_lines;
        DROP TABLE sales_return_lines;
        ALTER TABLE sales_return_lines_new RENAME TO sales_return_lines;
      `);
    } catch (e) {
      try { db.exec("ALTER TABLE sales_return_lines ADD COLUMN unit_price REAL NOT NULL DEFAULT 0"); } catch (_) {}
    }

    // ── purchase_returns: make purchase_id nullable, add reason/refund_method/notes ──
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_returns_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doc_no TEXT,
          purchase_id INTEGER,
          supplier_id INTEGER,
          total INTEGER NOT NULL DEFAULT 0,
          reason TEXT,
          refund_method TEXT DEFAULT 'cash_back',
          notes TEXT,
          settlement_type TEXT NOT NULL DEFAULT 'account',
          treasury_id INTEGER REFERENCES treasuries(id),
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(purchase_id) REFERENCES purchases(id),
          FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
        );
        INSERT INTO purchase_returns_new (id, doc_no, purchase_id, supplier_id, total, settlement_type, treasury_id, created_at)
          SELECT id, doc_no, purchase_id, supplier_id, total,
            COALESCE(settlement_type, 'account'), treasury_id, created_at
          FROM purchase_returns;
        DROP TABLE purchase_returns;
        ALTER TABLE purchase_returns_new RENAME TO purchase_returns;
      `);
    } catch (e) {
      try { db.exec("ALTER TABLE purchase_returns ADD COLUMN reason TEXT"); } catch (_) {}
      try { db.exec("ALTER TABLE purchase_returns ADD COLUMN refund_method TEXT DEFAULT 'cash_back'"); } catch (_) {}
      try { db.exec("ALTER TABLE purchase_returns ADD COLUMN notes TEXT"); } catch (_) {}
    }

    // ── purchase_return_lines: make purchase_line_id nullable, add unit_price ──
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_return_lines_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_return_id INTEGER NOT NULL,
          purchase_line_id INTEGER,
          item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_cost REAL NOT NULL DEFAULT 0,
          unit_price REAL NOT NULL DEFAULT 0,
          line_total INTEGER NOT NULL,
          FOREIGN KEY(purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
          FOREIGN KEY(purchase_line_id) REFERENCES purchase_lines(id),
          FOREIGN KEY(item_id) REFERENCES items(id)
        );
        INSERT INTO purchase_return_lines_new (id, purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, unit_price, line_total)
          SELECT id, purchase_return_id, purchase_line_id, item_id, quantity,
            COALESCE(unit_cost, 0), COALESCE(unit_cost, 0), line_total
          FROM purchase_return_lines;
        DROP TABLE purchase_return_lines;
        ALTER TABLE purchase_return_lines_new RENAME TO purchase_return_lines;
      `);
    } catch (e) {
      try { db.exec("ALTER TABLE purchase_return_lines ADD COLUMN unit_price REAL NOT NULL DEFAULT 0"); } catch (_) {}
    }
  },
};
