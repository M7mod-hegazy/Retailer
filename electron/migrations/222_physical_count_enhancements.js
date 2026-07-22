// Migration 222 — Physical count enhancements: per-product notes, timestamps,
// completion tracking, multi-user audit, and "complete" session type.
//
// physical_count_lines: +notes, +counted_at, +counted_by, +status
// physical_count_sessions: +completed_at, +completed_by, +type
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  addColumnIfMissing(db, "physical_count_lines", "notes", "TEXT DEFAULT NULL");
  addColumnIfMissing(db, "physical_count_lines", "counted_at", "TEXT DEFAULT NULL");
  addColumnIfMissing(db, "physical_count_lines", "counted_by", "INTEGER DEFAULT NULL");
  addColumnIfMissing(db, "physical_count_lines", "status", "TEXT DEFAULT 'pending'");

  addColumnIfMissing(db, "physical_count_sessions", "completed_at", "TEXT DEFAULT NULL");
  addColumnIfMissing(db, "physical_count_sessions", "completed_by", "INTEGER DEFAULT NULL");
  addColumnIfMissing(db, "physical_count_sessions", "type", "TEXT DEFAULT 'standard'");

  try { db.exec("CREATE INDEX IF NOT EXISTS idx_pcl_status ON physical_count_lines(status)"); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_pcl_counted_by ON physical_count_lines(counted_by)"); } catch {}
}

module.exports = { up, name: "222_physical_count_enhancements" };
