module.exports = {
  up(db) {
    // audit_logs enhancements
    const auditCols = db.prepare("PRAGMA table_info(audit_logs)").all().map(c => c.name);

    const addIfMissingAudit = (col, def) => {
      if (!auditCols.includes(col)) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN ${col} ${def}`);
      }
    };

    addIfMissingAudit("description", "TEXT");
    addIfMissingAudit("link",        "TEXT");

    // notifications enhancements
    const notifCols = db.prepare("PRAGMA table_info(notifications)").all().map(c => c.name);

    const addIfMissingNotif = (col, def) => {
      if (!notifCols.includes(col)) {
        db.exec(`ALTER TABLE notifications ADD COLUMN ${col} ${def}`);
      }
    };

    addIfMissingNotif("link", "TEXT");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
