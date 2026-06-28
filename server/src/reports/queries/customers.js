const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn, stockCostJoin, itemsCostJoin } = require("../helpers");

function _returnsSubquery(costMethod) {
  const { getReturnCostColumn } = require("../helpers");
  const costCol = getReturnCostColumn(costMethod);
  return `(
    SELECT sr.invoice_id,
      SUM(sr.total) AS return_revenue,
      COALESCE(SUM(srl.quantity * ${costCol}), 0) AS return_cost
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active'
    GROUP BY sr.invoice_id
  )`;
}

function topCustomers(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, cost_method } = opts;
  const costCol = getCostColumn(cost_method);
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      c.phone,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS total_sales,
      COALESCE(SUM(ret.return_revenue), 0) AS returns_total,
      COALESCE(SUM(i.total), 0) - COALESCE(SUM(ret.return_revenue), 0) AS net_sales,
      COALESCE(SUM(il_agg.total_cost), 0) AS total_cost,
      COALESCE(SUM(i.total), 0) - COALESCE(SUM(il_agg.total_cost), 0) - COALESCE(SUM(ret.return_revenue), 0) + COALESCE(SUM(ret.return_cost), 0) AS gross_profit,
      CASE WHEN COALESCE(SUM(i.total), 0) > 0
        THEN ROUND((COALESCE(SUM(i.total), 0) - COALESCE(SUM(il_agg.total_cost), 0)) / SUM(i.total) * 100, 1)
        ELSE 0 END AS margin_percent,
      CASE WHEN COUNT(DISTINCT i.id) > 0 THEN ROUND(SUM(i.total) * 1.0 / COUNT(DISTINCT i.id), 2) ELSE 0 END AS avg_invoice_value,
      MAX(DATE(i.created_at)) AS last_invoice_date
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN (
      SELECT il.invoice_id, SUM(il.quantity * ${costCol}) AS total_cost
      FROM invoice_lines il
      ${itemsCostJoin("il")}
      ${stockCostJoin("il")}
      GROUP BY il.invoice_id
    ) il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN ${_returnsSubquery(opts.cost_method)} ret ON ret.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
    GROUP BY i.customer_id
    ORDER BY total_sales DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function collectionEfficiency(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(ad.original_amount), 0) AS total_billed,
      COALESCE(SUM(ad.paid_amount), 0) AS collected,
      COALESCE(SUM(ad.original_amount), 0) - COALESCE(SUM(ad.paid_amount), 0) AS outstanding,
      CASE WHEN COALESCE(SUM(ad.original_amount), 0) > 0
        THEN ROUND(COALESCE(SUM(ad.paid_amount), 0) / SUM(ad.original_amount) * 100, 1)
        ELSE 0 END AS collection_rate,
      COUNT(CASE WHEN ad.paid_amount > 0 THEN 1 END) AS partially_paid_count,
      COUNT(CASE WHEN ad.paid_amount >= ad.original_amount THEN 1 END) AS fully_paid_count
    FROM ajal_debts ad
    JOIN invoices i ON i.id = ad.invoice_id AND i.status != 'cancelled'
    LEFT JOIN customers c ON c.id = ad.customer_id
    WHERE ad.party_type = 'customer' AND ad.source_type = 'invoice' AND ad.status != 'voided'
      ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND ad.customer_id = ?" : ""}
    GROUP BY ad.customer_id
    HAVING total_billed > 0
    ORDER BY total_billed DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function customerLoyalty(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      c.phone,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS total_sales,
      CASE WHEN COUNT(DISTINCT i.id) > 0 THEN ROUND(SUM(i.total) * 1.0 / COUNT(DISTINCT i.id), 2) ELSE 0 END AS avg_invoice_value,
      ROUND(AVG(COALESCE(i.discount, 0) / NULLIF(i.subtotal, 0) * 100), 1) AS avg_discount_percent,
      COALESCE(SUM(sr.total), 0) AS returns_total,
      CASE WHEN COUNT(DISTINCT i.id) > 0
        THEN ROUND(COUNT(DISTINCT i.id) * 1.0 / (julianday(MAX(i.created_at)) - julianday(MIN(i.created_at)) + 1) * 30, 1)
        ELSE 0 END AS frequency_monthly,
      ROUND(AVG(il2.item_count), 1) AS items_per_invoice,
      MIN(DATE(i.created_at)) AS first_invoice_date,
      MAX(DATE(i.created_at)) AS last_invoice_date,
      julianday('now') - julianday(MAX(i.created_at)) AS days_since_last_purchase
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN sales_returns sr ON sr.invoice_id = i.id AND sr.status = 'active'
    LEFT JOIN (SELECT invoice_id, COUNT(*) AS item_count FROM invoice_lines GROUP BY invoice_id) il2 ON il2.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
    GROUP BY i.customer_id
    HAVING COUNT(DISTINCT i.id) > 0
    ORDER BY total_sales DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

module.exports = {
  topCustomers,
  collectionEfficiency,
  customerLoyalty,
};
