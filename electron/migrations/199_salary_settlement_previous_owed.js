function up(db) {
  const addCol = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  // مستحقات سابقة مُرحّلة داخل هذا الصرف (متبقي صرف جزئي سابق مملوك للموظف)
  addCol("salary_settlements", "previous_owed", "INTEGER DEFAULT 0");
}

module.exports = { up };
