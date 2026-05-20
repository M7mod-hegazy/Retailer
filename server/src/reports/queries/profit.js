const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn } = require("../helpers");

// Pre-aggregated cost subquery per invoice (avoids Cartesian product with returns join)
function _costSubquery(costCol) {
  return `(
    SELECT invoice_id, SUM(quantity * ${costCol}) AS total_cost
    FROM invoice_lines GROUP BY invoice_id
  )`;
}

// Pre-aggregated returns subquery per invoice: deducts return revenue and reverses cost
const _returnsSubquery = `(
  SELECT sr.invoice_id,
    SUM(sr.total) AS return_revenue,
    COALESCE(SUM(srl.quantity * COALESCE(ref_il.cost_wacc, it.purchase_price, 0)), 0) AS return_cost
  FROM sales_returns sr
  JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
  LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
  LEFT JOIN items it ON it.id = srl.item_id
  WHERE sr.status = 'active'
  GROUP BY sr.invoice_id
)`;

function profitByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  const costCol = getCostColumn(opts.cost_method);

  // Line-level proportional revenue: each line absorbs its share of the invoice total
  // (header discount + increase already reflected in i.total)
  // inv_sums.line_sum = sum of all line_totals for the invoice
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) AS revenue,
      SUM(il.quantity * ${costCol}) AS cost,
      COALESCE(SUM(ret.return_revenue * il.line_total / NULLIF(inv_sums.line_sum, 0)), 0) AS returns_amount,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0))
        - SUM(il.quantity * ${costCol})
        - COALESCE(SUM(ret.return_revenue * il.line_total / NULLIF(inv_sums.line_sum, 0)), 0)
        + COALESCE(SUM(ret.return_cost * il.line_total / NULLIF(inv_sums.line_sum, 0)), 0) AS gross_profit,
      CASE WHEN SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) > 0
        THEN ROUND(
          (SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - SUM(il.quantity * ${costCol})) /
          SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) * 100, 1)
        ELSE 0 END AS margin_percent,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
        WHERE DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?
      ) AS total_expenses
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT invoice_id, SUM(line_total) AS line_sum
      FROM invoice_lines GROUP BY invoice_id
    ) inv_sums ON inv_sums.invoice_id = il.invoice_id
    LEFT JOIN ${_returnsSubquery} ret ON ret.invoice_id = il.invoice_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY gross_profit DESC
  `).all(
    ...params, startDate || "", endDate || "",
    ...(category_id ? [category_id] : []),
  );
}

function profitByCustomer(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      COUNT(DISTINCT i.id) AS invoice_count,
      SUM(i.total) AS revenue,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(il_agg.total_cost), 0) AS cost,
      COALESCE(SUM(ret.return_revenue), 0) AS returns_amount,
      SUM(i.total)
        - COALESCE(SUM(il_agg.total_cost), 0)
        - COALESCE(SUM(ret.return_revenue), 0)
        + COALESCE(SUM(ret.return_cost), 0) AS gross_profit,
      CASE WHEN SUM(i.total) > 0
        THEN ROUND(
          (SUM(i.total) - COALESCE(SUM(il_agg.total_cost), 0)) / SUM(i.total) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN ${_costSubquery(costCol)} il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN ${_returnsSubquery} ret ON ret.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
    GROUP BY i.customer_id
    ORDER BY gross_profit DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function profitByPeriod(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const costCol = getCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT DATE(i.created_at) AS date,
      COUNT(DISTINCT i.id) AS invoice_count,
      SUM(i.total) AS revenue,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(il_agg.total_cost), 0) AS cost_of_goods_sold,
      COALESCE(SUM(ret.return_revenue), 0) AS returns_amount,
      SUM(i.total)
        - COALESCE(SUM(il_agg.total_cost), 0)
        - COALESCE(SUM(ret.return_revenue), 0)
        + COALESCE(SUM(ret.return_cost), 0) AS gross_profit,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
        WHERE DATE(e.created_at) = DATE(i.created_at)
      ) AS expenses,
      SUM(i.total)
        - COALESCE(SUM(il_agg.total_cost), 0)
        - COALESCE(SUM(ret.return_revenue), 0)
        + COALESCE(SUM(ret.return_cost), 0)
        - COALESCE((SELECT SUM(e2.amount) FROM expenses e2 WHERE DATE(e2.created_at) = DATE(i.created_at)), 0) AS net_profit
    FROM invoices i
    LEFT JOIN ${_costSubquery(costCol)} il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN ${_returnsSubquery} ret ON ret.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
    GROUP BY DATE(i.created_at)
    ORDER BY date DESC
  `).all(...params);
}

module.exports = {
  profitByCategory,
  profitByCustomer,
  profitByPeriod,
};
