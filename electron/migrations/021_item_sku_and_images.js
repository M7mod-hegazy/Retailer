function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "item_categories", "sku_prefix", "TEXT");
  addColumnIfMissing(db, "items", "sku_sequence", "INTEGER");

  db.exec(`
    CREATE TABLE IF NOT EXISTS item_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_categories_sku_prefix ON item_categories(sku_prefix);
    CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);
  `);
}

module.exports = { up };
