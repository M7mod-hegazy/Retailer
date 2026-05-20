function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = {
  up(db) {
    // sales_returns: add cash_amount and credit_amount
    addColumnIfMissing(db, "sales_returns", "cash_amount", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "sales_returns", "credit_amount", "REAL NOT NULL DEFAULT 0");

    // Backfill existing sales_returns
    db.exec(`
      UPDATE sales_returns
      SET cash_amount = total, credit_amount = 0
      WHERE COALESCE(refund_method, 'cash_back') = 'cash_back' AND cash_amount = 0 AND credit_amount = 0;
    `);
    db.exec(`
      UPDATE sales_returns
      SET cash_amount = 0, credit_amount = total
      WHERE refund_method IN ('credit_note', 'store_credit') AND cash_amount = 0 AND credit_amount = 0;
    `);

    // purchase_returns: add cash_amount and credit_amount
    addColumnIfMissing(db, "purchase_returns", "cash_amount", "REAL NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "purchase_returns", "credit_amount", "REAL NOT NULL DEFAULT 0");

    // Backfill existing purchase_returns
    db.exec(`
      UPDATE purchase_returns
      SET cash_amount = total, credit_amount = 0
      WHERE COALESCE(settlement_type, 'account') = 'cash' AND cash_amount = 0 AND credit_amount = 0;
    `);
    db.exec(`
      UPDATE purchase_returns
      SET cash_amount = 0, credit_amount = total
      WHERE COALESCE(settlement_type, 'account') = 'account' AND cash_amount = 0 AND credit_amount = 0;
    `);
  },
};
