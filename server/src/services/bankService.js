// Centralised bank-money movement. Every change to a bank balance must go through
// recordBankMovement so that the `bank_transactions` table is the single source of
// truth and `banks.balance` is always exactly the running sum of its transactions.
// No code outside this module should run `UPDATE banks SET balance = ...` directly.

function ensureBankTxColumns(db) {
  const cols = db.prepare("PRAGMA table_info(bank_transactions)").all().map((c) => c.name);
  const add = (name, def) => {
    if (!cols.includes(name)) db.prepare(`ALTER TABLE bank_transactions ADD COLUMN ${name} ${def}`).run();
  };
  // source: where the movement came from — 'manual' | 'opening' | 'transfer' | 'pos_sale' | 'ajal' | 'purchase'
  add("source", "TEXT");
  // ref_type / ref_id: link back to the originating document (e.g. 'invoice', invoiceId)
  add("ref_type", "TEXT");
  add("ref_id", "INTEGER");
}

// Apply a signed movement to a bank and write its audit row. Returns the new
// transaction id, or null when the inputs are a no-op (no bank / non-positive amount).
function recordBankMovement(
  db,
  { bankId, type, amount, reference = null, notes = null, userId = 1, source = "manual", refType = null, refId = null },
) {
  const amt = Number(amount || 0);
  if (!bankId || amt <= 0) return null;
  if (type !== "deposit" && type !== "withdrawal") {
    throw new Error(`invalid bank movement type: ${type}`);
  }
  ensureBankTxColumns(db);
  const sign = type === "deposit" ? 1 : -1;
  db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(sign * amt, bankId);
  const info = db
    .prepare(
      `INSERT INTO bank_transactions (bank_id, type, amount, reference, notes, created_by, source, ref_type, ref_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(bankId, type, amt, reference, notes, userId || 1, source, refType, refId);
  return info.lastInsertRowid;
}

// Recompute and persist a bank's balance from its transaction history (repair/verify).
// Returns the recomputed net balance.
function recomputeBankBalance(db, bankId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) AS net
       FROM bank_transactions WHERE bank_id = ?`,
    )
    .get(bankId);
  const net = Number(row?.net || 0);
  db.prepare("UPDATE banks SET balance = ? WHERE id = ?").run(net, bankId);
  return net;
}

module.exports = { recordBankMovement, recomputeBankBalance, ensureBankTxColumns };
