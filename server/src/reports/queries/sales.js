const { getDb } = require("../../config/database");
const { addDateFilter, getCostColumn, getReturnCostColumn, addPaymentTypeFilter } = require("../helpers");
const { getItemsBelowMargin } = require("../../services/waccService");

function dailySales(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, category_id, item_id } = opts;
  if (customer_id || category_id || item_id || opts.cashier_id || opts.status || opts.payment_type) return _detailSalesQuery(startDate, endDate, opts);
  const costCol = getCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT DATE(i.created_at) AS date,
      COUNT(i.id) AS invoice_count,
      SUM(i.total) AS gross_sales,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(il_agg.total_cost), 0) AS total_cost,
      COALESCE(SUM(ret.return_total), 0) AS returns_amount,
      COALESCE(SUM(ret.return_count), 0) AS returns_count,
      SUM(i.total) - COALESCE(SUM(ret.return_total), 0) AS net_sales,
      SUM(i.total) - COALESCE(SUM(ret.return_total), 0)
        - COALESCE(SUM(il_agg.total_cost), 0) + COALESCE(SUM(ret.return_cost), 0) AS gross_profit
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(quantity * ${costCol}) AS total_cost
      FROM invoice_lines GROUP BY invoice_id
    ) il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN (
      SELECT sr.invoice_id,
        SUM(sr.total) AS return_total,
        COUNT(DISTINCT sr.id) AS return_count,
        COALESCE(SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}), 0) AS return_cost
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE sr.status = 'active'
      GROUP BY sr.invoice_id
    ) ret ON ret.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
      ${category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 WHERE il2.item_id = ?)" : ""}
    GROUP BY DATE(i.created_at)
    ORDER BY date DESC
  `).all(...params, ...(customer_id ? [customer_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function detailedSales(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { q, status, payment_type, customer_id, category_id, item_id } = opts;
  const ptFilter = addPaymentTypeFilter(payment_type, "i", params);
  return db.prepare(`
    SELECT i.invoice_no,
      DATE(i.created_at) AS date,
      COALESCE(c.name, 'نقدي') AS customer_name,
      u.full_name AS cashier,
      i.customer_id,
      i.payment_type, i.status,
      i.subtotal, i.discount, i.total,
      COUNT(il.id) AS item_count,
      CASE WHEN i.payment_type = 'multi' THEN (
        SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), ' / ')
        FROM payments p
        JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
      ) ELSE NULL END AS payment_breakdown
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id))
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${status ? " AND i.status = ?" : ""}
      ${ptFilter}
      ${customer_id ? " AND i.customer_id = ?" : ""}
      ${category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 WHERE il2.item_id = ?)" : ""}
      ${q ? " AND (i.invoice_no LIKE ? OR COALESCE(c.name,'') LIKE ?)" : ""}
    GROUP BY i.id
    ORDER BY i.created_at DESC
  `).all(
    ...params,
    ...(status ? [status] : []),
    ...(customer_id ? [customer_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(q ? [`%${q}%`, `%${q}%`] : []),
  );
}

function _detailSalesQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, category_id, item_id, status, payment_type, cashier_id } = opts;
  const ptFilter = addPaymentTypeFilter(payment_type, "i", params);
  return db.prepare(`
    SELECT i.invoice_no,
      DATE(i.created_at) AS date,
      COALESCE(c.name, 'نقدي') AS customer_name,
      u.full_name AS cashier,
      i.customer_id,
      i.payment_type, i.status,
      i.subtotal, i.discount, i.total,
      i.total AS net_sales,
      COUNT(il.id) AS item_count,
      CASE WHEN i.payment_type = 'multi' THEN (
        SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), ' / ')
        FROM payments p
        JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
      ) ELSE NULL END AS payment_breakdown
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id))
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
      ${category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 WHERE il2.item_id = ?)" : ""}
      ${status ? " AND i.status = ?" : ""}
      ${ptFilter}
      ${cashier_id ? " AND COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id)) = ?" : ""}
    GROUP BY i.id
    ORDER BY i.created_at DESC
  `).all(
    ...params,
    ...(customer_id ? [customer_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(status ? [status] : []),
    ...(cashier_id ? [cashier_id] : []),
  );
}

function _detailItemSalesQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, category_id, item_id, status, payment_type, cashier_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  const ptFilter = addPaymentTypeFilter(payment_type, "i", params);
  return db.prepare(`
    SELECT i.invoice_no, DATE(i.created_at) AS date,
      COALESCE(c.name, 'نقدي') AS customer_name,
      u.full_name AS cashier,
      it.code AS item_code, it.name AS item_name,
      COALESCE(cat.name, 'غير مصنف') AS category_name,
      il.quantity, il.unit_price, il.discount AS line_discount, il.line_total,
      (il.quantity * ${costCol}) AS line_cost,
      il.line_total - (il.quantity * ${costCol}) AS line_profit,
      i.payment_type, i.status
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories cat ON cat.id = it.category_id
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.id = COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id))
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
      ${status ? " AND i.status = ?" : ""}
      ${ptFilter}
      ${cashier_id ? " AND COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id)) = ?" : ""}
    ORDER BY i.created_at DESC, il.id
  `).all(
    ...params,
    ...(customer_id ? [customer_id] : []),
    ...(category_id ? [category_id] : []),
    ...(item_id ? [item_id] : []),
    ...(status ? [status] : []),
    ...(cashier_id ? [cashier_id] : []),
  );
}

function salesByItem(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { category_id, item_id } = opts;
  if (opts.customer_id || opts.cashier_id || opts.status || opts.payment_type || category_id || item_id) return _detailItemSalesQuery(startDate, endDate, opts);
  const costCol = getCostColumn(opts.cost_method);
  const returnDateFilter = addDateFilter("sr.created_at", startDate, endDate, returnParams);
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) AS revenue,
      SUM(il.discount) AS discount_total,
      SUM(il.quantity * ${costCol}) AS cost,
      COALESCE(MAX(ret.return_revenue), 0) AS returns_amount,
      COALESCE(MAX(ret.return_cost), 0) AS returns_cost,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0))
        - SUM(il.quantity * ${costCol})
        - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0) AS profit_margin,
      CASE WHEN SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - COALESCE(MAX(ret.return_revenue), 0) > 0
        THEN ROUND(((SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - SUM(il.quantity * ${costCol})
          - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0)) /
          (SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - COALESCE(MAX(ret.return_revenue), 0))) * 100, 1)
        ELSE 0 END AS margin_percent,
      ROUND(SUM(il.line_total) * 1.0 / NULLIF(SUM(il.quantity), 0), 2) AS avg_unit_price
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT invoice_id, SUM(line_total) AS line_sum
      FROM invoice_lines GROUP BY invoice_id
    ) inv_sums ON inv_sums.invoice_id = il.invoice_id
    LEFT JOIN (
      SELECT srl.item_id,
        SUM(srl.line_total) AS return_revenue,
        SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}) AS return_cost
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.sales_return_id AND sr.status = 'active'
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE 1=1 ${returnDateFilter}
      GROUP BY srl.item_id
    ) ret ON ret.item_id = il.item_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    ORDER BY revenue DESC
  `).all(...returnParams, ...params, ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function salesByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { category_id } = opts;
  if (opts.customer_id || opts.cashier_id || opts.status || opts.payment_type || opts.item_id) return _detailItemSalesQuery(startDate, endDate, opts);
  const costCol = getCostColumn(opts.cost_method);
  const returnDateFilter = addDateFilter("sr.created_at", startDate, endDate, returnParams);
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      COUNT(DISTINCT it.id) AS item_count,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0) AS revenue,
      SUM(il.discount) AS discount_total,
      SUM(il.quantity * ${costCol}) - COALESCE(MAX(ret.return_cost), 0) AS cost,
      SUM(il.line_total) - SUM(il.quantity * ${costCol})
        - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0) AS profit_margin,
      CASE WHEN SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0) > 0
        THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * ${costCol})
          - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0)) /
          (SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0))) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT it.category_id,
        SUM(srl.line_total) AS return_revenue,
        SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}) AS return_cost
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.sales_return_id AND sr.status = 'active'
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE 1=1 ${returnDateFilter}
      GROUP BY it.category_id
    ) ret ON COALESCE(ret.category_id, -1) = COALESCE(c.id, -1)
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY revenue DESC
  `).all(...returnParams, ...params, ...(category_id ? [category_id] : []));
}

function salesByCashier(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { cashier_id } = opts;
  if (cashier_id || opts.customer_id || opts.status || opts.payment_type || opts.category_id || opts.item_id) return _detailSalesQuery(startDate, endDate, opts);
  const costCol = getCostColumn(opts.cost_method);
  const returnDateFilter = addDateFilter("sr.created_at", startDate, endDate, returnParams);
  return db.prepare(`
    SELECT u.full_name AS cashier,
      COUNT(CASE WHEN i.status != 'cancelled' THEN 1 END) AS invoice_count,
      COUNT(CASE WHEN i.status = 'cancelled' THEN 1 END) AS cancelled_count,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total ELSE 0 END), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.discount ELSE 0 END), 0) AS total_discount,
      AVG(CASE WHEN i.status != 'cancelled' THEN i.total ELSE NULL END) AS avg_invoice_value,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN il_agg.item_count ELSE 0 END), 0) AS total_items_sold,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN cost_agg.total_cost ELSE 0 END), 0) AS total_cost,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN ret.return_total ELSE 0 END), 0) AS returns_handled,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN ret.return_cost ELSE 0 END), 0) AS returns_cost,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN ret.return_total ELSE 0 END), 0) AS net_sales,
      COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN ret.return_total ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN cost_agg.total_cost ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN ret.return_cost ELSE 0 END), 0) AS gross_profit
    FROM invoices i
    JOIN users u ON u.id = COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id))
    LEFT JOIN (
      SELECT invoice_id, COALESCE(SUM(quantity), 0) AS item_count
      FROM invoice_lines GROUP BY invoice_id
    ) il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN (
      SELECT invoice_id, COALESCE(SUM(quantity * ${costCol}), 0) AS total_cost
      FROM invoice_lines GROUP BY invoice_id
    ) cost_agg ON cost_agg.invoice_id = i.id
    LEFT JOIN (
      SELECT sr.invoice_id,
        COALESCE(SUM(sr.total), 0) AS return_total,
        COALESCE(SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}), 0) AS return_cost
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE sr.status = 'active' ${returnDateFilter}
      GROUP BY sr.invoice_id
    ) ret ON ret.invoice_id = i.id
    WHERE 1=1 ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${cashier_id ? " AND u.id = ?" : ""}
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).all(...returnParams, ...params, ...(cashier_id ? [cashier_id] : []));
}

