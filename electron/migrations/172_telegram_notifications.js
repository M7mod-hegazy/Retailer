// Telegram owner notifications: settings columns + local retry queue.
// - settings: bot token, chat_id, toggles for each event type.
// - pending_notifications: stores failed messages with retry metadata.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "172_telegram_notifications",
  up(db) {
    // Owner notification credentials and master switch.
    addColumnIfMissing(db, "settings", "telegram_enabled", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing(db, "settings", "telegram_bot_token", "TEXT");
    addColumnIfMissing(db, "settings", "telegram_chat_id", "TEXT");
    addColumnIfMissing(db, "settings", "telegram_api_base", "TEXT DEFAULT 'https://api.telegram.org'");

    // Event-type toggles (stored as 0/1 integers).
    addColumnIfMissing(db, "settings", "telegram_notify_new_invoice", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_daily_close", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_important_actions", "INTEGER NOT NULL DEFAULT 1");

    // Local retry queue for failed Telegram messages.
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_notifications (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type    TEXT NOT NULL,
        text          TEXT NOT NULL,
        payload_json  TEXT DEFAULT '{}',
        status        TEXT NOT NULL DEFAULT 'pending',
        retry_count   INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT,
        next_retry_at TEXT,
        sent_at       TEXT,
        error         TEXT
      )
    `);
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pending_notifications_retry ON pending_notifications(status, next_retry_at)").run();
  },
};
