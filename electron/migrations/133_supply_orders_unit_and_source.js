function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((entry) => entry.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function up(db) {
  // Persist the unit chosen on each PO line (was previously discarded).
  addColumnIfMissing(db, "purchase_order_lines", "unit_id", "INTEGER");
  // Optional suggested destination warehouse for the PO (default when converting).
  addColumnIfMissing(db, "purchase_orders", "warehouse_id", "INTEGER");
  // Link a purchase invoice back to the PO it was received from.
  addColumnIfMissing(db, "purchases", "source_purchase_order_id", "INTEGER");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_purchases_source_po ON purchases(source_purchase_order_id)"
  );
}

module.exports = { up };
