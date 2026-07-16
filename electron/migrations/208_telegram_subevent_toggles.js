// Migration 208: Give the edit/cancel sub-events (migration 202) their own
// per-recipient notify columns. Until now the UI showed independent toggles
// for them but the server piggybacked on parent toggles (returns_voids,
// purchases_payments…), so the switches silently did nothing — and flipping
// one in the UI also flipped its parent. Default 1 matches the previous
// effective behavior (parents default to 1).

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "208_telegram_subevent_toggles",
  up(db) {
    const cols = [
      "notify_invoice_edited",
      "notify_invoice_amended",
      "notify_purchase_edited",
      "notify_purchase_return_cancelled",
      "notify_branch_transfer_edited",
      "notify_branch_transfer_cancelled",
      "notify_withdrawal_edited",
      "notify_withdrawal_deleted",
    ];
    for (const col of cols) {
      addColumnIfMissing(db, "telegram_recipients", col, "INTEGER NOT NULL DEFAULT 1");
    }
  },
};
