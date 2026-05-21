module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(purchase_returns)").all().map(c => c.name);
    if (!cols.includes("warehouse_id"))
      db.exec("ALTER TABLE purchase_returns ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)");
  },
};
