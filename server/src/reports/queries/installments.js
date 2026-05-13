const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function installmentPlans(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      i.total, i.remaining, i.down_payment,
      i.frequency, i.installment_count, i.installment_amount,
      i.due_date, i.status, i.paid_at,
      DATE(i.created_at) AS created_date,
      (i.total - i.remaining) AS paid_amount,
      CASE WHEN i.remaining > 0 THEN ROUND((i.remaining * 100.0 / i.total), 1) ELSE 0 END AS remaining_pct
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE 1=1 ${addDateFilter("i.created_at", startDate, endDate, params)}
    ORDER BY i.created_at DESC
  `).all(...params);
}

function installmentCollections(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      i.installment_amount, i.due_date, i.paid_at, i.status,
      i.remaining, i.total
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.paid_at IS NOT NULL ${addDateFilter("i.paid_at", startDate, endDate, params)}
    ORDER BY i.paid_at DESC
  `).all(...params);
}

function installmentsByCustomer(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT COALESCE(c.name, 'عميل') AS customer_name,
      COUNT(i.id) AS plan_count,
      SUM(i.total) AS total_amount,
      SUM(i.remaining) AS total_remaining,
      SUM(i.total - i.remaining) AS total_paid,
      MAX(i.due_date) AS last_due_date,
      COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS paid_count,
      COUNT(CASE WHEN i.status = 'pending' THEN 1 END) AS pending_count
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE 1=1 ${addDateFilter("i.created_at", startDate, endDate, params)}
    GROUP BY i.customer_id
    ORDER BY total_amount DESC
  `).all(...params);
}

function installmentDelinquent(startDate, endDate, opts = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      i.total, i.remaining, i.installment_amount,
      i.due_date,
      CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_overdue,
      CASE
        WHEN julianday('now') - julianday(i.due_date) <= 30 THEN '0-30 يوم'
        WHEN julianday('now') - julianday(i.due_date) <= 60 THEN '31-60 يوم'
        WHEN julianday('now') - julianday(i.due_date) <= 90 THEN '61-90 يوم'
        ELSE 'أكثر من 90 يوم'
      END AS overdue_bucket
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.status = 'pending' AND i.due_date IS NOT NULL AND DATE(i.due_date) < DATE('now')
    ORDER BY days_overdue DESC
  `).all();
}

module.exports = {
  installmentPlans,
  installmentCollections,
  installmentsByCustomer,
  installmentDelinquent,
};
