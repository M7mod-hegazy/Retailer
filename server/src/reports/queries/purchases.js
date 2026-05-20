const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function _detailPurchaseQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id, status, payment_type, category_id, item_id } = opts;
  return db.prepare(`
    SELECT p.id, p.purchase_no,
      DATE(p.created_at) AS date,
      s.name AS supplier_name, p.total, p.status, p.payment_type,
      p.supplier_id,
      u.full_name AS created_by,
      COUNT(pl.id) AS item_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE 1=1 ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${category_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 JOIN items it2 ON it2.id = pl2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 WHERE pl2.item_id = ?)" : ""}
      ${status ? " AND p.status = ?" : ""}
      ${payment_type ? " AND p.payment_type = ?" : ""}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(
    ...params,
    ...(supplier_id ? [supplier_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(status ? [status] : []),
    ...(payment_type ? [payment_type] : []),
  );
}

function purchaseSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id, category_id, item_id } = opts;
  if (supplier_id || category_id || item_id || opts.status || opts.payment_type) return _detailPurchaseQuery(startDate, endDate, opts);
  return db.prepare(`
    SELECT DATE(p.created_at) AS date,
      COUNT(*) AS purchase_count,
      COUNT(DISTINCT p.supplier_id) AS distinct_suppliers,
      SUM(p.total) AS total_purchases,
      ROUND(AVG(p.total), 2) AS avg_order_value
    FROM purchases p
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${category_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 JOIN items it2 ON it2.id = pl2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 WHERE pl2.item_id = ?)" : ""}
    GROUP BY DATE(p.created_at)
    ORDER BY date DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function detailedPurchases(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id, status, payment_type, category_id, item_id } = opts;
  return db.prepare(`
    SELECT p.id, p.purchase_no,
      DATE(p.created_at) AS date,
      s.name AS supplier_name, p.total, p.status, p.payment_type,
      p.supplier_id,
      u.full_name AS created_by,
      COUNT(pl.id) AS item_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE 1=1 ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${category_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 JOIN items it2 ON it2.id = pl2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 WHERE pl2.item_id = ?)" : ""}
      ${status ? " AND p.status = ?" : ""}
      ${payment_type ? " AND p.payment_type = ?" : ""}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(
    ...params,
    ...(supplier_id ? [supplier_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(status ? [status] : []),
    ...(payment_type ? [payment_type] : []),
  );
}

function purchasesBySupplier(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id } = opts;
  if (opts.status || opts.payment_type || opts.category_id || opts.item_id) return _detailPurchaseQuery(startDate, endDate, opts);
  return db.prepare(`
    SELECT s.name AS supplier_name,
      COUNT(p.id) AS purchase_count,
      SUM(p.total) AS total_purchases,
      ROUND(AVG(p.total), 2) AS avg_order_value,
      COALESCE(pr.return_total, 0) AS returns_total,
      MAX(DATE(p.created_at)) AS last_purchase_date
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN (
      SELECT pr.supplier_id, SUM(pr.total) AS return_total
      FROM purchase_returns pr
      WHERE pr.status = 'active'
        ${addDateFilter("pr.created_at", startDate, endDate, params)}
      GROUP BY pr.supplier_id
    ) pr ON pr.supplier_id = s.id
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
    GROUP BY s.id
    ORDER BY total_purchases DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function purchasesByItem(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, item_id, supplier_id } = opts;
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      SUM(pl.quantity) AS quantity_purchased,
      SUM(pl.line_total) AS total_cost,
      ROUND(AVG(pl.unit_cost), 2) AS avg_unit_cost,
      COUNT(DISTINCT p.supplier_id) AS distinct_suppliers,
      MAX(DATE(p.created_at)) AS last_purchase_date
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    JOIN items it ON it.id = pl.item_id
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
    GROUP BY it.id
    ORDER BY total_cost DESC
  `).all(
    ...params,
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(supplier_id ? [supplier_id] : []),
  );
}

function purchaseReturns(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id } = opts;
  return db.prepare(`
    SELECT pr.id, pr.doc_no AS return_ref,
      s.name AS supplier_name,
      DATE(pr.created_at) AS date,
      pr.total AS return_total, pr.reason, pr.refund_method,
      COUNT(prl.id) AS items_returned
    FROM purchase_returns pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    LEFT JOIN purchase_return_lines prl ON prl.purchase_return_id = pr.id
    WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND pr.supplier_id = ?" : ""}
    GROUP BY pr.id
    ORDER BY pr.created_at DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function supplierPricing(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id, item_id } = opts;
  return db.prepare(`
    SELECT s.name AS supplier_name,
      it.name AS item_name,
      pl.unit_price, pl.quantity, pl.line_total,
      DATE(p.created_at) AS purchase_date
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN items it ON it.id = pl.item_id
    WHERE p.status != 'cancelled' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    ORDER BY it.name, p.created_at DESC
  `).all(
    ...params,
    ...(supplier_id ? [supplier_id] : []),
    ...(item_id ? [item_id] : []),
  );
}

function purchaseReturnsSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id } = opts;
  return db.prepare(`
    SELECT DATE(pr.created_at) AS date,
      COUNT(*) AS return_count,
      COALESCE(SUM(pr.total), 0) AS returns_total,
      COUNT(DISTINCT pr.supplier_id) AS supplier_count,
      COALESCE(SUM(prl.quantity), 0) AS items_returned
    FROM purchase_returns pr
    LEFT JOIN purchase_return_lines prl ON prl.purchase_return_id = pr.id
    WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND pr.supplier_id = ?" : ""}
    GROUP BY DATE(pr.created_at)
    ORDER BY date DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function purchaseReturnsBySupplier(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT s.name AS supplier_name,
      COUNT(pr.id) AS return_count,
      COALESCE(SUM(pr.total), 0) AS returns_total,
      MAX(DATE(pr.created_at)) AS last_return_date
    FROM purchase_returns pr
    JOIN suppliers s ON s.id = pr.supplier_id
    WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, params)}
    GROUP BY s.id
    ORDER BY returns_total DESC
  `).all(...params);
}

module.exports = {
  _detailPurchaseQuery,
  purchaseSummary,
  detailedPurchases,
  purchasesBySupplier,
  purchasesByItem,
  purchaseReturns,
  supplierPricing,
  purchaseReturnsSummary,
  purchaseReturnsBySupplier,
};
