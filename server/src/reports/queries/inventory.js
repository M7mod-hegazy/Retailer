const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumnForValuation } = require("../helpers");
const { getLowStock } = require("../../services/reportService");

function slowMoving(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { warehouse_id, category_id, item_id } = opts;
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      COALESCE(SUM(sl.quantity), 0) AS stock_quantity,
      it.purchase_price AS cost_price,
      COALESCE(SUM(sl.quantity), 0) * it.purchase_price AS total_value,
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
      COALESCE(sl.quantity, 0) * it.purchase_price AS total_value,
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
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name,
      c.name AS category_name,
      sl.warehouse_id,
      COALESCE(w.name, '') AS warehouse_name,
      COALESCE(sl.quantity, 0) AS total_quantity,
      sl.wacc, sl.last_purchase_cost,
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
    LEFT JOIN stock_movements sm ON sm.item_id = it.id
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
};
