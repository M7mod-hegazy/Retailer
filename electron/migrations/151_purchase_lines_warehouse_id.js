/**
 * Root-cause fix for "FOREIGN KEY constraint failed" on editing/voiding a purchase.
 *
 * Sales invoices store warehouse_id on invoice_lines, so reversing their stock on
 * void/edit targets the real warehouse. purchase_lines never had a warehouse_id
 * column — so the purchase void/edit/cancel reversal fell back to a hardcoded
 * warehouse 1. On any store whose warehouse isn't id 1 (deleted or different id),
 * the stock_levels/stock_movements insert FK-fails on warehouse_id -> warehouses.
 * That is why creating a purchase works (the form supplies a real warehouse) but
 * editing/deleting it fails on every invoice.
 *
 * This adds the column and backfills it for existing lines from the warehouse the
 * original purchase actually deposited stock into (recorded on stock_movements),
 * falling back to the purchase header warehouse, then the configured default.
 */
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

module.exports = {
  up(db) {
    addColumnIfMissing(db, "purchase_lines", "warehouse_id", "INTEGER");

    const defaultWh =
      db.prepare("SELECT default_warehouse_id AS w FROM settings WHERE id = 1").get()?.w ||
      db.prepare("SELECT id FROM warehouses ORDER BY id ASC LIMIT 1").get()?.id ||
      null;

    // The purchases header may or may not have a warehouse_id column depending on
    // the database's migration history — only reference it when it exists.
    const purchasesHasWh = db
      .prepare("PRAGMA table_info(purchases)")
      .all()
      .some((c) => c.name === "warehouse_id");
    const headerTerm = purchasesHasWh
      ? "(SELECT p.warehouse_id FROM purchases p WHERE p.id = purchase_lines.purchase_id),"
      : "";

    // Backfill from the original purchase stock movement (most accurate), else the
    // purchase header warehouse (when present), else the system default.
    const updated = db
      .prepare(
        `UPDATE purchase_lines
            SET warehouse_id = COALESCE(
              (SELECT sm.warehouse_id FROM stock_movements sm
                WHERE sm.reference_type = 'purchase'
                  AND sm.reference_id = purchase_lines.purchase_id
                  AND sm.item_id = purchase_lines.item_id
                  AND sm.warehouse_id IS NOT NULL
                ORDER BY sm.id ASC LIMIT 1),
              ${headerTerm}
              ?
            )
          WHERE warehouse_id IS NULL`
      )
      .run(defaultWh);

    // Final safety: any line still pointing at a non-existent warehouse → default.
    if (defaultWh) {
      db.prepare(
        `UPDATE purchase_lines SET warehouse_id = ?
          WHERE warehouse_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = purchase_lines.warehouse_id)`
      ).run(defaultWh);
    }

    console.log(`[151] purchase_lines.warehouse_id added; backfilled ${updated.changes} rows (default=${defaultWh})`);
  },
};