function salesByPayment(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id, category_id } = opts;
  if (customer_id || opts.cashier_id || opts.status || category_id || opts.item_id) return _detailSalesQuery(startDate, endDate, opts);

  const scopeClause = (params) => [
    addDateFilter("i.created_at", startDate, endDate, params),
    customer_id ? " AND i.customer_id = ?" : "",
    category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : "",
  ].join("");
  const scopeArgs = [
    ...(customer_id ? [customer_id] : []),
    ...(category_id ? [category_id] : []),
  ];

  const paramsA = [];
  const nonMulti = db.prepare(`
    SELECT i.payment_type,
      COUNT(DISTINCT i.id) AS invoice_count,
      SUM(i.total) AS total_sales,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(sr.total), 0) AS returns_amount
    FROM invoices i
    LEFT JOIN sales_returns sr ON sr.invoice_id = i.id AND sr.status = 'active'
    WHERE i.status != 'cancelled' AND i.payment_type != 'multi'
      ${scopeClause(paramsA)}
    GROUP BY i.payment_type
  `).all(...paramsA, ...scopeArgs);

  const paramsB = [];
  const multiSplits = db.prepare(`
    SELECT p.method AS payment_type,
      COUNT(DISTINCT i.id) AS invoice_count,
      SUM(p.amount) AS total_sales,
      0 AS total_discount,
      0 AS returns_amount
    FROM invoices i
    JOIN payment_allocations pa ON pa.invoice_id = i.id
    JOIN payments p ON p.id = pa.payment_id
    WHERE i.status != 'cancelled' AND i.payment_type = 'multi'
      ${scopeClause(paramsB)}
    GROUP BY p.method
  `).all(...paramsB, ...scopeArgs);

  const merged = new Map();
  for (const row of [...nonMulti, ...multiSplits]) {
    if (!merged.has(row.payment_type)) {
      merged.set(row.payment_type, {
        payment_type: row.payment_type,
        invoice_count: Number(row.invoice_count || 0),
        total_sales: Number(row.total_sales || 0),
        total_discount: Number(row.total_discount || 0),
        returns_amount: Number(row.returns_amount || 0),
      });
    } else {
      const e = merged.get(row.payment_type);
      e.invoice_count  += Number(row.invoice_count || 0);
      e.total_sales    += Number(row.total_sales || 0);
      e.total_discount += Number(row.total_discount || 0);
      e.returns_amount += Number(row.returns_amount || 0);
    }
  }
  return Array.from(merged.values())
    .map(r => ({ ...r, avg_transaction: r.invoice_count > 0 ? r.total_sales / r.invoice_count : 0 }))
    .sort((a, b) => b.total_sales - a.total_sales);
}

