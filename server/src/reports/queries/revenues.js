const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");
const { paginateSql } = require("../pagination");

function revenueSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  return db.prepare(`
    SELECT DATE(r.created_at) AS date,
      COUNT(*) AS revenue_count,
      SUM(r.amount) AS total_revenues,
      ROUND(AVG(r.amount), 2) AS avg_revenue,
      COUNT(DISTINCT r.category_id) AS category_count
    FROM revenues r
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
      ${category_id ? " AND r.category_id = ?" : ""}
      ${payment_type ? " AND r.payment_method = ?" : ""}
    GROUP BY DATE(r.created_at)
    ORDER BY date DESC
  `).all(...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : []));
}

function detailedRevenues(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  let sql = `
    SELECT DATE(r.created_at) AS date,
      COALESCE(c.name, '??? ????') AS category_name,
      r.amount, r.description, r.notes,
      r.payment_method AS payment_type
    FROM revenues r
    LEFT JOIN revenue_categories c ON c.id = r.category_id
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
      ${category_id ? " AND r.category_id = ?" : ""}
      ${payment_type ? " AND r.payment_method = ?" : ""}
    ORDER BY r.created_at DESC
  `;
  const allParams = [...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function revenuesByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id, payment_type } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, '??? ????') AS category_name,
      COUNT(*) AS revenue_count,
      SUM(r.amount) AS total_revenues,
      ROUND(AVG(r.amount), 2) AS avg_revenue,
      ROUND(SUM(r.amount) * 100.0 / NULLIF(SUM(SUM(r.amount)) OVER (), 0), 1) AS pct_of_total,
      MAX(DATE(r.created_at)) AS last_revenue_date
    FROM revenues r
    LEFT JOIN revenue_categories c ON c.id = r.category_id
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
      ${category_id ? " AND r.category_id = ?" : ""}
      ${payment_type ? " AND r.payment_method = ?" : ""}
    GROUP BY c.id
    ORDER BY total_revenues DESC
  `).all(...params, ...(category_id ? [category_id] : []), ...(payment_type ? [payment_type] : []));
}

function revenuesByPayment(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { payment_type } = opts;
    const rawData = db.prepare(`
      SELECT r.payment_method,
        COUNT(*) AS revenue_count,
        SUM(r.amount) AS total_revenues
      FROM revenues r
      WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
        ${payment_type ? " AND r.payment_method = ?" : ""}
      GROUP BY r.payment_method
    `).all(...params, ...(payment_type ? [payment_type] : []));

    const merged = new Map();
    for (const row of rawData) {
      let pt = row.payment_method || "cash";
      if (pt === "نقدي" || pt.includes("نقدي -") || pt.includes("نقدي")) pt = "cash";
      
      if (!merged.has(pt)) {
        merged.set(pt, { payment_method: pt, revenue_count: 0, total_revenues: 0 });
      }
      const e = merged.get(pt);
      e.revenue_count += Number(row.revenue_count || 0);
      e.total_revenues += Number(row.total_revenues || 0);
    }

    return Array.from(merged.values())
      .map(r => ({ ...r, avg_revenue: r.revenue_count ? Number((r.total_revenues / r.revenue_count).toFixed(2)) : 0 }))
      .sort((a, b) => b.total_revenues - a.total_revenues);
}

module.exports = { revenueSummary, detailedRevenues, revenuesByCategory, revenuesByPayment };
