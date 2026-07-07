const { getDb } = require("../config/database");
const { addDateFilter, getCostColumn, getReturnCostColumn, stockCostJoin, itemsCostJoin } = require("../reports/helpers");

// Daily sales summary for the analytics chart.
// Fixes vs the old version:
//  - Dates are wrapped in DATE() so an end_date of e.g. 2026-06-21 is inclusive
//    (raw `created_at <= '2026-06-21'` silently dropped that whole day).
//  - Returns cost-of-goods, gross_profit and margin_percent per day so the chart's
//    margin / profit lines plot real numbers instead of a flat zero.
function getSalesSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const costMethod = opts.cost_method || "wacc";
  const costCol = getCostColumn(costMethod);
  const returnCostCol = getReturnCostColumn(costMethod);
  const dateFilter = addDateFilter("i.created_at", startDate, endDate, params);

  return db.prepare(`
    SELECT
      DATE(i.created_at) AS date,
      COUNT(i.id) AS invoice_count,
      COUNT(i.id) AS orders_count,
      SUM(i.total) AS revenue,
      SUM(i.subtotal) AS subtotal,
      SUM(i.discount) AS total_discount,
      COALESCE(SUM(il_agg.total_cost), 0) AS cost,
      COALESCE(SUM(ret.return_total), 0) AS returns_amount,
      SUM(i.total) - COALESCE(SUM(ret.return_total), 0)
        - COALESCE(SUM(il_agg.total_cost), 0) + COALESCE(SUM(retc.return_cost), 0) AS gross_profit,
      CASE WHEN (SUM(i.total) - COALESCE(SUM(ret.return_total), 0)) > 0
        THEN ROUND((SUM(i.total) - COALESCE(SUM(ret.return_total), 0)
          - COALESCE(SUM(il_agg.total_cost), 0) + COALESCE(SUM(retc.return_cost), 0))
          / (SUM(i.total) - COALESCE(SUM(ret.return_total), 0)) * 100, 1)
        ELSE 0 END AS margin_percent
    FROM invoices i
    LEFT JOIN (
      SELECT il.invoice_id, SUM(il.quantity * ${costCol}) AS total_cost
      FROM invoice_lines il
      ${itemsCostJoin("il")}
      ${stockCostJoin("il")}
      GROUP BY il.invoice_id
    ) il_agg ON il_agg.invoice_id = i.id
    LEFT JOIN (
      SELECT invoice_id, SUM(total) AS return_total
      FROM sales_returns WHERE status = 'active' GROUP BY invoice_id
    ) ret ON ret.invoice_id = i.id
    LEFT JOIN (
      SELECT sr.invoice_id, COALESCE(SUM(srl.quantity * ${returnCostCol}), 0) AS return_cost
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
      LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
      LEFT JOIN items it ON it.id = srl.item_id
      WHERE sr.status = 'active' GROUP BY sr.invoice_id
    ) retc ON retc.invoice_id = i.id
    WHERE i.status != 'cancelled' ${dateFilter}
    GROUP BY DATE(i.created_at)
    ORDER BY date DESC
  `).all(...params);
}

function getInventoryValuation() {
  const db = getDb();
  // Use WACC as cost basis — consistent with stockValuation report
  // Aggregate multi-warehouse wacc/last_purchase_cost via MAX to avoid
  // non-aggregated column errors from GROUP BY i.id
  return db.prepare(`
    SELECT
      COALESCE(i.code, 'ITEM-' || i.id) AS item_code,
      i.name,
      c.name AS category_name,
      COALESCE(SUM(sl.quantity), 0) AS total_quantity,
      COALESCE(MAX(sl.wacc), MAX(sl.last_purchase_cost), i.purchase_price, 0) AS cost_price,
      COALESCE(SUM(sl.quantity), 0) * COALESCE(MAX(sl.wacc), MAX(sl.last_purchase_cost), i.purchase_price, 0) AS total_value
    FROM items i
    LEFT JOIN stock_levels sl ON i.id = sl.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE COALESCE(i.is_active, 1) = 1 AND i.deleted_at IS NULL
    GROUP BY i.id
    ORDER BY total_value DESC
  `).all();
}

function getCashierPerformance(startDate, endDate) {
  const db = getDb();
  let query = `
    SELECT 
      u.id as user_id,
      COALESCE(u.full_name, u.username) as cashier_name,
      COUNT(i.id) as total_invoices,
      SUM(i.total) as total_sales,
      AVG(i.total) as average_invoice_value
    FROM invoices i
    JOIN shifts s ON i.shift_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE i.status != 'cancelled'
  `;
  const params = [];

  if (startDate) {
    query += " AND i.created_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND i.created_at <= ?";
    params.push(endDate);
  }

  query += " GROUP BY u.id, u.full_name ORDER BY total_sales DESC";

  return db.prepare(query).all(...params);
}

function getLowStock() {
  const db = getDb();
  return db.prepare(`
    SELECT i.id,
      COALESCE(i.code, 'ITEM-' || i.id) as item_code,
      i.name,
      i.min_stock_qty as min_stock,
      u.name as unit_name,
      COALESCE(SUM(sl.quantity), 0) as quantity
    FROM items i
    LEFT JOIN stock_levels sl ON i.id = sl.item_id
    LEFT JOIN units u ON i.unit_id = u.id
    WHERE COALESCE(i.is_active, 1) = 1 AND COALESCE(i.min_stock_qty, 0) > 0
    GROUP BY i.id
    HAVING quantity <= i.min_stock_qty
    ORDER BY quantity ASC
  `).all();
}

