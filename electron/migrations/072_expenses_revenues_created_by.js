module.exports = {
  version: 72,
  description: "Add created_by to expenses and revenues for user tracking",
  up(db) {
    try { db.prepare("ALTER TABLE expenses ADD COLUMN created_by INTEGER REFERENCES users(id)").run(); } catch (_) {}
    try { db.prepare("ALTER TABLE revenues ADD COLUMN created_by INTEGER REFERENCES users(id)").run(); } catch (_) {}
  },
};
