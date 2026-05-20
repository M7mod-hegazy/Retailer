module.exports = {
  version: 78,
  name: "078_purchases_updated_by",
  up(db) {
    try { db.exec("ALTER TABLE purchases ADD COLUMN updated_by INTEGER REFERENCES users(id)"); } catch (_) {}
  },
};
