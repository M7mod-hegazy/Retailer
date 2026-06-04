module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    if (!cols.includes("max_discount_percent"))
      db.exec("ALTER TABLE settings ADD COLUMN max_discount_percent REAL NOT NULL DEFAULT 15");
  },
};
