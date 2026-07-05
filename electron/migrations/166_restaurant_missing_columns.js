function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "166_restaurant_missing_columns",
  up(db) {
    addColumnIfMissing(db, "invoice_lines", "modifiers_json", "TEXT");
    addColumnIfMissing(db, "invoices", "order_type", "TEXT NOT NULL DEFAULT 'dine_in' CHECK(order_type IN ('dine_in','takeaway','delivery'))");
  },
};
