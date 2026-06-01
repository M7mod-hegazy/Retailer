exports.up = function (db) {
  // Recalculate supplier opening_balance without MAX(0) clamping.
  // Previously, many supplier balance deductions used MAX(0, balance - X),
  // which silently clamped negative balances to zero. This migration
  // recalculates every supplier's true current balance by starting from
  // base_opening_balance and applying all transaction effects forward
  // using simple arithmetic (no clamping).
  //
  // Formula:
  //   opening_balance = COALESCE(base_opening_balance, 0)
  //     + non-voided credit purchases (ajal_debts where party_type='supplier')
  //     - standalone supplier payments
  //     - ajal_payments for this supplier's ajal debts
  //     - non-cancelled purchase return credit amounts
  //     + supplier_notes adjustments (type='adjustment')

  const suppliers = db.prepare("SELECT id, opening_balance, base_opening_balance FROM suppliers").all();

  for (const s of suppliers) {
    const base = Number(s.base_opening_balance || 0);

    const purchaseCredit = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(original_amount), 0) AS v FROM ajal_debts
           WHERE supplier_id = ? AND COALESCE(party_type,'customer') = 'supplier' AND status != 'voided'`,
        )
        .get(s.id)?.v || 0,
    );

    const payments = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS v FROM payments
           WHERE party_type = 'supplier' AND party_id = ?`,
        )
        .get(s.id)?.v || 0,
    );

    const ajalPayments = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(ap.amount), 0) AS v
           FROM ajal_payments ap
           JOIN ajal_debts d ON d.id = ap.debt_id
           WHERE d.supplier_id = ? AND COALESCE(d.party_type,'customer') = 'supplier'`,
        )
        .get(s.id)?.v || 0,
    );

    const prCredit = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(
             CASE WHEN COALESCE(settlement_type,'account') = 'account' THEN total
                  WHEN settlement_type = 'split' THEN COALESCE(credit_amount, 0)
                  ELSE 0 END
           ), 0) AS v FROM purchase_returns
           WHERE supplier_id = ? AND COALESCE(status,'') NOT IN ('voided','cancelled')`,
        )
        .get(s.id)?.v || 0,
    );

    const adjNet = Number(
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS v FROM supplier_notes
           WHERE supplier_id = ? AND type = 'adjustment'`,
        )
        .get(s.id)?.v || 0,
    );

    const corrected = base + purchaseCredit - payments - ajalPayments - prCredit + adjNet;

    db.prepare("UPDATE suppliers SET opening_balance = ? WHERE id = ?").run(corrected, s.id);
  }
};
