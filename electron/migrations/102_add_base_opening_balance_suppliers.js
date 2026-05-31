exports.up = function (db) {
  try { db.exec("ALTER TABLE suppliers ADD COLUMN base_opening_balance REAL DEFAULT NULL"); } catch (_) {}

  // Compute the original opening balance for every existing supplier by reversing
  // all transactions that have touched opening_balance since the supplier was created:
  //   initial = current
  //           - purchase_credit   (ajal_debts created for this supplier, non-voided)
  //           + payments          (standalone supplier payments)
  //           + ajal_payments     (ajal debt payments)
  //           + pr_credit         (purchase return credit settlements)
  //           - net_adjustments   (supplier_notes of type 'adjustment', sum can be +/-)
  const suppliers = db.prepare("SELECT id, opening_balance, base_opening_balance FROM suppliers").all();

  for (const s of suppliers) {
    if (s.base_opening_balance !== null) continue; // already set

    const current = Number(s.opening_balance || 0);

    const purchaseCredit = Number(db.prepare(`
      SELECT COALESCE(SUM(original_amount), 0) AS v FROM ajal_debts
      WHERE supplier_id = ? AND COALESCE(party_type,'customer') = 'supplier' AND status != 'voided'
    `).get(s.id)?.v || 0);

    const payments = Number(db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS v FROM payments
      WHERE party_type = 'supplier' AND party_id = ?
    `).get(s.id)?.v || 0);

    const ajalPayments = Number(db.prepare(`
      SELECT COALESCE(SUM(ap.amount), 0) AS v
      FROM ajal_payments ap
      JOIN ajal_debts d ON d.id = ap.debt_id
      WHERE d.supplier_id = ? AND COALESCE(d.party_type,'customer') = 'supplier'
    `).get(s.id)?.v || 0);

    const prCredit = Number(db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN COALESCE(settlement_type,'account') = 'account' THEN total
             WHEN settlement_type = 'split' THEN COALESCE(credit_amount, 0)
             ELSE 0 END
      ), 0) AS v FROM purchase_returns
      WHERE supplier_id = ? AND COALESCE(status,'') NOT IN ('voided','cancelled')
    `).get(s.id)?.v || 0);

    const adjNet = Number(db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS v FROM supplier_notes
      WHERE supplier_id = ? AND type = 'adjustment'
    `).get(s.id)?.v || 0);

    const base = current - purchaseCredit + payments + ajalPayments + prCredit - adjNet;
    db.prepare("UPDATE suppliers SET base_opening_balance = ? WHERE id = ?").run(base, s.id);
  }
};
