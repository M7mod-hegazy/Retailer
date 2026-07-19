// Migration 220 — covers bulk settings changes.
//
// Before this, a user could change any setting via POST /bulk (tax rate,
// discount caps, Telegram config, feature flags, etc.) without producing
// a Telegram alert. Only Telegram disable was detected in the PUT / route.
//
// Adds per-recipient toggle (default ON) plus templates for:
//   • settings_changed (POST /bulk — all setting changes)
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  if (!cols.includes("notify_settings_changed")) {
    db.exec("ALTER TABLE telegram_recipients ADD COLUMN notify_settings_changed INTEGER NOT NULL DEFAULT 1");
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
    "telegram_settings_changed",
    "تغيير إعدادات النظام",
    [
      "⚙️ *تغيير إعدادات النظام*",
      "",
      "📝 عدد الإعدادات المُعدّلة: *{changes_count}*",
      "🔑 الإعدادات: {changes_summary}",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "⚙️ تحديث {changes_count} إعداد | {changes_summary} | {user_name}"
  );
}

module.exports = { up };
