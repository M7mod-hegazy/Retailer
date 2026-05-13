function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function up(db) {
  // Add page_permissions column to users table (nullable, defaults to NULL)
  addColumnIfMissing(db, "users", "page_permissions", "TEXT");

  // Add default_user_permissions row to settings_kv (key/value store)
  db.prepare(`INSERT OR IGNORE INTO settings_kv (key, value) VALUES ('default_user_permissions', '{"pos":["view","add"]}')`).run();
}

module.exports = { name: '059_page_permissions', up };
