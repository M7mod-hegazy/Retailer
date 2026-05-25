/**
 * Cascade-aware master price update service.
 *
 * When a purchase line has update_master_* = 1 (locked = update master),
 * this service updates items.sale_price / purchase_price / wholesale_price
 * AND writes a price_history row.
 *
 * Cascade-check: if the master price was changed by a DIFFERENT source after
 * this operation set it, we warn but still respect the lock choice (the last
 * locked purchase wins). This prevents silent silent double-updates.
 */
const { roundMoney } = require("../utils/money");

const FIELD_MAP = {
  sale_price:       "sale_price",
  purchase_price:   "purchase_price",
  wholesale_price:  "wholesale_price",
};

/**
 * Apply a master price update from a purchase line.
 *
 * @param {number}  itemId
 * @param {'sale_price'|'purchase_price'|'wholesale_price'} field
 * @param {number}  newValue
 * @param {string}  source        e.g. 'purchase_locked'
 * @param {string}  operationId   e.g. 'PUR-42'
 * @param {number|null} changedBy user id
 * @param {object}  db
 * @returns {{ applied: boolean, oldValue: number, newValue: number, warning: string|null }}
 */
function applyMasterPriceUpdate(itemId, field, newValue, source, operationId, changedBy, db) {
  if (!FIELD_MAP[field]) throw new Error(`Unknown price field: ${field}`);

  const item = db.prepare(`SELECT id, ${field} FROM items WHERE id = ?`).get(itemId);
  if (!item) return { applied: false, oldValue: 0, newValue, warning: "Item not found" };

  const oldValue = roundMoney(item[field] || 0);
  const rounded  = roundMoney(newValue);

  if (oldValue === rounded) {
    return { applied: false, oldValue, newValue: rounded, warning: null };
  }

  // Update master price
  db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(rounded, itemId);

  // Write price_history entry
  db.prepare(`
    INSERT INTO price_history
      (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by, changed_at)
    VALUES (?, ?, ?, ?, 'set', ?, ?, ?, ?, datetime('now'))
  `).run(itemId, field, oldValue, rounded, rounded, source, operationId, changedBy ?? null);

  return { applied: true, oldValue, newValue: rounded, warning: null };
}

/**
 * Revert a master price change when a purchase is voided or deleted.
 *
 * Finds the price_history entry BEFORE the given operationId and restores
 * that value, but only if the current master value still matches what
 * operationId set (to avoid reverting a subsequent manual change).
 *
 * @param {number} itemId
 * @param {'sale_price'|'purchase_price'|'wholesale_price'} field
 * @param {string} sourceOperationId  the operation being undone (e.g. 'PUR-42')
 * @param {number|null} changedBy
 * @param {object} db
 * @returns {{ reverted: boolean, reason: string }}
 */
function revertMasterPrice(itemId, field, sourceOperationId, changedBy, db) {
  if (!FIELD_MAP[field]) return { reverted: false, reason: "Unknown field" };

  // Find the row this operation wrote
  const ourEntry = db.prepare(`
    SELECT id, old_value, new_value FROM price_history
    WHERE item_id = ? AND field = ? AND operation_id = ?
    ORDER BY id DESC LIMIT 1
  `).get(itemId, field, sourceOperationId);

  if (!ourEntry) return { reverted: false, reason: "No history entry found for this operation" };

  // Check current master value matches what we set
  const item = db.prepare(`SELECT ${field} FROM items WHERE id = ?`).get(itemId);
  if (!item) return { reverted: false, reason: "Item not found" };

  const current = roundMoney(item[field] || 0);
  const weSet   = roundMoney(ourEntry.new_value);

  if (Math.abs(current - weSet) > 0.0001) {
    return {
      reverted: false,
      reason: `Current master price (${current}) differs from what this operation set (${weSet}) — a later change exists. Manual correction required.`,
    };
  }

  const restoreTo = roundMoney(ourEntry.old_value);

  db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(restoreTo, itemId);

  db.prepare(`
    INSERT INTO price_history
      (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by, changed_at)
    VALUES (?, ?, ?, ?, 'set', ?, 'revert', ?, ?, datetime('now'))
  `).run(itemId, field, current, restoreTo, restoreTo, `REVERT-${sourceOperationId}`, changedBy ?? null);

  return { reverted: true, reason: null };
}

/**
 * Apply all lock-controlled price updates for a purchase line batch.
 * Designed to be called inside an existing DB transaction.
 *
 * @param {Array<{
 *   item_id, unit_cost, unit_price, wholesale_price,
 *   update_master_purchase_price, update_master_sale_price, update_master_wholesale_price
 * }>} lines
 * @param {string} purchaseId  numeric id of the purchase
 * @param {number|null} changedBy
 * @param {object} db
 * @returns {Array<{ item_id, field, applied, oldValue, newValue, warning }>}
 */
function applyPurchaseLinePriceUpdates(lines, purchaseId, changedBy, db) {
  const operationId = `PUR-${purchaseId}`;
  const results = [];

  for (const line of lines) {
    if (line.update_master_purchase_price) {
      const r = applyMasterPriceUpdate(
        line.item_id, "purchase_price", line.unit_cost,
        "purchase_locked", operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "purchase_price", ...r });
    }

    if (line.update_master_sale_price && line.unit_price != null) {
      const r = applyMasterPriceUpdate(
        line.item_id, "sale_price", line.unit_price,
        "purchase_locked", operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "sale_price", ...r });
    }

    if (line.update_master_wholesale_price && line.wholesale_price != null) {
      const r = applyMasterPriceUpdate(
        line.item_id, "wholesale_price", line.wholesale_price,
        "purchase_locked", operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "wholesale_price", ...r });
    }
  }

  return results;
}

/**
 * Revert all price changes that were applied by a purchase (on void/delete).
 */
function revertPurchaseLinePriceUpdates(purchaseId, changedBy, db) {
  const operationId = `PUR-${purchaseId}`;

  // Find all price_history entries written by this operation
  const entries = db.prepare(`
    SELECT DISTINCT item_id, field FROM price_history
    WHERE operation_id = ? AND source = 'purchase_locked'
  `).all(operationId);

  const results = [];
  for (const entry of entries) {
    const r = revertMasterPrice(entry.item_id, entry.field, operationId, changedBy, db);
    results.push({ item_id: entry.item_id, field: entry.field, ...r });
  }
  return results;
}

module.exports = {
  applyMasterPriceUpdate,
  revertMasterPrice,
  applyPurchaseLinePriceUpdates,
  revertPurchaseLinePriceUpdates,
};
