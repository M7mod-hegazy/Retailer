function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "126_scale_barcodes",
  up(db) {
    addColumnIfMissing(db, "settings", "scale_prefix",           "TEXT DEFAULT '22'");
    addColumnIfMissing(db, "settings", "scale_item_code_length", "INTEGER DEFAULT 5");
    addColumnIfMissing(db, "settings", "scale_value_type",       "TEXT DEFAULT 'weight'");
    addColumnIfMissing(db, "settings", "scale_value_decimals",   "INTEGER DEFAULT 3");
    addColumnIfMissing(db, "items",    "scale_plu",              "TEXT");
    db.prepare("CREATE INDEX IF NOT EXISTS idx_items_scale_plu ON items(scale_plu)").run();
  },
};
