// Adds the extra template variants (Standard, Short, Premium) for categories that
// only had 1 default variant from earlier migrations (177/178). Does NOT override
// existing variants — only inserts if the specific label is missing per category.
module.exports = {
  name: "181_seed_extra_template_variants",
  up(db) {
    const missingLabel = (cat, label) =>
      !db.prepare("SELECT 1 FROM message_template_variants WHERE category=? AND label=?").get(cat, label);

    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?,?,?,?,?,datetime('now'))
    `);

    // ─── receipt ──────────────────────────────────────────────────────
    if (missingLabel("receipt", "مختصر — سريع")) {
      insertVariant.run("receipt", "مختصر — سريع",
`مرحباً {name}،
شكراً لتسوقك معنا 🛍️

فاتورة: {invoice_no}
{items_table}
المبلغ: {total} جنيه
{shop}`, "whatsapp", 0);
    }
    if (missingLabel("receipt", "بريميوم — فاخر")) {
      insertVariant.run("receipt", "بريميوم — فاخر",
`┌── {shop} ──┐

شكراً لاختيارك {name} العزيز،
نقدر ثقتك بنا ❤️

📄 فاتورة رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

💳 {payment_type}

💰 الإجمالي: {total} جنيه
💰 الخصم: {discount}

نتشرف بخدمتك دائماً ✨
{shop}`, "whatsapp", 0);
    }

    // ─── return_receipt ──────────────────────────────────────────────
    if (missingLabel("return_receipt", "مختصر — سريع")) {
      insertVariant.run("return_receipt", "مختصر — سريع",
`مرحباً {name}،
تم استلام مرتجعك بنجاح ✅

رقم: {invoice_no}
المبلغ المسترد: {total} جنيه
{shop}`, "whatsapp", 0);
    }

    // ─── birthday ────────────────────────────────────────────────────
    if (missingLabel("birthday", "مختصر — سريع")) {
      insertVariant.run("birthday", "مختصر — سريع",
`🎂 كل عام وأنت بخير {name} 🎂🎉🎈
{shop}`, "whatsapp", 0);
    }
    if (missingLabel("birthday", "بريميوم — فاخر")) {
      insertVariant.run("birthday", "بريميوم — فاخر",
`✨ {shop} ✨

بمناسبة عيد ميلاد {name} السعيد 🎂

نرسل لكم أطيب التهاني والتبريكات
ونتمنى لكم سنة مليئة بالنجاح والسعادة ❤️

🎁 تعالوا اليوم واستلموا هديتكم بمناسبة عيد ميلادكم! 🎁

مع فائق الاحترام،
{shop}`, "whatsapp", 0);
    }

    // ─── debt ────────────────────────────────────────────────────────
    if (missingLabel("debt", "مختصر — سريع")) {
      insertVariant.run("debt", "مختصر — سريع",
`مرحباً {name}،
تذكير: لديك رصيد مستحق بقيمة {amount} جنيه ⏰
نأمل سرعة التسوية 🙏
{shop}`, "whatsapp", 0);
    }
    if (missingLabel("debt", "ودود — لطيف")) {
      insertVariant.run("debt", "ودود — لطيف",
`مرحباً {name} العزيز،

تحية طيبة وبعد،

نذكركم بوجود رصيد مستحق بقيمة {amount} جنيه 💼
يسعدنا استقبالكم في المعرض لتسوية الرصيد
في الوقت المناسب لكم.

وجودكم شرف لنا ❤️
{shop}`, "whatsapp", 0);
    }
  },
};
