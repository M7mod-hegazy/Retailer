// expense_categories and revenue_categories: add parent_id column
// expense_categories was created in migration 004 without parent_id.
// Migration 039 tried to recreate it with CREATE TABLE IF NOT EXISTS,
// which is a no-op since the table already exists.
// revenue_categories already has parent_id from migration 011,
// but we defensively add it in case it's missing.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "117_expense_revenue_categories_parent_id",
  up(db) {
    addColumnIfMissing(db, "expense_categories", "parent_id", "INTEGER REFERENCES expense_categories(id)");
    addColumnIfMissing(db, "revenue_categories", "parent_id", "INTEGER REFERENCES revenue_categories(id)");
  },
};
