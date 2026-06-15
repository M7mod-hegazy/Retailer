const { getDb } = require("../config/database");

/**
 * Generate a sequential document number in format PREFIX-YYYYMMDD-NNN(N).
 * Counter resets every calendar day.
 * @param {string} type - 'pos_sale' | 'purchase_receipt' | 'sales_return' | 'purchase_return'
 * @param {string} [overridePrefix] - optional prefix override
 * @returns {string} e.g. "INV-20260508-0001" or "PUR-20260508-001"
 */
function generateDocNumber(type, overridePrefix) {
  const db = getDb();

  // YYYYMMDD of today (local time)
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  // Prefix from settings_kv or fallback. POS sales are invoices — default to "INV"
  // (not the raw "POS_" that type.slice(0,4) would yield) so the saved number matches
  // the "INV-…" the cashier sees in the UI.
  let prefix = overridePrefix;
  if (!prefix) {
    const row = db.prepare("SELECT value FROM settings_kv WHERE key = ?").get(`doc_prefix_${type}`);
    prefix = row?.value || (type === "pos_sale" ? "INV" : type.toUpperCase().slice(0, 4));
  }

  // INV (pos_sale) uses 4 digits; all others use 3
  const digits = type === "pos_sale" ? 4 : 3;

  const existing = db.prepare(
    "SELECT day, last_seq FROM document_sequences WHERE type = ?"
  ).get(type);

  let nextSeq;
  if (!existing) {
    db.prepare(
      "INSERT INTO document_sequences (type, day, last_seq) VALUES (?, ?, 1)"
    ).run(type, day);
    nextSeq = 1;
  } else if (existing.day !== day) {
    // New day — reset counter
    db.prepare(
      "UPDATE document_sequences SET day = ?, last_seq = 1 WHERE type = ?"
    ).run(day, type);
    nextSeq = 1;
  } else {
    nextSeq = existing.last_seq + 1;
    db.prepare(
      "UPDATE document_sequences SET last_seq = ? WHERE type = ?"
    ).run(nextSeq, type);
  }

  return `${prefix}-${day}-${String(nextSeq).padStart(digits, "0")}`;
}

module.exports = { generateDocNumber };
