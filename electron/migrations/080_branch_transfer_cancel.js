module.exports = {
  version: 80,
  name: "080_branch_transfer_cancel",
  up(db) {
    try { db.exec("ALTER TABLE branch_transfers ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch (_) {}
    try { db.exec("ALTER TABLE branch_transfers ADD COLUMN cancelled_at TEXT"); } catch (_) {}
    try { db.exec("ALTER TABLE branch_transfers ADD COLUMN cancelled_by INTEGER REFERENCES users(id)"); } catch (_) {}
    try { db.exec("ALTER TABLE branch_transfers ADD COLUMN cancel_reason TEXT"); } catch (_) {}
  },
};
