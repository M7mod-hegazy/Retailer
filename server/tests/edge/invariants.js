// Universal laws checked against the real DB after a sequence runs.

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// Real balance = opening + unpaid credit (sum of credit invoice totals) - payments received.
function realCustomerBalance(db, customerId) {
  const opening = Number(
    db.prepare("SELECT opening_balance AS v FROM customers WHERE id = ?").get(customerId)?.v || 0,
  );
  const creditTotal = Number(
    db
      .prepare(
        "SELECT COALESCE(SUM(total), 0) AS v FROM invoices WHERE customer_id = ? AND payment_type = 'credit'",
      )
      .get(customerId)?.v || 0,
  );
  const paid = Number(
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE party_type = 'customer' AND party_id = ?",
      )
      .get(customerId)?.v || 0,
  );
  return round2(opening + creditTotal - paid);
}

// Compare every modelled customer against the real DB.
function checkInvariants(db, model) {
  for (const id of Object.keys(model.customers)) {
    const expected = round2(model.customers[id].balance);
    const actual = realCustomerBalance(db, Number(id));
    if (expected !== actual) {
      throw new Error(
        `INVARIANT: customer ${id} balance mismatch — model=${expected} db=${actual}`,
      );
    }
  }
}

module.exports = { checkInvariants, realCustomerBalance, round2 };
