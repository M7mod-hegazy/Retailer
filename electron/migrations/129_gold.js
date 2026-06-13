function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "129_gold",
  up(db) {
    // Gold rates by karat — daily entry
    db.prepare(`
      CREATE TABLE IF NOT EXISTS gold_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rate_date TEXT NOT NULL,
        karat INTEGER NOT NULL CHECK(karat IN (18, 21, 22, 24)),
        price_per_gram REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EGP',
        source TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(rate_date, karat, currency)
      )
    `).run();

    db.prepare("CREATE INDEX IF NOT EXISTS idx_gold_rates_date ON gold_rates(rate_date DESC)").run();

    // Gold-specific item fields
    addColumnIfMissing(db, "items", "is_gold_item",      "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "items", "gold_karat",        "INTEGER DEFAULT 21");
    addColumnIfMissing(db, "items", "gold_weight_grams", "REAL DEFAULT 0");
    addColumnIfMissing(db, "items", "gold_making_charge","REAL DEFAULT 0");

    // Snapshot the gold rate used when creating an invoice line
    addColumnIfMissing(db, "invoice_lines", "gold_weight_grams", "REAL");
    addColumnIfMissing(db, "invoice_lines", "gold_rate_per_gram","REAL");
    addColumnIfMissing(db, "invoice_lines", "gold_making_charge","REAL");
  },
};
