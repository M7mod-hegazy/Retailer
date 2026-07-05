/**
 * Central cost engine — single entry point for all cost queries.
 * All monetary math goes through utils/money.js helpers.
 */
const { roundMoney, multiplyMoney, divideMoney } = require("../utils/money");
const { nowSql } = require("../utils/datetime");

/**
 * Get the active cost method from settings (default: 'wacc').
 * @returns {'wacc'|'last_purchase'|'standard'|'fifo'|'lifo'}
 */
function getActiveCostMethod(db) {
  const row = db.prepare("SELECT margin_alert_cost_method FROM settings WHERE id = 1").get();
  return row?.margin_alert_cost_method || "wacc";
}

/**
 * Compute cost for an item using a specific costing method.
 * @param {number} itemId
 * @param {'wacc'|'last_purchase'|'standard'|'fifo'|'lifo'} method
 * @param {string|null} asOfDate  ISO date string — used for FIFO/LIFO replay; null = now
 * @param {object} db
 * @returns {{ cost: number, method: string, computed_at: string }}
 */
function computeCostByMethod(itemId, method, asOfDate, db) {
  const computed_at = asOfDate || nowSql();

  switch (method) {
    case "last_purchase": {
      const row = db.prepare(
        "SELECT last_purchase_cost FROM stock_levels WHERE item_id = ? LIMIT 1"
      ).get(itemId);
      return { cost: roundMoney(row?.last_purchase_cost || 0), method, computed_at };
    }

    case "standard": {
      const row = db.prepare(
        "SELECT purchase_price FROM items WHERE id = ?"
      ).get(itemId);
      return { cost: roundMoney(row?.purchase_price || 0), method, computed_at };
    }

    case "fifo": {
      const cost = computeFifoLifoCost(itemId, asOfDate, "oldest", db);
      return { cost, method, computed_at };
    }

    case "lifo": {
      const cost = computeFifoLifoCost(itemId, asOfDate, "newest", db);
      return { cost, method, computed_at };
    }

    case "wacc":
    default: {
      const row = db.prepare(
        "SELECT wacc FROM stock_levels WHERE item_id = ? LIMIT 1"
      ).get(itemId);
      return { cost: roundMoney(row?.wacc || 0), method: "wacc", computed_at };
    }
  }
}

/**
 * FIFO/LIFO report-time replay.
 *
 * Replays all purchases and sales up to asOfDate in chronological order.
 * Builds a virtual lot queue and returns the weighted average cost of
 * whatever stock would have been consumed next.
 *
 * @param {number} itemId
 * @param {string|null} asOfDate  ISO string cutoff; null = now
 * @param {'oldest'|'newest'} direction  'oldest' = FIFO, 'newest' = LIFO
 * @param {object} db
 * @returns {number} cost per unit
 */
