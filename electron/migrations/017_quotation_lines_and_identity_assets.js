function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotation_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES items(id)
    );
  `);

  addColumnIfMissing(db, "quotations", "notes", "TEXT");
  addColumnIfMissing(db, "quotations", "expires_at", "TEXT");
  addColumnIfMissing(db, "settings", "logo_url", "TEXT");
  addColumnIfMissing(db, "settings", "logo_on_invoices", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "logo_on_receipts", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "logo_on_sidebar", "INTEGER DEFAULT 1");
  addColumnIfMissing(db, "settings", "logo_on_reports", "INTEGER DEFAULT 1");
}

module.exports = { up };
