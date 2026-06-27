/**
 * Bug fix: purchase_lines never stored the per-line selling price or wholesale
 * price entered at purchase time, so editing/viewing an existing purchase always
 * showed 0 for "سعر البيع" and "جملة".
 *
 * Adds nullable price snapshot columns. Legacy rows stay NULL and fall back to the
 * current item master price in the read query (COALESCE in getPurchaseWithLines).
 */
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = {
  up(db) {
    addColumnIfMissing(db, "purchase_lines", "unit_price", "NUMERIC DEFAULT 0");
    addColumnIfMissing(db, "purchase_lines", "wholesale_price", "NUMERIC DEFAULT 0");
  },
};
