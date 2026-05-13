module.exports = {
  up(db) {
    try {
      db.exec(`ALTER TABLE invoices ADD COLUMN seller_id INTEGER REFERENCES employees(id) ON DELETE SET NULL`);
    } catch (_) { /* column may already exist */ }
    try {
      db.exec(`ALTER TABLE invoices ADD COLUMN increase REAL NOT NULL DEFAULT 0`);
    } catch (_) { /* column may already exist */ }
  },
  down(db) {
    // SQLite does not support DROP COLUMN in older versions.
  }
};
