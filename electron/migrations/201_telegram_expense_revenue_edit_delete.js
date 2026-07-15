// Migration 201: Add notify columns for expense/revenue edit & delete events
// and seed 2 message_template_variants (مفصل + مختصر) for each.

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

module.exports = {
  name: "201_telegram_expense_revenue_edit_delete",
  up(db) {
    // ── telegram_recipients: 4 new notify columns ────────────────────────────
    addColumnIfMissing(db, "telegram_recipients", "notify_expense_edited",  "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_expense_deleted", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_revenue_edited",  "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "telegram_recipients", "notify_revenue_deleted", "INTEGER NOT NULL DEFAULT 1");

    // ── settings: legacy columns (kept for forward compat) ───────────────────
    addColumnIfMissing(db, "settings", "telegram_notify_expense_edited",  "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_expense_deleted", "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_revenue_edited",  "INTEGER NOT NULL DEFAULT 1");
    addColumnIfMissing(db, "settings", "telegram_notify_revenue_deleted", "INTEGER NOT NULL DEFAULT 1");

    // ── message_template_variants: 2 presets per event ───────────────────────
    const insertTemplate = db.prepare(
      "INSERT OR IGNORE INTO message_templates (kind, label, body, channel) VALUES (?, ?, ?, 'telegram')"
    );
    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?, ?, ?, 'telegram', ?, datetime('now'))
    `);

    const templates = {
      telegram_expense_edited: {
        label: "تعديل مصروف",
        detailed: [
          "✏️ *تعديل مصروف*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💰 المبلغ القديم: ~{old_amount}~",
          "💰 المبلغ الجديد: *{new_amount}*",
          "📝 الوصف قبل: {old_description}",
          "📝 الوصف بعد: {new_description}",
          "💳 الطريقة: {payment_method}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل مصروف | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}",
      },

      telegram_expense_deleted: {
        label: "حذف مصروف",
        detailed: [
          "🗑️ *حذف مصروف*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💰 المبلغ: *{amount}*",
          "📝 الوصف: {description}",
          "💳 الطريقة: {payment_method}",
          "📅 تاريخ المصروف: {date}",
          "👤 حذف بواسطة: {user_name}",
          "⏰ وقت الحذف: {time}",
        ].join("\n"),
        short: "🗑️ حذف مصروف | {doc_no} | {category} | {amount} | {user_name}",
      },

      telegram_revenue_edited: {
        label: "تعديل إيراد",
        detailed: [
          "✏️ *تعديل إيراد*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💵 المبلغ القديم: ~{old_amount}~",
          "💵 المبلغ الجديد: *{new_amount}*",
          "📝 الوصف قبل: {old_description}",
          "📝 الوصف بعد: {new_description}",
          "💳 الطريقة: {payment_method}",
          "👤 بواسطة: {user_name}",
          "⏰ {time}",
        ].join("\n"),
        short: "✏️ تعديل إيراد | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}",
      },

      telegram_revenue_deleted: {
        label: "حذف إيراد",
        detailed: [
          "🗑️ *حذف إيراد*",
          "",
          "🔖 المستند: *{doc_no}*",
          "📂 الفئة: {category}",
          "💵 المبلغ: *{amount}*",
          "📝 الوصف: {description}",
          "💳 الطريقة: {payment_method}",
          "📅 تاريخ الإيراد: {date}",
          "👤 حذف بواسطة: {user_name}",
          "⏰ وقت الحذف: {time}",
        ].join("\n"),
        short: "🗑️ حذف إيراد | {doc_no} | {category} | {amount} | {user_name}",
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
