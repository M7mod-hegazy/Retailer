// Scheduled Telegram analytics digests: per-period toggles + a sent-log so a
// digest for a completed period is delivered exactly once (with catch-up on the
// next app launch if the scheduled time was missed while the app was closed).
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "185_telegram_digests",
  up(db) {
    // Per-period enable toggles (default OFF — opt-in).
    addColumnIfMissing(db, "settings", "telegram_notify_weekly", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "telegram_notify_monthly", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "telegram_notify_yearly", "INTEGER NOT NULL DEFAULT 0");

    // One row per (period_type, period_key) that has been sent.
    db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_digest_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        period_type TEXT NOT NULL,
        period_key  TEXT NOT NULL,
        sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(period_type, period_key)
      )
    `);
  },
};
