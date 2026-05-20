module.exports = {
  up(db) {
    db.prepare("ALTER TABLE invoices ADD COLUMN paid_at TEXT").run();
  },
};