function salesHeatmap(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, category_id } = opts;
  return db.prepare(`
    SELECT
      CASE CAST(strftime('%w', created_at) AS INTEGER)
        WHEN 0 THEN 'الأحد' WHEN 1 THEN 'الإثنين'
        WHEN 2 THEN 'الثلاثاء' WHEN 3 THEN 'الأربعاء'
        WHEN 4 THEN 'الخميس' WHEN 5 THEN 'الجمعة'
        WHEN 6 THEN 'السبت'
      END AS weekday_name,
      CAST(strftime('%w', created_at) AS INTEGER) AS weekday_num,
      strftime('%H:00', created_at) AS hour_slot,
      customer_id,
      COUNT(*) AS invoice_count,
      SUM(total) AS total_sales,
      AVG(total) AS avg_sale
    FROM invoices
    WHERE status != 'cancelled' ${addDateFilter("created_at", startDate, endDate, params)}
      ${customer_id ? " AND customer_id = ?" : ""}
      ${category_id ? " AND id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}
    GROUP BY weekday_num, hour_slot
    ORDER BY weekday_num, hour_slot
  `).all(...params, ...(customer_id ? [customer_id] : []), ...(category_id ? [category_id] : []));
}

function periodComparison(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!opts.period2_start || !opts.period2_end) {
    return [];
  }
  const { customer_id, category_id } = opts;
  const scopeVals = [];
  if (customer_id) scopeVals.push(customer_id);
  if (category_id) scopeVals.push(category_id);
  const scopeClause = `${customer_id ? " AND i.customer_id = ?" : ""}${category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}`;
  const costCol = getCostColumn(opts.cost_method);
  const returnCostCol = getReturnCostColumn(opts.cost_method);
  const runPeriod = (period, from, to) => {
    const invoiceParams = [];
    const returnParams = [];
    const invoiceDateFilter = addDateFilter("i.created_at", from, to, invoiceParams);
    const returnDateFilter = addDateFilter("sr.created_at", from, to, returnParams);
    return db.prepare(`
      SELECT ? AS period, DATE(i.created_at) AS date,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.total), 0) AS total_sales,
        COALESCE(SUM(i.discount), 0) AS total_discount,
        COALESCE(SUM(ret.return_total), 0) AS returns_amount,
        COALESCE(SUM(i.total), 0) - COALESCE(SUM(ret.return_total), 0) AS net_sales,
        COALESCE(SUM(cost_agg.total_cost), 0) AS total_cost,
        COALESCE(SUM(i.total), 0) - COALESCE(SUM(ret.return_total), 0)
          - COALESCE(SUM(cost_agg.total_cost), 0) + COALESCE(SUM(ret.return_cost), 0) AS gross_profit
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, COALESCE(SUM(quantity * ${costCol}), 0) AS total_cost
        FROM invoice_lines GROUP BY invoice_id
      ) cost_agg ON cost_agg.invoice_id = i.id
      LEFT JOIN (
        SELECT sr.invoice_id,
          COALESCE(SUM(sr.total), 0) AS return_total,
          COALESCE(SUM(srl.quantity * ${returnCostCol}), 0) AS return_cost
        FROM sales_returns sr
        JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
        LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
        LEFT JOIN items it ON it.id = srl.item_id
        WHERE sr.status = 'active' ${returnDateFilter}
        GROUP BY sr.invoice_id
      ) ret ON ret.invoice_id = i.id
      WHERE i.status != 'cancelled' ${invoiceDateFilter} ${scopeClause}
      GROUP BY DATE(i.created_at)
      ORDER BY date
    `).all(period, ...returnParams, ...invoiceParams, ...scopeVals);
  };
  const p1 = runPeriod("period_1", startDate, endDate);
  const p2 = runPeriod("period_2", opts.period2_start, opts.period2_end);
  return [...p1, ...p2];
}

