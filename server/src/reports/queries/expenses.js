const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");
const { paginateSql } = require("../pagination");

function expenseSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  return db.prepare(`
    SELECT DATE(e.created_at) AS date,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_expenses,
      ROUND(AVG(e.amount), 2) AS avg_expense,
      COUNT(DISTINCT e.category_id) AS category_count
    FROM expenses e
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
      ${category_id ? " AND e.category_id = ?" : ""}
      ${payment_type ? " AND e.payment_method = ?" : ""}
    GROUP BY DATE(e.created_at)
    ORDER BY date DESC
  `).all(...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : []));
}

function detailedExpenses(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  let sql = `
    SELECT DATE(e.created_at) AS date,
      COALESCE(c.name, '??? ????') AS category_name,
      e.amount, e.description, e.notes,
      e.payment_method, e.employee_id
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
      ${category_id ? " AND e.category_id = ?" : ""}
      ${payment_type ? " AND e.payment_method = ?" : ""}
    ORDER BY e.created_at DESC
  `;
  const allParams = [...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function expensesByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, '??? ????') AS category_name,
      COUNT(*) AS expense_count,
      SUM(e.amount) AS total_expenses,
      ROUND(AVG(e.amount), 2) AS avg_expense,
      ROUND(SUM(e.amount) * 100.0 / NULLIF(SUM(SUM(e.amount)) OVER (), 0), 1) AS pct_of_total,
      MAX(DATE(e.created_at)) AS last_expense_date
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
      ${category_id ? " AND e.category_id = ?" : ""}
      ${payment_type ? " AND e.payment_method = ?" : ""}
    GROUP BY c.id
    ORDER BY total_expenses DESC
  `).all(...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : []));
}

function expensesByPayment(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { payment_type } = opts;
    const rawData = db.prepare(`
      SELECT e.payment_method,
        COUNT(*) AS expense_count,
        SUM(e.amount) AS total_expenses
      FROM expenses e
      WHERE 1=1 ${addDateFilter("e.created_at", startDate, endDate, params)}
        ${payment_type ? " AND e.payment_method = ?" : ""}
      GROUP BY e.payment_method
    `).all(...params, ...(payment_type ? [payment_type] : []));

    const merged = new Map();
    for (const row of rawData) {
      let pt = row.payment_method || "cash";
      if (pt === "نقدي" || pt.includes("نقدي -") || pt.includes("نقدي")) pt = "cash";
      
      if (!merged.has(pt)) {
        merged.set(pt, { payment_method: pt, expense_count: 0, total_expenses: 0 });
      }
      const e = merged.get(pt);
      e.expense_count += Number(row.expense_count || 0);
      e.total_expenses += Number(row.total_expenses || 0);
    }

    return Array.from(merged.values())
      .map(r => ({ ...r, avg_expense: r.expense_count ? Number((r.total_expenses / r.expense_count).toFixed(2)) : 0 }))
      .sort((a, b) => b.total_expenses - a.total_expenses);
}

module.exports = { expenseSummary, detailedExpenses, expensesByCategory, expensesByPayment };
