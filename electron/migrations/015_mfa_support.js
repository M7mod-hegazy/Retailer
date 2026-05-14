function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "users", "mfa_secret", "TEXT");
  addColumnIfMissing(db, "users", "mfa_enabled", "INTEGER DEFAULT 0");
}

module.exports = { up };
