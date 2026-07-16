function addCol(db, table, col, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

module.exports.up = function (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_tag_map (
      customer_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (customer_id, tag_id),
      FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
    );
  `);

  addCol(db, "customers", "notes", "TEXT");
};

module.exports.down = function (db) {
  db.exec(`DROP TABLE IF EXISTS customer_tag_map`);
  db.exec(`DROP TABLE IF EXISTS customer_tags`);
};
