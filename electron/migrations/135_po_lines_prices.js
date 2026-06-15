function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Planned selling / wholesale prices captured on a purchase order line; carried
  // into the purchase invoice on conversion.
  addColumnIfMissing(db, "purchase_order_lines", "selling_price", "REAL");
  addColumnIfMissing(db, "purchase_order_lines", "wholesale_price", "REAL");
}

module.exports = { up };
