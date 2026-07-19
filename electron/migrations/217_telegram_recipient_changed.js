// Migration 217 — wires the self-watching alert channel.
//
// The TELEGRAM_RECIPIENT_CHANGED event type was defined in telegramService.js
// (migration 217 comment) but never actually implemented: no column, no
// template, no sample data. This closes that gap so the owner gets notified
// when someone adds/removes a Telegram recipient or toggles individual events
// off — all ways to go dark without touching the DB directly.
//
// Adds:
//   • notify_telegram_recipient_changed column (default ON)
//   • message_templates + variants for telegram_recipient_changed
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  if (!cols.includes("notify_telegram_recipient_changed")) {
    db.exec("ALTER TABLE telegram_recipients ADD COLUMN notify_telegram_recipient_changed INTEGER NOT NULL DEFAULT 1");
  }

  const upd = db.prepare("UPDATE message_templates SET body = ?, updated_at = datetime('now') WHERE kind = ?");
  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
  );
  const insertVariant = db.prepare(
    "INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?, ?, ?, 'telegram', ?, datetime('now'))"
  );
  const delVariants = db.prepare("DELETE FROM message_template_variants WHERE category = ?");

  const seed = (kind, label, detailed, short) => {
    const exists = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get(kind);
    if (exists) upd.run(detailed, kind);
    else insertTemplate.run(kind, label, detailed);
    delVariants.run(kind);
    insertVariant.run(kind, "قياسي — مفصل", detailed, 1);
    insertVariant.run(kind, "مختصر — سريع", short, 0);
  };

  seed(
    "telegram_recipient_changed",
    "تغيير مستلم Telegram",
    [
      "🔔 *تغيير في مستلمي إشعارات Telegram*",
      "",
      "📝 الحدث: *{action_label}*",
      "👤 المستلم: *{recipient_name}*",
      "💬 Chat ID: `{chat_id}`",
      "📋 التغييرات: {changes_summary}",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "🔔 {action_label} | {recipient_name} | {chat_id} | {user_name}"
  );
}

module.exports = { up };
