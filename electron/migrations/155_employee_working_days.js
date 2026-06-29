function up(db) {
  const addCol = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  addCol("employees", "working_days_per_month", "INTEGER DEFAULT 26");
}

module.exports = { up };
