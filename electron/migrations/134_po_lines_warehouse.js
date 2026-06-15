function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Per-line destination warehouse for a purchase order (used as the convert-time default).
  addColumnIfMissing(db, "purchase_order_lines", "warehouse_id", "INTEGER");
}

module.exports = { up };
