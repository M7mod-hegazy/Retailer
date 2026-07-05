/**
 * Migration 167: Fix invoices.order_type NOT NULL constraint
 *
 * Migration 166 added order_type as NOT NULL DEFAULT 'dine_in', but
 * `addColumnIfMissing` skips the ALTER if the column already existed
 * (from some path that pre-created it without a DEFAULT). This leaves
 * rows with NULL which cause: "NOT NULL constraint failed: invoices.order_type"
 * when feature_restaurant is off and no order_type is sent by the client.
 *
 * Fix: backfill all NULL order_type rows to 'dine_in'.
 */

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "167_fix_invoices_order_type_default",
  up(db) {
    // Ensure the column exists at all (safe no-op if 166 already ran)
    addColumnIfMissing(
      db,
      "invoices",
      "order_type",
      "TEXT NOT NULL DEFAULT 'dine_in' CHECK(order_type IN ('dine_in','takeaway','delivery'))"
    );

    // Backfill any NULL values that may have been stored before this fix
    db.prepare(
      "UPDATE invoices SET order_type = 'dine_in' WHERE order_type IS NULL"
    ).run();
  },
};
