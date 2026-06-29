function up(db) {
  const empCols = db.prepare("PRAGMA table_info(employees)").all().map(c => c.name);
  if (!empCols.includes("salary_period"))
    db.exec("ALTER TABLE employees ADD COLUMN salary_period TEXT DEFAULT 'monthly'");
  if (!empCols.includes("salary"))
    db.exec("ALTER TABLE employees ADD COLUMN salary INTEGER DEFAULT 0");
  if (!empCols.includes("job_title"))
    db.exec("ALTER TABLE employees ADD COLUMN job_title TEXT");
  if (!empCols.includes("address"))
    db.exec("ALTER TABLE employees ADD COLUMN address TEXT DEFAULT ''");
  if (!empCols.includes("phones"))
    db.exec("ALTER TABLE employees ADD COLUMN phones TEXT DEFAULT '[]'");

  // سلفيات
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      amount INTEGER NOT NULL,
      remaining_balance INTEGER NOT NULL,
      installment_count INTEGER NOT NULL DEFAULT 1,
      installment_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // مدفوعات السلف
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_advance_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advance_id INTEGER NOT NULL REFERENCES employee_advances(id),
      amount INTEGER NOT NULL,
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_by INTEGER REFERENCES users(id)
    )
  `);

  // خصومات
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      deduction_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // مكافئات
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      bonus_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // صرف رواتب
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      base_salary INTEGER NOT NULL,
      total_bonuses INTEGER DEFAULT 0,
      total_deductions INTEGER DEFAULT 0,
      advance_deductions INTEGER DEFAULT 0,
      net_salary INTEGER NOT NULL,
      payment_method TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'settled',
      settled_by INTEGER REFERENCES users(id),
      settled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expense_id INTEGER REFERENCES expenses(id)
    )
  `);
}

module.exports = { up };
