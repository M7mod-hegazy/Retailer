module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);

    const addIfMissing = (col, def) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
      }
    };

    // Minimum age (in hours) before an auto-backup is "due". The auto-backup
    // engine is now interval/staleness based (launch catch-up + hourly tick +
    // on-close) instead of a single fixed clock time, so the app still backs up
    // even when the PC is off at the old 02:00 schedule. (auto_backup_time is
    // left in place but no longer read.)
    addIfMissing("auto_backup_interval_hours", "INTEGER DEFAULT 24");

    // ISO timestamp of the last successful auto-backup — the staleness anchor.
    addIfMissing("last_auto_backup_at", "TEXT");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
