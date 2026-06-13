function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "127_repair_orders",
  up(db) {
    // Repair orders main table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS repair_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        device_type TEXT,
        device_brand TEXT,
        device_model TEXT,
        serial_number TEXT,
        reported_issue TEXT NOT NULL,
        diagnosis TEXT,
        status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','diagnosing','waiting_parts','in_repair','waiting_customer','ready','delivered','cancelled')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        estimated_cost REAL DEFAULT 0,
        deposit_amount REAL DEFAULT 0,
        final_cost REAL DEFAULT 0,
        warranty_days INTEGER DEFAULT 0,
        notes TEXT,
        received_at TEXT NOT NULL DEFAULT (datetime('now')),
        estimated_delivery TEXT,
        delivered_at TEXT,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Parts used in repair (links to items)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS repair_order_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        part_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_cost REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Labor charges
    db.prepare(`
      CREATE TABLE IF NOT EXISTS repair_order_labor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    // Status history log
    db.prepare(`
      CREATE TABLE IF NOT EXISTS repair_order_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repair_order_id INTEGER NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare("CREATE INDEX IF NOT EXISTS idx_repair_orders_customer ON repair_orders(customer_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_repair_orders_number ON repair_orders(order_number)").run();

    // Add repair_order_id to payments table for deposit tracking
    addColumnIfMissing(db, "payments", "repair_order_id", "INTEGER REFERENCES repair_orders(id) ON DELETE SET NULL");
  },
};
