module.exports = {
  version: 77,
  name: "077_invoices_updated_by",
  up(db) {
    try { db.exec("ALTER TABLE invoices ADD COLUMN updated_by INTEGER REFERENCES users(id)"); } catch (_) {}
  },
};
