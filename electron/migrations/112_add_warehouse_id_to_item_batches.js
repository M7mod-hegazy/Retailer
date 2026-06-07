function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "112_add_warehouse_id_to_item_batches",
  up(db) {
    addColumnIfMissing(db, "item_batches", "warehouse_id", "INTEGER NOT NULL DEFAULT 1");
  },
};
