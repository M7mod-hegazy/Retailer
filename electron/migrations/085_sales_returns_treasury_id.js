module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(sales_returns)").all().map(c => c.name);
    if (!cols.includes("treasury_id"))
      db.exec("ALTER TABLE sales_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)");
  },
};
