function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "124_variants",
  up(db) {
    addColumnIfMissing(db, "items", "is_variant_parent", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "items", "parent_item_id",    "INTEGER REFERENCES items(id)");
    addColumnIfMissing(db, "items", "variant_attributes","TEXT");

    db.prepare("CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_item_id)").run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS variant_attributes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS variant_attribute_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attribute_id INTEGER NOT NULL REFERENCES variant_attributes(id),
        value TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        UNIQUE(attribute_id, value)
      )
    `).run();
  },
};
