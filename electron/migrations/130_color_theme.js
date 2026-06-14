module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    if (!cols.includes("color_theme")) {
      db.exec("ALTER TABLE settings ADD COLUMN color_theme TEXT DEFAULT 'emerald'");
    }
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
