module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
    if (!cols.includes("created_by")) {
      db.exec("ALTER TABLE payments ADD COLUMN created_by INTEGER REFERENCES users(id)");
    }
  },
};
