const { getDb } = require("../config/database");

function ensureLoyaltySchema(db) {
  const customerColumns = db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name);
  if (!customerColumns.includes("loyalty_points")) {
    db.exec("ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0");
  }

  const transactionColumns = db.prepare("PRAGMA table_info(loyalty_transactions)").all().map((column) => column.name);
  if (!transactionColumns.includes("source")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN source TEXT DEFAULT 'manual'");
  if (!transactionColumns.includes("transaction_type")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN transaction_type TEXT");
  if (!transactionColumns.includes("balance_after")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN balance_after INTEGER DEFAULT 0");
  if (!transactionColumns.includes("note")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN note TEXT");
  if (!transactionColumns.includes("user_id")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN user_id INTEGER");
  if (!transactionColumns.includes("invoice_id")) db.exec("ALTER TABLE loyalty_transactions ADD COLUMN invoice_id INTEGER");
}

function earnPointsForInvoice(customerId, invoiceId, points, userId = null) {
  const db = getDb();
  ensureLoyaltySchema(db);
  const customer = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
  const nextBalance = Number(customer?.loyalty_points || 0) + Number(points || 0);

  db.prepare("UPDATE customers SET loyalty_points = ? WHERE id = ?").run(nextBalance, customerId);
  db.prepare(
    "INSERT INTO loyalty_transactions (customer_id, invoice_id, points, source, transaction_type, balance_after, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(customerId, invoiceId || null, Number(points || 0), "invoice", "earn", nextBalance, userId);

  return nextBalance;
}

function calculateEarnedPoints(invoiceTotal) {
  return Math.floor(Number(invoiceTotal || 0) / 100);
}

module.exports = { earnPointsForInvoice, calculateEarnedPoints };
