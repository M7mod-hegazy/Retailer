function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "130_feature_promotions",
  up(db) {
    // Promotions/discounts is now an opt-in module like the other feature flags —
    // hidden from menus and locked at the route until the dev account enables it.
    addColumnIfMissing(db, "settings", "feature_promotions", "INTEGER NOT NULL DEFAULT 0");
  },
};
