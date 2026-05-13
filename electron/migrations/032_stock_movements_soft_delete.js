function up(db) {
  const cols = db.prepare("PRAGMA table_info(stock_movements)").all();
  const hasDeletedAt = cols.some((c) => c.name === "deleted_at");
  if (!hasDeletedAt) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN deleted_at TEXT");
  }
}

module.exports = { up };

