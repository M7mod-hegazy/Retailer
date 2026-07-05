const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function tableColumns(db, table) {
  try {
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  } catch {
    return new Set();
  }
}

function tableExists(db, table) {
  return tableColumns(db, table).size > 0;
}

function pushFilter(parts, params, condition, value) {
  if (value === undefined || value === null || value === "") return;
  parts.push(condition);
  params.push(value);
}

function statusLabel(expr) {
  return `CASE COALESCE(${expr}, '')
    WHEN 'paid' THEN 'مدفوع'
    WHEN 'open' THEN 'قيد السداد'
    WHEN 'partial' THEN 'مدفوع جزئياً'
    WHEN 'pending' THEN 'قيد السداد'
    WHEN 'overdue' THEN 'متأخر'
    WHEN 'cancelled' THEN 'ملغي'
    WHEN 'voided' THEN 'ملغي'
    ELSE COALESCE(${expr}, 'غير محدد')
  END`;
}

function legacyInstallmentWhere(alias, opts = {}, dateColumn, startDate, endDate, params) {
  const where = ["1=1"];
  if (dateColumn) {
    const dateClause = addDateFilter(`${alias}.${dateColumn}`, startDate, endDate, params).replace(/^ AND /, "");
    if (dateClause) where.push(dateClause);
  }
  pushFilter(where, params, `${alias}.customer_id = ?`, opts.customer_id);
  pushFilter(where, params, `${alias}.status = ?`, opts.status);
  return where.join(" AND ");
}

function debtWhere(db, alias, opts = {}, dateColumn, startDate, endDate, params) {
  const cols = tableColumns(db, "ajal_debts");
  const where = [`COALESCE(${alias}.status, '') != 'voided'`];
  if (cols.has("party_type")) where.push(`COALESCE(${alias}.party_type, 'customer') = 'customer'`);
  if (cols.has("source_type")) where.push(`COALESCE(${alias}.source_type, 'invoice') = 'invoice'`);
  if (dateColumn) {
    const dateClause = addDateFilter(`${alias}.${dateColumn}`, startDate, endDate, params).replace(/^ AND /, "");
    if (dateClause) where.push(dateClause);
  }
  pushFilter(where, params, `${alias}.customer_id = ?`, opts.customer_id);
  if (opts.status) {
    if (opts.status === "pending" || opts.status === "open") where.push(`COALESCE(${alias}.status, 'open') NOT IN ('paid', 'voided', 'cancelled')`);
    else if (opts.status === "cancelled") where.push(`COALESCE(${alias}.status, '') IN ('cancelled', 'voided')`);
    else pushFilter(where, params, `${alias}.status = ?`, opts.status);
  }
  return where.join(" AND ");
}

