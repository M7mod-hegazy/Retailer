const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function _detailPurchaseQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { supplier_id, status, payment_type, category_id, item_id } = opts;
  return db.prepare(`
    SELECT p.id, p.doc_no AS purchase_no,
      DATE(p.created_at) AS date,
      s.name AS supplier_name, p.total, p.discount AS total_discount,
      p.increase AS additions_amount, p.status, p.payment_method AS payment_type,
      p.supplier_id,
      u.full_name AS created_by,
      COUNT(pl.id) AS item_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE 1=1 AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${category_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 JOIN items it2 ON it2.id = pl2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 WHERE pl2.item_id = ?)" : ""}
      ${status ? " AND p.status = ?" : ""}
      ${payment_type ? " AND p.payment_method = ?" : ""}
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
      SUM(p.discount) AS total_discount,
      SUM(p.increase) AS additions_amount,
      SUM(p.total) AS total_purchases,
      ROUND(AVG(p.total), 2) AS avg_order_value
    FROM purchases p
    WHERE p.status != 'cancelled' AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
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
    SELECT p.id, p.doc_no AS purchase_no,
      DATE(p.created_at) AS date,
      s.name AS supplier_name, p.total, p.discount AS total_discount,
      p.increase AS additions_amount, p.status, p.payment_method AS payment_type,
      p.supplier_id,
      u.full_name AS created_by,
      COUNT(pl.id) AS item_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN purchase_lines pl ON pl.purchase_id = p.id
    WHERE 1=1 AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
      ${category_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 JOIN items it2 ON it2.id = pl2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND p.id IN (SELECT DISTINCT pl2.purchase_id FROM purchase_lines pl2 WHERE pl2.item_id = ?)" : ""}
      ${status ? " AND p.status = ?" : ""}
      ${payment_type ? " AND p.payment_method = ?" : ""}
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
      SUM(p.total) - COALESCE(pr.return_total, 0) AS net_purchases,
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
    WHERE p.status != 'cancelled' AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
    GROUP BY s.id
    ORDER BY total_purchases DESC
  `).all(...params, ...(supplier_id ? [supplier_id] : []));
}

