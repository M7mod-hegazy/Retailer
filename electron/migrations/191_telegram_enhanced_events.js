// Enhanced Telegram event types + detailed invoice template variables.
// Adds toggles for customer/supplier/expense/return-payment events and updates
// the new-invoice template to expose items_table and payment_breakdown.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

const NEW_EVENT_DEFAULTS = {
  telegram_customer_created:
`👤 *عميل جديد*
━━━━━━━━━━━━━━
الاسم: {customer_name}
الهاتف: {phone}
المدينة: {city}
الرصيد الافتتاحي: {opening_balance}`,

  telegram_supplier_created:
`🏭 *مورد جديد*
━━━━━━━━━━━━━━
الاسم: {supplier_name}
الهاتف: {phone}
الرصيد الافتتاحي: {opening_balance}`,

  telegram_expense_created:
`💸 *مصروف جديد*
━━━━━━━━━━━━━━
الفئة: {category}
المبلغ: *{amount}*
التاريخ: {date}
ملاحظات: {notes}`,

  telegram_return_payment:
`↩️ *دفعة مرتجعة*
━━━━━━━━━━━━━━
العميل: {customer_name}
المبلغ: *{amount}*
الطريقة: {method}
التاريخ: {date}`,
};

const NEW_SETTINGS_COLUMNS = [
  "telegram_notify_customer_created",
  "telegram_notify_supplier_created",
  "telegram_notify_expense_created",
  "telegram_notify_return_payment",
];

const NEW_RECIPIENT_COLUMNS = [
  "notify_customer_created",
  "notify_supplier_created",
  "notify_expense_created",
  "notify_return_payment",
];

const LABELS = {
  telegram_customer_created: "عميل جديد",
  telegram_supplier_created: "مورد جديد",
  telegram_expense_created: "مصروف جديد",
  telegram_return_payment: "دفعة مرتجعة",
};

module.exports = {
  name: "191_telegram_enhanced_events",
  up(db) {
    // 1. Settings toggles (legacy single-recipient fallback)
    for (const col of NEW_SETTINGS_COLUMNS) {
      addColumnIfMissing(db, "settings", col, "INTEGER NOT NULL DEFAULT 1");
    }

    // 2. Recipient toggles (multi-recipient table)
    for (const col of NEW_RECIPIENT_COLUMNS) {
      addColumnIfMissing(db, "telegram_recipients", col, "INTEGER NOT NULL DEFAULT 1");
    }

    // 3. Template categories + variants
    const insertTemplate = db.prepare("INSERT INTO message_templates (kind, body, channel) VALUES (?,?,'telegram')");
    const insertVariant = db.prepare("INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?,?,?,'telegram',1,datetime('now'))");
    const hasTemplate = db.prepare("SELECT 1 FROM message_templates WHERE kind=?");
    const hasVariant = db.prepare("SELECT 1 FROM message_template_variants WHERE category=?");

    for (const [kind, body] of Object.entries(NEW_EVENT_DEFAULTS)) {
      if (!hasTemplate.get(kind)) insertTemplate.run(kind, body);
      if (!hasVariant.get(kind)) insertVariant.run(kind, LABELS[kind], body);
    }

    // 4. Update the new-invoice template to include detailed variables.
    const detailedInvoiceBody =
`🧾 *فاتورة جديدة* #{invoice_no}
━━━━━━━━━━━━━━
👤 العميل: {customer_name}
💰 الإجمالي: *{total}*
📊 الصافي: {subtotal} | الضريبة: {tax} | الخصم: {discount}
💳 الدفع: {payment_type} | المدفوع: {paid} | الباقي: {balance}
🕐 {created_at}

🛒 *الأصناف ({items_count})*
{items_table}

💳 *تفاصيل الدفع*
{payment_breakdown}`;

    db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind='telegram_new_invoice'").run(detailedInvoiceBody);
    db.prepare("UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE category='telegram_new_invoice' AND is_active=1").run(detailedInvoiceBody);
  },
};
