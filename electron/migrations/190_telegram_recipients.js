// Support multiple Telegram recipients per bot, each with its own event filters.
// The existing single-chat config is migrated into the first recipient row.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function asBool(v) {
  return v !== undefined && v !== null && v !== 0 && v !== false && v !== "0";
}

module.exports = {
  name: "190_telegram_recipients",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_recipients (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        name                      TEXT NOT NULL DEFAULT '',
        chat_id                   TEXT NOT NULL,
        enabled                   INTEGER NOT NULL DEFAULT 1,
        notify_new_invoice        INTEGER NOT NULL DEFAULT 1,
        notify_daily_close        INTEGER NOT NULL DEFAULT 1,
        notify_large_amounts      INTEGER NOT NULL DEFAULT 1,
        notify_returns_voids      INTEGER NOT NULL DEFAULT 1,
        notify_purchases_payments INTEGER NOT NULL DEFAULT 1,
        notify_low_stock          INTEGER NOT NULL DEFAULT 1,
        notify_system             INTEGER NOT NULL DEFAULT 1,
        notify_weekly             INTEGER NOT NULL DEFAULT 0,
        notify_monthly            INTEGER NOT NULL DEFAULT 0,
        notify_yearly             INTEGER NOT NULL DEFAULT 0,
        created_at                TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Migrate the legacy single chat_id into a recipient row if present.
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() || {};
    const existingRecipients = db.prepare("SELECT COUNT(*) AS n FROM telegram_recipients").get().n;

    if (existingRecipients === 0 && settings.telegram_chat_id) {
      const bundled = asBool(settings.telegram_notify_important_actions);
      db.prepare(`
        INSERT INTO telegram_recipients (
          name, chat_id, enabled,
          notify_new_invoice, notify_daily_close, notify_large_amounts,
          notify_returns_voids, notify_purchases_payments, notify_low_stock,
          notify_system, notify_weekly, notify_monthly, notify_yearly
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "المستلم الافتراضي",
        settings.telegram_chat_id,
        asBool(settings.telegram_enabled) ? 1 : 0,
        asBool(settings.telegram_notify_new_invoice, true) ? 1 : 0,
        asBool(settings.telegram_notify_daily_close, true) ? 1 : 0,
        asBool(settings.telegram_notify_large_amounts, bundled) ? 1 : 0,
        asBool(settings.telegram_notify_returns_voids, bundled) ? 1 : 0,
        asBool(settings.telegram_notify_purchases_payments, bundled) ? 1 : 0,
        asBool(settings.telegram_notify_low_stock, bundled) ? 1 : 0,
        asBool(settings.telegram_notify_system, bundled) ? 1 : 0,
        asBool(settings.telegram_notify_weekly, false) ? 1 : 0,
        asBool(settings.telegram_notify_monthly, false) ? 1 : 0,
        asBool(settings.telegram_notify_yearly, false) ? 1 : 0
      );
    }

    // The retry queue now needs to know which recipient a message belongs to.
    addColumnIfMissing(db, "pending_notifications", "chat_id", "TEXT");

    // The settings columns remain for the bot-level config (token, api_base, enabled).
    // We keep telegram_chat_id for backward compatibility but the app now prefers recipients.
    addColumnIfMissing(db, "settings", "telegram_recipients_migrated", "INTEGER NOT NULL DEFAULT 1");
  },
};
