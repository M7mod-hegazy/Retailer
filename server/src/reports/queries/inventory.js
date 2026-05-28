const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumnForValuation } = require("../helpers");
const { getLowStock } = require("../../services/reportService");
const { deriveFIFO, deriveLIFO, hasTable } = require("../../services/costLedger");

function slowMoving(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { warehouse_id, category_id, item_id } = opts;
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      COALESCE(SUM(sl.quantity), 0) AS stock_quantity,
      COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price) AS cost_price,
      COALESCE(SUM(sl.quantity), 0) * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price) AS total_value,
      COALESCE(SUM(sl.quantity), 0) * it.sale_price AS potential_revenue,
      MAX(DATE(i.created_at)) AS last_sale_date
    FROM items it
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN invoice_lines il ON il.item_id = it.id
    LEFT JOIN invoices i ON i.id = il.invoice_id AND i.status != 'cancelled'
      AND DATE(i.created_at) BETWEEN ? AND ?
    WHERE it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    HAVING COALESCE(SUM(CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END), 0) = 0
    ORDER BY stock_quantity DESC
  `).all(startDate, endDate, ...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function stockLevels(startDate, endDate, opts = {}) {
  const db = getDb();
  const { warehouse_id, category_id, item_id } = opts;
  const params = [];
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      c.name AS category_name,
      sl.warehouse_id,
      COALESCE(w.name, '') AS warehouse_name,
      COALESCE(sl.quantity, 0) AS quantity,
      it.min_stock_qty,
      u.name AS unit_name,
      COALESCE(sl.quantity, 0) * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price) AS total_value,
      CASE
        WHEN COALESCE(sl.quantity, 0) <= 0 THEN 'نفذ'
        WHEN COALESCE(sl.quantity, 0) <= COALESCE(it.min_stock_qty, 0) THEN 'منخفض'
        ELSE 'متاح'
      END AS stock_status
    FROM items it
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN units u ON u.id = it.unit_id
    LEFT JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    ORDER BY it.name ASC
  `).all(...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function stockMovements(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { movement_type, q, warehouse_id, category_id, item_id } = opts;
  return db.prepare(`
    SELECT COALESCE(i.code, 'ITEM-' || i.id) AS item_code,
      i.name AS item_name,
      COALESCE(w.name, '') AS warehouse_name,
      sm.movement_type, sm.reference_type, sm.reference_id,
      sm.warehouse_id, sm.before_qty, sm.after_qty,
      sm.quantity,
      u.full_name AS created_by,
      DATE(sm.created_at) AS date
    FROM stock_movements sm
    LEFT JOIN items i ON i.id = sm.item_id
    LEFT JOIN users u ON u.id = sm.created_by
    LEFT JOIN warehouses w ON w.id = sm.warehouse_id
    WHERE sm.deleted_at IS NULL
      ${addDateFilter("sm.created_at", startDate, endDate, params)}
      ${movement_type ? " AND sm.movement_type = ?" : ""}
      ${warehouse_id ? " AND sm.warehouse_id = ?" : ""}
      ${category_id ? " AND i.category_id = ?" : ""}
      ${item_id ? " AND i.id = ?" : ""}
      ${q ? " AND (COALESCE(i.name,'') LIKE ? OR COALESCE(i.code,'') LIKE ?)" : ""}
    ORDER BY sm.created_at DESC
  `).all(
    ...params,
    ...(movement_type ? [movement_type] : []),
    ...(warehouse_id ? [warehouse_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(q ? [`%${q}%`, `%${q}%`] : []),
  );
}

function stockValuation(startDate, endDate, opts = {}) {
  const db = getDb();
  const costCol = getCostColumnForValuation(opts.cost_method);
  const { warehouse_id, category_id, item_id } = opts;
  const params = [];
  const rows = db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.id AS item_id,
      it.name,
      c.name AS category_name,
      sl.warehouse_id,
      COALESCE(w.name, '') AS warehouse_name,
      COALESCE(sl.quantity, 0) AS total_quantity,
      sl.wacc, sl.last_purchase_cost, it.purchase_price,
      COALESCE(sl.quantity, 0) * ${costCol} AS total_value
    FROM items it
    JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE it.deleted_at IS NULL AND COALESCE(sl.quantity, 0) > 0
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    ORDER BY total_value DESC
  `).all(...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));

  if (!["fifo", "lifo"].includes(opts.cost_method)) return rows;

  // FIFO valuation of stock-on-hand = newest layers remaining after oldest were sold,
  // which is exactly what deriveLIFO returns from buildReceiptLayers (and vice versa for LIFO).
  // The function name describes which layers it extracts; the cost-method label describes
  // which layers were already consumed by sales.
  return rows
    .map((row) => {
      const qty = Number(row.total_quantity || 0);
      const fallback = opts.cost_method === "last_purchase"
        ? Number(row.last_purchase_cost || row.wacc || row.purchase_price || 0)
        : Number(row.wacc || row.last_purchase_cost || row.purchase_price || 0);
      const valuation = opts.cost_method === "fifo"
        ? deriveLIFO(db, row.item_id, qty)
        : deriveFIFO(db, row.item_id, qty);
      const unitCost = Number(valuation.unit_cost || fallback || 0);
      return {
        ...row,
        selected_cost: unitCost,
        total_value: qty * unitCost,
      };
    })
    .sort((a, b) => Number(b.total_value || 0) - Number(a.total_value || 0));
}

function countSheet(startDate, endDate, opts = {}) {
  const db = getDb();
  const { warehouse_id, category_id } = opts;
  const params = [];
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name, it.barcode,
      c.name AS category_name,
      sl.warehouse_id,
      COALESCE(w.name, '') AS warehouse_name,
      COALESCE(SUM(sl.quantity), 0) AS system_quantity,
      u.name AS unit_name
    FROM items it
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN units u ON u.id = it.unit_id
    LEFT JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
    GROUP BY it.id, sl.warehouse_id
    ORDER BY it.name ASC
  `).all(...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []));
}

function reorderReport(startDate, endDate, opts = {}) {
  return getLowStock();
}

function expiryReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const { item_id, warehouse_id } = opts;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='item_batches'").all();
  if (tables.length === 0) return [];
  const params = [];
  return db.prepare(`
    SELECT eb.id, eb.batch_no,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      eb.quantity, eb.expiry_date, eb.cost_price,
      CAST(julianday(eb.expiry_date) - julianday('now') AS INTEGER) AS days_until_expiry,
      CASE
        WHEN julianday(eb.expiry_date) <= julianday('now') THEN 'منتهي'
        WHEN julianday(eb.expiry_date) <= julianday('now', '+30 days') THEN 'ينتهي قريباً'
        ELSE 'ساري'
      END AS expiry_status
    FROM item_batches eb
    JOIN items it ON it.id = eb.item_id
    WHERE 1=1
      ${item_id ? " AND eb.item_id = ?" : ""}
      ${warehouse_id ? " AND eb.warehouse_id = ?" : ""}
    ORDER BY eb.expiry_date ASC
  `).all(...(item_id ? [item_id] : []), ...(warehouse_id ? [warehouse_id] : []));
}