function grossNetSales(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id, category_id, item_id } = opts;
  if (customer_id || category_id || item_id) return _detailSalesQuery(startDate, endDate, opts);
  const costCol = getCostColumn(opts.cost_method);
  return db.prepare(`
    SELECT DATE(i.created_at) AS date,
      COUNT(i.id) AS invoice_count,
      SUM(i.total) AS gross_sales,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(il_agg.total_cost), 0) AS total_cost,
      COALESCE(SUM(ret.return_total), 0) AS returns_amount,
      SUM(i.total) - COALESCE(SUM(ret.return_total), 0) AS net_sales,
      SUM(i.total) - COALESCE(SUM(ret.return_total), 0)
        - COALESCE(SUM(il_agg.total_cost), 0) + COALESCE(SUM(ret.return_cost), 0) AS gross_profit
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(quantity * ${costCol}) AS total_cost
      FROM invoice_lines GROUP BY invoice_id
    ) il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN (
      SELECT sr.invoice_id,
        SUM(sr.total) AS return_total,
        COALESCE(SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}), 0) AS return_cost
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE sr.status = 'active'
      GROUP BY sr.invoice_id
    ) ret ON ret.invoice_id = i.id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND i.customer_id = ?" : ""}
      ${category_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}
      ${item_id ? " AND i.id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 WHERE il2.item_id = ?)" : ""}
    GROUP BY DATE(i.created_at)
    ORDER BY date DESC
  `).all(...params, ...(customer_id ? [customer_id] : []), ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function salesReturns(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT sr.id, sr.doc_no AS return_ref,
      COALESCE(i.invoice_no, '—') AS invoice_no,
      DATE(sr.created_at) AS date,
      COALESCE(c.name, 'نقدي') AS customer_name,
      u.full_name AS handled_by,
      sr.customer_id,
      sr.total AS return_total, sr.reason, sr.refund_method,
      COUNT(srl.id) AS items_returned
    FROM sales_returns sr
    LEFT JOIN invoices i ON i.id = sr.invoice_id
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN users u ON u.id = sr.created_by
    LEFT JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, params)}
      ${customer_id ? " AND sr.customer_id = ?" : ""}
    GROUP BY sr.id
    ORDER BY sr.created_at DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function discountAnalysis(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id, category_id } = opts;
  const scopeClause = `${customer_id ? " AND customer_id = ?" : ""}${category_id ? " AND id IN (SELECT DISTINCT il2.invoice_id FROM invoice_lines il2 JOIN items it2 ON it2.id = il2.item_id WHERE it2.category_id = ?)" : ""}`;
  const scopeVals = [];
  if (customer_id) scopeVals.push(customer_id);
  if (category_id) scopeVals.push(category_id);
  const byPaymentParams = [];
  const byPayment = db.prepare(`
    SELECT i.payment_type,
      COUNT(*) AS invoice_count,
      SUM(i.discount) AS total_discount,
      AVG(i.discount) AS avg_discount,
      SUM(i.total) AS total_sales
    FROM invoices i
    WHERE i.discount > 0 AND i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, byPaymentParams)} ${scopeClause}
    GROUP BY i.payment_type
    ORDER BY total_discount DESC
  `).all(...byPaymentParams, ...scopeVals);
  const byRangeParams = [];
  const byRange = db.prepare(`
    SELECT
      CASE
        WHEN discount * 100.0 / total < 5 THEN '0-5%'
        WHEN discount * 100.0 / total < 10 THEN '5-10%'
        WHEN discount * 100.0 / total < 20 THEN '10-20%'
        ELSE '20%+'
      END AS discount_range,
      COUNT(*) AS invoice_count,
      SUM(discount) AS total_discount,
      ROUND(AVG(discount * 100.0 / total), 1) AS avg_discount_percent
    FROM invoices
    WHERE discount > 0 AND status != 'cancelled' ${addDateFilter("created_at", startDate, endDate, byRangeParams)} ${scopeClause}
    GROUP BY discount_range
    ORDER BY avg_discount_percent DESC
  `).all(...byRangeParams, ...scopeVals);
  return { by_payment: byPayment, by_range: byRange };
}

function cashierOverrideImpactReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const overrideParams = [];
  const discountParams = [];
  const { cashier_id } = opts;
  return db.prepare(`
    SELECT COALESCE(u.full_name, u.username, 'unknown') AS cashier,
      u.id AS cashier_id,
      COALESCE(ov.override_count, 0) AS override_count,
      COALESCE(ov.price_downs, 0) AS price_downs,
      COALESCE(ov.price_ups, 0) AS price_ups,
      COALESCE(ov.estimated_revenue_impact, 0) AS estimated_revenue_impact,
      COALESCE(ov.avg_diff_pct, 0) AS avg_diff_pct,
      COALESCE(disc.discount_invoice_count, 0) AS discount_invoice_count,
      COALESCE(disc.total_header_discount, 0) AS total_header_discount,
      COALESCE(disc.avg_discount_pct, 0) AS avg_discount_pct
    FROM users u
    LEFT JOIN (
      SELECT COALESCE(inv.user_id, (SELECT user_id FROM shifts WHERE id = inv.shift_id)) AS user_id,
        COUNT(*) AS override_count,
        SUM(CASE WHEN il.unit_price < il.master_price_at_time THEN 1 ELSE 0 END) AS price_downs,
        SUM(CASE WHEN il.unit_price > il.master_price_at_time THEN 1 ELSE 0 END) AS price_ups,
        SUM((il.master_price_at_time - il.unit_price) * il.quantity) AS estimated_revenue_impact,
        ROUND(AVG(ABS(il.unit_price - il.master_price_at_time) / NULLIF(il.master_price_at_time, 0) * 100), 2) AS avg_diff_pct
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      WHERE il.master_price_at_time IS NOT NULL
        AND ABS(il.unit_price - il.master_price_at_time) > 0.001
        AND inv.status != 'cancelled'
        ${addDateFilter("inv.created_at", startDate, endDate, overrideParams)}
      GROUP BY user_id
    ) ov ON ov.user_id = u.id
    LEFT JOIN (
      SELECT COALESCE(i.user_id, (SELECT user_id FROM shifts WHERE id = i.shift_id)) AS user_id,
        COUNT(*) AS discount_invoice_count,
        SUM(i.discount) AS total_header_discount,
        ROUND(AVG(i.discount * 100.0 / NULLIF(i.subtotal, 0)), 2) AS avg_discount_pct
      FROM invoices i
      WHERE i.status != 'cancelled' AND COALESCE(i.discount, 0) > 0
        ${addDateFilter("i.created_at", startDate, endDate, discountParams)}
      GROUP BY user_id
    ) disc ON disc.user_id = u.id
    WHERE (COALESCE(ov.override_count, 0) > 0 OR COALESCE(disc.discount_invoice_count, 0) > 0)
      ${cashier_id ? " AND u.id = ?" : ""}
    ORDER BY estimated_revenue_impact DESC, override_count DESC
  `).all(
    ...overrideParams,
    ...discountParams,
    ...(cashier_id ? [cashier_id] : []),
  );
}

