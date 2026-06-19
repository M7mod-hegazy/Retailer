/**
 * Cascade-aware master price update service.
 *
 * When a purchase/branch-receive line has update_master_* = 1,
 * this service updates items.sale_price / purchase_price / wholesale_price
 * AND writes a price_history row.
 *
 * Cascade-check: if the master price was changed by a DIFFERENT source after
 * this operation set it, we warn but still respect the lock choice (the last
 * locked operation wins).
 */
const { roundMoney } = require("../utils/money");

const FIELD_MAP = {
  sale_price:       "sale_price",
  purchase_price:   "purchase_price",
  wholesale_price:  "wholesale_price",
};

/**
 * Apply a master price update from a single line.
 *
 * @param {number}  itemId
 * @param {'sale_price'|'purchase_price'|'wholesale_price'} field
 * @param {number}  newValue
 * @param {string}  source        e.g. 'purchase_locked' | 'branch_receive_locked'
 * @param {string}  operationId   e.g. 'PUR-42' | 'BTR-7'
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

  db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
    .run(rounded, itemId);

  db.prepare(`
    INSERT INTO price_history
      (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by, changed_at)
    VALUES (?, ?, ?, ?, 'set', ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(itemId, field, oldValue, rounded, rounded, source, operationId, changedBy ?? null);

  return { applied: true, oldValue, newValue: rounded, warning: null };
}

/**
 * Revert a master price change when an operation is voided/deleted/edited.
 *
 * Finds the price_history entry written by operationId+source and restores
 * the old value — but only if the current master value still matches what
 * this operation set (to avoid reverting a subsequent manual change).
 *
 * @param {number} itemId
 * @param {'sale_price'|'purchase_price'|'wholesale_price'} field
 * @param {string} sourceOperationId  the operation being undone (e.g. 'PUR-42' | 'BTR-7')
 * @param {string} source             the source tag used when writing (e.g. 'purchase_locked' | 'branch_receive_locked')
 * @param {number|null} changedBy
 * @param {object} db
 * @returns {{ reverted: boolean, reason: string }}
 */
function revertMasterPrice(itemId, field, sourceOperationId, source, changedBy, db) {
  if (!FIELD_MAP[field]) return { reverted: false, reason: "Unknown field" };

  const ourEntry = db.prepare(`
    SELECT id, old_value, new_value FROM price_history
    WHERE item_id = ? AND field = ? AND operation_id = ? AND source = ?
    ORDER BY id DESC LIMIT 1
  `).get(itemId, field, sourceOperationId, source);

  if (!ourEntry) return { reverted: false, reason: "No history entry found for this operation" };

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

  db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`)
    .run(restoreTo, itemId);

  db.prepare(`
    INSERT INTO price_history
      (item_id, field, old_value, new_value, adjustment_type, adjustment_value, source, operation_id, changed_by, changed_at)
    VALUES (?, ?, ?, ?, 'set', ?, 'revert', ?, ?, datetime('now', 'localtime'))
  `).run(itemId, field, current, restoreTo, restoreTo, `REVERT-${sourceOperationId}`, changedBy ?? null);

  return { reverted: true, reason: null };
}

/**
 * Apply all lock-controlled price updates for a batch of lines.
 * Designed to be called inside an existing DB transaction.
 *
 * @param {Array<{
 *   item_id, unit_cost, unit_price, wholesale_price,
 *   update_master_purchase_price, update_master_sale_price, update_master_wholesale_price
 * }>} lines
 * @param {{ source: string, operationId: string, changedBy: number|null, db: object }} opts
 * @returns {Array<{ item_id, field, applied, oldValue, newValue, warning }>}
 */
function applyLinePriceUpdates(lines, { source, operationId, changedBy, db }) {
  const results = [];

  for (const line of lines) {
    if (line.update_master_purchase_price) {
      const r = applyMasterPriceUpdate(
        line.item_id, "purchase_price", line.unit_cost,
        source, operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "purchase_price", ...r });
    }

    if (line.update_master_sale_price && line.unit_price != null) {
      const r = applyMasterPriceUpdate(
        line.item_id, "sale_price", line.unit_price,
        source, operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "sale_price", ...r });
    }

    if (line.update_master_wholesale_price && line.wholesale_price != null) {
      const r = applyMasterPriceUpdate(
        line.item_id, "wholesale_price", line.wholesale_price,
        source, operationId, changedBy, db
      );
      results.push({ item_id: line.item_id, field: "wholesale_price", ...r });
    }
  }

  return results;
}

/**
 * Revert all price changes that were applied by a specific operation.
 *
 * @param {{ source: string, operationId: string, changedBy: number|null, db: object }} opts
 * @returns {Array<{ item_id, field, reverted, reason }>}
 */
function revertLinePriceUpdates({ source, operationId, changedBy, db }) {
  const entries = db.prepare(`
    SELECT DISTINCT item_id, field FROM price_history
    WHERE operation_id = ? AND source = ?
  `).all(operationId, source);

  const results = [];
  for (const entry of entries) {
    const r = revertMasterPrice(entry.item_id, entry.field, operationId, source, changedBy, db);
    results.push({ item_id: entry.item_id, field: entry.field, ...r });
  }
  return results;
}

// ─── Backwards-compatible purchase wrappers ──────────────────────────────────

function applyPurchaseLinePriceUpdates(lines, purchaseId, changedBy, db) {
  return applyLinePriceUpdates(lines, {
    source: "purchase_locked",
    operationId: `PUR-${purchaseId}`,
    changedBy,
    db,
  });
}

function revertPurchaseLinePriceUpdates(purchaseId, changedBy, db) {
  return revertLinePriceUpdates({
    source: "purchase_locked",
    operationId: `PUR-${purchaseId}`,
    changedBy,
    db,
  });
}

module.exports = {
  applyMasterPriceUpdate,
  revertMasterPrice,
  applyLinePriceUpdates,
  revertLinePriceUpdates,
  applyPurchaseLinePriceUpdates,
  revertPurchaseLinePriceUpdates,
};
