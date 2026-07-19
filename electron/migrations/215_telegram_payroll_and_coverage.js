// Migration 215 — payroll partial-payout event + risky-action coverage.
//
// 1. Adds telegram_recipients.notify_salary_partial_paid (default ON) for the
//    new "صرف جزئي للراتب" event (fired when a salary is settled with paid <
//    due, and when a carried remainder is paid off later).
// 2. Enriches telegram_expense_created to the same detail level as revenue /
//    withdrawal (doc no, method, user, description) — previously the three
//    "money out/in" messages were near-identical and undertold.
// 3. Seeds templates for previously-silent risky actions: salary settlement
//    deletion, advance repayment / deletion, deduction & bonus cancellation,
//    and user account deletion. These ride their "created" counterpart's
//    recipient toggle, so no further schema is needed.
function up(db) {
  const cols = db.prepare("PRAGMA table_info(telegram_recipients)").all().map((c) => c.name);
  if (!cols.includes("notify_salary_partial_paid")) {
    db.exec("ALTER TABLE telegram_recipients ADD COLUMN notify_salary_partial_paid INTEGER NOT NULL DEFAULT 1");
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

  // ── telegram_expense_created (enriched) ────────────────────────────
  seed(
    "telegram_expense_created",
    "مصروف جديد",
    [
      "💸 *مصروف جديد*",
      "",
      "🔖 المستند: *{doc_no}*",
      "📂 الفئة: {category}",
      "💰 المبلغ: *{amount}*",
      "💳 الطريقة: {method}",
      "📝 الوصف: {description}",
      "👤 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "💸 مصروف جديد | {doc_no} | {amount} | {category} | {method}"
  );

  // ── telegram_salary_partial_paid ───────────────────────────────────
  seed(
    "telegram_salary_partial_paid",
    "صرف جزئي للراتب",
    [
      "💰 *{kind_label}*",
      "",
      "👤 الموظف: *{employee_name}*",
      "📅 الفترة: {period}",
      "🧮 المستحق: *{net_salary}*",
      "✅ المدفوع الآن: *{paid_amount}*",
      "⏳ المتبقي: *{remaining}*",
      "📌 المتبقي: {remainder_plan}",
      "💳 الطريقة: {method}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "💰 {kind_label} | {employee_name} | دفع {paid_amount} / متبقي {remaining}"
  );

  // ── telegram_salary_settlement_deleted ─────────────────────────────
  seed(
    "telegram_salary_settlement_deleted",
    "إلغاء صرف راتب",
    [
      "🗑️ *إلغاء صرف راتب*",
      "",
      "👤 الموظف: *{employee_name}*",
      "📅 الفترة: {period}",
      "💰 كان مدفوعاً: *{paid_amount}*",
      "🧮 الصافي: {net_salary}",
      "🧾 حذف المصروف المرتبط: {expense_deleted}",
      "↩️ أقساط سلف أُعيدت: {reversed_advances}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "🗑️ إلغاء صرف راتب | {employee_name} | {paid_amount} | بواسطة {user_name}"
  );

  // ── telegram_advance_payment ───────────────────────────────────────
  seed(
    "telegram_advance_payment",
    "تسديد قسط سلفة",
    [
      "💵 *تسديد قسط سلفة*",
      "",
      "👤 الموظف: *{employee_name}*",
      "💰 المبلغ المسدد: *{amount}*",
      "⏳ المتبقي من السلفة: *{remaining}*",
      "📝 ملاحظات: {notes}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "💵 تسديد قسط سلفة | {employee_name} | {amount} | متبقي {remaining}"
  );

  // ── telegram_advance_deleted ───────────────────────────────────────
  seed(
    "telegram_advance_deleted",
    "حذف سلفة",
    [
      "🗑️ *حذف/إلغاء سلفة*",
      "",
      "👤 الموظف: *{employee_name}*",
      "💰 قيمة السلفة: *{amount}*",
      "⏳ كان متبقياً: *{remaining}*",
      "📌 النوع: {delete_kind}",
      "🧾 حذف المصروف المرتبط: {expense_deleted}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "🗑️ حذف سلفة | {employee_name} | {amount} | بواسطة {user_name}"
  );

  // ── telegram_deduction_deleted ─────────────────────────────────────
  seed(
    "telegram_deduction_deleted",
    "إلغاء خصم موظف",
    [
      "🗑️ *إلغاء خصم موظف*",
      "",
      "👤 الموظف: *{employee_name}*",
      "💰 قيمة الخصم الملغي: *{amount}*",
      "📂 النوع: {deduction_type}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "🗑️ إلغاء خصم | {employee_name} | {amount} | بواسطة {user_name}"
  );

  // ── telegram_bonus_deleted ─────────────────────────────────────────
  seed(
    "telegram_bonus_deleted",
    "إلغاء مكافأة موظف",
    [
      "🗑️ *إلغاء مكافأة موظف*",
      "",
      "👤 الموظف: *{employee_name}*",
      "💰 قيمة المكافأة الملغاة: *{amount}*",
      "📂 النوع: {bonus_type}",
      "👨‍💼 بواسطة: {user_name}",
      "⏰ {time}",
    ].join("\n"),
    "🗑️ إلغاء مكافأة | {employee_name} | {amount} | بواسطة {user_name}"
  );

  // ── telegram_user_deleted ──────────────────────────────────────────
  seed(
    "telegram_user_deleted",
    "حذف مستخدم",
    [
      "🚨 *حذف حساب مستخدم*",
      "",
      "👤 المستخدم المحذوف: *{user_name}*",
      "🏷️ الدور: {role}",
      "👨‍💼 حذفه: *{deleted_by}*",
      "⏰ {time}",
    ].join("\n"),
    "🚨 حذف مستخدم | {user_name} ({role}) | بواسطة {deleted_by}"
  );
}

module.exports = { up, name: "215_telegram_payroll_and_coverage" };
