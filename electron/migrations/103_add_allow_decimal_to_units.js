module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(units)").all().map(c => c.name);
    if (!cols.includes("allow_decimal")) {
      db.exec("ALTER TABLE units ADD COLUMN allow_decimal INTEGER DEFAULT 1");
    }
  },
};
