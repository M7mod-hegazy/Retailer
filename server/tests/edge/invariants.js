// Universal laws checked against the real DB after a sequence runs.

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

// The app keeps a customer's running balance directly in customers.opening_balance:
// credit sales do `opening_balance += total` (invoiceService) and payments do
// `opening_balance -= amount` (payments route). So the real balance IS that column.
function realCustomerBalance(db, customerId) {
  const v = db.prepare("SELECT opening_balance AS v FROM customers WHERE id = ?").get(customerId)?.v;
  return round2(Number(v || 0));
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
