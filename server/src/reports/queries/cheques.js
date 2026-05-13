const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");

function chequeListing(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { status } = opts;
  return db.prepare(`
    SELECT c.id, c.cheque_no, c.bank_name, c.amount, c.due_date, c.status, c.type,
      c.drawer_name, c.notes,
      COALESCE(p.party_type, '') AS party_type,
      COALESCE(p.party_id, 0) AS party_id,
      DATE(c.created_at) AS created_date
    FROM cheques c
    LEFT JOIN payments p ON p.id = c.payment_id
    WHERE 1=1 ${addDateFilter("c.created_at", startDate, endDate, params)}
      ${status ? " AND c.status = ?" : ""}
    ORDER BY c.created_at DESC
  `).all(...params, ...(status ? [status] : []));
}

function bankTransactions(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  return db.prepare(`
    SELECT bt.id, b.name AS bank_name,
      bt.type, bt.amount, bt.reference, bt.notes,
      DATE(bt.created_at) AS date
    FROM bank_transactions bt
    JOIN banks b ON b.id = bt.bank_id
    WHERE 1=1 ${addDateFilter("bt.created_at", startDate, endDate, params)}
    ORDER BY bt.created_at DESC
  `).all(...params);
}

function bankSummary(startDate, endDate, opts = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT b.name, b.balance,
      COUNT(bt.id) AS transaction_count,
      COALESCE(SUM(CASE WHEN bt.type = 'deposit' THEN bt.amount ELSE 0 END), 0) AS total_deposits,
      COALESCE(SUM(CASE WHEN bt.type = 'withdrawal' THEN bt.amount ELSE 0 END), 0) AS total_withdrawals
    FROM banks b
    LEFT JOIN bank_transactions bt ON bt.bank_id = b.id
    WHERE b.is_active = 1
    GROUP BY b.id
    ORDER BY b.name ASC
  `).all();
}

module.exports = {
  chequeListing,
  bankTransactions,
  bankSummary,
};
