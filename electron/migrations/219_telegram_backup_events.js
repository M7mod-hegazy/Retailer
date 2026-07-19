// Migration 219 — covers backup export, settings change, and manual trigger.
//
// Before this, a user could export the DB (data exfiltration vector),
// disable auto-backup (prevents recovery), or trigger a manual backup — none
// producing a Telegram alert. Automated backups already fire BACKUP_RESULT,
// but manual ones did not.
//
// Adds per-recipient toggles (default ON) plus templates for:
//   • backup_exported (POST /export)
//   • backup_settings_changed (PUT /settings — disabling auto-backup, etc.)
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  const addCol = (name) => {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE telegram_recipients ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 1`);
    }
  };
  addCol("notify_backup_exported");
  addCol("notify_backup_settings_changed");

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
    "telegram_backup_exported",
    "تصدير نسخة احتياطية",
    [
      "📦 *تصدير نسخة احتياطية*",
      "",
      "📂 المسار: *{file_path}*",
      "📦 الحجم: {file_size}",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "📦 تصدير نسخة | {file_path} | {user_name}"
  );

  seed(
    "telegram_backup_settings_changed",
    "تغيير إعدادات النسخ الاحتياطي",
    [
      "⚙️ *تغيير إعدادات النسخ الاحتياطي*",
      "",
      "📝 الإعداد: *{setting_name}*",
      "🔄 القيمة قبل: {old_value}",
      "🔄 القيمة بعد: *{new_value}*",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "⚙️ تغيير إعداد النسخ | {setting_name} | {old_value} ← {new_value} | {user_name}"
  );
}

module.exports = { up };
