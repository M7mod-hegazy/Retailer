const { getDb } = require("../config/database");

function getSalesSummary(startDate, endDate) {
  const db = getDb();
  let baseQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(id) as invoice_count,
      SUM(total) as revenue,
      SUM(subtotal) as subtotal,
      SUM(discount) as total_discount
    FROM invoices
    WHERE status != 'cancelled'
  `;
  const params = [];

  if (startDate) {
    baseQuery += " AND created_at >= ?";
    params.push(startDate);
  }
  if (endDate) {
    baseQuery += " AND created_at <= ?";
    params.push(endDate);
  }

  baseQuery += " GROUP BY DATE(created_at) ORDER BY date DESC";

  return db.prepare(baseQuery).all(...params);
}

function getInventoryValuation() {
  const db = getDb();
  const query = `
    SELECT 
      COALESCE(i.code, 'ITEM-' || i.id) as item_code,
      i.name,
      c.name as category_name,
      COALESCE(SUM(sl.quantity), 0) as total_quantity,
      i.purchase_price as cost_price,
      (COALESCE(SUM(sl.quantity), 0) * i.purchase_price) as total_value
    FROM items i
    LEFT JOIN stock_levels sl ON i.id = sl.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE COALESCE(i.is_active, 1) = 1
    GROUP BY i.id
    ORDER BY total_value DESC
  `;

  return db.prepare(query).all();
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

  query += " GROUP BY u.id, u.name ORDER BY total_sales DESC";

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

function getProfitLoss(startDate, endDate) {
  const db = getDb();
  const invoiceParams = [];
  let invoiceWhere = "WHERE status != 'cancelled'";
  if (startDate) { invoiceWhere += " AND DATE(created_at) >= ?"; invoiceParams.push(startDate); }
  if (endDate) { invoiceWhere += " AND DATE(created_at) <= ?"; invoiceParams.push(endDate); }

  const expenseParams = [];
  let expenseWhere = "WHERE 1=1";
  if (startDate) { expenseWhere += " AND DATE(created_at) >= ?"; expenseParams.push(startDate); }
  if (endDate) { expenseWhere += " AND DATE(created_at) <= ?"; expenseParams.push(endDate); }

  const sales = db.prepare(`SELECT COALESCE(SUM(total),0) as revenue, COALESCE(SUM(discount),0) as discounts FROM invoices ${invoiceWhere}`).get(...invoiceParams);
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses ${expenseWhere}`).get(...expenseParams);
  const costOfGoods = db.prepare(
    `SELECT COALESCE(SUM(il.quantity * COALESCE(items.purchase_price, 0)), 0) AS total
     FROM invoice_lines il
     JOIN invoices i ON i.id = il.invoice_id
     LEFT JOIN items ON items.id = il.item_id
     ${invoiceWhere.replace(/created_at/g, "i.created_at").replace("status", "i.status")}`,
  ).get(...invoiceParams);

  const revenue = Number(sales.revenue || 0);
  const discounts = Number(sales.discounts || 0);
  const expenseTotal = Number(expenses.total || 0);
  const cogs = Number(costOfGoods.total || 0);
  const grossProfit = revenue - discounts - cogs;

  return {
    revenue,
    discounts,
    cost_of_goods_sold: cogs,
    expenses: expenseTotal,
    gross_profit: grossProfit,
    net_profit: grossProfit - expenseTotal,
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
