module.exports = {
  up(db) {
    // Review queue for orders pushed from the online store. Orders land here as
    // 'pending'; the user reviews and forwards each into a real POS invoice.
    db.exec(`
      CREATE TABLE IF NOT EXISTS online_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ecom_order_id TEXT NOT NULL UNIQUE,
        store_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        total REAL DEFAULT 0,
        items_count INTEGER DEFAULT 0,
        items_json TEXT,
        raw_json TEXT,
        status TEXT DEFAULT 'pending',
        invoice_id INTEGER,
        received_at TEXT DEFAULT (datetime('now')),
        forwarded_at TEXT
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_online_orders_received ON online_orders(received_at)");
  },
};
