function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Defensive: some databases drifted and lost the purchases.notes column
  // (originally added in migration 064). The purchases INSERT relies on it.
  addColumnIfMissing(db, "purchases", "notes", "TEXT");
}

module.exports = { up };
