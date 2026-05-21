module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(sales_returns)").all().map(c => c.name);
    if (!cols.includes("warehouse_id"))
      db.exec("ALTER TABLE sales_returns ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id)");
  },
};
