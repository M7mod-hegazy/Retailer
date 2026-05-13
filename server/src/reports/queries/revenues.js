const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function _detailRevenueQuery(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  return db.prepare(`
    SELECT DATE(r.created_at) AS date,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      r.amount, r.description, r.notes,
      r.payment_method AS payment_type
    FROM revenues r
    LEFT JOIN revenue_categories c ON c.id = r.category_id
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
      ${category_id ? " AND r.category_id = ?" : ""}
    ORDER BY r.created_at DESC
  `).all(...params, ...(category_id ? [category_id] : []));
}

function revenueSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  if (category_id) return _detailRevenueQuery(startDate, endDate, opts);
  return db.prepare(`
    SELECT DATE(r.created_at) AS date,
      COUNT(*) AS revenue_count,
      SUM(r.amount) AS total_revenues,
      ROUND(AVG(r.amount), 2) AS avg_revenue,
      COUNT(DISTINCT r.category_id) AS category_count
    FROM revenues r
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
    GROUP BY DATE(r.created_at)
    ORDER BY date DESC
  `).all(...params);
}

function detailedRevenues(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { category_id } = opts;
  return db.prepare(`
    SELECT DATE(r.created_at) AS date,
      COALESCE(c.name, 'غير مصنف') AS category_name,
      r.amount, r.description, r.notes,
      r.payment_method AS payment_type
    FROM revenues r
    LEFT JOIN revenue_categories c ON c.id = r.category_id
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
      ${category_id ? " AND r.category_id = ?" : ""}
    ORDER BY r.created_at DESC
  `).all(...params, ...(category_id ? [category_id] : []));
}

function revenuesByCategory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
      COUNT(*) AS revenue_count,
      SUM(r.amount) AS total_revenues,
      ROUND(AVG(r.amount), 2) AS avg_revenue
    FROM revenues r
    LEFT JOIN revenue_categories c ON c.id = r.category_id
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
    GROUP BY c.id
    ORDER BY total_revenues DESC
  `).all(...params);
}

function revenuesByPayment(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT r.payment_method,
      COUNT(*) AS revenue_count,
      SUM(r.amount) AS total_revenues,
      ROUND(AVG(r.amount), 2) AS avg_revenue
    FROM revenues r
    WHERE 1=1 ${addDateFilter("r.created_at", startDate, endDate, params)}
    GROUP BY r.payment_method
    ORDER BY total_revenues DESC
  `).all(...params);
}

module.exports = {
  _detailRevenueQuery,
  revenueSummary,
  detailedRevenues,
  revenuesByCategory,
  revenuesByPayment,
};
