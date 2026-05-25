/**
 * Override tracking service.
 *
 * At invoice/return/transfer save time, records the master price that was in
 * effect so we can later identify lines where the operator used a different
 * price (a "price override").
 *
 * The master_price_at_time column is always written — even when the operator
 * did NOT override. The override detection in list queries checks:
 *   ABS(unit_price - master_price_at_time) > 0.001
 */
const { roundMoney } = require("../utils/money");

/**
 * Capture the current master sale_price for each invoice line.
 * Call this INSIDE the transaction that saves the invoice lines,
 * after the lines are inserted (so we have their IDs).
 *
 * @param {Array<{id: number, item_id: number}>} savedLines  already-inserted rows with ids
 * @param {object} db
 */
function captureInvoiceLineOverrides(savedLines, db) {
  const update = db.prepare(`
    UPDATE invoice_lines
    SET master_price_at_time = (
      SELECT sale_price FROM items WHERE id = invoice_lines.item_id
    ),
    master_price_backfilled = 0
    WHERE id = ?
  `);

  for (const line of savedLines) {
    update.run(line.id);
  }
}

/**
 * Capture master price for sales return lines (uses sale_price).
 */
function captureSalesReturnLineOverrides(savedLines, db) {
  const update = db.prepare(`
    UPDATE sales_return_lines
    SET master_price_at_time = (
      SELECT sale_price FROM items WHERE id = sales_return_lines.item_id
    ),
    master_price_backfilled = 0
    WHERE id = ?
  `);
  for (const line of savedLines) update.run(line.id);
}

/**
 * Capture master price for purchase return lines (uses purchase_price).
 */
function capturePurchaseReturnLineOverrides(savedLines, db) {
  const update = db.prepare(`
    UPDATE purchase_return_lines
    SET master_price_at_time = (
      SELECT purchase_price FROM items WHERE id = purchase_return_lines.item_id
    ),
    master_price_backfilled = 0
    WHERE id = ?
  `);
  for (const line of savedLines) update.run(line.id);
}

/**
 * Capture master price for branch transfer lines (uses purchase_price as cost basis).
 */
function captureBranchTransferLineOverrides(savedLines, db) {
  const update = db.prepare(`
    UPDATE branch_transfer_lines
    SET master_price_at_time = (
      SELECT purchase_price FROM items WHERE id = branch_transfer_lines.item_id
    ),
    master_price_backfilled = 0
    WHERE id = ?
  `);
  for (const line of savedLines) update.run(line.id);
}

/**
 * List overrides across all document types.
 * An "override" is any line where the used price differs from the master price
 * by more than 0.001.
 *
 * @param {{
 *   item_id?: number,
 *   from_date?: string,
 *   to_date?: string,
 *   source?: 'invoice'|'sales_return'|'purchase_return'|'branch_transfer',
 *   page?: number,
 *   limit?: number,
 * }} filters
 * @param {object} db
 * @returns {{ rows: Array, total: number }}
 */
function listOverrides(filters, db) {
  const page  = Math.max(1, filters.page  || 1);
  const limit = Math.min(200, filters.limit || 50);
  const offset = (page - 1) * limit;

  const parts   = [];
  const allRows = [];

  // ── invoice_lines ──
  if (!filters.source || filters.source === "invoice") {
    let q = `
      SELECT
        il.id, 'invoice' as source_type,
        COALESCE(i.doc_no, i.invoice_no) as doc_no, i.created_at, il.item_id,
        i.id as source_id,
        items.name as item_name,
        items.code as item_code,
        il.unit_price as used_price,
        il.master_price_at_time,
        il.quantity,
        (il.unit_price - il.master_price_at_time) as diff
      FROM invoice_lines il
      JOIN invoices i    ON i.id  = il.invoice_id
      JOIN items         ON items.id = il.item_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND i.status NOT IN ('cancelled','voided')
    `;
    const params = [];
    if (filters.item_id) { q += " AND il.item_id = ?"; params.push(filters.item_id); }
    if (filters.from_date) { q += " AND i.created_at >= ?"; params.push(filters.from_date); }
    if (filters.to_date)   { q += " AND i.created_at <= ?"; params.push(filters.to_date + " 23:59:59"); }
    allRows.push({ q, params });
  }

  // ── sales_return_lines ──
  if (!filters.source || filters.source === "sales_return") {
    let q = `
      SELECT
        srl.id, 'sales_return' as source_type,
        sr.doc_no, sr.created_at, srl.item_id,
        sr.id as source_id,
        items.name as item_name,
        items.code as item_code,
        srl.unit_price as used_price,
        srl.master_price_at_time,
        srl.quantity,
        (srl.unit_price - srl.master_price_at_time) as diff
      FROM sales_return_lines srl
      JOIN sales_returns sr  ON sr.id  = srl.sales_return_id
      JOIN items             ON items.id = srl.item_id
      WHERE srl.master_price_at_time IS NOT NULL
        AND ABS(srl.unit_price - srl.master_price_at_time) > 0.001
        AND sr.status NOT IN ('cancelled','voided')
    `;
    const params = [];
    if (filters.item_id) { q += " AND srl.item_id = ?"; params.push(filters.item_id); }
    if (filters.from_date) { q += " AND sr.created_at >= ?"; params.push(filters.from_date); }
    if (filters.to_date)   { q += " AND sr.created_at <= ?"; params.push(filters.to_date + " 23:59:59"); }
    allRows.push({ q, params });
  }

  // ── purchase_return_lines ──
  if (!filters.source || filters.source === "purchase_return") {
    let q = `
      SELECT
        prl.id, 'purchase_return' as source_type,
        pr.doc_no, pr.created_at, prl.item_id,
        pr.id as source_id,
        items.name as item_name,
        items.code as item_code,
        prl.unit_cost as used_price,
        prl.master_price_at_time,
        prl.quantity,
        (prl.unit_cost - prl.master_price_at_time) as diff
      FROM purchase_return_lines prl
      JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
      JOIN items               ON items.id = prl.item_id
      WHERE prl.master_price_at_time IS NOT NULL
        AND ABS(prl.unit_cost - prl.master_price_at_time) > 0.001
        AND pr.status NOT IN ('cancelled','voided')
    `;
    const params = [];
    if (filters.item_id) { q += " AND prl.item_id = ?"; params.push(filters.item_id); }
    if (filters.from_date) { q += " AND pr.created_at >= ?"; params.push(filters.from_date); }
    if (filters.to_date)   { q += " AND pr.created_at <= ?"; params.push(filters.to_date + " 23:59:59"); }
    allRows.push({ q, params });
  }

  if (allRows.length === 0) return { rows: [], total: 0 };

  // Union all sources
  const unionSql = allRows.map(r => r.q).join(" UNION ALL ");
  const unionParams = allRows.flatMap(r => r.params);

  const countSql = `SELECT COUNT(*) as cnt FROM (${unionSql})`;
  const total = db.prepare(countSql).get(...unionParams)?.cnt || 0;

  const dataSql = `SELECT * FROM (${unionSql}) ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(dataSql).all(...unionParams, limit, offset);

  return {
    rows: rows.map(r => ({ ...r, diff: roundMoney(r.diff) })),
    total,
    page,
    limit,
  };
}

module.exports = {
  captureInvoiceLineOverrides,
  captureSalesReturnLineOverrides,
  capturePurchaseReturnLineOverrides,
  captureBranchTransferLineOverrides,
  listOverrides,
};
