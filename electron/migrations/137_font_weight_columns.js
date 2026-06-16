module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);

    const addIfMissing = (col, def) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
      }
    };

    addIfMissing("font_weight",          "TEXT DEFAULT '700'");
    addIfMissing("number_font_weight",   "TEXT DEFAULT '700'");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