function legacyInstallmentPlans(db, startDate, endDate, opts) {
  const params = [];
  const where = legacyInstallmentWhere("i", opts, "created_at", startDate, endDate, params);
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      i.total, i.remaining, i.down_payment,
      i.frequency, i.installment_count, i.installment_amount,
      COALESCE(i.due_date, i.next_due_date) AS due_date, i.status,
      ${statusLabel("i.status")} AS status_label,
      i.paid_at, DATE(i.created_at) AS created_date,
      (i.total - i.remaining) AS paid_amount,
      CASE WHEN i.total > 0 THEN ROUND(((i.total - i.remaining) * 100.0 / i.total), 1) ELSE 0 END AS paid_pct,
      CASE WHEN i.remaining > 0 THEN ROUND((i.remaining * 100.0 / NULLIF(i.total, 0)), 1) ELSE 0 END AS remaining_pct,
      CASE WHEN i.remaining > 0 AND COALESCE(i.due_date, i.next_due_date) IS NOT NULL AND DATE(COALESCE(i.due_date, i.next_due_date)) < DATE('now') THEN 1 ELSE 0 END AS is_overdue
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE ${where}
    ORDER BY i.created_at DESC
  `).all(...params);
}

function installmentPlans(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!tableExists(db, "ajal_debts")) return legacyInstallmentPlans(db, startDate, endDate, opts);
  const params = [];
  const where = debtWhere(db, "d", opts, "created_at", startDate, endDate, params);
  const invoiceCols = tableColumns(db, "invoices");
  const downPaymentExpr = invoiceCols.has("amount_received") ? "ROUND(COALESCE(i.amount_received, 0), 2)" : "0";
  const invoiceJoinFilter = tableExists(db, "invoices") && invoiceCols.has("payment_type") ? "AND (i.id IS NULL OR i.payment_type = 'installments')" : "";
  const scheduleJoin = tableExists(db, "ajal_schedules") ? `
    LEFT JOIN (
      SELECT debt_id,
        COUNT(*) AS installment_count,
        ROUND(AVG(amount), 2) AS installment_amount,
        MIN(CASE WHEN COALESCE(status, 'pending') NOT IN ('paid', 'voided') AND paid_at IS NULL THEN due_date END) AS next_due_date,
        MAX(paid_at) AS paid_at,
        SUM(CASE WHEN COALESCE(status, 'pending') NOT IN ('paid', 'voided') AND paid_at IS NULL AND due_date IS NOT NULL AND DATE(due_date) < DATE('now', 'localtime') THEN 1 ELSE 0 END) AS overdue_count
      FROM ajal_schedules
      GROUP BY debt_id
    ) s ON s.debt_id = d.id` : "";
  return db.prepare(`
    SELECT d.id, COALESCE(c.name, 'عميل') AS customer_name,
      ROUND(COALESCE(d.original_amount, 0), 2) AS total,
      ROUND(COALESCE(d.paid_amount, 0), 2) AS paid_amount,
      CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN ROUND(COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0), 2) ELSE 0 END AS remaining,
      ${downPaymentExpr} AS down_payment,
      'مجدول' AS frequency,
      COALESCE(s.installment_count, 1) AS installment_count,
      ROUND(COALESCE(s.installment_amount, d.original_amount), 2) AS installment_amount,
      COALESCE(s.next_due_date, d.due_date) AS due_date,
      d.status,
      ${statusLabel("d.status")} AS status_label,
      s.paid_at,
      DATE(d.created_at) AS created_date,
      CASE WHEN COALESCE(d.original_amount, 0) > 0 THEN ROUND(COALESCE(d.paid_amount, 0) * 100.0 / d.original_amount, 1) ELSE 0 END AS paid_pct,
      CASE WHEN COALESCE(d.original_amount, 0) > 0 THEN ROUND(CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN (COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) ELSE 0 END * 100.0 / d.original_amount, 1) ELSE 0 END AS remaining_pct,
      CASE WHEN COALESCE(s.overdue_count, 0) > 0 OR ((COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) > 0 AND d.due_date IS NOT NULL AND DATE(d.due_date) < DATE('now', 'localtime')) THEN 1 ELSE 0 END AS is_overdue
    FROM ajal_debts d
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN invoices i ON i.id = d.invoice_id
    ${scheduleJoin}
    WHERE ${where} ${invoiceJoinFilter}
    ORDER BY d.created_at DESC
  `).all(...params);
}

function legacyInstallmentCollections(db, startDate, endDate, opts) {
  const params = [];
  const where = legacyInstallmentWhere("i", opts, "paid_at", startDate, endDate, params);
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      ROUND(i.total - i.remaining, 2) AS collected,
      ROUND(i.installment_amount, 2) AS installment_amount, COALESCE(i.due_date, i.next_due_date) AS due_date, i.paid_at, i.status,
      ${statusLabel("i.status")} AS status_label,
      ROUND(i.remaining, 2) AS remaining, ROUND(i.total, 2) AS total,
      CASE WHEN i.total > 0 THEN ROUND(((i.total - i.remaining) * 100.0 / i.total), 1) ELSE 0 END AS collection_rate
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.paid_at IS NOT NULL AND ${where}
    ORDER BY i.paid_at DESC
  `).all(...params);
}

function installmentCollections(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!tableExists(db, "ajal_debts") || !tableExists(db, "ajal_payments")) return legacyInstallmentCollections(db, startDate, endDate, opts);
  const params = [];
  const where = debtWhere(db, "d", opts, null, null, null, params);
  const paymentDateExpr = tableColumns(db, "ajal_payments").has("payment_date") ? "COALESCE(ap.payment_date, ap.created_at)" : "ap.created_at";
  const dateClause = addDateFilter(paymentDateExpr, startDate, endDate, params).replace(/^ AND /, "");
  const dateWhere = dateClause ? ` AND ${dateClause}` : "";
  return db.prepare(`
    SELECT ap.id, d.id AS plan_id, COALESCE(c.name, 'عميل') AS customer_name,
      ROUND(COALESCE(ap.amount, 0), 2) AS collected,
      ROUND(COALESCE(ap.amount, 0), 2) AS installment_amount,
      d.due_date,
      ${paymentDateExpr} AS paid_at,
      d.status,
      ${statusLabel("d.status")} AS status_label,
      ROUND(MAX(COALESCE(d.original_amount, 0) - (SELECT COALESCE(SUM(p2.amount), 0) FROM ajal_payments p2 WHERE p2.debt_id = ap.debt_id AND (p2.created_at < ap.created_at OR (p2.created_at = ap.created_at AND p2.id <= ap.id))), 0), 2) AS remaining,
      ROUND(COALESCE(d.original_amount, 0), 2) AS total,
      CASE WHEN COALESCE(d.original_amount, 0) > 0 THEN ROUND(COALESCE(d.paid_amount, 0) * 100.0 / d.original_amount, 1) ELSE 0 END AS collection_rate,
      COALESCE(pm.name, 'غير محدد') AS method_name
    FROM ajal_payments ap
    JOIN ajal_debts d ON d.id = ap.debt_id
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    WHERE ${where}${dateWhere}
    ORDER BY ${paymentDateExpr} DESC, ap.id DESC
  `).all(...params);
}

