module.exports = {
  version: 74,
  description: "Add unit_cost to branch_transfer_lines for receive valuation",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(branch_transfer_lines)").all().map(c => c.name);
    if (!cols.includes("unit_cost")) {
      db.exec("ALTER TABLE branch_transfer_lines ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0");
    }
  },
};
