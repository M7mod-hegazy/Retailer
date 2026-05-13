module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS supplier_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES users(id)
      );
    `);
  },
  down(db) {
    db.exec(`DROP TABLE IF EXISTS customer_notes; DROP TABLE IF EXISTS supplier_notes;`);
  }
};
