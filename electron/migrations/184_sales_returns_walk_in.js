// Adds walk-in customer fields to sales_returns so a return can carry a
// lightweight name/phone (mirrors the POS invoice walk_in_* columns from
// migrations 170/171) — for direct returns and inherited from-invoice returns.
module.exports = {
  name: "184_sales_returns_walk_in",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(sales_returns)").all().map((c) => c.name);
    if (!cols.includes("walk_in_name")) {
      db.exec("ALTER TABLE sales_returns ADD COLUMN walk_in_name TEXT");
    }
    if (!cols.includes("walk_in_phone")) {
      db.exec("ALTER TABLE sales_returns ADD COLUMN walk_in_phone TEXT");
    }
  },
};
