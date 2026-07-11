// "Important actions" bundled 8 different event types (large invoice/discount,
// returns/voids, purchases/payments, low stock, backup, failed login) behind a
// single checkbox. Splits it into a few meaningful groups so owners can pick
// what they actually want alerts for. New columns copy the old bundled
// preference so existing behavior is preserved until the owner adjusts them.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    return true;
  }
  return false;
}

module.exports = {
  name: "176_telegram_granular_toggles",
  up(db) {
    const newCols = [
      "telegram_notify_large_amounts",
      "telegram_notify_returns_voids",
      "telegram_notify_purchases_payments",
      "telegram_notify_low_stock",
      "telegram_notify_system",
    ];
    const added = newCols.map((col) => addColumnIfMissing(db, "settings", col, "INTEGER NOT NULL DEFAULT 1"));

    // Carry forward the old bundled preference so nobody's notifications
    // suddenly change on upgrade — only applied to rows just added.
    if (added.some(Boolean)) {
      const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
      if (cols.includes("telegram_notify_important_actions")) {
        db.prepare(`
          UPDATE settings SET
            telegram_notify_large_amounts = telegram_notify_important_actions,
            telegram_notify_returns_voids = telegram_notify_important_actions,
            telegram_notify_purchases_payments = telegram_notify_important_actions,
            telegram_notify_low_stock = telegram_notify_important_actions,
            telegram_notify_system = telegram_notify_important_actions
        `).run();
      }
    }
  },
};
