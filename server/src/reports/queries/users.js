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
  const { user_id } = opts;
  // sales_returns has no shift_id — attribute returns to the user who handled them
  // (created_by) via fanout-free correlated subqueries. Joining sr/shifts directly
  // alongside invoices would multiply rows and inflate total_sales.
  const retParams = [];
  const retFilter = addDateFilter("sr2.created_at", startDate, endDate, retParams);
  const mainParams = [];
  const mainFilter = addDateFilter("sh.opened_at", startDate, endDate, mainParams);
  return db.prepare(`
    SELECT u.id AS user_id, u.full_name,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(SUM(i.total), 0) AS total_sales,
      COALESCE(SUM(i.discount), 0) AS total_discount,
      COALESCE(AVG(i.total), 0) AS avg_invoice_value,
      (SELECT COUNT(*) FROM sales_returns sr2
        WHERE sr2.created_by = u.id AND sr2.status = 'active' ${retFilter}) AS returns_handled,
      (SELECT COALESCE(SUM(sr2.total), 0) FROM sales_returns sr2
        WHERE sr2.created_by = u.id AND sr2.status = 'active' ${retFilter}) AS returns_amount,
      COUNT(DISTINCT sh.id) AS shift_count
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    LEFT JOIN invoices i ON i.shift_id = sh.id AND i.status = 'paid'
    WHERE 1=1
      ${mainFilter}
      ${user_id ? " AND sh.user_id = ?" : ""}
    GROUP BY u.id
    ORDER BY total_sales DESC
  `).all(
    ...retParams,
    ...retParams,
    ...mainParams,
    ...(user_id ? [user_id] : []),
  );
}

function loginHistory(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { user_id } = opts;
  return db.prepare(`
    SELECT al.id, al.user_id, u.full_name,
      al.action, al.created_at AS date
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
