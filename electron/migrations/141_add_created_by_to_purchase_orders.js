module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(purchase_orders)").all().map(c => c.name);
    if (!cols.includes("created_by")) {
      db.exec("ALTER TABLE purchase_orders ADD COLUMN created_by INTEGER REFERENCES users(id)");
    }
  }
};
