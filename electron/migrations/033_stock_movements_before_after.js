function up(db) {
  const cols = db.prepare("PRAGMA table_info(stock_movements)").all();
  const hasBefore = cols.some((c) => c.name === "before_qty");
  const hasAfter = cols.some((c) => c.name === "after_qty");
  if (!hasBefore) db.exec("ALTER TABLE stock_movements ADD COLUMN before_qty INTEGER");
  if (!hasAfter) db.exec("ALTER TABLE stock_movements ADD COLUMN after_qty INTEGER");
}

module.exports = { up };

