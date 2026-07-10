// Refine the 12 Telegram owner-notification templates: same variables, better
// visual organization (header + dividers + grouped sections). Updates the active
// variant and the resolved message_templates row so buildMessage picks it up.
module.exports = {
  name: "186_refine_telegram_templates",
  up(db) {
    const bodies = {
      telegram_new_invoice:
`🧾 *فاتورة جديدة* #{invoice_no}
━━━━━━━━━━━━━━
👤 العميل: {customer_name}
💰 الإجمالي: *{total}*
💳 الدفع: {payment_type}
🕐 {created_at}`,

      telegram_large_invoice:
`🚨 *فاتورة بمبلغ كبير* #{invoice_no}
━━━━━━━━━━━━━━
👤 العميل: {customer_name}
💰 المجموع: *{total}*`,

      telegram_large_discount:
`💸 *خصم كبير مطبق*
━━━━━━━━━━━━━━
🧾 الفاتورة: #{invoice_no}
📉 نسبة الخصم: *{discount_percent}%*`,

      telegram_sales_return:
`↩️ *مرتجع مبيعات*
━━━━━━━━━━━━━━
🧾 الفاتورة الأصلية: #{original_invoice_id}
💰 مبلغ المرتجع: *{total}*`,

      telegram_invoice_voided:
`⛔ *فاتورة ملغاة* #{invoice_no}
━━━━━━━━━━━━━━
📝 السبب: {reason}
👤 بواسطة: {user_name}`,

      telegram_purchase_created:
`📦 *عملية شراء جديدة*
━━━━━━━━━━━━━━
🏷️ النوع: {kind_label}
🔢 الرقم: #{reference}
🏭 المورد: {supplier_name}
💰 المجموع: *{total}*`,

      telegram_customer_payment:
`💰 *دفعة من عميل*
━━━━━━━━━━━━━━
👤 العميل: {customer_name}
💵 المبلغ: *{amount}*
💳 الطريقة: {method}`,

      telegram_daily_close:
`📅 *إغلاق يومية* — {date}
━━━ 🛒 المبيعات ━━━
• نقدي: {cash_sales}
• آجل: {credit_sales}
━━━ 🏦 الخزنة ━━━
• افتتاحي: {opening_balance}
• متوقع: {expected_cash}
• فعلي: {actual_cash}
• الفرق: *{discrepancy}*
━━━━━━━━━━━━━━
🧾 عدد الفواتير: {invoices_count}`,

      telegram_shift_close:
`📋 *إغلاق وردية* #{shift_id}
━━━ 🏦 الخزنة ━━━
• افتتاحي: {opening_cash}
• متوقع: {expected_cash}
• فعلي: {closing_cash}
• الفرق: *{discrepancy}*
━━━━━━━━━━━━━━
🧾 عدد الفواتير: {invoices_count}`,

      telegram_low_stock:
`⚠️ *تنبيه مخزون منخفض*
━━━━━━━━━━━━━━
📦 المنتج: {product_name}
📉 الكمية الحالية: *{current_quantity}*
🔻 الحد الأدنى: {min_quantity}`,

      telegram_backup_result:
`{success_text}
━━━━━━━━━━━━━━
📝 السبب: {reason}
📁 الملف: {file_path}
{error}`,

      telegram_failed_login:
`🔒 *محاولة دخول فاشلة*
━━━━━━━━━━━━━━
👤 المستخدم: {username}
🕐 الوقت: {time}
🌐 IP: {ip}`,
    };

    const updTemplate = db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=?");
    let updVariant = null;
    try {
      // Update the active variant too, when the variants table exists.
      db.prepare("SELECT 1 FROM message_template_variants LIMIT 1").get();
      updVariant = db.prepare("UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE category=? AND is_active=1");
    } catch (_) { /* no variants table — templates only */ }

    for (const [kind, body] of Object.entries(bodies)) {
      updTemplate.run(body, kind);
      if (updVariant) { try { updVariant.run(body, kind); } catch (_) {} }
    }
  },
};
