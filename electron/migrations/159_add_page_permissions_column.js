module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!cols.includes("page_permissions")) {
      db.exec("ALTER TABLE users ADD COLUMN page_permissions TEXT DEFAULT NULL");
    }
  },
};
