function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "122_feature_module_flags",
  up(db) {
    addColumnIfMissing(db, "settings", "feature_multi_unit",     "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_variants",       "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_serials",        "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_scale_barcodes", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_repair_orders",  "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_restaurant",     "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "feature_gold",           "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "serials_strict_mode",    "INTEGER NOT NULL DEFAULT 1");
  },
};
