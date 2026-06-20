module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(purchase_orders)").all().map(c => c.name);
    if (!cols.includes("discount")) {
      db.exec("ALTER TABLE purchase_orders ADD COLUMN discount REAL NOT NULL DEFAULT 0");
    }
    if (!cols.includes("increase")) {
      db.exec("ALTER TABLE purchase_orders ADD COLUMN increase REAL NOT NULL DEFAULT 0");
    }
  }
};
