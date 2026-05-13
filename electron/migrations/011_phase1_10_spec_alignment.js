function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "settings", "company_name_en", "TEXT");
  addColumnIfMissing(db, "settings", "branch_name", "TEXT");
  addColumnIfMissing(db, "settings", "branch_code", "TEXT");
  addColumnIfMissing(db, "settings", "address", "TEXT");
  addColumnIfMissing(db, "settings", "phone", "TEXT");
  addColumnIfMissing(db, "settings", "commercial_register", "TEXT");
  addColumnIfMissing(db, "settings", "currency_code", "TEXT DEFAULT 'EGP'");
  addColumnIfMissing(db, "settings", "currency_symbol", "TEXT DEFAULT 'EGP'");
  addColumnIfMissing(db, "settings", "decimal_places", "INTEGER DEFAULT 2");
  addColumnIfMissing(db, "settings", "tax_type", "TEXT DEFAULT 'none'");
  addColumnIfMissing(db, "settings", "invoice_prefix", "TEXT DEFAULT 'INV-'");
  addColumnIfMissing(db, "settings", "purchase_prefix", "TEXT DEFAULT 'PUR-'");
  addColumnIfMissing(db, "settings", "fiscal_year_start", "TEXT DEFAULT 'January'");
  addColumnIfMissing(db, "settings", "date_format", "TEXT DEFAULT 'dd/MM/yyyy'");
  addColumnIfMissing(db, "settings", "language", "TEXT DEFAULT 'ar'");
  addColumnIfMissing(db, "settings", "receipt_width", "TEXT DEFAULT '80mm'");
  addColumnIfMissing(db, "settings", "auto_backup_enabled", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "settings", "auto_backup_path", "TEXT");
  addColumnIfMissing(db, "settings", "walk_in_customer_id", "INTEGER");
  addColumnIfMissing(db, "settings", "default_warehouse_id", "INTEGER");
  addColumnIfMissing(db, "settings", "default_treasury_id", "INTEGER");
  addColumnIfMissing(db, "settings", "setup_step", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "setup_payload_json", "TEXT");
  addColumnIfMissing(db, "settings", "license_key", "TEXT");
  addColumnIfMissing(db, "settings", "license_status", "TEXT DEFAULT 'trial'");

  addColumnIfMissing(db, "users", "full_name", "TEXT");
  addColumnIfMissing(db, "users", "last_login_at", "TEXT");

  addColumnIfMissing(db, "customers", "code", "TEXT");
  addColumnIfMissing(db, "customers", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "customers", "is_blacklisted", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "customers", "blacklist_reason", "TEXT");
  addColumnIfMissing(db, "customers", "credit_limit", "INTEGER DEFAULT 0");

  addColumnIfMissing(db, "suppliers", "code", "TEXT");
  addColumnIfMissing(db, "suppliers", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "suppliers", "payment_terms", "TEXT");
  addColumnIfMissing(db, "suppliers", "bank_details", "TEXT");

  addColumnIfMissing(db, "items", "code", "TEXT");
  addColumnIfMissing(db, "items", "name_en", "TEXT");
  addColumnIfMissing(db, "items", "item_type", "TEXT DEFAULT 'product'");
  addColumnIfMissing(db, "items", "description", "TEXT");
  addColumnIfMissing(db, "items", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "items", "min_stock_qty", "INTEGER DEFAULT 0");

  addColumnIfMissing(db, "units", "is_active", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "warehouses", "code", "TEXT");
  addColumnIfMissing(db, "treasuries", "code", "TEXT");
  addColumnIfMissing(db, "banks", "code", "TEXT");
  addColumnIfMissing(db, "employees", "is_active", "INTEGER DEFAULT 1");

  addColumnIfMissing(db, "payments", "reference_number", "TEXT");
  addColumnIfMissing(db, "payments", "notes", "TEXT");
  addColumnIfMissing(db, "payments", "treasury_id", "INTEGER");
  addColumnIfMissing(db, "payments", "bank_id", "INTEGER");
  addColumnIfMissing(db, "payments", "allocated_amount", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "payments", "unallocated_amount", "INTEGER DEFAULT 0");

  addColumnIfMissing(db, "installments", "invoice_id", "INTEGER");
  addColumnIfMissing(db, "installments", "down_payment", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "installments", "frequency", "TEXT DEFAULT 'monthly'");
  addColumnIfMissing(db, "installments", "installment_count", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "installments", "next_due_date", "TEXT");

  addColumnIfMissing(db, "expenses", "description", "TEXT");
  addColumnIfMissing(db, "expenses", "payment_method", "TEXT DEFAULT 'cash'");
  addColumnIfMissing(db, "expenses", "employee_id", "INTEGER");
  addColumnIfMissing(db, "expenses", "receipt_image", "TEXT");
  addColumnIfMissing(db, "expenses", "is_recurring", "INTEGER DEFAULT 0");
  addColumnIfMissing(db, "expenses", "recurring_frequency", "TEXT");
  addColumnIfMissing(db, "expenses", "treasury_id", "INTEGER");
  addColumnIfMissing(db, "expenses", "bank_id", "INTEGER");

  addColumnIfMissing(db, "revenues", "description", "TEXT");
  addColumnIfMissing(db, "revenues", "payment_method", "TEXT DEFAULT 'cash'");
  addColumnIfMissing(db, "revenues", "treasury_id", "INTEGER");
  addColumnIfMissing(db, "revenues", "bank_id", "INTEGER");
  addColumnIfMissing(db, "sales_returns", "reason", "TEXT");
  addColumnIfMissing(db, "sales_returns", "refund_method", "TEXT DEFAULT 'cash_back'");
  addColumnIfMissing(db, "purchase_orders", "notes", "TEXT");
  addColumnIfMissing(db, "purchase_order_lines", "received_quantity", "INTEGER DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      FOREIGN KEY(parent_id) REFERENCES revenue_categories(id)
    );

    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      supplier_id INTEGER,
      total INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_return_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_return_id INTEGER NOT NULL,
      purchase_line_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      FOREIGN KEY(purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
      FOREIGN KEY(purchase_line_id) REFERENCES purchase_lines(id),
      FOREIGN KEY(item_id) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS physical_count_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS physical_count_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      system_quantity INTEGER NOT NULL DEFAULT 0,
      counted_quantity INTEGER NOT NULL DEFAULT 0,
      variance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, item_id),
      FOREIGN KEY(session_id) REFERENCES physical_count_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );
  `);

  db.prepare("INSERT OR IGNORE INTO revenue_categories (id, name) VALUES (1, 'إيرادات أخرى')").run();
}

module.exports = { up };
