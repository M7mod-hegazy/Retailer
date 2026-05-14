module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);

    if (!columns.includes("additional_addresses")) {
      db.exec("ALTER TABLE settings ADD COLUMN additional_addresses TEXT DEFAULT '[]'");
    }
    if (!columns.includes("additional_phones")) {
      db.exec("ALTER TABLE settings ADD COLUMN additional_phones TEXT DEFAULT '[]'");
    }
    if (!columns.includes("address_position")) {
      db.exec("ALTER TABLE settings ADD COLUMN address_position TEXT DEFAULT 'top'");
    }
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
    // Best-effort: columns remain but are ignored by the app
  },
};
