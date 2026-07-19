function up(db) {
  const upd = db.prepare("UPDATE message_templates SET body = ?, updated_at = datetime('now') WHERE kind = ?");
  const syncActive = db.prepare(
    "UPDATE message_template_variants SET body = ?, updated_at = datetime('now') WHERE category = ? AND is_active = 1"
  );
  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
  );
  const insertVariant = db.prepare(
    "INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?, ?, ?, 'telegram', ?, datetime('now'))"
  );
  const delVariants = db.prepare("DELETE FROM message_template_variants WHERE category = ?");

  const templates = {
    // ── New invoice ─────────────────────────────────────────────────────
    telegram_new_invoice: {
      label: "فاتورة مبيعات جديدة",
      detailed: [
        "🧾 *فاتورة جديدة* #{invoice_no}",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 الإجمالي: *{total}*",
        "📊 الصافي: {subtotal} | الضريبة: {tax} | الخصم: {discount}",
        "💳 الدفع: {payment_type} | المدفوع: {paid} | الباقي: {balance}",
        "🕐 {created_at}",
        "🛒 الأصناف ({items_count})",
        "{items_table}",
        "💳 تفاصيل الدفع",
        "{payment_breakdown}",
      ].join("\n"),
      short: "🧾 فاتورة #{invoice_no} | {customer_name} | {total} | {payment_type}",
    },
    // ── Daily close ─────────────────────────────────────────────────────
    telegram_daily_close: {
      label: "إغلاق يومية",
      detailed: [
        "📅 إغلاق يومية — {date}",
        "━━━━━━━━━━━━━━━━",
        "💰 الرصيد الافتتاحي: *{opening_balance}*",
        "━━━━ 📥 المبيعات ━━━━",
        "🧾 نقدية: *{cash_sales}*",
        "📋 آجلة: *{credit_sales}*",
        "🔄 أقساط: *{installment_cash}*",
        "🔀 متعدد: *{multi_cash}*",
        "🏦 بنكي/بطاقة: *{bank_sales}*",
        "📊 الإجمالي: *{total_sales}* ({invoices_count} فاتورة)",
        "━━━━ 📦 المشتريات ━━━━",
        "💵 نقدية: *{purchases_cash}*",
        "📋 آجلة: *{purchases_payable}*",
        "━━━━ ↩️ المرتجعات ━━━━",
        "↩️ مبيعات (نقدي): *{sales_returns_cash}*",
        "↩️ مبيعات (آجل): *{sales_returns_account}*",
        "↩️ مشتريات (نقدي): *{purchase_returns_cash}*",
        "↩️ مشتريات (آجل): *{purchase_returns_account}*",
        "━━━━ 💸 المصروفات ━━━━",
        "💸 مصروفات: *{expenses_cash}* ({expenses_count})",
        "💰 إيرادات: *{revenues_cash}* ({revenues_count})",
        "🏧 سحوبات: *{withdrawals}*",
        "━━━━ 💳 الدفعات ━━━━",
        "💰 تحصيل عملاء: *{customer_payments}* ({customer_payments_count})",
        "💰 دفع موردين: *{supplier_payments}* ({supplier_payments_count})",
        "📋 تحصيل آجل: *{ajal_payments}*",
        "━━━━━━━━━━━━━━━━",
        "📥 الوارد: *{cash_in}*",
        "📤 الصادر: *{cash_out}*",
        "💰 الرصيد المتوقع: *{expected_cash}*",
        "💵 الرصيد الفعلي: *{actual_cash}*",
        "⚖️ الفرق: *{discrepancy}*",
        "━━━━━━━━━━━━━━━━",
        "{payment_methods_summary}",
      ].join("\n"),
      short: "📅 إغلاق يومية {date} | فرق: {discrepancy}",
    },
    // ── Sales return ────────────────────────────────────────────────────
    telegram_sales_return: {
      label: "مرتجع مبيعات",
      detailed: [
        "↩️ *مرتجع مبيعات*",
        "",
        "📋 الفاتورة الأصلية: #{original_invoice_id}",
        "👤 العميل: *{customer_name}*",
        "💰 مبلغ المرتجع: *{total}*",
        "💳 طريقة الاسترداد: *{refund_method}*",
        "📝 السبب: {reason}",
        "📦 الأصناف ({items_count}):",
        "{items_table}",
        "👤 بواسطة: {user_name}",
      ].join("\n"),
      short: "↩️ مرتجع #{original_invoice_id} | {total} | {reason}",
    },
    // ── Invoice voided ──────────────────────────────────────────────────
    telegram_invoice_voided: {
      label: "إلغاء فاتورة مبيعات",
      detailed: [
        "⛔ *إلغاء فاتورة مبيعات #{invoice_no}*",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 الإجمالي: *{total}*",
        "💳 طريقة الدفع: *{payment_type}*",
        "📝 السبب: *{reason}*",
        "📦 أصناف الفاتورة الملغاة:",
        "{items_table}",
        "📊 عدد الأصناف: {items_count}",
        "👤 بواسطة: *{user_name}*",
      ].join("\n"),
      short: "⛔ فاتورة ملغاة #{invoice_no} | {total} | {reason}",
    },
    // ── Invoice edited ──────────────────────────────────────────────────
    telegram_invoice_edited: {
      label: "تعديل فاتورة مبيعات",
      detailed: [
        "✏️ *تعديل فاتورة مبيعات*",
        "",
        "🔖 رقم الفاتورة: *#{invoice_no}*",
        "👤 العميل: *{old_customer_name}* ➔ *{new_customer_name}*",
        "💰 الإجمالي: *{old_total}* ➔ *{new_total}*",
        "💳 الدفع: *{old_payment_type}* ➔ *{new_payment_type}*",
        "",
        "📦 *الأصناف قبل التعديل:*",
        "{old_items_table}",
        "",
        "📦 *الأصناف بعد التعديل:*",
        "{new_items_table}",
        "",
        "👨‍💼 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "✏️ تعديل فاتورة #{invoice_no} | {old_total} → {new_total} | {user_name}",
    },
    // ── Invoice amended ─────────────────────────────────────────────────
    telegram_invoice_amended: {
      label: "أمندمنت فاتورة",
      detailed: [
        "🔄 *تعديل (أمندمنت) فاتورة مبيعات*",
        "",
        "📄 الفاتورة القديمة: *#{old_invoice_no}* (ملغاة)",
        "📄 الفاتورة الجديدة: *#{new_invoice_no}*",
        "👤 العميل: *{old_customer_name}* ➔ *{new_customer_name}*",
        "💰 الإجمالي: *{old_total}* ➔ *{new_total}*",
        "",
        "📦 *الأصناف قبل (الملغاة):*",
        "{old_items_table}",
        "",
        "📦 *الأصناف بعد (الجديدة):*",
        "{new_items_table}",
        "",
        "👨‍💼 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "🔄 أمندمنت #{old_invoice_no} → #{new_invoice_no} | {new_total} | {user_name}",
    },
    // ── Purchase created ────────────────────────────────────────────────
    telegram_purchase_created: {
      label: "عملية شراء جديدة",
      detailed: [
        "📦 *عملية شراء جديدة*",
        "",
        "📝 النوع: *{kind_label}*",
        "📋 الرقم: *#{reference}*",
        "🏭 المورد: *{supplier_name}*",
        "💰 المجموع: *{total}*",
        "💳 طريقة الدفع: {payment_type}",
        "⏰ {time}",
      ].join("\n"),
      short: "📦 {kind_label} #{reference} | {supplier_name} | {total}",
    },
    // ── Purchase edited ─────────────────────────────────────────────────
    telegram_purchase_edited: {
      label: "تعديل فاتورة مشتريات",
      detailed: [
        "✏️ *تعديل فاتورة مشتريات*",
        "",
        "🔖 المرجع: *#{reference_no}*",
        "🏢 المورد: *{old_supplier_name}* ➔ *{new_supplier_name}*",
        "💰 الإجمالي: *{old_total}* ➔ *{new_total}*",
        "💳 الدفع: *{old_payment_method}* ➔ *{new_payment_method}*",
        "",
        "📦 *الأصناف قبل التعديل:*",
        "{old_items_table}",
        "",
        "📦 *الأصناف بعد التعديل:*",
        "{new_items_table}",
        "",
        "👨‍💼 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "✏️ تعديل مشتريات #{reference_no} | {old_total} → {new_total} | {user_name}",
    },
    // ── Purchase voided ─────────────────────────────────────────────────
    telegram_purchase_voided: {
      label: "إلغاء فاتورة شراء",
      detailed: [
        "⛔ *إلغاء فاتورة شراء*",
        "",
        "📋 المرجع: *{reference_no}*",
        "🏭 المورد: *{supplier_name}*",
        "💰 الإجمالي: *{total}*",
        "📝 السبب: *{reason}*",
        "📦 الأصناف ({items_count}):",
        "{items_table}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "⛔ شراء ملغي #{reference_no} | {total} | {reason}",
    },
    // ── Purchase return ─────────────────────────────────────────────────
    telegram_purchase_return: {
      label: "مرتجع مشتريات",
      detailed: [
        "↩️ *مرتجع مشتريات*",
        "",
        "📋 المرجع: *{reference_no}*",
        "🏭 المورد: *{supplier_name}*",
        "💰 الإجمالي: *{total}*",
        "📦 الأصناف ({items_count}):",
        "{items_table}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "↩️ مرتجع شراء #{reference_no} | {total} | {user_name}",
    },
    // ── Customer payment ────────────────────────────────────────────────
    telegram_customer_payment: {
      label: "دفعة من عميل",
      detailed: [
        "💰 *دفع من عميل*",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 المبلغ: *{amount}*",
        "💳 الطريقة: {method}",
      ].join("\n"),
      short: "💰 دفع من {customer_name} | {amount} | {method}",
    },
    // ── Return payment ──────────────────────────────────────────────────
    telegram_return_payment: {
      label: "دفعة مرتجعة",
      detailed: [
        "↩️ *دفعة مرتجعة*",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 المبلغ: *{amount}*",
        "💳 الطريقة: *{method}*",
        "📅 التاريخ: {date}",
        "📝 السبب: {reason}",
      ].join("\n"),
      short: "↩️ دفعة مرتجعة | {customer_name} | {amount} | {method}",
    },
    // ── Supplier payment ────────────────────────────────────────────────
    telegram_supplier_payment: {
      label: "دفع مورد",
      detailed: [
        "💰 *دفع مورد*",
        "",
        "🏭 المورد: *{supplier_name}*",
        "💰 المبلغ: *{amount}*",
        "💳 الطريقة: {method}",
        "📋 المرجع: {reference}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "💰 دفع مورد | {supplier_name} | {amount} | {method}",
    },
    // ── Debt payment ────────────────────────────────────────────────────
    telegram_debt_payment: {
      label: "دفعة دين",
      detailed: [
        "💰 *دفعة دين*",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 المبلغ: *{amount}*",
        "💳 الطريقة: {method}",
        "💰 المتبقي: {remaining_debt}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "💰 دفعة دين | {customer_name} | {amount} | {method}",
    },
    // ── Installment paid ────────────────────────────────────────────────
    telegram_installment_paid: {
      label: "دفعة قسط",
      detailed: [
        "💰 *دفعة قسط*",
        "",
        "👤 العميل: *{customer_name}*",
        "💰 المبلغ: *{amount}*",
        "💳 الطريقة: {method}",
        "📋 القسط: {installment_no} / {total_installments}",
        "💰 المتبقي: {remaining}",
      ].join("\n"),
      short: "💰 قسط | {customer_name} | {amount} | {installment_no}/{total_installments}",
    },
    // ── Sales return edited ─────────────────────────────────────────────
    telegram_sales_return_edited: {
      label: "تعديل مرتجع مبيعات",
      detailed: [
        "✏️ *تعديل مرتجع مبيعات*",
        "",
        "🔖 المستند: *{doc_no}*",
        "👤 العميل: {customer_name}",
        "💰 الإجمالي قبل: {old_total}",
        "💰 الإجمالي بعد: *{new_total}*",
        "◀️ الأصناف قبل:",
        "{old_items_table}",
        "▶️ الأصناف بعد:",
        "{new_items_table}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "✏️ تعديل مرتجع مبيعات {doc_no} | {old_total} → {new_total} | {user_name}",
    },
    // ── Sales return cancelled ──────────────────────────────────────────
    telegram_sales_return_cancelled: {
      label: "إلغاء مرتجع مبيعات",
      detailed: [
        "❌ *إلغاء مرتجع مبيعات*",
        "",
        "🔖 المستند: *{doc_no}*",
        "👤 العميل: {customer_name}",
        "💰 الإجمالي: *{total}*",
        "📝 السبب: {reason}",
        "📦 الأصناف:",
        "{items_table}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "❌ إلغاء مرتجع مبيعات {doc_no} | {total} | {reason} | {user_name}",
    },
    // ── Purchase return edited ──────────────────────────────────────────
    telegram_purchase_return_edited: {
      label: "تعديل مرتجع مشتريات",
      detailed: [
        "✏️ *تعديل مرتجع مشتريات*",
        "",
        "🔖 المرجع: *{reference_no}*",
        "🏭 المورد: {supplier_name}",
        "💰 الإجمالي قبل: {old_total}",
        "💰 الإجمالي بعد: *{new_total}*",
        "◀️ الأصناف قبل:",
        "{old_items_table}",
        "▶️ الأصناف بعد:",
        "{new_items_table}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "✏️ تعديل مرتجع مشتريات {reference_no} | {old_total} → {new_total} | {user_name}",
    },
    // ── Purchase return cancelled ───────────────────────────────────────
    telegram_purchase_return_cancelled: {
      label: "إلغاء مرتجع مشتريات",
      detailed: [
        "❌ *إلغاء مرتجع مشتريات*",
        "",
        "🔖 المرجع: *{reference_no}*",
        "🏭 المورد: {supplier_name}",
        "💰 الإجمالي: *{total}*",
        "📝 السبب: {reason}",
        "👤 بواسطة: {user_name}",
        "⏰ {time}",
      ].join("\n"),
      short: "❌ إلغاء مرتجع مشتريات {reference_no} | {total} | {reason} | {user_name}",
    },
  };

  for (const [category, { label, detailed, short }] of Object.entries(templates)) {
    const existing = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get(category);
    if (existing) {
      upd.run(detailed, category);
    } else {
      insertTemplate.run(category, label, detailed);
    }
    // Reset variants so the new defaults take effect
    delVariants.run(category);
    insertVariant.run(category, "قياسي — مفصل", detailed, 1);
    insertVariant.run(category, "مختصر — سريع", short, 0);
  }

  // ── telegram_app_quit (new) ──────────────────────────────────────────
  const appQuitBody = [
    "🛑 *إغلاق التطبيق*",
    "",
    "👤 المستخدم: *{user_name}*",
    "📝 السبب: *{trigger_reason}*",
    "⏰ الوقت: {time}",
  ].join("\n");
  insertTemplate.run("telegram_app_quit", "إغلاق التطبيق", appQuitBody);
  insertVariant.run("telegram_app_quit", "قياسي — مفصل", appQuitBody, 1);
  insertVariant.run("telegram_app_quit", "مختصر — سريع", "🛑 إغلاق التطبيق | {user_name} | {trigger_reason}", 0);

  // ── telegram_user_logout (new) ───────────────────────────────────────
  const userLogoutBody = [
    "🚪 *تسجيل خروج*",
    "",
    "👤 المستخدم: *{user_name}*",
    "📝 السبب: *{trigger_reason}*",
    "⏰ الوقت: {time}",
  ].join("\n");
  insertTemplate.run("telegram_user_logout", "تسجيل خروج", userLogoutBody);
  insertVariant.run("telegram_user_logout", "قياسي — مفصل", userLogoutBody, 1);
  insertVariant.run("telegram_user_logout", "مختصر — سريع", "🚪 تسجيل خروج | {user_name} | {trigger_reason}", 0);
}

module.exports = { up, name: "213_update_telegram_templates_accumulative" };