function marginByItem(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { category_id, item_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  const returnDateFilter = addDateFilter("sr.created_at", startDate, endDate, returnParams);
  return db.prepare(`
    SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
      it.name AS item_name,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) AS revenue,
      SUM(il.quantity * ${costCol}) AS cost,
      COALESCE(MAX(ret.return_revenue), 0) AS returns_amount,
      SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0))
        - SUM(il.quantity * ${costCol})
        - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0) AS profit_margin,
      CASE WHEN SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - COALESCE(MAX(ret.return_revenue), 0) > 0
        THEN ROUND(((SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0))
          - SUM(il.quantity * ${costCol})
          - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0)) /
          (SUM(il.line_total * i.total / NULLIF(inv_sums.line_sum, 0)) - COALESCE(MAX(ret.return_revenue), 0))) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN (
      SELECT invoice_id, SUM(line_total) AS line_sum
      FROM invoice_lines GROUP BY invoice_id
    ) inv_sums ON inv_sums.invoice_id = il.invoice_id
    LEFT JOIN (
      SELECT srl.item_id,
        SUM(srl.line_total) AS return_revenue,
        SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}) AS return_cost
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.sales_return_id AND sr.status = 'active'
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE 1=1 ${returnDateFilter}
      GROUP BY srl.item_id
    ) ret ON ret.item_id = il.item_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND it.category_id = ?" : ""}
      ${item_id ? " AND it.id = ?" : ""}
    GROUP BY it.id
    ORDER BY profit_margin DESC
  `).all(...returnParams, ...params, ...(category_id ? [category_id] : []), ...(item_id ? [item_id] : []));
}

function marginByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const returnParams = [];
  const { category_id } = opts;
  const costCol = getCostColumn(opts.cost_method);
  const returnDateFilter = addDateFilter("sr.created_at", startDate, endDate, returnParams);
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      SUM(il.quantity) AS quantity_sold,
      SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0) AS revenue,
      SUM(il.quantity * ${costCol}) - COALESCE(MAX(ret.return_cost), 0) AS cost,
      SUM(il.line_total) - SUM(il.quantity * ${costCol})
        - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0) AS profit_margin,
      CASE WHEN SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0) > 0
        THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * ${costCol})
          - COALESCE(MAX(ret.return_revenue), 0) + COALESCE(MAX(ret.return_cost), 0)) /
          (SUM(il.line_total) - COALESCE(MAX(ret.return_revenue), 0))) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    JOIN items it ON it.id = il.item_id
    LEFT JOIN item_categories c ON c.id = it.category_id
    LEFT JOIN (
      SELECT it.category_id,
        SUM(srl.line_total) AS return_revenue,
        SUM(srl.quantity * ${getReturnCostColumn(opts.cost_method)}) AS return_cost
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.sales_return_id AND sr.status = 'active'
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE 1=1 ${returnDateFilter}
      GROUP BY it.category_id
    ) ret ON COALESCE(ret.category_id, -1) = COALESCE(c.id, -1)
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${category_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY profit_margin DESC
  `).all(...returnParams, ...params, ...(category_id ? [category_id] : []));
}

function marginHealth(startDate, endDate, opts = {}) {
  return getItemsBelowMargin();
}

function shiftHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT s.id, u.full_name AS cashier,
      DATE(s.opened_at) AS opened_date, s.closed_at,
      s.opening_cash, s.closing_cash,
      COALESCE(SUM(i.total), 0) AS sales_total,
      (s.opening_cash + COALESCE(SUM(i.total), 0)) AS expected_cash,
      COALESCE(s.closing_cash, 0) - s.opening_cash - COALESCE(SUM(i.total), 0) AS cash_variance,
      COUNT(DISTINCT i.id) AS invoice_count,
      s.status
    FROM shifts s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN invoices i ON i.shift_id = s.id AND i.status != 'cancelled'
    WHERE 1=1 ${addDateFilter("s.opened_at", startDate, endDate, params)}
    GROUP BY s.id
    ORDER BY s.id DESC
  `).all(...params);
}

function salesReturnsSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT DATE(sr.created_at) AS date,
      COUNT(*) AS return_count,
      COALESCE(SUM(sr.total), 0) AS returns_total,
      COUNT(DISTINCT sr.customer_id) AS customer_count,
      COALESCE(SUM(srl.quantity), 0) AS items_returned
    FROM sales_returns sr
    LEFT JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, params)}
      ${customer_id ? " AND sr.customer_id = ?" : ""}
    GROUP BY DATE(sr.created_at)
    ORDER BY date DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function salesReturnsByCustomer(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      COUNT(sr.id) AS return_count,
      COALESCE(SUM(sr.total), 0) AS returns_total,
      MAX(DATE(sr.created_at)) AS last_return_date
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    WHERE sr.status = 'active' ${addDateFilter("sr.created_at", startDate, endDate, params)}
    GROUP BY c.id
    ORDER BY returns_total DESC
  `).all(...params);
}

module.exports = {
  _detailSalesQuery,
  _detailItemSalesQuery,
  dailySales,
  detailedSales,
  salesByItem,
  salesByCategory,
  salesByCashier,
  salesByPayment,
  salesHeatmap,
  periodComparison,
  grossNetSales,
  salesReturns,
  salesReturnsSummary,
  salesReturnsByCustomer,
  discountAnalysis,
  cashierOverrideImpactReport,
  marginByItem,
  marginByCategory,
  marginHealth,
  shiftHistory,
};
