const { getDb } = require("../config/database");

/**
 * Recalculate WACC after a purchase.
 * Called inside an existing transaction — uses the passed db instance.
 * Returns the new WACC value so callers can snapshot it on purchase lines.
 */
function recalculateWACC(item_id, new_qty, new_cost, db) {
  const row = db.prepare(
    "SELECT quantity, wacc FROM stock_levels WHERE item_id = ? LIMIT 1"
  ).get(item_id);

  const current_qty   = Number(row?.quantity  || 0);
  const current_wacc  = Number(row?.wacc      || 0);
  const total_qty     = current_qty + new_qty;
  const total_value   = (current_qty * current_wacc) + (new_qty * new_cost);
  const new_wacc      = total_qty > 0 ? total_value / total_qty : new_cost;

  // Update ALL stock_level rows for this item (global WACC, not per-warehouse)
  db.prepare(
    "UPDATE stock_levels SET wacc = ?, last_purchase_cost = ? WHERE item_id = ?"
  ).run(new_wacc, new_cost, item_id);

  return new_wacc;
}

/**
 * Read current snapshot costs for an item.
 * Called at invoice creation time to freeze costs on invoice lines.
 */
function getSnapshotCosts(item_id, db) {
  const row = db.prepare(
    "SELECT wacc, last_purchase_cost FROM stock_levels WHERE item_id = ? LIMIT 1"
  ).get(item_id);
  return {
    cost_wacc:          Number(row?.wacc               || 0),
    cost_last_purchase: Number(row?.last_purchase_cost || 0),
  };
}

/**
 * Check if an item's current margin is below the minimum threshold.
 * Returns margin info — never throws.
 */
function checkItemMargin(item_id, db_instance) {
  const db = db_instance || getDb();
  const item = db.prepare(
    "SELECT id, name, sale_price, purchase_price, min_margin_percent FROM items WHERE id = ?"
  ).get(item_id);
  if (!item) return null;

  const settings = db.prepare(
    "SELECT min_margin_percent FROM settings WHERE id = 1"
  ).get();
  const global_min = Number(settings?.min_margin_percent ?? 15);
  const item_min   = item.min_margin_percent != null ? Number(item.min_margin_percent) : global_min;

  const sl = db.prepare(
    "SELECT wacc FROM stock_levels WHERE item_id = ? LIMIT 1"
  ).get(item_id);
  const wacc = Number(sl?.wacc || item.purchase_price || 0);

  const sale_price = Number(item.sale_price || 0);
  const current_margin = wacc > 0 ? ((sale_price - wacc) / wacc) * 100 : null;
  const suggested_price = wacc * (1 + item_min / 100);
  const below_threshold = current_margin !== null && current_margin < item_min;

  return {
    item_id,
    item_name: item.name,
    wacc,
    sale_price,
    current_margin_percent: current_margin !== null ? Math.round(current_margin * 100) / 100 : null,
    min_margin_percent: item_min,
    suggested_price: Math.round(suggested_price * 100) / 100,
    below_threshold,
  };
}

/**
 * Get all items currently below minimum margin threshold.
 * Used by analytics + reports.
 */
function getItemsBelowMargin(db_instance) {
  const db = db_instance || getDb();
  const settings = db.prepare("SELECT min_margin_percent FROM settings WHERE id = 1").get();
  const global_min = Number(settings?.min_margin_percent ?? 15);

  const items = db.prepare(
    "SELECT id, name, sale_price, purchase_price, min_margin_percent FROM items WHERE deleted_at IS NULL"
  ).all();

  const results = [];
  for (const item of items) {
    const info = checkItemMargin(item.id, db);
    if (info && info.below_threshold) results.push(info);
  }

  return results.sort((a, b) => (a.current_margin_percent ?? -999) - (b.current_margin_percent ?? -999));
}

/**
 * Recompute WACC for an item by replaying all surviving (non-cancelled, non-voided) purchase lines
 * in chronological order. Call this after any cancel, void, purchase return, or edit.
 */
function recomputeWACCForItem(item_id, db) {
  const lines = db.prepare(`
    SELECT pl.quantity, pl.unit_cost
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    WHERE pl.item_id = ?
      AND p.status NOT IN ('cancelled', 'voided')
    ORDER BY p.created_at ASC, pl.id ASC
  `).all(item_id);

  let wacc = 0;
  let runningQty = 0;
  let lastCost = 0;

  for (const line of lines) {
    const qty = Number(line.quantity);
    const cost = Number(line.unit_cost);
    const totalQty = runningQty + qty;
    wacc = totalQty > 0 ? (runningQty * wacc + qty * cost) / totalQty : cost;
    runningQty = totalQty;
    lastCost = cost;
  }

  // If no surviving lines, reset to 0
  db.prepare("UPDATE stock_levels SET wacc = ?, last_purchase_cost = ? WHERE item_id = ?")
    .run(lines.length > 0 ? wacc : 0, lines.length > 0 ? lastCost : 0, item_id);

  return wacc;
}

module.exports = { recalculateWACC, recomputeWACCForItem, getSnapshotCosts, checkItemMargin, getItemsBelowMargin };
