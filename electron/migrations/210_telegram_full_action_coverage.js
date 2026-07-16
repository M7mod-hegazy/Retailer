// Migration 210: close the Telegram notification gaps found in the full
// route audit (2026-07-16). New event categories + templates:
//   - sales_return_edited / sales_return_cancelled (own recipient columns)
//   - purchase_return_edited (own recipient column)
//   - price_bulk_update            (shares notify_price_change)
//   - item_deleted                 (shares notify_new_product)
//   - customer_deleted             (shares notify_customer_created)
//   - supplier_deleted             (shares notify_supplier_created)
//   - employee_deleted             (shares notify_employee_created)

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "210_telegram_full_action_coverage",
  up(db) {
    addColumnIfMissing(db, "telegram_recipients", "notify_sales_return_edited", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_sales_return_cancelled", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_purchase_return_edited", "INTEGER NOT NULL DEFAULT 1");

    const insertTemplate = db.prepare(
      "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
    );
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);

    const templates = {
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
      telegram_price_bulk_update: {
        label: "تحديث أسعار جماعي",
        detailed: [
          "🏷️ *{operation_label}*",
          "",
          "📦 عدد الأصناف: *{items_count}*",
          "💲 الحقل: {field_label}",
          "🧮 التعديل: {adjustment_label}",
          "📝 السبب: {reason}",
          "{changes_table}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🏷️ {operation_label} | {items_count} صنف | {adjustment_label} | {user_name}",
      },
      telegram_item_deleted: {
        label: "حذف صنف",
        detailed: [
          "🗑️ *حذف صنف*",
          "",
          "📦 الصنف: *{product_name}*",
          "🔖 الكود: {sku}",
          "💰 سعر البيع: {price}",
          "📊 الكمية وقت الحذف: {quantity}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🗑️ حذف صنف {product_name} [{sku}] | {user_name}",
      },
      telegram_customer_deleted: {
        label: "حذف عميل",
        detailed: [
          "🗑️ *حذف عميل*",
          "",
          "👤 العميل: *{customer_name}*",
          "📱 الهاتف: {phone}",
          "💰 الرصيد وقت الحذف: {balance}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🗑️ حذف عميل {customer_name} | الرصيد: {balance} | {user_name}",
      },
      telegram_supplier_deleted: {
        label: "حذف مورد",
        detailed: [
          "🗑️ *حذف مورد*",
          "",
          "🏭 المورد: *{supplier_name}*",
          "📱 الهاتف: {phone}",
          "💰 الرصيد وقت الحذف: {balance}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🗑️ حذف مورد {supplier_name} | الرصيد: {balance} | {user_name}",
      },
      telegram_employee_deleted: {
        label: "حذف موظف",
        detailed: [
          "🗑️ *حذف موظف*",
          "",
          "👤 الموظف: *{employee_name}*",
          "💼 الوظيفة: {job_title}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "🗑️ حذف موظف {employee_name} | {user_name}",
      },
    };

    for (const [category, { label, detailed, short }] of Object.entries(templates)) {
      db.prepare("DELETE FROM message_template_variants WHERE category = ?").run(category);

      const existing = db.prepare("SELECT 1 FROM message_templates WHERE kind = ?").get(category);
      if (existing) {
        db.prepare("UPDATE message_templates SET body = ?, label = ? WHERE kind = ?").run(detailed, label, category);
      } else {
        insertTemplate.run(category, label, detailed);
      }

      insertVariant.run(category, "قياسي — مفصل", detailed, 1);
      insertVariant.run(category, "مختصر — سريع", short, 0);
    }
  },
};
