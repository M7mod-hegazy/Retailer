function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "invoice_lines", "cost_fifo", "REAL");
  addColumnIfMissing(db, "invoice_lines", "cost_lifo", "REAL");
  addColumnIfMissing(db, "sales_return_lines", "cost_fifo", "REAL");
  addColumnIfMissing(db, "sales_return_lines", "cost_lifo", "REAL");
}

module.exports = { up };
