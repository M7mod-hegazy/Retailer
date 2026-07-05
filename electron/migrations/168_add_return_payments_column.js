function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = {
  up(db) {
    addColumnIfMissing(db, "sales_returns", "payments", "TEXT");

    // Backfill: convert existing cash_amount/credit_amount to JSON array
    const salesReturns = db.prepare(
      "SELECT id, refund_method, cash_amount, credit_amount, total FROM sales_returns WHERE payments IS NULL"
    ).all();

    for (const sr of salesReturns) {
      const method = (sr.refund_method || 'cash_back');
      let payments = [];
      if (method === 'cash_back') {
        payments = [{ method: 'cash', amount: sr.total, method_type: 'cash' }];
      } else if (method === 'store_credit' || method === 'credit_note') {
        payments = [{ method: 'credit', amount: sr.total, method_type: 'credit' }];
      } else if (method === 'split') {
        const cashAmt = Number(sr.cash_amount || 0);
        const creditAmt = Number(sr.credit_amount || 0);
        if (cashAmt > 0) payments.push({ method: 'cash', amount: cashAmt, method_type: 'cash' });
        if (creditAmt > 0) payments.push({ method: 'credit', amount: creditAmt, method_type: 'credit' });
        if (payments.length === 0) payments = [{ method: 'cash', amount: sr.total, method_type: 'cash' }];
      } else {
        payments = [{ method: 'cash', amount: sr.total, method_type: 'cash' }];
      }
      db.prepare("UPDATE sales_returns SET payments = ? WHERE id = ?").run(JSON.stringify(payments), sr.id);
    }

    addColumnIfMissing(db, "purchase_returns", "payments", "TEXT");

    const purchaseReturns = db.prepare(
      "SELECT id, settlement_type, cash_amount, credit_amount, total FROM purchase_returns WHERE payments IS NULL"
    ).all();

    for (const pr of purchaseReturns) {
      const method = (pr.settlement_type || 'account');
      let payments = [];
      if (method === 'cash') {
        payments = [{ method: 'cash', amount: pr.total, method_type: 'cash' }];
      } else if (method === 'account') {
        payments = [{ method: 'credit', amount: pr.total, method_type: 'credit' }];
      } else if (method === 'split') {
        const cashAmt = Number(pr.cash_amount || 0);
        const creditAmt = Number(pr.credit_amount || 0);
        if (cashAmt > 0) payments.push({ method: 'cash', amount: cashAmt, method_type: 'cash' });
        if (creditAmt > 0) payments.push({ method: 'credit', amount: creditAmt, method_type: 'credit' });
        if (payments.length === 0) payments = [{ method: 'cash', amount: pr.total, method_type: 'cash' }];
      } else {
        payments = [{ method: 'cash', amount: pr.total, method_type: 'cash' }];
      }
      db.prepare("UPDATE purchase_returns SET payments = ? WHERE id = ?").run(JSON.stringify(payments), pr.id);
    }
  },
};
