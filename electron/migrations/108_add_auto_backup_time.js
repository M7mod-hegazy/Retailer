module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);

    const addIfMissing = (col, def) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
      }
    };

    // Daily time (HH:MM, 24h) for the scheduled auto-backup. Empty/'02:00' default.
    addIfMissing("auto_backup_time", "TEXT DEFAULT '02:00'");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
