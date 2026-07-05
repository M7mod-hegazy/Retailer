module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(items)").all().map(c => c.name);
    if (!cols.includes("stock")) {
      db.exec("ALTER TABLE items ADD COLUMN stock INTEGER DEFAULT 0");
    }
  },
};
