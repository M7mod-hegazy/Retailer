module.exports = {
  up(db) {
    // Older saves stringified a null path into the literal text "null"/"undefined",
    // which is truthy and would route backups into a folder named "null".
    // Normalise those back to real NULL.
    const cols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);
    if (cols.includes("auto_backup_path")) {
      db.prepare(
        "UPDATE settings SET auto_backup_path = NULL WHERE auto_backup_path IN ('null', 'undefined', '')",
      ).run();
    }
  },

  down() {},
};
