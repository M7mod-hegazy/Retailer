// Templates were one row per purpose (kind), single body, no history. The
// owner wants several drafts per purpose and to pick which one is live —
// and wants that same control over Telegram's owner-alert messages, which
// used to be hardcoded strings in telegramService.js with no template at all.
//
// message_templates stays the single source of truth every sender reads
// (notificationJobs birthday cron, POS/sales-return receipt send, telegramService
// buildMessage) — kind === category, body === whichever variant is active.
// message_template_variants is the editing/history layer on top: many rows per
// category, exactly one flagged is_active, activating one copies its body into
// message_templates so existing send call-sites need no changes.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

// Telegram categories that previously had no message_templates row at all —
// default bodies mirror the hardcoded strings in telegramService.js so
// behavior is unchanged until the owner customizes one.
const TELEGRAM_DEFAULTS = {
  telegram_new_invoice: "🧾 فاتورة جديدة\nالرقم: *#{invoice_no}*\nالعميل: *{customer_name}*\nالمجموع: *{total}*\nطريقة الدفع: *{payment_type}*\nالوقت: {created_at}",
  telegram_daily_close: "📅 إغلاق يومية — {date}\nالرصيد الافتتاحي: *{opening_balance}*\nالمبيعات النقدية: *{cash_sales}*\nالمبيعات الآجلة: *{credit_sales}*\nالرصيد المتوقع: *{expected_cash}*\nالرصيد الفعلي: *{actual_cash}*\nالفرق: *{discrepancy}*\nعدد الفواتير: *{invoices_count}*",
  telegram_shift_close: "📋 إغلاق وردية\nرقم الوردية: *#{shift_id}*\nالرصيد الافتتاحي: *{opening_cash}*\nالرصيد المتوقع: *{expected_cash}*\nالرصيد الفعلي: *{closing_cash}*\nالفرق: *{discrepancy}*\nعدد الفواتير: *{invoices_count}*",
  telegram_large_invoice: "🚨 فاتورة بمبلغ كبير\nالرقم: *#{invoice_no}*\nالعميل: *{customer_name}*\nالمجموع: *{total}*",
  telegram_large_discount: "💸 خصم كبير مطبق\nالفاتورة: *#{invoice_no}*\nنسبة الخصم: *{discount_percent}%*",
  telegram_sales_return: "↩️ مرتجع مبيعات\nالفاتورة الأصلية: *#{original_invoice_id}*\nمبلغ المرتجع: *{total}*",
  telegram_invoice_voided: "⛔ فاتورة ملغاة\nالفاتورة: *#{invoice_no}*\nالسبب: *{reason}*\nبواسطة: *{user_name}*",
  telegram_purchase_created: "📦 عملية شراء جديدة\nالنوع: *{kind_label}*\nالرقم: *#{reference}*\nالمورد: *{supplier_name}*\nالمجموع: *{total}*",
  telegram_customer_payment: "💰 دفع من عميل\nالعميل: *{customer_name}*\nالمبلغ: *{amount}*\nالطريقة: *{method}*",
  telegram_low_stock: "⚠️ تنبيه مخزون منخفض\nالمنتج: *{product_name}*\nالكمية الحالية: *{current_quantity}*\nالحد الأدنى: *{min_quantity}*",
  telegram_backup_result: "{success_text}\nالسبب: *{reason}*\nالملف: *{file_path}*\n{error}",
  telegram_failed_login: "🔒 محاولة دخول فاشلة\nالمستخدم: *{username}*\nالوقت: {time}\nIP: *{ip}*",
};

const SYSTEM_LABELS = {
  receipt: "إيصال الشراء", return_receipt: "إيصال المرتجع", birthday: "عيد الميلاد", debt: "تذكير الدين",
  telegram_new_invoice: "فاتورة مبيعات جديدة", telegram_daily_close: "إغلاق يومية", telegram_shift_close: "إغلاق وردية",
  telegram_large_invoice: "فاتورة بمبلغ كبير", telegram_large_discount: "خصم كبير", telegram_sales_return: "مرتجع مبيعات",
  telegram_invoice_voided: "فاتورة ملغاة", telegram_purchase_created: "عملية شراء جديدة", telegram_customer_payment: "دفعة من عميل",
  telegram_low_stock: "مخزون منخفض", telegram_backup_result: "نتيجة النسخ الاحتياطي", telegram_failed_login: "محاولة دخول فاشلة",
};

module.exports = {
  name: "177_message_template_variants",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS message_template_variants (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category    TEXT NOT NULL,
        label       TEXT,
        body        TEXT NOT NULL,
        channel     TEXT NOT NULL DEFAULT 'whatsapp',
        is_active   INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT
      )
    `);
    db.prepare("CREATE INDEX IF NOT EXISTS idx_mtv_category ON message_template_variants(category)").run();

    addColumnIfMissing(db, "message_templates", "channel", "TEXT NOT NULL DEFAULT 'both'");

    // Seed variants for the existing WhatsApp system rows from their current body.
    const existingSystemRows = db.prepare(
      "SELECT kind, body FROM message_templates WHERE kind IN ('receipt','return_receipt','birthday','debt')"
    ).all();
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?,?,?,?,1,datetime('now'))
    `);
    const hasVariant = db.prepare("SELECT 1 FROM message_template_variants WHERE category=?");
    for (const row of existingSystemRows) {
      if (!hasVariant.get(row.kind)) {
        insertVariant.run(row.kind, SYSTEM_LABELS[row.kind] || row.kind, row.body, "whatsapp");
      }
      db.prepare("UPDATE message_templates SET channel='whatsapp' WHERE kind=?").run(row.kind);
    }

    // Telegram categories never had a message_templates row — create both the
    // canonical row (read by telegramService.buildMessage) and its first variant.
    const insertTemplateRow = db.prepare("INSERT INTO message_templates (kind, body, channel) VALUES (?,?,'telegram')");
    for (const [category, body] of Object.entries(TELEGRAM_DEFAULTS)) {
      const exists = db.prepare("SELECT 1 FROM message_templates WHERE kind=?").get(category);
      if (!exists) insertTemplateRow.run(category, body);
      if (!hasVariant.get(category)) {
        insertVariant.run(category, SYSTEM_LABELS[category] || category, body, "telegram");
      }
    }
  },
};
