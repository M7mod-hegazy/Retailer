// Migration 207: richer Telegram templates for edit / void / cancel actions.
//  • Edit events now show a BEFORE section and an AFTER section, each with its
//    own line-item table (old vs new), so the reader sees exactly what changed.
//  • Void / delete / cancel events for line-item documents now list the full
//    product table of the affected document ("detailed product list").
//  • Wording clarified with explicit section dividers.
//
// Updates the canonical message_templates row AND the active "detailed" variant
// (label "قياسي — مفصل") so buildMessage picks the new body up. The short
// variant is left untouched (it is intentionally a one-line summary).
//
// All template variables used below are already produced by buildTemplateVars
// in telegramService.js (old_items_table / new_items_table / items_table / …).

const DIVIDER = "━━━━━━━━━━━━━━";

const BODIES = {
  // ── Sales invoice edit ────────────────────────────────────────────────────
  telegram_invoice_edited: [
    "✏️ *تعديل فاتورة مبيعات*",
    "🔖 رقم الفاتورة: *#{invoice_no}*",
    "",
    "◀️ *قبل التعديل*",
    "👤 العميل: {old_customer_name}",
    "💰 الإجمالي: {old_total}",
    "📦 الأصناف:",
    "{old_items_table}",
    "",
    "▶️ *بعد التعديل*",
    "👤 العميل: *{new_customer_name}*",
    "💰 الإجمالي: *{new_total}*",
    "📦 الأصناف:",
    "{new_items_table}",
    DIVIDER,
    "💳 طريقة الدفع: {old_payment_type} ← {new_payment_type}",
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Sales invoice amendment (void old + issue new) ────────────────────────
  telegram_invoice_amended: [
    "🔄 *تعديل (أمندمنت) فاتورة مبيعات*",
    "📄 القديمة: #{old_invoice_no} (ملغاة) ← الجديدة: *#{new_invoice_no}*",
    "",
    "◀️ *قبل*",
    "👤 العميل: {old_customer_name}",
    "💰 الإجمالي: {old_total}",
    "📦 الأصناف:",
    "{old_items_table}",
    "",
    "▶️ *بعد*",
    "👤 العميل: *{new_customer_name}*",
    "💰 الإجمالي: *{new_total}*",
    "📦 الأصناف:",
    "{new_items_table}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Purchase invoice edit ─────────────────────────────────────────────────
  telegram_purchase_edited: [
    "✏️ *تعديل فاتورة مشتريات*",
    "🔖 المرجع: *{reference_no}*",
    "",
    "◀️ *قبل التعديل*",
    "🏢 المورد: {old_supplier_name}",
    "💰 الإجمالي: {old_total}",
    "📦 الأصناف:",
    "{old_items_table}",
    "",
    "▶️ *بعد التعديل*",
    "🏢 المورد: *{new_supplier_name}*",
    "💰 الإجمالي: *{new_total}*",
    "📦 الأصناف:",
    "{new_items_table}",
    DIVIDER,
    "💳 طريقة الدفع: {old_payment_method} ← {new_payment_method}",
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Branch transfer edit ──────────────────────────────────────────────────
  telegram_branch_transfer_edited: [
    "✏️ *تعديل حركة فرع*",
    "🔖 المرجع: *{reference_no}*",
    "🔀 النوع: {transfer_type}",
    "",
    "◀️ *قبل التعديل*",
    "🏢 الفرع: {old_partner_branch}",
    "📦 الأصناف:",
    "{old_items_table}",
    "",
    "▶️ *بعد التعديل*",
    "🏢 الفرع: *{new_partner_branch}*",
    "📦 الأصناف:",
    "{new_items_table}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Sales invoice void (with full product list) ───────────────────────────
  telegram_invoice_voided: [
    "⛔ *إلغاء فاتورة مبيعات* #{invoice_no}",
    DIVIDER,
    "👤 العميل: {customer_name}",
    "💰 الإجمالي: *{total}*",
    "📝 السبب: {reason}",
    "",
    "📦 *أصناف الفاتورة الملغاة:*",
    "{items_table}",
    "📊 عدد الأصناف: {items_count}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Purchase invoice void (with full product list) ────────────────────────
  telegram_purchase_voided: [
    "🚫 *إلغاء فاتورة شراء*",
    "🔖 المرجع: {reference_no}",
    DIVIDER,
    "🏢 المورد: *{supplier_name}*",
    "💰 الإجمالي: *{total}*",
    "📝 السبب: {reason}",
    "",
    "📦 *أصناف الفاتورة الملغاة:*",
    "{items_table}",
    "📊 عدد الأصناف: {items_count}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Purchase return cancel (with product list) ────────────────────────────
  telegram_purchase_return_cancelled: [
    "❌ *إلغاء مرتجع مشتريات*",
    "🔖 المرجع: *{reference_no}*",
    DIVIDER,
    "🏢 المورد: *{supplier_name}*",
    "💰 المبلغ: *{total}*",
    "📝 السبب: {reason}",
    "",
    "📦 *أصناف المرتجع الملغى:*",
    "{items_table}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),

  // ── Branch transfer cancel (with product list) ────────────────────────────
  telegram_branch_transfer_cancelled: [
    "❌ *إلغاء حركة فرع*",
    "🔖 المرجع: *{reference_no}*",
    "🔀 النوع: {transfer_type}",
    DIVIDER,
    "🏢 الفرع: *{partner_branch}*",
    "📝 السبب: {reason}",
    "",
    "📦 *أصناف الحركة الملغاة:*",
    "{items_table}",
    DIVIDER,
    "👨‍💼 بواسطة: {user_name}",
    "⏰ {time}",
  ].join("\n"),
};

module.exports = {
  name: "207_telegram_richer_edit_void_templates",
  up(db) {
    const updTemplate = db.prepare(
      "UPDATE message_templates SET body = ?, updated_at = datetime('now') WHERE kind = ?"
    );
    const updVariant = db.prepare(
      "UPDATE message_template_variants SET body = ?, updated_at = datetime('now') WHERE category = ? AND label = 'قياسي — مفصل'"
    );
    for (const [category, body] of Object.entries(BODIES)) {
      try { updTemplate.run(body, category); } catch (_) {}
      try { updVariant.run(body, category); } catch (_) {}
    }
  },
};
