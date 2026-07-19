// Migration 221 — Enrich SETTINGS_CHANGED template with per-setting old→new diff.
//
// Before this, the template only showed count + key names (e.g. "3 إعدادات:
// company_name, tax_rate, ..."). The owner could not tell what actually changed
// — was the tax rate increased or decreased? Was the company name corrected?
//
// Adds {changes_detail} variable that renders each setting as:
//   • اسم الشركة: "القديم" ← "الجديد"
function up(db) {
  const upd = db.prepare("UPDATE message_templates SET body = ?, updated_at = datetime('now') WHERE kind = ?");
  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
  );
  const delVariants = db.prepare("DELETE FROM message_template_variants WHERE category = ?");
  const insertVariant = db.prepare(
    "INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?, ?, ?, 'telegram', ?, datetime('now'))"
  );

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
      "",
      "{changes_detail}",
      "",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "⚙️ تحديث {changes_count} إعداد | {changes_summary} | {user_name}"
  );
}

module.exports = { up };
