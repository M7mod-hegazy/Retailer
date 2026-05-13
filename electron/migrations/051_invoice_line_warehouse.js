module.exports = {
  up(db) {
    try { db.exec("ALTER TABLE invoice_lines ADD COLUMN warehouse_id INTEGER DEFAULT 1 REFERENCES warehouses(id)"); } catch (_) {}
  },
};