function purchasesByItem(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { category_id, item_id, supplier_id } = opts;
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      SUM(pl.quantity) AS quantity_purchased,
      SUM(pl.line_total) AS total_cost,
      COALESCE(MAX(ret.quantity_returned), 0) AS quantity_returned,
      COALESCE(MAX(ret.returns_cost), 0) AS returns_cost,
      SUM(pl.quantity) - COALESCE(MAX(ret.quantity_returned), 0) AS net_quantity_purchased,
      SUM(pl.line_total) - COALESCE(MAX(ret.returns_cost), 0) AS net_total_cost,
      ROUND(AVG(pl.unit_cost), 2) AS avg_unit_cost,
      COUNT(DISTINCT p.supplier_id) AS distinct_suppliers,
      MAX(DATE(p.created_at)) AS last_purchase_date
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    JOIN items it ON it.id = pl.item_id
    LEFT JOIN (
      SELECT prl.item_id,
        COALESCE(SUM(prl.quantity), 0) AS quantity_returned,
        COALESCE(SUM(prl.line_total * pr.total / NULLIF(prsum.line_sum, 0)), 0) AS returns_cost
      FROM purchase_return_lines prl
      JOIN purchase_returns pr ON pr.id = prl.purchase_return_id
      JOIN (SELECT purchase_return_id, SUM(line_total) AS line_sum FROM purchase_return_lines GROUP BY purchase_return_id) prsum ON prsum.purchase_return_id = prl.purchase_return_id
      WHERE pr.status = 'active' ${addDateFilter("pr.created_at", startDate, endDate, returnParams)}
        ${supplier_id ? " AND pr.supplier_id = ?" : ""}
      GROUP BY prl.item_id
    ) ret ON ret.item_id = it.id
    WHERE p.status != 'cancelled' AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
      ${supplier_id ? " AND p.supplier_id = ?" : ""}
    GROUP BY it.id
    ORDER BY net_total_cost DESC
  `).all(
    ...returnParams,
    ...(supplier_id ? [supplier_id] : []),
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
      pr.discount AS return_discount, pr.increase AS return_increase,
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
      pl.unit_cost AS unit_price, pl.quantity, pl.line_total,
      DATE(p.created_at) AS purchase_date
    FROM purchase_lines pl
    JOIN purchases p ON p.id = pl.purchase_id
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN items it ON it.id = pl.item_id
    WHERE p.status != 'cancelled' AND COALESCE(p.is_opening_balance, 0) = 0 AND COALESCE(p.doc_no, '') NOT LIKE 'OB-%' ${addDateFilter("p.created_at", startDate, endDate, params)}
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

function supplierReliabilityReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const purchaseParams = [];
  const returnParams = [];
  const { supplier_id } = opts;
  return db.prepare(`
    SELECT s.id AS supplier_id,
      s.name AS supplier_name,
      s.phone,
      COALESCE(pur.purchase_count, 0) AS purchase_count,
      COALESCE(pur.total_purchases, 0) AS total_purchases,
      COALESCE(ret.return_count, 0) AS return_count,
      COALESCE(ret.total_returns, 0) AS total_returns,
      CASE WHEN COALESCE(pur.total_purchases, 0) > 0
        THEN ROUND(COALESCE(ret.total_returns, 0) / pur.total_purchases * 100, 1)
        ELSE 0 END AS return_rate_percent,
      COALESCE(pay.avg_payment_days, 0) AS avg_payment_days,
      COALESCE(price.repeat_items, 0) AS repeat_items,
      COALESCE(price.avg_price_spread_percent, 0) AS avg_price_spread_percent,
      pur.last_purchase_date
    FROM suppliers s
    LEFT JOIN (
      SELECT supplier_id,
        COUNT(id) AS purchase_count,
        SUM(total) AS total_purchases,
        MAX(DATE(created_at)) AS last_purchase_date
      FROM purchases
      WHERE status != 'cancelled' ${addDateFilter("created_at", startDate, endDate, purchaseParams)}
      GROUP BY supplier_id
    ) pur ON pur.supplier_id = s.id
    LEFT JOIN (
      SELECT supplier_id,
        COUNT(id) AS return_count,
        SUM(total) AS total_returns
      FROM purchase_returns
      WHERE status = 'active' ${addDateFilter("created_at", startDate, endDate, returnParams)}
      GROUP BY supplier_id
    ) ret ON ret.supplier_id = s.id
    LEFT JOIN (
      SELECT p.supplier_id,
        ROUND(AVG(julianday(pp.created_at) - julianday(p.created_at)), 1) AS avg_payment_days
      FROM purchases p
      JOIN purchase_payments pp ON pp.purchase_id = p.id
      WHERE p.status != 'cancelled'
      GROUP BY p.supplier_id
    ) pay ON pay.supplier_id = s.id
    LEFT JOIN (
      SELECT supplier_id,
        COUNT(*) AS repeat_items,
        ROUND(AVG(CASE WHEN avg_cost > 0 THEN ((max_cost - min_cost) / avg_cost) * 100 ELSE 0 END), 1) AS avg_price_spread_percent
      FROM (
        SELECT p.supplier_id, pl.item_id,
          MIN(pl.unit_cost) AS min_cost,
          MAX(pl.unit_cost) AS max_cost,
          AVG(pl.unit_cost) AS avg_cost,
          COUNT(*) AS buys
        FROM purchase_lines pl
        JOIN purchases p ON p.id = pl.purchase_id
        WHERE p.status != 'cancelled'
        GROUP BY p.supplier_id, pl.item_id
        HAVING buys > 1
      ) item_prices
      GROUP BY supplier_id
    ) price ON price.supplier_id = s.id
    WHERE (COALESCE(pur.purchase_count, 0) > 0 OR COALESCE(ret.return_count, 0) > 0)
      ${supplier_id ? " AND s.id = ?" : ""}
    ORDER BY total_purchases DESC
  `).all(
    ...purchaseParams,
    ...returnParams,
    ...(supplier_id ? [supplier_id] : []),
  );
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
  supplierReliabilityReport,
};
