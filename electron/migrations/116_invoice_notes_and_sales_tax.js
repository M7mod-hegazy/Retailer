// invoices, quotations, sales_returns: add notes (invoices) and tax columns (all three)
// pos_drafts: add notes and nullable tax columns
// settings: add tax_enabled flag
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "116_invoice_notes_and_sales_tax",
  up(db) {
    // invoices table: add notes + 4 tax columns
    addColumnIfMissing(db, "invoices", "notes", "TEXT");
    addColumnIfMissing(db, "invoices", "tax_enabled", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "invoices", "tax_rate", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "invoices", "tax_amount", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "invoices", "tax_type", "TEXT");

    // quotations table: add 4 tax columns (notes already exists)
    addColumnIfMissing(db, "quotations", "tax_enabled", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "quotations", "tax_rate", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "quotations", "tax_amount", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "quotations", "tax_type", "TEXT");

    // sales_returns table: add 4 tax columns (notes already exists)
    addColumnIfMissing(db, "sales_returns", "tax_enabled", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "sales_returns", "tax_rate", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "sales_returns", "tax_amount", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "sales_returns", "tax_type", "TEXT");

    // pos_drafts table: add notes and nullable tax columns
    addColumnIfMissing(db, "pos_drafts", "notes", "TEXT");
    addColumnIfMissing(db, "pos_drafts", "tax_enabled", "INTEGER");
    addColumnIfMissing(db, "pos_drafts", "tax_rate", "REAL");

    // settings table: add tax_enabled flag
    addColumnIfMissing(db, "settings", "tax_enabled", "INTEGER NOT NULL DEFAULT 0");
  },
};
