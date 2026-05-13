const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function userList(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { role, is_active } = opts;
  return db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role,
      CASE WHEN u.is_active = 1 THEN 'نشط' ELSE 'غير نشط' END AS status,
      u.created_at, u.updated_at,
      (SELECT MAX(created_at) FROM audit_logs WHERE user_id = u.id AND action = 'login') AS last_login
    FROM users u
    WHERE 1=1
      ${role ? " AND u.role = ?" : ""}
      ${is_active !== undefined ? " AND u.is_active = ?" : ""}
    ORDER BY u.full_name ASC
  `).all(
    ...params,
    ...(role ? [role] : []),
    ...(is_active !== undefined ? [is_active] : []),
  );
}

function userPerformance(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { user_id } = opts;
  return db.prepare(`
    SELECT u.id AS user_id, u.full_name,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS total_sales,
      COALESCE(SUM(i.discount), 0) AS total_discount,
      COALESCE(AVG(i.total), 0) AS avg_invoice_value,
      COUNT(DISTINCT sr.id) AS returns_handled,
      COALESCE(SUM(sr.total), 0) AS returns_amount,
      COUNT(DISTINCT s.id) AS shift_count
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    LEFT JOIN invoices i ON i.shift_id = sh.id AND i.status = 'paid'
    LEFT JOIN sales_returns sr ON sr.shift_id = sh.id
    LEFT JOIN shifts s ON s.user_id = u.id
    WHERE 1=1
      ${addDateFilter("sh.opened_at", startDate, endDate, params)}
      ${user_id ? " AND sh.user_id = ?" : ""}
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).all(
    ...params,
    ...(user_id ? [user_id] : []),
  );
}

function loginHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { user_id } = opts;
  return db.prepare(`
    SELECT al.id, al.user_id, u.full_name,
      al.action, al.created_at AS date,
      al.payload_json AS details,
      al.resource
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.action IN ('login', 'logout', 'login_failed')
      ${addDateFilter("al.created_at", startDate, endDate, params)}
      ${user_id ? " AND al.user_id = ?" : ""}
    ORDER BY al.created_at DESC
  `).all(
    ...params,
    ...(user_id ? [user_id] : []),
  );
}

module.exports = {
  userList,
  userPerformance,
  loginHistory,
};