function computeFifoLifoCost(itemId, asOfDate, direction, db) {
  const cutoff = asOfDate || nowSql();

  // Collect all purchase lots in chronological order
  const purchases = db.prepare(`
    SELECT pl.id, pl.quantity, pl.unit_cost, p.created_at
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    WHERE pl.item_id = ?
      AND p.status NOT IN ('cancelled', 'voided')
      AND p.created_at <= ?
    ORDER BY p.created_at ASC, pl.id ASC
  `).all(itemId, cutoff);

  // Collect all sales (outflows) in chronological order
  const sales = db.prepare(`
    SELECT il.quantity, i.created_at
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    WHERE il.item_id = ?
      AND i.status NOT IN ('cancelled', 'voided')
      AND i.created_at <= ?
    ORDER BY i.created_at ASC, il.id ASC
  `).all(itemId, cutoff);

  // Deduct sales returns (add back to stock)
  const salesReturns = db.prepare(`
    SELECT srl.quantity, sr.created_at
    FROM sales_return_lines srl
    JOIN sales_returns sr ON sr.id = srl.sales_return_id
    WHERE srl.item_id = ?
      AND sr.status NOT IN ('cancelled', 'voided')
      AND sr.created_at <= ?
    ORDER BY sr.created_at ASC, srl.id ASC
  `).all(itemId, cutoff);

  if (purchases.length === 0) return 0;

  // Build lot queue: [ { qty, cost } ... ]
  // For FIFO: consume from front; for LIFO: consume from back
  const lots = purchases.map(p => ({ qty: roundMoney(p.quantity), cost: roundMoney(p.unit_cost) }));

  // Merge events for chronological processing
  const events = [
    ...sales.map(s => ({ type: "sale",          qty: roundMoney(s.quantity),  at: s.created_at })),
    ...salesReturns.map(r => ({ type: "return", qty: roundMoney(r.quantity),  at: r.created_at })),
  ].sort((a, b) => a.at < b.at ? -1 : 1);

  for (const event of events) {
    if (event.type === "return") {
      // Returns go back at the most recent purchase cost
      const refCost = lots.length > 0 ? lots[lots.length - 1].cost : 0;
      lots.push({ qty: event.qty, cost: refCost });
      continue;
    }

    // Sale: consume from lots
    let remaining = event.qty;
    while (remaining > 0 && lots.length > 0) {
      const idx = direction === "oldest" ? 0 : lots.length - 1;
      const lot  = lots[idx];
      if (lot.qty <= remaining) {
        remaining = roundMoney(remaining - lot.qty);
        lots.splice(idx, 1);
      } else {
        lot.qty = roundMoney(lot.qty - remaining);
        remaining = 0;
      }
    }
  }

  if (lots.length === 0) return 0;

  // Return the cost of the next unit to be consumed
  const refIdx = direction === "oldest" ? 0 : lots.length - 1;
  return lots[refIdx].cost;
}

/**
 * Compute per-item profit analysis used by the purchases profit modal.
 * @param {Array<{item_id, quantity, unit_cost, unit_price, wholesale_price}>} lines
 * @param {object} db
 * @returns {Array<{item_id, item_name, qty, cost, selling, wholesale, profit, margin_pct, below_target, below_min}>}
 */
function computePurchaseProfitAnalysis(lines, db) {
  const settings = db.prepare("SELECT min_margin_percent, target_margin_percent, margin_alert_cost_method FROM settings WHERE id = 1").get();
  const globalMin    = Number(settings?.min_margin_percent    ?? 15);
  const globalTarget = Number(settings?.target_margin_percent ?? 25);
  const activeMethod = settings?.margin_alert_cost_method || "wacc";

  return lines.map(line => {
    const item = db.prepare("SELECT id, name, min_margin_percent FROM items WHERE id = ?").get(line.item_id);

    // Cost used for margin: this purchase's cost OR active method's cost if line has no cost.
    // We surface BOTH so the modal can show "new purchase cost vs. existing-stock cost".
    const purchaseCost = roundMoney(line.unit_cost || 0);
    let referenceCost = purchaseCost;
    if (item) {
      const ref = computeCostByMethod(line.item_id, activeMethod, null, db);
      if (ref.cost > 0) referenceCost = ref.cost;
    }

    const selling  = roundMoney(line.unit_price  || 0);
    const qty      = roundMoney(line.quantity    || 0);
    const profit   = roundMoney(selling - purchaseCost);
    const margin   = purchaseCost > 0 ? Math.round(((selling - purchaseCost) / purchaseCost) * 10000) / 100 : null;

    // Per-item min margin overrides global
    const minMargin = item?.min_margin_percent != null ? Number(item.min_margin_percent) : globalMin;

    return {
      item_id:        line.item_id,
      item_name:      item?.name || `#${line.item_id}`,
      qty,
      cost:           purchaseCost,
      reference_cost: referenceCost,
      cost_method:    activeMethod,
      selling,
      profit,
      margin_pct:     margin,
      below_target:   margin !== null && margin < globalTarget,
      below_min:      margin !== null && margin < minMargin,
      total_profit:   roundMoney(profit * qty),
    };
  });
}

module.exports = {
  getActiveCostMethod,
  computeCostByMethod,
  computeFifoLifoCost,
  computePurchaseProfitAnalysis,
};
