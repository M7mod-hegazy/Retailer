// Customers get an immutable `base_opening_balance` — the opening balance entered
// when the customer was created. `opening_balance` is the LIVE running balance
// (mutated by every invoice/payment/return); base is frozen and must NEVER be
// changed by a transaction. The account-statement "opening" row reads base, so:
//   • a customer created with no opening balance never shows an opening row, and
//   • a customer created with one always shows exactly that figure, untouched.
//
// Mirrors 102_add_base_opening_balance_suppliers.js. Backfill computes the true
// opening by reversing every balance-affecting transaction (same sources and sign
// convention as server/src/reports/queries/accounts.js customerStatementV2):
//   base = current
//        − invoice credit (ajal_debts, source_type='invoice', non-voided)
//        + sales-return credit (sales_returns, active)
//        + payments (customer payments)
//        − net adjustments (customer_notes type='adjustment')
exports.up = function (db) {
  try { db.exec("ALTER TABLE customers ADD COLUMN base_opening_balance REAL DEFAULT NULL"); } catch (_) {}

  const customers = db.prepare("SELECT id, opening_balance, base_opening_balance FROM customers").all();

  for (const c of customers) {
    if (c.base_opening_balance !== null && c.base_opening_balance !== undefined) continue; // already set

    const current = Number(c.opening_balance || 0);

    const invoiceCredit = Number(db.prepare(`
      SELECT COALESCE(SUM(original_amount), 0) AS v FROM ajal_debts
      WHERE customer_id = ? AND COALESCE(party_type,'customer') = 'customer'
        AND source_type = 'invoice' AND status != 'voided'
    `).get(c.id)?.v || 0);

    const salesReturnCredit = Number(db.prepare(`
      SELECT COALESCE(SUM(COALESCE(credit_amount, 0)), 0) AS v FROM sales_returns
      WHERE customer_id = ? AND status = 'active'
    `).get(c.id)?.v || 0);

    const payments = Number(db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS v FROM payments
      WHERE party_type = 'customer' AND party_id = ?
    `).get(c.id)?.v || 0);

    let adjNet = 0;
    try {
      adjNet = Number(db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS v FROM customer_notes
        WHERE customer_id = ? AND type = 'adjustment'
      `).get(c.id)?.v || 0);
    } catch (_) { /* customer_notes may not exist on older schemas */ }

    const base = current - invoiceCredit + salesReturnCredit + payments - adjNet;
    db.prepare("UPDATE customers SET base_opening_balance = ? WHERE id = ?").run(base, c.id);
  }
};
