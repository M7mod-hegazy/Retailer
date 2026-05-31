module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(purchase_returns)").all().map(c => c.name);
    if (cols.includes("settlement_type")) {
      db.exec(`
        UPDATE purchase_returns
        SET settlement_type = 'cash', refund_method = 'cash_back',
            cash_amount = total, credit_amount = 0
        WHERE supplier_id IS NULL AND settlement_type = 'account'
      `);
    }
  },
};
