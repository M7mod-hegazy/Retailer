// Migration 216 — closes the "money moves without an invoice" blind spots.
//
// Before this, an employee could adjust the treasury balance by hand, create a
// payment method that never reaches the drawer, stand up a permanent discount,
// restore an old backup over today's records, wipe data, or simply switch the
// owner's Telegram alerts off — and none of it produced a single alert.
//
// Adds per-recipient toggles (default ON) plus templates for:
//   • treasury create/edit/delete (manual balance edits called out)
//   • payment-method create/edit/delete (excludes_from_treasury called out)
//   • promotion create/edit/delete/toggle
//   • backup restored / data wiped / notifications disabled  (ride notify_system)
//   • user account created (own toggle, shared with user deleted)
//
// Bank / cheque / loyalty events are deliberately NOT included — those pages
// were removed from the product.
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  const addCol = (name) => {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE telegram_recipients ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 1`);
    }
  };
  addCol("notify_treasury_changed");
  addCol("notify_payment_method_changed");
  addCol("notify_promotion_changed");
  addCol("notify_user_account");

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
    "telegram_user_created",
    "إنشاء مستخدم",
    [
      "🆕 *إنشاء حساب مستخدم*",
      "",
      "👤 الاسم: *{user_name}*",
      "🔑 اسم الدخول: *{login_name}*",
      "🏷️ الدور: *{role}*",
      "👨‍💼 أنشأه: *{created_by}*",
      "⏰ {time}",
      "",
      "🛡️ *الصلاحيات الممنوحة:*{permissions_summary}",
    ].join("\n"),
    "🆕 مستخدم جديد | {user_name} ({role}) | بواسطة {created_by}"
  );

  seed(
    "telegram_treasury_changed",
    "تغيير خزينة",
    [
      "🏦 *{action_label}*",
      "",
      "💼 الخزينة: *{treasury_name}*",
      "💰 الرصيد قبل: {old_balance}",
      "💰 الرصيد بعد: *{new_balance}*",
      "📝 التفاصيل: {details}",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "🏦 {action_label} | {treasury_name} | {old_balance} ← {new_balance} | {user_name}"
  );

  seed(
    "telegram_payment_method_changed",
    "تغيير وسيلة دفع",
    [
      "💳 *{action_label}*",
      "",
      "🏷️ الوسيلة: *{method_name}*",
      "📝 التفاصيل: {details}",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "💳 {action_label} | {method_name} | {details} | {user_name}"
  );

  seed(
    "telegram_promotion_changed",
    "تغيير عرض",
    [
      "🎯 *{action_label}*",
      "",
      "🏷️ العرض: *{promotion_name}*",
      "📝 التفاصيل: {details}",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
    ].join("\n"),
    "🎯 {action_label} | {promotion_name} | {details} | {user_name}"
  );

  seed(
    "telegram_backup_restored",
    "استعادة نسخة احتياطية",
    [
      "🚨 *استعادة نسخة احتياطية*",
      "",
      "📦 المصدر: *{source}*",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
      "",
      "⚠️ الاستعادة تستبدل البيانات الحالية — راجع العمليات بعد هذا الوقت.",
    ].join("\n"),
    "🚨 استعادة نسخة احتياطية | {source} | بواسطة {user_name}"
  );

  seed(
    "telegram_data_wiped",
    "تفريغ بيانات",
    [
      "🚨 *تفريغ بيانات من النظام*",
      "",
      "🗂️ النطاق: *{scope}*",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
      "",
      "⚠️ هذه العملية تحذف سجلات نهائياً.",
    ].join("\n"),
    "🚨 تفريغ بيانات | {scope} | بواسطة {user_name}"
  );

  seed(
    "telegram_notifications_disabled",
    "إيقاف الإشعارات",
    [
      "🚨 *تنبيه أمني — إيقاف الإشعارات*",
      "",
      "🔕 التغيير: *{change_label}*",
      "👨‍💼 بواسطة: *{user_name}*",
      "⏰ {time}",
      "",
      "⚠️ لو مش إنت اللي عملت ده، راجع صلاحيات المستخدمين فوراً.",
    ].join("\n"),
    "🚨 {change_label} | بواسطة {user_name} | {time}"
  );
}

module.exports = { up, name: "216_telegram_security_coverage" };
