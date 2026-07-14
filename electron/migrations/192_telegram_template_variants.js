// Give every Telegram owner-alert category a second "short" variant so owners
// can choose between detailed and compact message styles. Also normalizes the
// existing active variant label to "قياسي — مفصل" so reset-to-default works
// consistently across all Telegram templates.
const TELEGRAM_CATEGORIES = [
  "telegram_new_invoice", "telegram_daily_close", "telegram_shift_close",
  "telegram_large_invoice", "telegram_large_discount", "telegram_sales_return",
  "telegram_invoice_voided", "telegram_purchase_created", "telegram_customer_payment",
  "telegram_low_stock", "telegram_backup_result", "telegram_failed_login",
  "telegram_customer_created", "telegram_supplier_created", "telegram_expense_created",
  "telegram_return_payment",
];

const SHORT_BODIES = {
  telegram_new_invoice: `🧾 فاتورة جديدة #{invoice_no}
👤 {customer_name}
💰 {total}
🕐 {created_at}`,
  telegram_daily_close: `📅 إغلاق يومية {date}
💵 نقداً: {cash_sales} | آجل: {credit_sales}
⚠️ فرق: {discrepancy}`,
  telegram_shift_close: `📋 إغلاق وردية #{shift_id}
⚠️ فرق: {discrepancy}
🧾 فواتير: {invoices_count}`,
  telegram_large_invoice: `🚨 فاتورة كبيرة #{invoice_no} | {customer_name} | {total}`,
  telegram_large_discount: `💸 خصم كبير #{invoice_no} | {discount_percent}`,
  telegram_sales_return: `↩️ مرتجع #{original_invoice_id} | {total}`,
  telegram_invoice_voided: `⛔ فاتورة ملغاة #{invoice_no} | {reason}`,
  telegram_purchase_created: `📦 {kind_label} #{reference} | {supplier_name} | {total}`,
  telegram_customer_payment: `💰 دفع من {customer_name} | {amount} | {method}`,
  telegram_low_stock: `⚠️ مخزون منخفض: {product_name} | {current_quantity}/{min_quantity}`,
  telegram_backup_result: `{success_text} | {reason}`,
  telegram_failed_login: `🔒 دخول فاشل: {username} | {ip}`,
  telegram_customer_created: `👤 عميل جديد: {customer_name} | {phone}`,
  telegram_supplier_created: `🏭 مورد جديد: {supplier_name} | {phone}`,
  telegram_expense_created: `💸 مصروف: {category} | {amount} | {date}`,
  telegram_return_payment: `↩️ دفعة مرتجعة: {customer_name} | {amount} | {method}`,
};

module.exports = {
  name: "192_telegram_template_variants",
  up(db) {
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', 0, datetime('now'))
    `);
    const hasShort = db.prepare("SELECT 1 FROM message_template_variants WHERE category=? AND label=?");
    const renameActive = db.prepare("UPDATE message_template_variants SET label=? WHERE category=? AND is_active=1 AND label!=?");
    const getActive = db.prepare("SELECT body FROM message_template_variants WHERE category=? AND is_active=1");

    for (const category of TELEGRAM_CATEGORIES) {
      // Normalize the active variant label so reset-to-default keys match.
      renameActive.run("قياسي — مفصل", category, "قياسي — مفصل");

      // Seed a short variant if missing.
      if (!hasShort.get(category, "مختصر — سريع")) {
        insertVariant.run(category, "مختصر — سريع", SHORT_BODIES[category] || "");
      }

      // Make sure the canonical message_templates row stays in sync with the
      // active variant body (some earlier migrations only updated the variant).
      const active = getActive.get(category);
      if (active?.body) {
        db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=?").run(active.body, category);
      }
    }
  },
};
