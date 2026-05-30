function hasTable(db, table) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

function hasColumns(db, table, columns) {
  if (!hasTable(db, table)) return false;
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name));
  return columns.every((column) => existing.has(column));
}

function createIndex(db, table, columns, sql) {
  if (!hasColumns(db, table, columns)) return;
  db.exec(sql);
}

module.exports = {
  up(db) {
    createIndex(
      db,
      "items",
      ["deleted_at", "is_active", "category_id", "sku_sequence", "id"],
      "CREATE INDEX IF NOT EXISTS idx_items_active_category_sequence ON items(deleted_at, is_active, category_id, sku_sequence, id)",
    );
    createIndex(
      db,
      "items",
      ["name"],
      "CREATE INDEX IF NOT EXISTS idx_items_name_nocase ON items(name COLLATE NOCASE)",
    );
    createIndex(
      db,
      "items",
      ["code"],
      "CREATE INDEX IF NOT EXISTS idx_items_code_nocase ON items(code COLLATE NOCASE)",
    );
    createIndex(
      db,
      "items",
      ["barcode"],
      "CREATE INDEX IF NOT EXISTS idx_items_barcode_nocase ON items(barcode COLLATE NOCASE)",
    );
    createIndex(
      db,
      "customers",
      ["is_active", "name", "phone", "code"],
      "CREATE INDEX IF NOT EXISTS idx_customers_active_lookup ON customers(is_active, name COLLATE NOCASE, phone, code COLLATE NOCASE)",
    );
    createIndex(
      db,
      "suppliers",
      ["is_active", "name", "phone", "code"],
      "CREATE INDEX IF NOT EXISTS idx_suppliers_active_lookup ON suppliers(is_active, name COLLATE NOCASE, phone, code COLLATE NOCASE)",
    );
    createIndex(
      db,
      "invoices",
      ["created_at", "status", "customer_id"],
      "CREATE INDEX IF NOT EXISTS idx_invoices_date_status_customer ON invoices(created_at, status, customer_id)",
    );
    createIndex(
      db,
      "purchases",
      ["created_at", "status", "supplier_id"],
      "CREATE INDEX IF NOT EXISTS idx_purchases_date_status_supplier ON purchases(created_at, status, supplier_id)",
    );
    createIndex(
      db,
      "stock_movements",
      ["warehouse_id", "item_id", "created_at", "movement_type"],
      "CREATE INDEX IF NOT EXISTS idx_stock_movements_common_filters ON stock_movements(warehouse_id, item_id, created_at, movement_type)",
    );
    createIndex(
      db,
      "payments",
      ["created_at", "party_type", "party_id"],
      "CREATE INDEX IF NOT EXISTS idx_payments_date_party ON payments(created_at, party_type, party_id)",
    );
    createIndex(
      db,
      "stock_levels",
      ["warehouse_id", "item_id"],
      "CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse_item ON stock_levels(warehouse_id, item_id)",
    );
  },
};
