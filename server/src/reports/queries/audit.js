const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");
const { paginateSql } = require("../pagination");

function exceptionsReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  let sql = `
    SELECT i.invoice_no, DATE(i.created_at) AS date,
      COALESCE(c.name, 'نقدي') AS customer_name,
      i.discount, i.status, i.total,
      CASE
        WHEN i.status = 'cancelled' THEN 'ملغاة'
        WHEN i.status = 'unpaid' THEN 'غير مدفوعة'
        WHEN i.discount > i.total * 0.2 THEN 'خصم عالي'
        ELSE 'أخرى'
      END AS exception_type
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE (i.status != 'paid' OR i.discount > i.total * 0.2)
      ${addDateFilter("i.created_at", startDate, endDate, params)}
    ORDER BY i.created_at DESC
  `;
  const allParams = [...params];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function auditLog(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { action, resource } = opts;
  let sql = `
    SELECT al.id, al.user_id, u.full_name,
      al.action, al.resource, al.payload_json, al.created_at
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1 ${addDateFilter("al.created_at", startDate, endDate, params)}
      ${action ? " AND al.action = ?" : ""}
      ${resource ? " AND al.resource = ?" : ""}
    ORDER BY al.id DESC
  `;
  const allParams = [...params, ...(action ? [action] : []), ...(resource ? [resource] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

function userActivity(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { user_id } = opts;
  let sql = `
    SELECT al.user_id, u.full_name,
      al.action, al.resource,
      COUNT(*) AS action_count,
      DATE(al.created_at) AS date
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1 ${addDateFilter("al.created_at", startDate, endDate, params)}
      ${user_id ? " AND al.user_id = ?" : ""}
    GROUP BY al.user_id, al.action, al.resource, DATE(al.created_at)
    ORDER BY date DESC, action_count DESC
  `;
  const allParams = [...params, ...(user_id ? [user_id] : [])];
  if (opts.page || opts.pageSize) {
    const p = paginateSql(sql, opts);
    sql = p.sql;
    allParams.push(...p.params);
  }
  return db.prepare(sql).all(...allParams);
}

module.exports = {
  exceptionsReport,
  auditLog,
  userActivity,
};
