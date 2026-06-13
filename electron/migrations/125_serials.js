function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "125_serials",
  up(db) {
    addColumnIfMissing(db, "items", "track_serials",            "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "items", "default_warranty_months",  "INTEGER");

    db.prepare(`
      CREATE TABLE IF NOT EXISTS item_serials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        serial TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_stock'
          CHECK(status IN ('in_stock','sold','returned','defective')),
        warehouse_id INTEGER DEFAULT 1,
        purchase_id INTEGER,
        purchase_line_id INTEGER,
        invoice_id INTEGER,
        invoice_line_id INTEGER,
        warranty_months INTEGER,
        sold_at TEXT,
        returned_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(item_id, serial)
      )
    `).run();

    db.prepare("CREATE INDEX IF NOT EXISTS idx_serials_serial ON item_serials(serial)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_serials_status ON item_serials(item_id, status)").run();
  },
};
