function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      base_salary INTEGER NOT NULL,
      total_bonuses INTEGER DEFAULT 0,
      total_deductions INTEGER DEFAULT 0,
      advance_deductions INTEGER DEFAULT 0,
      net_salary INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL,
      remaining_balance INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'full',
      carry_forward INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      description TEXT,
      settled_by INTEGER REFERENCES users(id),
      settled_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expense_id INTEGER REFERENCES expenses(id)
    )
  `);

  // Add paid_amount / remaining_balance / carry_forward / status columns to salary_settlements if missing
  const cols = db.prepare("PRAGMA table_info(salary_settlements)").all().map(c => c.name);
  if (!cols.includes("paid_amount"))
    db.exec("ALTER TABLE salary_settlements ADD COLUMN paid_amount INTEGER");
  if (!cols.includes("remaining_balance"))
    db.exec("ALTER TABLE salary_settlements ADD COLUMN remaining_balance INTEGER DEFAULT 0");
  if (!cols.includes("carry_forward"))
    db.exec("ALTER TABLE salary_settlements ADD COLUMN carry_forward INTEGER DEFAULT 0");
}

module.exports = { up };
