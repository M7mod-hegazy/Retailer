// Migration 209: store-wide switch for the POS Telegram status chip (the small
// pill cashiers see after an action that fires an owner notification). Owners
// may prefer staff not to see that reports are being sent — default stays ON
// to match previous behavior.

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "209_telegram_status_chip_setting",
  up(db) {
    addColumnIfMissing(db, "settings", "telegram_status_chip_enabled", "INTEGER NOT NULL DEFAULT 1");
  },
};
