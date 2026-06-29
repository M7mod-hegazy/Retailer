function up(db) {
  const addCol = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  addCol("employee_deductions", "completed_at", "TEXT");
  addCol("employee_deductions", "cancelled_at", "TEXT");
  addCol("employee_bonuses", "completed_at", "TEXT");
  addCol("employee_bonuses", "cancelled_at", "TEXT");
}

module.exports = { up };
