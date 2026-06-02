// Backfill invoice_lines cost snapshots that were frozen at 0.
//
// Items sold before their WACC was seeded (no purchase recorded yet, or sold before the
// cost-snapshot feature existed) captured cost_wacc = 0 on their invoice lines. That made
// every profit/margin report show cost = 0 and a fake 100% margin for those sales.
//
// We rewrite only the zero-valued snapshots, using the item's current cost basis:
//   stock WACC  ->  stock last-purchase cost  ->  items.purchase_price.
// Real (non-zero) snapshots are left untouched, so genuine cost-at-sale-time is preserved.
function up(db) {
  const cols = db.prepare("PRAGMA table_info(invoice_lines)").all().map((c) => c.name);
  if (!cols.includes("cost_wacc")) return; // schema predates cost snapshots; nothing to do

  const hasFifo = cols.includes("cost_fifo");
  const hasLifo = cols.includes("cost_lifo");

  const rows = db.prepare(`
    SELECT il.id,
      COALESCE(
        NULLIF((SELECT MAX(wacc) FROM stock_levels WHERE item_id = il.item_id), 0),
        NULLIF((SELECT MAX(last_purchase_cost) FROM stock_levels WHERE item_id = il.item_id), 0),
        NULLIF((SELECT purchase_price FROM items WHERE id = il.item_id), 0),
        0
      ) AS fallback_cost
    FROM invoice_lines il
    WHERE COALESCE(il.cost_wacc, 0) = 0
  `).all();

  const sets = [
    "cost_wacc = ?",
    "cost_last_purchase = CASE WHEN COALESCE(cost_last_purchase, 0) = 0 THEN ? ELSE cost_last_purchase END",
  ];
  const args = (cost) => {
    const a = [cost, cost];
    if (hasFifo) a.push(cost);
    if (hasLifo) a.push(cost);
    return a;
  };
  if (hasFifo) sets.push("cost_fifo = CASE WHEN COALESCE(cost_fifo, 0) = 0 THEN ? ELSE cost_fifo END");
  if (hasLifo) sets.push("cost_lifo = CASE WHEN COALESCE(cost_lifo, 0) = 0 THEN ? ELSE cost_lifo END");

  const upd = db.prepare(`UPDATE invoice_lines SET ${sets.join(", ")} WHERE id = ?`);

  const tx = db.transaction(() => {
    let n = 0;
    for (const r of rows) {
      if (!r.fallback_cost) continue; // no cost basis anywhere — leave as 0
      upd.run(...args(r.fallback_cost), r.id);
      n++;
    }
    return n;
  });
  const count = tx();
  console.log(`[105] Backfilled cost snapshots for ${count} zero-cost invoice_lines`);
}

module.exports = { up };