function installmentsByCustomer(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!tableExists(db, "ajal_debts")) {
    const params = [];
    const where = legacyInstallmentWhere("i", opts, "created_at", startDate, endDate, params);
    return db.prepare(`
      SELECT COALESCE(c.name, 'عميل') AS customer_name,
        COUNT(i.id) AS plan_count,
        ROUND(SUM(COALESCE(i.total, 0)), 2) AS total_amount,
        ROUND(SUM(COALESCE(i.remaining, 0)), 2) AS total_remaining,
        ROUND(SUM(COALESCE(i.total, 0) - COALESCE(i.remaining, 0)), 2) AS total_paid,
        MAX(COALESCE(i.due_date, i.next_due_date)) AS last_due_date,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS paid_count,
        COUNT(CASE WHEN i.status = 'pending' OR i.status = 'open' THEN 1 END) AS pending_count,
        COUNT(CASE WHEN COALESCE(i.remaining, 0) > 0 AND COALESCE(i.due_date, i.next_due_date) IS NOT NULL AND DATE(COALESCE(i.due_date, i.next_due_date)) < DATE('now', 'localtime') THEN 1 END) AS overdue_count,
        CASE WHEN SUM(COALESCE(i.total, 0)) > 0 THEN ROUND(SUM(COALESCE(i.total, 0) - COALESCE(i.remaining, 0)) * 100.0 / SUM(COALESCE(i.total, 0)), 1) ELSE 0 END AS collection_rate
      FROM installments i
      LEFT JOIN customers c ON c.id = i.customer_id
      WHERE ${where}
      GROUP BY i.customer_id
      ORDER BY total_remaining DESC
    `).all(...params);
  }
  const params = [];
  const where = debtWhere(db, "d", opts, "created_at", startDate, endDate, params);
  const scheduleJoin = tableExists(db, "ajal_schedules") ? `
    LEFT JOIN (
      SELECT debt_id,
        MIN(CASE WHEN COALESCE(status, 'pending') NOT IN ('paid', 'voided') AND paid_at IS NULL THEN due_date END) AS next_due_date,
        SUM(CASE WHEN COALESCE(status, 'pending') NOT IN ('paid', 'voided') AND paid_at IS NULL AND due_date IS NOT NULL AND DATE(due_date) < DATE('now', 'localtime') THEN 1 ELSE 0 END) AS overdue_schedules_count
      FROM ajal_schedules
      GROUP BY debt_id
    ) s ON s.debt_id = d.id` : "";
  return db.prepare(`
    SELECT COALESCE(c.name, 'عميل') AS customer_name,
      COUNT(d.id) AS plan_count,
      ROUND(SUM(COALESCE(d.original_amount, 0)), 2) AS total_amount,
      ROUND(SUM(CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN (COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) ELSE 0 END), 2) AS total_remaining,
      ROUND(SUM(COALESCE(d.paid_amount, 0)), 2) AS total_paid,
      MAX(COALESCE(s.next_due_date, d.due_date)) AS last_due_date,
      COUNT(CASE WHEN d.status = 'paid' THEN 1 END) AS paid_count,
      COUNT(CASE WHEN COALESCE(d.status, 'open') NOT IN ('paid', 'voided', 'cancelled') THEN 1 END) AS pending_count,
      COALESCE(SUM(CASE WHEN COALESCE(s.overdue_schedules_count, 0) > 0 THEN s.overdue_schedules_count WHEN (COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) > 0 AND d.due_date IS NOT NULL AND DATE(d.due_date) < DATE('now', 'localtime') THEN 1 ELSE 0 END), 0) AS overdue_count,
      CASE WHEN SUM(COALESCE(d.original_amount, 0)) > 0 THEN ROUND(SUM(COALESCE(d.paid_amount, 0)) * 100.0 / SUM(COALESCE(d.original_amount, 0)), 1) ELSE 0 END AS collection_rate
    FROM ajal_debts d
    LEFT JOIN customers c ON c.id = d.customer_id
    ${scheduleJoin}
    WHERE ${where}
    GROUP BY d.customer_id
    ORDER BY total_remaining DESC
  `).all(...params);
}

