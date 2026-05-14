function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Extend sessions with scope info and user-defined name
  addColumnIfMissing(db, "physical_count_sessions", "scope", "TEXT DEFAULT 'warehouse'");
  addColumnIfMissing(db, "physical_count_sessions", "category_id", "INTEGER REFERENCES item_categories(id)");
  addColumnIfMissing(db, "physical_count_sessions", "name", "TEXT");

  // Extend lines to track warehouse per line (needed for multi-warehouse scopes)
  addColumnIfMissing(db, "physical_count_lines", "warehouse_id", "INTEGER REFERENCES warehouses(id)");
  addColumnIfMissing(db, "physical_count_lines", "touched", "INTEGER DEFAULT 0");

  // Unique constraint per session+item+warehouse (SQLite: create index as unique)
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name);
  if (!indexes.includes("uq_pcl_session_item_wh")) {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS uq_pcl_session_item_wh ON physical_count_lines(session_id, item_id, COALESCE(warehouse_id, 0))",
    );
  }
}

module.exports = { up };
