function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "settings", "receipt_footer", "TEXT");
  addColumnIfMissing(db, "settings", "show_cashier_name", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "show_customer_name", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "show_tax", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "show_footer", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "app_name", "TEXT");
  addColumnIfMissing(db, "settings", "app_subtitle", "TEXT");
}

module.exports = { up };
