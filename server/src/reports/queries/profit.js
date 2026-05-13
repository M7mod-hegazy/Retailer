const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn } = require("../helpers");

function profitByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total) AS revenue,
      SUM(il.quantity * ${costCol}) AS cost,
      SUM(il.line_total) - SUM(il.quantity * ${costCol}) AS gross_profit,
      CASE WHEN SUM(il.line_total) > 0
        THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * ${costCol})) / SUM(il.line_total)) * 100, 1)
        ELSE 0 END AS margin_percent,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
        WHERE DATE(e.created_at) >= ? AND DATE(e.created_at) <= ?
      ) AS total_expenses,
      SUM(il.line_total) - SUM(il.quantity * ${costCol}) -
        (SELECT COALESCE(SUM(e2.amount), 0) FROM expenses e2
          WHERE DATE(e2.created_at) >= ? AND DATE(e2.created_at) <= ?) AS net_profit
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY gross_profit DESC
  `).all(
    ...params, startDate || "", endDate || "",
    startDate || "", endDate || "",
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
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total) AS revenue,
      SUM(i.discount) AS total_discount,
      SUM(il.quantity * ${costCol}) AS cost,
      SUM(il.line_total) - SUM(il.quantity * ${costCol}) AS gross_profit,
      CASE WHEN SUM(il.line_total) > 0
        THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * ${costCol})) / SUM(il.line_total)) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN customers c ON c.id = i.customer_id
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
      SUM(il.line_total) AS revenue,
      SUM(i.discount) AS total_discount,
      SUM(il.quantity * ${costCol}) AS cost_of_goods_sold,
      SUM(il.line_total) - SUM(il.quantity * ${costCol}) AS gross_profit,
      (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e
        WHERE DATE(e.created_at) = DATE(i.created_at)
      ) AS expenses,
      SUM(il.line_total) - SUM(il.quantity * ${costCol}) -
        COALESCE((SELECT SUM(e2.amount) FROM expenses e2 WHERE DATE(e2.created_at) = DATE(i.created_at)), 0) AS net_profit
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
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
