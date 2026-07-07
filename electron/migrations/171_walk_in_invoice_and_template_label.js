// Late additions that were appended to migration 170 AFTER some databases had
// already recorded it as applied (dev DBs mid-development). Re-issued here so
// every database gets them; addColumnIfMissing keeps it a no-op where 170's
// final form already ran.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "171_walk_in_invoice_and_template_label",
  up(db) {
    addColumnIfMissing(db, "message_templates", "label", "TEXT");
    addColumnIfMissing(db, "invoices", "walk_in_phone", "TEXT");
    addColumnIfMissing(db, "invoices", "walk_in_name", "TEXT");
  },
};
