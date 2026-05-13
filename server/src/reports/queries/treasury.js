const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function cashFlow(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT DATE(t.date) AS date, t.type, SUM(t.amount) AS total
    FROM (
      SELECT created_at AS date, 'مبيعات' AS type, total AS amount
      FROM invoices WHERE status = 'paid'
      UNION ALL
      SELECT created_at, 'إيرادات أخرى', amount FROM revenues
      UNION ALL
      SELECT created_at, 'مصروفات', -amount FROM expenses
    ) t
    WHERE 1=1 ${addDateFilter("t.date", startDate, endDate, params)}
    GROUP BY DATE(t.date), t.type
    ORDER BY date DESC
  `).all(...params);
}

function treasury(startDate, endDate, opts = {}) {
  const db = getDb();
  const treasuries = db.prepare(`
    SELECT t.name, t.code, t.balance, 'treasury' AS source,
      COUNT(p.id) AS tx_count
    FROM treasuries t
    LEFT JOIN payments p ON p.treasury_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all();
  const banks = db.prepare(`
    SELECT b.name, b.code, b.balance, 'bank' AS source,
      COUNT(p.id) AS tx_count
    FROM banks b
    LEFT JOIN payments p ON p.bank_id = b.id
    GROUP BY b.id
    ORDER BY b.name ASC
  `).all();
  return [...treasuries, ...banks];
}

function cashConsistency(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT DATE(s.opened_at) AS date, s.id AS shift_id,
      u.full_name AS cashier,
      s.opening_cash, s.closing_cash,
      COALESCE(SUM(i.total), 0) AS sales_total,
      (s.opening_cash + COALESCE(SUM(i.total), 0)) AS expected_cash,
      COALESCE(s.closing_cash, 0) - s.opening_cash - COALESCE(SUM(i.total), 0) AS cash_variance,
      COUNT(DISTINCT i.id) AS invoice_count,
      s.status
    FROM shifts s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN invoices i ON i.shift_id = s.id
    WHERE 1=1 ${addDateFilter("s.opened_at", startDate, endDate, params)}
    GROUP BY s.id
    ORDER BY s.opened_at DESC
  `).all(...params);
}

function paymentMethodFlow(startDate, endDate, opts = {}) {
  const db = getDb();

  const paramsA = [];
  const nonMulti = db.prepare(`
    SELECT i.payment_type, DATE(i.created_at) AS date,
      COUNT(*) AS transaction_count, SUM(i.total) AS total_amount
    FROM invoices i
    WHERE i.status = 'paid' AND i.payment_type != 'multi'
      ${addDateFilter("i.created_at", startDate, endDate, paramsA)}
    GROUP BY i.payment_type, DATE(i.created_at)
  `).all(...paramsA);

  const paramsB = [];
  const multiSplits = db.prepare(`
    SELECT p.method AS payment_type, DATE(i.created_at) AS date,
      COUNT(DISTINCT i.id) AS transaction_count, SUM(p.amount) AS total_amount
    FROM invoices i
    JOIN payment_allocations pa ON pa.invoice_id = i.id
    JOIN payments p ON p.id = pa.payment_id
    WHERE i.status = 'paid' AND i.payment_type = 'multi'
      ${addDateFilter("i.created_at", startDate, endDate, paramsB)}
    GROUP BY p.method, DATE(i.created_at)
  `).all(...paramsB);

  const mergeMap = new Map();
  for (const row of [...nonMulti, ...multiSplits]) {
    const key = `${row.payment_type}::${row.date}`;
    if (!mergeMap.has(key)) {
      mergeMap.set(key, { ...row, transaction_count: Number(row.transaction_count), total_amount: Number(row.total_amount) });
    } else {
      const e = mergeMap.get(key);
      e.transaction_count += Number(row.transaction_count);
      e.total_amount      += Number(row.total_amount);
    }
  }

  const rows = Array.from(mergeMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const runningMap = new Map();
  for (const row of rows) {
    const prev = runningMap.get(row.payment_type) || 0;
    row.running_total = prev + row.total_amount;
    runningMap.set(row.payment_type, row.running_total);
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.total_amount - a.total_amount);
}

function bankCashSplit(startDate, endDate, opts = {}) {
  const db = getDb();
  const rows = [
    ...db.prepare("SELECT 'treasury' AS type, name, balance FROM treasuries WHERE is_active = 1").all(),
    ...db.prepare("SELECT 'bank' AS type, name, balance FROM banks WHERE is_active = 1").all(),
  ];
  const grandTotal = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
  return rows.map(r => ({
    ...r,
    percentage: grandTotal > 0 ? Math.round((Number(r.balance) / grandTotal) * 100) : 0,
  }));
}

function reconciliationExceptions(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT DATE(s.opened_at) AS date, s.id AS shift_id,
      u.full_name AS cashier,
      s.opening_cash, s.closing_cash,
      COALESCE(SUM(i.total), 0) AS sales_total,
      (s.opening_cash + COALESCE(SUM(i.total), 0)) AS expected_cash,
      COALESCE(s.closing_cash, 0) - s.opening_cash - COALESCE(SUM(i.total), 0) AS cash_variance,
      COUNT(DISTINCT i.id) AS invoice_count,
      s.status
    FROM shifts s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN invoices i ON i.shift_id = s.id
    WHERE ABS(COALESCE(s.closing_cash, 0) - s.opening_cash - COALESCE(SUM(i.total), 0)) > 0.01
      ${addDateFilter("s.opened_at", startDate, endDate, params)}
    GROUP BY s.id
    HAVING ABS(cash_variance) > 0.01
    ORDER BY s.opened_at DESC
  `).all(...params);
}

function dailySessionsReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT DATE(s.opened_at) AS date,
      u.full_name AS cashier,
      s.opening_cash, COALESCE(s.closing_cash, 0) AS closing_cash,
      COALESCE(SUM(i.total), 0) AS sales_total,
      COALESCE(SUM(i.discount), 0) AS total_discount,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(s.closing_cash, 0) - s.opening_cash - COALESCE(SUM(i.total), 0) AS cash_variance,
      s.status
    FROM shifts s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN invoices i ON i.shift_id = s.id
    WHERE 1=1 ${addDateFilter("s.opened_at", startDate, endDate, params)}
    GROUP BY s.id
    ORDER BY s.opened_at DESC
  `).all(...params);
}

function withdrawalsReport(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT w.id, w.reference_no, DATE(w.date) AS date,
      w.amount, w.reason, w.status,
      t.name AS treasury_name,
      u.full_name AS created_by
    FROM withdrawals w
    LEFT JOIN treasuries t ON t.id = w.treasury_id
    LEFT JOIN users u ON u.id = w.created_by
    WHERE 1=1 ${addDateFilter("w.date", startDate, endDate, params)}
    ORDER BY w.date DESC
  `).all(...params);
}

module.exports = {
  cashFlow,
  treasury,
  cashConsistency,
  paymentMethodFlow,
  bankCashSplit,
  reconciliationExceptions,
  dailySessionsReport,
  withdrawalsReport,
};
