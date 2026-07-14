// Add a JSON column to telegram_recipients so each recipient can remember
// which message-template preset they prefer for every event toggle.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "198_add_event_presets_column",
  up(db) {
    addColumnIfMissing(db, "telegram_recipients", "event_presets", "TEXT NOT NULL DEFAULT '{}'");
  },
};
