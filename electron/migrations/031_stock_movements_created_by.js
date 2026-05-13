function up(db) {
  // Add created_by column to stock_movements for tracking who made the movement
  const cols = db.prepare("PRAGMA table_info(stock_movements)").all().map(c => c.name);
  if (!cols.includes("created_by")) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN created_by INTEGER REFERENCES users(id)");
  }
  
  // Add updated_at column if missing
  if (!cols.includes("updated_at")) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN updated_at TEXT");
  }
  
  // Add deleted_at column if missing  
  if (!cols.includes("deleted_at")) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN deleted_at TEXT");
  }
  
  // Add notes column if missing
  if (!cols.includes("notes")) {
    db.exec("ALTER TABLE stock_movements ADD COLUMN notes TEXT");
  }
}

module.exports = { up };
