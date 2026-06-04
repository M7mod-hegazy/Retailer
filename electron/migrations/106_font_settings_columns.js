module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);

    const addIfMissing = (col, def) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`);
      }
    };

    addIfMissing("font_family",        "TEXT DEFAULT 'Noto Sans Arabic'");
    addIfMissing("font_size",          "TEXT DEFAULT 'normal'");
    addIfMissing("number_font_family", "TEXT DEFAULT 'Outfit'");
    addIfMissing("number_font_scale",  "TEXT DEFAULT 'normal'");
    addIfMissing("numeral_style",      "TEXT DEFAULT 'western'");
  },

  down(db) {
    // SQLite ALTER TABLE DROP COLUMN requires >= 3.35.0
  },
};
