// Reconciliation helper for customer/supplier account balances.
//
// `opening_balance` on customers/suppliers is stored as the LIVE running balance
// (it is mutated by every invoice/payment/return), NOT a historical opening.
// Account statements back-compute the true opening as:
//     trueOpening = liveBalance − Σ(all balance-affecting transactions)
//
// `partyTxnSum` returns exactly that Σ(txns) using the SAME transaction sources
// and sign convention as server/src/reports/queries/accounts.js. Importing an
// "opening balance" should therefore set:
//     opening_balance = importedOpening + partyTxnSum(...)
// which preserves existing activity. For a party with no transactions the sum is
// 0, so this reduces to a plain overwrite (the common fresh-import case).

function tableExists(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?")
    .get(name);
}

function scalar(db, sql, params) {
  try {
    return Number(db.prepare(sql).get(...params)?.total || 0);
  } catch (_) {
    return 0;
  }
}

// Signed sum of every balance-affecting transaction for a party.
// Customers: +آجل invoice, −sales return, −payment, +adjustment.
// Suppliers: +آجل purchase, −purchase return, −payment, +adjustment.
function partyTxnSum(db, partyType, partyId) {
  const id = Number(partyId);
  if (!id) return 0;

  if (partyType === "supplier") {
    let total = 0;
    total += scalar(db, `
      SELECT COALESCE(SUM(MAX(0, COALESCE(pur.total, 0) - CASE
        WHEN pur.payment_method IN ('cash', 'bank_transfer') THEN COALESCE(pur.total, 0)
        WHEN pur.payment_method = 'multi' THEN COALESCE((
          SELECT SUM(pp.amount) FROM purchase_payments pp
          LEFT JOIN payment_methods pm ON pm.id = pp.method_id
          WHERE pp.purchase_id = pur.id
            AND pm.type IS NOT NULL AND pm.type != 'credit'
            AND COALESCE(pm.category, '') != 'credit'
        ), 0)
        WHEN pur.payment_method IN ('credit', 'future_due') THEN COALESCE((
          SELECT paid_amount FROM ajal_debts
          WHERE invoice_id = pur.id AND source_type = 'purchase' AND status != 'voided'
          ORDER BY id DESC LIMIT 1
        ), 0)
        ELSE 0
      END)), 0) AS total
      FROM purchases pur
      WHERE pur.supplier_id = ? AND pur.status != 'cancelled'`, [id]);
    total -= scalar(db, `
      SELECT COALESCE(SUM(CASE
        WHEN pr.settlement_type = 'split' THEN COALESCE(pr.credit_amount, 0)
        WHEN pr.settlement_type = 'cash' THEN 0
        ELSE COALESCE(pr.total, 0)
      END), 0) AS total
      FROM purchase_returns pr
      WHERE pr.supplier_id = ? AND pr.status = 'active'`, [id]);
    total -= scalar(db, `
      SELECT COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      WHERE p.party_type = 'supplier' AND p.party_id = ? AND p.invoice_id IS NULL`, [id]);
    if (tableExists(db, "ajal_payments")) {
      total -= scalar(db, `
        SELECT COALESCE(SUM(ap.amount), 0) AS total
        FROM ajal_payments ap
        JOIN ajal_debts ad ON ad.id = ap.debt_id
        WHERE COALESCE(ad.party_type, 'customer') = 'supplier'
          AND ad.supplier_id = ?
`, [id]);
    }
    if (tableExists(db, "supplier_notes")) {
      total += scalar(db, `
        SELECT COALESCE(SUM(COALESCE(n.amount, 0)), 0) AS total
        FROM supplier_notes n
        WHERE n.supplier_id = ? AND n.type = 'adjustment'`, [id]);
    }
    return total;
  }

  // default: customer
  let total = 0;
  total += scalar(db, `
    SELECT COALESCE(SUM(MAX(0, COALESCE(i.total, 0) - COALESCE(i.amount_received, 0))), 0) AS total
    FROM invoices i
    WHERE i.customer_id = ? AND i.status != 'cancelled'`, [id]);
  total -= scalar(db, `
    SELECT COALESCE(SUM(CASE
      WHEN sr.refund_method = 'split' THEN COALESCE(sr.credit_amount, 0)
      WHEN sr.refund_method = 'cash_back' THEN 0
      ELSE COALESCE(sr.total, 0)
    END), 0) AS total
    FROM sales_returns sr
    WHERE sr.customer_id = ? AND sr.status = 'active'`, [id]);
  total -= scalar(db, `
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ? AND p.invoice_id IS NULL`, [id]);
  if (tableExists(db, "ajal_payments")) {
    total -= scalar(db, `
      SELECT COALESCE(SUM(ap.amount), 0) AS total
      FROM ajal_payments ap
      JOIN ajal_debts ad ON ad.id = ap.debt_id
      WHERE COALESCE(ad.party_type, 'customer') = 'customer'
        AND ad.customer_id = ?
        AND ad.status != 'voided'`, [id]);
  }
  if (tableExists(db, "customer_notes")) {
    total += scalar(db, `
      SELECT COALESCE(SUM(COALESCE(n.amount, 0)), 0) AS total
      FROM customer_notes n
      WHERE n.customer_id = ? AND n.type = 'adjustment'`, [id]);
  }
  return total;
}

module.exports = { partyTxnSum };
