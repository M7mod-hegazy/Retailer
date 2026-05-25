/**
 * Ensure pricing-system settings columns exist.
 * Migration 086 added these, but if 086 had already run before
 * the column additions were written, this migration fills the gap.
 */
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, 'settings', 'margin_alert_cost_method', "TEXT NOT NULL DEFAULT 'wacc'");
  addColumnIfMissing(db, 'settings', 'target_margin_percent',    'REAL DEFAULT 25');
}

module.exports = { up };