function legacyInstallmentDelinquent(db, opts) {
  const params = [];
  const where = legacyInstallmentWhere("i", opts, null, null, null, params);
  return db.prepare(`
    SELECT i.id, COALESCE(c.name, 'عميل') AS customer_name,
      ROUND(i.total, 2) AS total, ROUND(i.remaining, 2) AS remaining, ROUND(i.installment_amount, 2) AS installment_amount,
      COALESCE(i.due_date, i.next_due_date) AS due_date,
      CAST(julianday('now') - julianday(COALESCE(i.due_date, i.next_due_date)) AS INTEGER) AS days_overdue,
      CASE
        WHEN julianday('now') - julianday(COALESCE(i.due_date, i.next_due_date)) <= 30 THEN '0-30 يوم'
        WHEN julianday('now') - julianday(COALESCE(i.due_date, i.next_due_date)) <= 60 THEN '31-60 يوم'
        WHEN julianday('now') - julianday(COALESCE(i.due_date, i.next_due_date)) <= 90 THEN '61-90 يوم'
        ELSE 'أكثر من 90 يوم'
      END AS overdue_bucket
    FROM installments i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.status = 'pending' AND i.remaining > 0 AND COALESCE(i.due_date, i.next_due_date) IS NOT NULL
      AND DATE(COALESCE(i.due_date, i.next_due_date)) < DATE('now', 'localtime') AND ${where}
    ORDER BY days_overdue DESC
  `).all(...params);
}

function installmentDelinquent(startDate, endDate, opts = {}) {
  const db = getDb();
  if (!tableExists(db, "ajal_debts")) return legacyInstallmentDelinquent(db, opts);
  const params = [];
  const where = debtWhere(db, "d", opts, null, null, null, params);
  if (tableExists(db, "ajal_schedules")) {
    return db.prepare(`
      SELECT s.id, d.id AS plan_id, COALESCE(c.name, 'عميل') AS customer_name,
        ROUND(COALESCE(d.original_amount, 0), 2) AS total,
        CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN ROUND(COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0), 2) ELSE 0 END AS remaining,
        ROUND(COALESCE(s.amount, 0), 2) AS installment_amount,
        s.due_date,
        CAST(julianday('now') - julianday(s.due_date) AS INTEGER) AS days_overdue,
        CASE
          WHEN julianday('now') - julianday(s.due_date) <= 30 THEN '0-30 يوم'
          WHEN julianday('now') - julianday(s.due_date) <= 60 THEN '31-60 يوم'
          WHEN julianday('now') - julianday(s.due_date) <= 90 THEN '61-90 يوم'
          ELSE 'أكثر من 90 يوم'
        END AS overdue_bucket,
        ${statusLabel("d.status")} AS status_label
      FROM ajal_schedules s
      JOIN ajal_debts d ON d.id = s.debt_id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE ${where}
        AND COALESCE(s.status, 'pending') NOT IN ('paid', 'voided')
        AND s.paid_at IS NULL
        AND s.due_date IS NOT NULL
        AND DATE(s.due_date) < DATE('now', 'localtime')
      ORDER BY days_overdue DESC
    `).all(...params);
  }
  return db.prepare(`
    SELECT d.id, COALESCE(c.name, 'عميل') AS customer_name,
      ROUND(COALESCE(d.original_amount, 0), 2) AS total,
      CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN ROUND(COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0), 2) ELSE 0 END AS remaining,
      CASE WHEN COALESCE(d.original_amount, 0) > COALESCE(d.paid_amount, 0) THEN ROUND(COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0), 2) ELSE 0 END AS installment_amount,
      d.due_date,
      CAST(julianday('now') - julianday(d.due_date) AS INTEGER) AS days_overdue,
      CASE
        WHEN julianday('now') - julianday(d.due_date) <= 30 THEN '0-30 يوم'
        WHEN julianday('now') - julianday(d.due_date) <= 60 THEN '31-60 يوم'
        WHEN julianday('now') - julianday(d.due_date) <= 90 THEN '61-90 يوم'
        ELSE 'أكثر من 90 يوم'
      END AS overdue_bucket,
      ${statusLabel("d.status")} AS status_label
    FROM ajal_debts d
    LEFT JOIN customers c ON c.id = d.customer_id
    WHERE ${where}
      AND (COALESCE(d.original_amount, 0) - COALESCE(d.paid_amount, 0)) > 0
      AND d.due_date IS NOT NULL
      AND DATE(d.due_date) < DATE('now', 'localtime')
    ORDER BY days_overdue DESC
  `).all(...params);
}

module.exports = {
  installmentPlans,
  installmentCollections,
  installmentsByCustomer,
  installmentDelinquent,
};

