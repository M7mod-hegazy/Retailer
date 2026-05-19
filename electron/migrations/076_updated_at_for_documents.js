module.exports = {
  version: 76,
  name: "076_updated_at_for_documents",
  up(db) {
    const tables = ["invoices", "purchases", "sales_returns", "purchase_returns", "branch_transfers"];
    for (const t of tables) {
      try { db.exec(`ALTER TABLE ${t} ADD COLUMN updated_at TEXT`); } catch (_) {}
    }
  },
};
