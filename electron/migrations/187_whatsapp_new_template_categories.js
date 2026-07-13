// Seed WhatsApp template categories for purchase receipts, purchase returns,
// and branch transfers (send + receive). Follows the same pattern as migration
// 177 which seeded receipt, return_receipt, birthday, and debt.
function addColumnIfMissing(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

const NEW_CATEGORIES = {
  purchase_receipt: "فاتورة شراء",
  purchase_return_receipt: "مرتجع مشتريات",
  transfer_send: "تسليم بضاعة",
  transfer_receive: "استلام بضاعة",
};

const DEFAULT_VARIANTS = {
  purchase_receipt: {
    "قياسي — مفصل": `مرحباً {name}،

🛍️ فاتورة شراء
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━━ الدفع ━━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

شكراً لتعاملكم معنا ✨
{shop}`,
    "مختصر — سريع": `مرحباً {name}،
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 {total} جنيه
{shop}`,
    "بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،
شكراً لاختيارنا ❤️

📋 فاتورة شراء رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━━ الدفع ━━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

نتشرف بخدمتك دائماً ✨
{shop}`,
  },
  purchase_return_receipt: {
    "قياسي — مفصل": `مرحباً {name}،

✅ تم إتمام مرتجع الشراء
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

💰 المسترد: {total} جنيه

شكراً لتعاملكم ✨
{shop}`,
    "مختصر — سريع": `مرحباً {name}،
✅ تم استلام مرتجع الشراء
📋 {invoice_no} — {date}
{items_table}
💰 المسترد: {total} جنيه
{shop}`,
    "بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،

✅ تمت معالجة مرتجع الشراء

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

المنتجات المسترجعة:
{items_table}

💰 المسترد: {total} جنيه

نتشرف بخدمتك دائماً ❤️
{shop}`,
  },
  transfer_send: {
    "قياسي — مفصل": `📦 تم تسليم البضاعة
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُستلم: {name}

{items_table}

💰 إجمالي التكلفة: {total} جنيه
━━━━━━━━━━━━━━━━
{shop}`,
    "مختصر — سريع": `📦 تسليم بضاعة
📋 {invoice_no} — {date}
🏢 {name}
{items_table}
💰 {total} جنيه
{shop}`,
    "بريميوم — فاخر": `┌─ {shop} ─┐

📦 إشعار تسليم بضاعة

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُستلم: {name}

{items_table}

💰 الإجمالي: {total} جنيه

تم التسليم بنجاح ✅
{shop}`,
  },
  transfer_receive: {
    "قياسي — مفصل": `📦 تم استلام البضاعة
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُرسل: {name}

{items_table}

💰 إجمالي التكلفة: {total} جنيه
━━━━━━━━━━━━━━━━
{shop}`,
    "مختصر — سريع": `📦 استلام بضاعة
📋 {invoice_no} — {date}
🏢 {name}
{items_table}
💰 {total} جنيه
{shop}`,
    "بريميوم — فاخر": `┌─ {shop} ─┐

📦 إشعار استلام بضاعة

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُرسل: {name}

{items_table}

💰 الإجمالي: {total} جنيه

تم الاستلام بنجاح ✅
{shop}`,
  },
};

module.exports = {
  name: "187_whatsapp_new_template_categories",
  up(db) {
    addColumnIfMissing(db, "message_templates", "label", "TEXT");
    addColumnIfMissing(db, "message_templates", "channel", "TEXT NOT NULL DEFAULT 'both'");

    const hasTemplate = db.prepare("SELECT 1 FROM message_templates WHERE kind=?");
    const insertTemplate = db.prepare(
      "INSERT INTO message_templates (kind, label, body, channel) VALUES (?,?,?,'whatsapp')"
    );
    const insertVariant = db.prepare(
      "INSERT INTO message_template_variants (category, label, body, channel, is_active) VALUES (?,?,?,'whatsapp',?)"
    );
    const hasVariant = db.prepare("SELECT 1 FROM message_template_variants WHERE category=? AND label=?");

    for (const [category, label] of Object.entries(NEW_CATEGORIES)) {
      const variants = DEFAULT_VARIANTS[category];
      const firstKey = Object.keys(variants)[0];
      const firstBody = variants[firstKey];

      // Seed the canonical message_templates row with the first variant body
      if (!hasTemplate.get(category)) {
        insertTemplate.run(category, label, firstBody);
      }

      // Seed all 3 default variants; first one is marked active
      let isFirst = true;
      for (const [varLabel, body] of Object.entries(variants)) {
        if (!hasVariant.get(category, varLabel)) {
          insertVariant.run(category, varLabel, body, isFirst ? 1 : 0);
        }
        isFirst = false;
      }
    }
  },
};
