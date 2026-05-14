module.exports = {
  version: 52,
  description: "Add user_id (creator) to invoices",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name);
    if (!cols.includes("user_id")) {
      db.prepare("ALTER TABLE invoices ADD COLUMN user_id INTEGER REFERENCES users(id)").run();
    }
  },
};