function inventoryAging(startDate, endDate, opts = {}) {
  const db = getDb();
  const { warehouse_id, category_id, item_id } = opts;
  const params = [];
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(sl.quantity, 0) AS quantity,
      sl.wacc,
      COALESCE(sl.quantity, 0) * sl.wacc AS total_value,
      MAX(sm.created_at) AS last_movement_date,
      CAST(julianday('now') - julianday(MAX(sm.created_at)) AS INTEGER) AS days_since_last_movement,
      CASE
        WHEN MAX(sm.created_at) IS NULL THEN 'بدون حركة'
        WHEN julianday('now') - julianday(MAX(sm.created_at)) <= 30 THEN '0-30 يوم'
        WHEN julianday('now') - julianday(MAX(sm.created_at)) <= 60 THEN '30-60 يوم'
        WHEN julianday('now') - julianday(MAX(sm.created_at)) <= 90 THEN '60-90 يوم'
        ELSE '90+ يوم'
      END AS aging_bucket
    FROM items it
    JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN stock_movements sm ON sm.item_id = it.id AND sm.deleted_at IS NULL
    WHERE sl.quantity > 0 AND it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    ORDER BY days_since_last_movement DESC
  `).all(...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function deadStock(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { warehouse_id, category_id, item_id } = opts;
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      c.name AS category_name,
      COALESCE(sl.quantity, 0) AS quantity,
      sl.wacc,
      COALESCE(sl.quantity, 0) * sl.wacc AS total_value,
      MAX(DATE(i.created_at)) AS last_sale_date,
      CAST(julianday('now') - julianday(MAX(i.created_at)) AS INTEGER) AS days_since_last_sale,
      CASE
        WHEN MAX(i.created_at) IS NULL THEN 'بدون حركة'
        WHEN julianday('now') - julianday(MAX(i.created_at)) <= 90 THEN '0-90 يوم'
        WHEN julianday('now') - julianday(MAX(i.created_at)) <= 180 THEN '90-180 يوم'
        ELSE '180+ يوم'
      END AS aging_bucket
    FROM items it
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN invoice_lines il ON il.item_id = it.id
    LEFT JOIN invoices i ON i.id = il.invoice_id AND i.status != 'cancelled'
      AND DATE(i.created_at) BETWEEN ? AND ?
    WHERE sl.quantity > 0 AND it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    HAVING COALESCE(SUM(CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END), 0) = 0
    ORDER BY days_since_last_sale DESC
  `).all(startDate, endDate, ...(warehouse_id ? [warehouse_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function costMovementReport(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!hasTable(db, "cost_movements")) return [];
  const params = [];
  const { item_id, movement_type } = opts;
  const rows = db.prepare(`
    SELECT cm.id, cm.item_id,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(w.name, '') AS warehouse_name,
      cm.movement_type,
      cm.quantity,
      cm.unit_cost,
      cm.source_table,
      cm.source_id,
      cm.source_line_id,
      COALESCE(p.doc_no, bt.reference_no, 'IMPORT-' || cm.source_id) AS source_doc_no,
      COALESCE(up.full_name, ub.full_name, '') AS created_by,
      cm.occurred_at,
      cm.created_at
    FROM cost_movements cm
    JOIN items it ON it.id = cm.item_id
    LEFT JOIN warehouses w ON w.id = cm.warehouse_id
    LEFT JOIN purchases p ON p.id = cm.source_id AND cm.source_table = 'purchase_lines'
    LEFT JOIN branch_transfers bt ON bt.id = cm.source_id AND cm.source_table = 'branch_transfer_lines'
    LEFT JOIN users up ON up.id = p.created_by
    LEFT JOIN users ub ON ub.id = bt.created_by
    WHERE 1=1 ${addDateFilter("cm.occurred_at", startDate, endDate, params)}
      ${item_id ? " AND cm.item_id = ?" : ""}
      ${movement_type ? " AND cm.movement_type = ?" : ""}
    ORDER BY cm.item_id ASC, cm.occurred_at ASC, cm.id ASC
  `).all(
    ...params,
    ...(item_id ? [item_id] : []),
    ...(movement_type ? [movement_type] : []),
  );

  const state = new Map();
  const enriched = rows.map((row) => {
    const previous = state.get(row.item_id) || { qty: 0, value: 0 };
    const qty = previous.qty + Number(row.quantity || 0);
    const value = previous.value + Number(row.quantity || 0) * Number(row.unit_cost || 0);
    const runningWacc = qty > 0 ? value / qty : 0;
    state.set(row.item_id, { qty, value: qty > 0 ? value : 0 });
    return {
      ...row,
      running_quantity: qty,
      running_wacc: Math.round(runningWacc * 100) / 100,
      date: row.occurred_at,
    };
  });
  return enriched.reverse();
}

function costMethodComparison(startDate, endDate, opts = {}) {
  const db = getDb();
  const { warehouse_id, category_id, item_id } = opts;
  const rows = db.prepare(`
    SELECT it.id AS item_id,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, '') AS category_name,
      COALESCE(SUM(sl.quantity), 0) AS quantity,
      COALESCE(MAX(sl.wacc), 0) AS wacc,
      COALESCE(MAX(sl.last_purchase_cost), it.purchase_price, 0) AS last_cost
    FROM items it
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    WHERE it.deleted_at IS NULL
      ${warehouse_id ? " AND sl.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    HAVING quantity > 0
    ORDER BY item_name ASC
  `).all(
    ...(warehouse_id ? [warehouse_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
  );

  return rows.map((row) => {
    const qty = Number(row.quantity || 0);
    const wacc = Number(row.wacc || row.last_cost || 0);
    const last = Number(row.last_cost || wacc || 0);
    // Same inverted relationship as stockValuation: FIFO valuation = newest layers (deriveLIFO),
    // LIFO valuation = oldest layers (deriveFIFO).
    const fifo = hasTable(db, "cost_movements") ? Number(deriveLIFO(db, row.item_id, qty).total_cost || 0) : qty * wacc;
    const lifo = hasTable(db, "cost_movements") ? Number(deriveFIFO(db, row.item_id, qty).total_cost || 0) : qty * wacc;
    const values = [qty * wacc, fifo, lifo, qty * last];
    return {
      ...row,
      value_wacc: qty * wacc,
      value_fifo: fifo,
      value_lifo: lifo,
      value_last: qty * last,
      spread_min_max: Math.max(...values) - Math.min(...values),
    };
  }).sort((a, b) => Number(b.spread_min_max || 0) - Number(a.spread_min_max || 0));
}

function itemLifecycleReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const purchaseParams = [];
  const salesParams = [];
  const salesReturnParams = [];
  const purchaseReturnParams = [];
  const transferParams = [];
  const { category_id, item_id } = opts;
  return db.prepare(`
    SELECT it.id AS item_id,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, '') AS category_name,
      COALESCE(stock.on_hand, 0) AS stock_on_hand,
      COALESCE(stock.current_wacc, it.purchase_price, 0) AS current_wacc,
      it.sale_price,
      CASE WHEN it.sale_price > 0 THEN ROUND(((it.sale_price - COALESCE(stock.current_wacc, it.purchase_price, 0)) / it.sale_price) * 100, 1) ELSE 0 END AS current_margin_percent,
      COALESCE(pur.purchase_qty, 0) AS purchase_qty,
      COALESCE(pur.purchase_value, 0) AS purchase_value,
      COALESCE(pur.distinct_suppliers, 0) AS distinct_suppliers,
      pur.first_purchase_date,
      pur.last_purchase_date,
      COALESCE(sales.sales_qty, 0) AS sales_qty,
      COALESCE(sales.sales_revenue, 0) AS sales_revenue,
      COALESCE(sales.sales_cost, 0) AS sales_cost,
      COALESCE(sales.distinct_customers, 0) AS distinct_customers,
      sales.first_sale_date,
      sales.last_sale_date,
      COALESCE(sr.sales_return_qty, 0) AS sales_return_qty,
      COALESCE(sr.sales_return_value, 0) AS sales_return_value,
      COALESCE(pr.purchase_return_qty, 0) AS purchase_return_qty,
      COALESCE(pr.purchase_return_value, 0) AS purchase_return_value,
      COALESCE(tr.transfer_in_qty, 0) AS transfer_in_qty,
      COALESCE(tr.transfer_out_qty, 0) AS transfer_out_qty,
      COALESCE(sales.sales_revenue, 0) - COALESCE(sr.sales_return_value, 0)
        - COALESCE(sales.sales_cost, 0) AS lifetime_gross_profit,
      COALESCE(pur.purchase_tx_count, 0) + COALESCE(sales.sales_tx_count, 0)
        + COALESCE(sr.sales_return_tx_count, 0) + COALESCE(pr.purchase_return_tx_count, 0)
        + COALESCE(tr.transfer_tx_count, 0) AS total_transactions
    FROM items it
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT item_id, SUM(quantity) AS on_hand, MAX(wacc) AS current_wacc
      FROM stock_levels GROUP BY item_id
    ) stock ON stock.item_id = it.id
    LEFT JOIN (
      SELECT pl.item_id, SUM(pl.quantity) AS purchase_qty, SUM(pl.line_total) AS purchase_value,
        COUNT(DISTINCT p.id) AS purchase_tx_count,
        COUNT(DISTINCT p.supplier_id) AS distinct_suppliers,
        MIN(DATE(p.created_at)) AS first_purchase_date,
        MAX(DATE(p.created_at)) AS last_purchase_date
      FROM purchase_lines pl
      JOIN purchases p ON p.id = pl.purchase_id
      WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, purchaseParams)}
      GROUP BY pl.item_id
    ) pur ON pur.item_id = it.id
    LEFT JOIN (
      SELECT il.item_id, SUM(il.quantity) AS sales_qty, SUM(il.line_total) AS sales_revenue,
        SUM(il.quantity * COALESCE(il.cost_wacc, il.cost_last_purchase, 0)) AS sales_cost,
        COUNT(DISTINCT i.id) AS sales_tx_count,
        COUNT(DISTINCT i.customer_id) AS distinct_customers,
        MIN(DATE(i.created_at)) AS first_sale_date,
        MAX(DATE(i.created_at)) AS last_sale_date
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, salesParams)}
      GROUP BY il.item_id
    ) sales ON sales.item_id = it.id
    LEFT JOIN (
      SELECT srl.item_id, SUM(srl.quantity) AS sales_return_qty, SUM(srl.line_total) AS sales_return_value,
        COUNT(DISTINCT sr.id) AS sales_return_tx_count
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.sales_return_id
      WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, salesReturnParams)}
      GROUP BY srl.item_id
    ) sr ON sr.item_id = it.id
    LEFT JOIN (
      SELECT prl.item_id, SUM(prl.quantity) AS purchase_return_qty, SUM(prl.line_total) AS purchase_return_value,
        COUNT(DISTINCT pr.id) AS purchase_return_tx_count
      FROM purchase_return_lines prl
      JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
      WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, purchaseReturnParams)}
      GROUP BY prl.item_id
    ) pr ON pr.item_id = it.id
    LEFT JOIN (
      SELECT btl.item_id,
        SUM(CASE WHEN bt.type = 'receive' THEN btl.quantity ELSE 0 END) AS transfer_in_qty,
        SUM(CASE WHEN bt.type = 'send' THEN btl.quantity ELSE 0 END) AS transfer_out_qty,
        COUNT(DISTINCT bt.id) AS transfer_tx_count
      FROM branch_transfer_lines btl
      JOIN branch_transfers bt ON bt.id = btl.transfer_id
      WHERE COALESCE(bt.status, 'active') != 'cancelled' ${addDateFilter("bt.created_at", startDate, endDate, transferParams)}
      GROUP BY btl.item_id
    ) tr ON tr.item_id = it.id
    WHERE it.deleted_at IS NULL
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    ORDER BY total_transactions DESC, it.name ASC
  `).all(
    ...purchaseParams,
    ...salesParams,
    ...salesReturnParams,
    ...purchaseReturnParams,
    ...transferParams,
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
  );
}

function marginDriftReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const { category_id, item_id } = opts;
  const items = db.prepare(`
    SELECT it.id AS item_id,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, '') AS category_name,
      it.sale_price,
      COALESCE(MAX(sl.wacc), MAX(sl.last_purchase_cost), it.purchase_price, 0) AS current_cost
    FROM items it
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN stock_levels sl ON sl.item_id = it.id
    WHERE it.deleted_at IS NULL
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
  `).all(...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));

  const firstCostStmt = hasTable(db, "cost_movements") ? db.prepare(`
    SELECT unit_cost FROM cost_movements
    WHERE item_id = ? ${startDate ? " AND DATE(occurred_at) >= DATE(?)" : ""} ${endDate ? " AND DATE(occurred_at) <= DATE(?)" : ""}
    ORDER BY occurred_at ASC, id ASC LIMIT 1
  `) : null;
  const lastCostStmt = hasTable(db, "cost_movements") ? db.prepare(`
    SELECT unit_cost FROM cost_movements
    WHERE item_id = ? ${startDate ? " AND DATE(occurred_at) >= DATE(?)" : ""} ${endDate ? " AND DATE(occurred_at) <= DATE(?)" : ""}
    ORDER BY occurred_at DESC, id DESC LIMIT 1
  `) : null;
  const dateArgs = [ ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []) ];

  return items.map((item) => {
    const firstCost = Number(firstCostStmt?.get(item.item_id, ...dateArgs)?.unit_cost || item.current_cost || 0);
    const lastCost = Number(lastCostStmt?.get(item.item_id, ...dateArgs)?.unit_cost || item.current_cost || 0);
    const salePrice = Number(item.sale_price || 0);
    const previousMargin = salePrice > 0 ? ((salePrice - firstCost) / salePrice) * 100 : 0;
    const currentMargin = salePrice > 0 ? ((salePrice - Number(item.current_cost || lastCost || 0)) / salePrice) * 100 : 0;
    return {
      ...item,
      first_period_cost: firstCost,
      last_period_cost: lastCost,
      cost_change: lastCost - firstCost,
      previous_margin_percent: Math.round(previousMargin * 10) / 10,
      current_margin_percent: Math.round(currentMargin * 10) / 10,
      margin_decline_percent: Math.round((previousMargin - currentMargin) * 10) / 10,
    };
  }).filter((row) => row.cost_change > 0 || row.margin_decline_percent > 0)
    .sort((a, b) => Number(b.margin_decline_percent || 0) - Number(a.margin_decline_percent || 0));
}

function inventoryTurnoverReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const { category_id, item_id, warehouse_id } = opts;
  const params = [];
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
  const end = endDate ? new Date(endDate) : new Date();
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return db.prepare(`
    SELECT it.id AS item_id,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, '') AS category_name,
      COALESCE(stock.on_hand, 0) AS stock_on_hand,
      COALESCE(stock.inventory_value, 0) AS inventory_value,
      COALESCE(sales.qty_sold, 0) AS qty_sold,
      COALESCE(sales.cogs, 0) AS cogs,
      ROUND(COALESCE(sales.qty_sold, 0) / ?, 2) AS avg_daily_sales,
      CASE WHEN COALESCE(sales.qty_sold, 0) > 0 THEN ROUND(COALESCE(stock.on_hand, 0) / (COALESCE(sales.qty_sold, 0) / ?), 1) ELSE NULL END AS days_of_stock,
      CASE WHEN COALESCE(stock.inventory_value, 0) > 0 THEN ROUND(COALESCE(sales.cogs, 0) / stock.inventory_value, 2) ELSE 0 END AS turnover_ratio,
      CASE
        WHEN COALESCE(stock.on_hand, 0) <= 0 THEN 'out'
        WHEN COALESCE(sales.qty_sold, 0) = 0 THEN 'overstocked'
        WHEN COALESCE(stock.on_hand, 0) / (COALESCE(sales.qty_sold, 0) / ?) > 90 THEN 'overstocked'
        WHEN COALESCE(stock.on_hand, 0) / (COALESCE(sales.qty_sold, 0) / ?) < 7 THEN 'understocked'
        ELSE 'healthy'
      END AS stock_velocity_status
    FROM items it
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT item_id,
        SUM(quantity) AS on_hand,
        SUM(quantity * COALESCE(wacc, last_purchase_cost, 0)) AS inventory_value
      FROM stock_levels
      WHERE 1=1 ${warehouse_id ? " AND warehouse_id = ?" : ""}
      GROUP BY item_id
    ) stock ON stock.item_id = it.id
    LEFT JOIN (
      SELECT il.item_id,
        SUM(il.quantity) AS qty_sold,
        SUM(il.quantity * COALESCE(il.cost_wacc, il.cost_last_purchase, 0)) AS cogs
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      GROUP BY il.item_id
    ) sales ON sales.item_id = it.id
    WHERE it.deleted_at IS NULL
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    ORDER BY turnover_ratio DESC, days_of_stock ASC
  `).all(
    days, days, days, days,
    ...(warehouse_id ? [warehouse_id] : []),
    ...params,
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
  );
}

function stockAdjustmentAuditReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { warehouse_id, category_id, item_id, user_id } = opts;
  return db.prepare(`
    SELECT sm.id,
      DATE(sm.created_at) AS date,
      COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, '') AS category_name,
      COALESCE(w.name, '') AS warehouse_name,
      sm.quantity AS qty_change,
      sm.before_qty,
      sm.after_qty,
      COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price, 0) AS cost_basis,
      sm.quantity * COALESCE(sl.wacc, sl.last_purchase_cost, it.purchase_price, 0) AS value_impact,
      sm.notes AS reason,
      u.full_name AS created_by
    FROM stock_movements sm
    JOIN items it ON it.id = sm.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN warehouses w ON w.id = sm.warehouse_id
    LEFT JOIN stock_levels sl ON sl.item_id = sm.item_id AND sl.warehouse_id = sm.warehouse_id
    LEFT JOIN users u ON u.id = sm.created_by
    WHERE sm.deleted_at IS NULL
      AND (sm.movement_type = 'manual_adjustment' OR sm.reference_type = 'stock_adjustment')
      ${addDateFilter("sm.created_at", startDate, endDate, params)}
      ${warehouse_id ? " AND sm.warehouse_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
      ${user_id ? " AND sm.created_by = ?" : ""}
    ORDER BY sm.created_at DESC, sm.id DESC
  `).all(
    ...params,
    ...(warehouse_id ? [warehouse_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(user_id ? [user_id] : []),
  );
}

module.exports = {
  slowMoving,
  stockLevels,
  stockMovements,
  stockValuation,
  countSheet,
  reorderReport,
  expiryReport,
  inventoryAging,
  deadStock,
  costMovementReport,
  costMethodComparison,
  itemLifecycleReport,
  marginDriftReport,
  inventoryTurnoverReport,
  stockAdjustmentAuditReport,
};
