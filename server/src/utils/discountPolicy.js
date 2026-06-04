// Centralised max-discount policy. The cap percent is configurable in
// settings.max_discount_percent (defaults to 15). Used by invoices, sales
// returns, and purchase returns so the limit is enforced consistently.
const DEFAULT_MAX_DISCOUNT_PERCENT = 15;

function getMaxDiscountPercent(db) {
  try {
    const row = db.prepare("SELECT max_discount_percent FROM settings WHERE id = 1").get();
    const pct = Number(row?.max_discount_percent);
    return Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_MAX_DISCOUNT_PERCENT;
  } catch (_) {
    return DEFAULT_MAX_DISCOUNT_PERCENT;
  }
}

// Max discount as a fraction of subtotal (e.g. 0.15).
function getMaxDiscountFraction(db) {
  return getMaxDiscountPercent(db) / 100;
}

// Whether the cap is enforced at all. When disabled, any discount is allowed.
function isDiscountCapEnabled(db) {
  try {
    const row = db.prepare("SELECT discount_cap_enabled FROM settings WHERE id = 1").get();
    // default ON when the column/row is missing
    return row?.discount_cap_enabled === undefined || row?.discount_cap_enabled === null
      ? true
      : Number(row.discount_cap_enabled) !== 0;
  } catch (_) {
    return true;
  }
}

// Single decision point: true when `discount` exceeds the allowed cap for `subtotal`.
function discountExceedsCap(db, subtotal, discount) {
  if (!isDiscountCapEnabled(db)) return false;
  return Number(discount) > Number(subtotal) * getMaxDiscountFraction(db);
}

module.exports = {
  DEFAULT_MAX_DISCOUNT_PERCENT,
  getMaxDiscountPercent,
  getMaxDiscountFraction,
  isDiscountCapEnabled,
  discountExceedsCap,
};
