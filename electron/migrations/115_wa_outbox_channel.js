// wa_outbox: add a channel abstraction (SMS designed-in for later) and a lead_id for clean
// birthday dedupe/reporting against the new leads table.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "115_wa_outbox_channel",
  up(db) {
    addColumnIfMissing(db, "wa_outbox", "channel", "TEXT NOT NULL DEFAULT 'whatsapp'");
    addColumnIfMissing(db, "wa_outbox", "lead_id", "INTEGER");
  },
};
