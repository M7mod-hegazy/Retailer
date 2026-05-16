module.exports = {
  version: 65,
  description: "Add warehouse_id column to branch_transfers (fixes mismatch with route queries)",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(branch_transfers)").all().map(c => c.name);
    if (cols.includes("warehouse_id")) return;
    db.exec("ALTER TABLE branch_transfers ADD COLUMN warehouse_id INTEGER NOT NULL DEFAULT 1 REFERENCES warehouses(id)");
  },
};
