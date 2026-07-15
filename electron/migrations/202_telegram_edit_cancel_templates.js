// Migration 202: Seed message_template_variants (مفصل + مختصر) for 8 new edit/cancel events:
// INVOICE_EDITED, INVOICE_AMENDED, PURCHASE_EDITED, PURCHASE_RETURN_CANCELLED,
// BRANCH_TRANSFER_EDITED, BRANCH_TRANSFER_CANCELLED, WITHDRAWAL_EDITED, WITHDRAWAL_DELETED

module.exports = {
  name: "202_telegram_edit_cancel_templates",
  up(db) {
    const insertTemplate = db.prepare(
      "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
    );
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);

    const templates = {
      // ── Sales Invoice ─────────────────────────────────────────────────────
      telegram_invoice_edited: {
        label: "تعديل فاتورة مبيعات",
        detailed: [
          "✏️ *تعديل فاتورة مبيعات*",
          "",
          "🔖 رقم الفاتورة: *#{invoice_no}*",
          "👤 العميل: *{customer_name}*",
          "💰 الإجمالي الجديد: *{total}*",
          "",
          "📦 *الأصناف بعد التعديل:*",
          "{items_table}",
          "",
          "💳 طريقة الدفع: {payment_breakdown}",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل فاتورة | #{invoice_no} | {customer_name} | {total} | {user_name}",
      },

      telegram_invoice_amended: {
        label: "تعديل (أمندمنت) فاتورة",
        detailed: [
          "🔄 *تعديل (أمندمنت) فاتورة مبيعات*",
          "",
          "📄 الفاتورة القديمة: *#{old_invoice_no}* (ملغاة)",
          "📄 الفاتورة الجديدة: *#{new_invoice_no}*",
          "👤 العميل: *{customer_name}*",
          "💰 الإجمالي الجديد: *{total}*",
          "",
          "📦 *الأصناف:*",
          "{items_table}",
          "",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🔄 أمندمنت | #{old_invoice_no} → #{new_invoice_no} | {customer_name} | {total} | {user_name}",
      },

      // ── Purchases ─────────────────────────────────────────────────────────
      telegram_purchase_edited: {
        label: "تعديل فاتورة مشتريات",
        detailed: [
          "✏️ *تعديل فاتورة مشتريات*",
          "",
          "🔖 المرجع: *{reference_no}*",
          "🏢 المورد: *{supplier_name}*",
          "💰 الإجمالي الجديد: *{new_total}*",
          "💳 طريقة الدفع: {payment_method}",
          "",
          "📦 *الأصناف الجديدة:*",
          "{items_table}",
          "",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل مشتريات | {reference_no} | {supplier_name} | {new_total} | {user_name}",
      },

      telegram_purchase_return_cancelled: {
        label: "إلغاء مرتجع مشتريات",
        detailed: [
          "❌ *إلغاء مرتجع مشتريات*",
          "",
          "🔖 المرجع: *{reference_no}*",
          "🏢 المورد: *{supplier_name}*",
          "💰 المبلغ: *{total}*",
          "📝 السبب: {reason}",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "❌ إلغاء مرتجع مشتريات | {reference_no} | {supplier_name} | {reason} | {user_name}",
      },

      // ── Branch Transfers ──────────────────────────────────────────────────
      telegram_branch_transfer_edited: {
        label: "تعديل حركة فرع",
        detailed: [
          "✏️ *تعديل حركة فرع*",
          "",
          "🔖 المرجع: *{reference_no}*",
          "🔀 النوع: {transfer_type}",
          "🏢 الفرع: *{partner_branch}*",
          "",
          "📦 *الأصناف الجديدة:*",
          "{items_table}",
          "",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل حركة فرع | {reference_no} | {transfer_type} | {partner_branch} | {user_name}",
      },

      telegram_branch_transfer_cancelled: {
        label: "إلغاء حركة فرع",
        detailed: [
          "❌ *إلغاء حركة فرع*",
          "",
          "🔖 المرجع: *{reference_no}*",
          "🔀 النوع: {transfer_type}",
          "🏢 الفرع: *{partner_branch}*",
          "📝 السبب: {reason}",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "❌ إلغاء حركة فرع | {reference_no} | {transfer_type} | {reason} | {user_name}",
      },

      // ── Withdrawals ───────────────────────────────────────────────────────
      telegram_withdrawal_edited: {
        label: "تعديل سحب نقدي",
        detailed: [
          "✏️ *تعديل سحب نقدي*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💰 المبلغ القديم: ~{old_amount}~",
          "💰 المبلغ الجديد: *{new_amount}*",
          "📝 الملاحظة: {note}",
          "💳 الطريقة: {payment_method}",
          "👨‍💼 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل سحب | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}",
      },

      telegram_withdrawal_deleted: {
        label: "حذف سحب نقدي",
        detailed: [
          "🗑️ *حذف سحب نقدي*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💰 المبلغ: *{amount}*",
          "📝 الملاحظة: {note}",
          "💳 الطريقة: {payment_method}",
          "📅 تاريخ السحب: {date}",
          "👨‍💼 حذف بواسطة: {user_name}",
          "⏰ وقت الحذف: {time}",
        ].join("\n"),
        short: "🗑️ حذف سحب | {doc_no} | {category} | {amount} | {user_name}",
      },
    };

    for (const [category, { label, detailed, short }] of Object.entries(templates)) {
      // Remove stale variants first so re-running is idempotent
      db.prepare("DELETE FROM message_template_variants WHERE category = ?").run(category);

      const existing = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get(category);
      if (existing) {
        db.prepare("UPDATE message_templates SET body = ?, label = ? WHERE kind = ?").run(detailed, label, category);
      } else {
        insertTemplate.run(category, label, detailed);
      }

      // Detailed preset — active by default
      insertVariant.run(category, "قياسي — مفصل", detailed, 1);
      // Short preset
      insertVariant.run(category, "مختصر — سريع", short, 0);
    }
  },
};
