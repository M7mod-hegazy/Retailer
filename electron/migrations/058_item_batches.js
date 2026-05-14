module.exports = {
  name: '058_item_batches',
  up(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    if (!tables.includes('item_batches')) {
      db.prepare(`
        CREATE TABLE item_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES items(id),
          batch_no TEXT NOT NULL,
          expiry_date TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          cost_price REAL NOT NULL DEFAULT 0,
          supplier_id INTEGER REFERENCES suppliers(id),
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(item_id, batch_no)
        )
      `).run();
    }
  },
};
