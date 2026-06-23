function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "145_bank_tx_source",
  up(db) {
    // Bank balances become fully transaction-backed: every movement (POS card sales,
    // ajal settlements, purchase payments, manual deposits/withdrawals, transfers) is
    // recorded in bank_transactions via services/bankService.recordBankMovement, and
    // banks.balance is always the running sum of those rows.

    // 1. Provenance columns so auto movements are distinguishable from manual ones.
    addColumnIfMissing(db, "bank_transactions", "source", "TEXT");
    addColumnIfMissing(db, "bank_transactions", "ref_type", "TEXT");
    addColumnIfMissing(db, "bank_transactions", "ref_id", "INTEGER");

    // 2. Backfill: reconcile every existing bank so its current balance is explained
    //    by its transactions. Any gap between the stored balance and the sum of its
    //    transactions is recorded as an opening-balance adjustment, so a later
    //    recompute never destroys a legitimate opening balance.
    const banks = db.prepare("SELECT id, balance FROM banks").all();
    const sumStmt = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) AS net
       FROM bank_transactions WHERE bank_id = ?`,
    );
    const insertTx = db.prepare(
      `INSERT INTO bank_transactions (bank_id, type, amount, reference, notes, source)
       VALUES (?, ?, ?, ?, ?, 'opening')`,
    );
    for (const bank of banks) {
      const net = Number(sumStmt.get(bank.id)?.net || 0);
      const diff = Number(bank.balance || 0) - net;
      if (Math.abs(diff) > 0.0001) {
        insertTx.run(
          bank.id,
          diff > 0 ? "deposit" : "withdrawal",
          Math.abs(diff),
          "OPENING",
          "رصيد افتتاحي",
        );
      }
    }
  },
};
