module.exports = {
  version: 34,
  description: "Add status column to purchases table",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(purchases)").all().map(c => c.name);
    if (!cols.includes("status")) {
      db.prepare("ALTER TABLE purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run();
    }
  },
};
