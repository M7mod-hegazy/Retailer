module.exports = {
  version: 75,
  description: "Add selling_price and unit_id to branch_transfer_lines",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(branch_transfer_lines)").all().map(c => c.name);
    if (!cols.includes("selling_price")) {
      db.exec("ALTER TABLE branch_transfer_lines ADD COLUMN selling_price REAL NOT NULL DEFAULT 0");
    }
    if (!cols.includes("unit_id")) {
      db.exec("ALTER TABLE branch_transfer_lines ADD COLUMN unit_id INTEGER REFERENCES units(id)");
    }
  },
};
