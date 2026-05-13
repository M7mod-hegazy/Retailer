module.exports = {
  version: 35,
  description: "Create branch_transfers and branch_transfer_lines tables",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS branch_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_no TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('receive', 'send')),
        warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS branch_transfer_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER NOT NULL REFERENCES branch_transfers(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id),
        quantity REAL NOT NULL CHECK (quantity > 0)
      );
    `);
  },
};
