function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "123_item_units",
  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        unit_name TEXT NOT NULL,
        factor INTEGER NOT NULL CHECK(factor >= 1),
        sale_price REAL,
        wholesale_price REAL,
        barcode TEXT UNIQUE,
        is_default_sale INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare("CREATE INDEX IF NOT EXISTS idx_item_units_item ON item_units(item_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_item_units_barcode ON item_units(barcode)").run();

    // Denormalized snapshot on invoice_lines — NULL on old rows, populated only when sold via a unit
    addColumnIfMissing(db, "invoice_lines", "sold_unit_name",   "TEXT");
    addColumnIfMissing(db, "invoice_lines", "sold_unit_factor", "INTEGER");
    addColumnIfMissing(db, "invoice_lines", "sold_unit_qty",    "REAL");
  },
};
