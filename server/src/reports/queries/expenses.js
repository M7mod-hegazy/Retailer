const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function _detailExpenseQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  return db.prepare(`
    SELECT DATE(e.created_at) AS date,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      e.amount, e.description, e.notes,
      e.payment_method AS payment_type
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
      ${category_id ? " AND e.category_id = ?" : ""}
    ORDER BY e.created_at DESC
  `).all(...params, ...(category_id ? [category_id] : []));
}

function expenseSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  if (category_id) return _detailExpenseQuery(startDate, endDate, opts);
  return db.prepare(`
    SELECT DATE(e.created_at) AS date,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_expenses,
      ROUND(AVG(e.amount), 2) AS avg_expense,
      COUNT(DISTINCT e.category_id) AS category_count
    FROM expenses e
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
    GROUP BY DATE(e.created_at)
    ORDER BY date DESC
  `).all(...params);
}

function detailedExpenses(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  return db.prepare(`
    SELECT DATE(e.created_at) AS date,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      e.amount, e.description, e.notes,
      e.payment_method, e.employee_id
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
      ${category_id ? " AND e.category_id = ?" : ""}
    ORDER BY e.created_at DESC
  `).all(...params, ...(category_id ? [category_id] : []));
}

function expensesByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_expenses,
      ROUND(AVG(e.amount), 2) AS avg_expense,
      MAX(DATE(e.created_at)) AS last_expense_date
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
    GROUP BY c.id
    ORDER BY total_expenses DESC
  `).all(...params);
}

function expensesByPayment(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT e.payment_method,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_expenses,
      ROUND(AVG(e.amount), 2) AS avg_expense
    FROM expenses e
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
    GROUP BY e.payment_method
    ORDER BY total_expenses DESC
  `).all(...params);
}

module.exports = {
  _detailExpenseQuery,
  expenseSummary,
  detailedExpenses,
  expensesByCategory,
  expensesByPayment,
};