function getPaymentsReport(startDate, endDate) {
  const db = getDb();
  let q = `SELECT p.id,
    COALESCE(p.reference_number, 'PAY-' || p.id) as payment_number,
    p.amount,
    p.method,
    p.party_type as type,
    DATE(p.created_at) as payment_date,
    c.name as customer_name, s.name as supplier_name, COALESCE(u.full_name, u.username) as created_by
    FROM payments p
    LEFT JOIN customers c ON p.party_type = 'customer' AND p.party_id = c.id
    LEFT JOIN suppliers s ON p.party_type = 'supplier' AND p.party_id = s.id
    LEFT JOIN users u ON p.created_by_user_id = u.id
    WHERE 1=1`;
  const params = [];
  if (startDate) { q += " AND DATE(p.created_at) >= ?"; params.push(startDate); }
  if (endDate) { q += " AND DATE(p.created_at) <= ?"; params.push(endDate); }
  q += " ORDER BY p.created_at DESC";
  return db.prepare(q).all(...params);
}

const COST_METHOD_LABELS = {
  wacc: "المتوسط المرجح للتكلفة (WACC)",
  last_purchase: "آخر سعر شراء",
};

function getProfitLoss(startDate, endDate, opts = {}) {
  const db = getDb();
  const costMethod = opts.cost_method || "wacc";
  // Fully-prefixed cost fallback chain matching getCostColumn from helpers.js.
  // Uses it.purchase_price as ultimate fallback (items is always joined).
  const costCol = costMethod === "last_purchase"
    ? "COALESCE(NULLIF(il.cost_last_purchase, 0), NULLIF(il.cost_wacc, 0), NULLIF(it.purchase_price, 0), 0)"
    : costMethod === "fifo"
      ? "COALESCE(NULLIF(il.cost_fifo, 0), NULLIF(il.cost_wacc, 0), NULLIF(il.cost_last_purchase, 0), NULLIF(it.purchase_price, 0), 0)"
      : costMethod === "lifo"
        ? "COALESCE(NULLIF(il.cost_lifo, 0), NULLIF(il.cost_wacc, 0), NULLIF(il.cost_last_purchase, 0), NULLIF(it.purchase_price, 0), 0)"
        : "COALESCE(NULLIF(il.cost_wacc, 0), NULLIF(il.cost_last_purchase, 0), NULLIF(it.purchase_price, 0), 0)";

  const dateParams = [];
  let dateWhere = "";
  if (startDate) { dateWhere += " AND DATE(i.created_at) >= ?"; dateParams.push(startDate); }
  if (endDate) { dateWhere += " AND DATE(i.created_at) <= ?"; dateParams.push(endDate); }

  const expParams = [];
  let expWhere = "WHERE 1=1";
  if (startDate) { expWhere += " AND DATE(created_at) >= ?"; expParams.push(startDate); }
  if (endDate) { expWhere += " AND DATE(created_at) <= ?"; expParams.push(endDate); }

  // Revenue = SUM(i.total): already nets header discount and includes increase
  const sales = db.prepare(`
    SELECT COALESCE(SUM(i.total), 0) AS revenue,
           COALESCE(SUM(i.discount), 0) AS discounts,
           COALESCE(SUM(i.increase), 0) AS increases
    FROM invoices i
    WHERE i.status != 'cancelled' ${dateWhere}
  `).get(...dateParams);

  // COGS uses snapshot cost from invoice_lines (not live items.purchase_price)
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(il.quantity * ${costCol}), 0) AS total
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN items it ON it.id = il.item_id
    WHERE i.status != 'cancelled' ${dateWhere}
  `).get(...dateParams);

  // Returns: deduct return revenue and reverse return cost using same cost method
  const returnCostCol = costMethod === "last_purchase"
    ? "COALESCE(ref_il.cost_last_purchase, srl.cost_last_purchase, it.purchase_price, 0)"
    : costMethod === "purchase_price"
      ? "COALESCE(it.purchase_price, 0)"
      : "COALESCE(ref_il.cost_wacc, srl.cost_wacc, it.purchase_price, 0)";
  const returnsRow = db.prepare(`
    SELECT COALESCE(SUM(sr.total), 0) AS return_revenue,
           COALESCE(SUM(srl.quantity * ${returnCostCol}), 0) AS return_cost
    FROM sales_returns sr
    JOIN sales_return_lines srl ON srl.sales_return_id = sr.id
    LEFT JOIN invoice_lines ref_il ON ref_il.id = srl.invoice_line_id
    LEFT JOIN items it ON it.id = srl.item_id
    WHERE sr.status = 'active'
      ${startDate ? " AND DATE(sr.created_at) >= ?" : ""}
      ${endDate ? " AND DATE(sr.created_at) <= ?" : ""}
  `).get(...(startDate ? [startDate] : []), ...(endDate ? [endDate] : []));

  const expenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses ${expWhere}`).get(...expParams);

  const revenue = Number(sales.revenue || 0);
  const discounts = Number(sales.discounts || 0);
  const increases = Number(sales.increases || 0);
  const cogs = Number(cogsRow.total || 0);
  const returnRevenue = Number(returnsRow.return_revenue || 0);
  const returnCost = Number(returnsRow.return_cost || 0);
  const expenseTotal = Number(expenses.total || 0);

  const netRevenue = revenue - returnRevenue;
  const netCogs = cogs - returnCost;
  const grossProfit = netRevenue - netCogs;

  return {
    revenue,
    discounts,
    increases,
    returns: returnRevenue,
    net_revenue: netRevenue,
    cost_of_goods_sold: netCogs,
    expenses: expenseTotal,
    gross_profit: grossProfit,
    net_profit: grossProfit - expenseTotal,
    cost_method_label: COST_METHOD_LABELS[costMethod] || costMethod,
  };
}

module.exports = {
  getSalesSummary,
  getInventoryValuation,
  getCashierPerformance,
  getLowStock,
  getPaymentsReport,
  getProfitLoss,
};
