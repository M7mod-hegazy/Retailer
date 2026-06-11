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
      SELECT COALESCE(SUM(ad.original_amount), 0) AS total
      FROM ajal_debts ad
      WHERE ad.party_type = 'supplier' AND ad.supplier_id = ?
        AND ad.source_type = 'purchase' AND ad.status != 'voided'`, [id]);
    total -= scalar(db, `
      SELECT COALESCE(SUM(COALESCE(pr.credit_amount, 0)), 0) AS total
      FROM purchase_returns pr
      WHERE pr.supplier_id = ? AND pr.status = 'active'`, [id]);
    total -= scalar(db, `
      SELECT COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      WHERE p.party_type = 'supplier' AND p.party_id = ?`, [id]);
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
    SELECT COALESCE(SUM(ad.original_amount), 0) AS total
    FROM ajal_debts ad
    WHERE ad.party_type = 'customer' AND ad.customer_id = ?
      AND ad.source_type = 'invoice' AND ad.status != 'voided'`, [id]);
  total -= scalar(db, `
    SELECT COALESCE(SUM(COALESCE(sr.credit_amount, 0)), 0) AS total
    FROM sales_returns sr
    WHERE sr.customer_id = ? AND sr.status = 'active'`, [id]);
  total -= scalar(db, `
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ?`, [id]);
  if (tableExists(db, "customer_notes")) {
    total += scalar(db, `
      SELECT COALESCE(SUM(COALESCE(n.amount, 0)), 0) AS total
      FROM customer_notes n
      WHERE n.customer_id = ? AND n.type = 'adjustment'`, [id]);
  }
  return total;
}

module.exports = { partyTxnSum };
