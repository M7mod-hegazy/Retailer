// Migration 218 — covers employee edit and legacy adjustment creation.
//
// Before this, an employee's salary, role, or phone could be silently changed,
// and legacy incentive/penalty adjustments could be created — none producing
// a Telegram alert. Both are security-sensitive because they affect payroll.
//
// Adds per-recipient toggles (default ON) plus templates for:
//   • employee_edited (PUT /:id — salary, role, phone, etc.)
//   • adjustment_created (POST /:id/adjustments — legacy incentive/penalty)
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  const addCol = (name) => {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE telegram_recipients ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 1`);
    }
  };
  addCol("notify_employee_edited");
  addCol("notify_adjustment_created");

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
    "telegram_employee_edited",
    "تعديل موظف",
    [
      "✏️ *تعديل بيانات موظف*",
      "",
      "👤 الموظف: *{employee_name}*",
      "💰 الراتب قبل: {old_salary}",
      "💰 الراتب بعد: *{new_salary}*",
      "🏷️ المنصب قبل: {old_job_title}",
      "🏷️ المنصب بعد: *{new_job_title}*",
      "📞 الهاتف: {phone}",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "✏️ تعديل موظف | {employee_name} | {old_salary} ← {new_salary} | {user_name}"
  );

  seed(
    "telegram_adjustment_created",
    "تسجيل حافز/خصم",
    [
      "📋 *تسجيل {type_label} للموظف*",
      "",
      "👤 الموظف: *{employee_name}*",
      "🏷️ النوع: *{type_label}*",
      "💰 المبلغ: *{amount}*",
      "📝 السبب: {reason}",
      "👨‍ بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "📋 {type_label} | {employee_name} | {amount} | {user_name}"
  );
}

module.exports = { up };
