// Seeds rich, detailed template variants for every WhatsApp auto-send category.
// Each category gets 2-3 variants (Standard, Short, Premium) so the owner has
// real choices when composing messages — from the sparse old defaults.
// Only inserts if the category has zero variants yet (first-run / fresh install).
module.exports = {
  name: "180_rich_template_variants",
  up(db) {
    const hasVariant = (cat) =>
      db.prepare("SELECT 1 FROM message_template_variants WHERE category=?").get(cat);

    const insertVariant = db.prepare(`
      INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at)
      VALUES (?,?,?,?,?,datetime('now'))
    `);

    const updateTemplate = db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=?");
    const updateActiveOthers = db.prepare("UPDATE message_template_variants SET is_active=0 WHERE category=?");

    // ─── receipt ──────────────────────────────────────────────────────
    if (!hasVariant("receipt")) {
      const standard = `مرحباً {name}،

🛍️  فاتورة بيع  🛍️
━━━━━━━━━━━━━━━━━━━━
رقم الفاتورة: {invoice_no}
التاريخ: {date}
الكاشير: {cashier}

{items_table}

طريقة الدفع: {payment_type}
━━━━━━━━━━━━━━━━━━━━

💰 الإجمالي: {total} جنيه
💰 الخصم: {discount}

شكراً لتسوقك معنا، نتمنى لك يوماً سعيداً! 🌟
{shop}`;

      const short = `مرحباً {name}،
شكراً لتسوقك معنا 🛍️

فاتورة: {invoice_no}
{items_table}
المبلغ: {total} جنيه
{shop}`;

      const premium = `┌── {shop} ──┐

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
{shop}`;

      updateActiveOthers.run("receipt");
      insertVariant.run("receipt", "قياسي — مفصل", standard, "whatsapp", 1);
      insertVariant.run("receipt", "مختصر — سريع", short, "whatsapp", 0);
      insertVariant.run("receipt", "بريميوم — فاخر", premium, "whatsapp", 0);
      updateTemplate.run(standard, "receipt");
    }

    // ─── return_receipt ──────────────────────────────────────────────
    if (!hasVariant("return_receipt")) {
      const standard = `مرحباً {name}،

✅  تم إتمام المرتجع بنجاح  ✅
━━━━━━━━━━━━━━━━━━━━
رقم المرتجع: {invoice_no}
التاريخ: {date}
الكاشير: {cashier}
━━━━━━━━━━━━━━━━━━━━

💳 طريقة الدفع: {payment_type}

💰 إجمالي المبلغ المسترد: {total} جنيه

نأسف لأي إزعاج، ونتمنى رضاك دائماً 🙏
{shop}`;

      const short = `مرحباً {name}،
تم استلام مرتجعك بنجاح ✅

رقم: {invoice_no}
المبلغ المسترد: {total} جنيه
{shop}`;

      updateActiveOthers.run("return_receipt");
      insertVariant.run("return_receipt", "قياسي — مفصل", standard, "whatsapp", 1);
      insertVariant.run("return_receipt", "مختصر — سريع", short, "whatsapp", 0);
      updateTemplate.run(standard, "return_receipt");
    }

    // ─── birthday ────────────────────────────────────────────────────
    if (!hasVariant("birthday")) {
      const standard = `🎂 كل عام وأنت بخير {name} 🎂

نهنئكم بمناسبة عيد ميلادكم السعيد 🎉
نتمنى لكم يوماً مليئاً بالفرح والسرور 🎈🎁

تعالوا واستمتعوا بخصم خاص بمناسبة عيد ميلادكم! 🎉
{shop}`;

      const short = `🎂 كل عام وأنت بخير {name} 🎂🎉🎈
{shop}`;

      const premium = `✨ {shop} ✨

بمناسبة عيد ميلاد {name} السعيد 🎂

نرسل لكم أطيب التهاني والتبريكات
ونتمنى لكم سنة مليئة بالنجاح والسعادة ❤️

🎁 تعالوا اليوم واستلموا هديتكم بمناسبة عيد ميلادكم! 🎁

مع فائق الاحترام،
{shop}`;

      updateActiveOthers.run("birthday");
      insertVariant.run("birthday", "قياسي — مفصل", standard, "whatsapp", 1);
      insertVariant.run("birthday", "مختصر — سريع", short, "whatsapp", 0);
      insertVariant.run("birthday", "بريميوم — فاخر", premium, "whatsapp", 0);
      updateTemplate.run(standard, "birthday");
    }

    // ─── debt ────────────────────────────────────────────────────────
    if (!hasVariant("debt")) {
      const formal = `مرحباً {name}،

⏰  تذكير برصيد مستحق  ⏰
━━━━━━━━━━━━━━━━━━━━
المبلغ المطلوب: {amount} جنيه
━━━━━━━━━━━━━━━━━━━━

نأمل منكم التكرم بتسوية الرصيد المستحق
في أقرب وقت ممكن.

شاكرين لكم حسن تعاونكم 🙏
{shop}`;

      const short = `مرحباً {name}،
تذكير: لديك رصيد مستحق بقيمة {amount} جنيه ⏰
نأمل سرعة التسوية 🙏
{shop}`;

      const friendly = `مرحباً {name} العزيز،

تحية طيبة وبعد،

نذكركم بوجود رصيد مستحق بقيمة {amount} جنيه 💼
يسعدنا استقبالكم في المعرض لتسوية الرصيد
في الوقت المناسب لكم.

وجودكم شرف لنا ❤️
{shop}`;

      updateActiveOthers.run("debt");
      insertVariant.run("debt", "رسمي — مهذب", formal, "whatsapp", 1);
      insertVariant.run("debt", "مختصر — سريع", short, "whatsapp", 0);
      insertVariant.run("debt", "ودود — لطيف", friendly, "whatsapp", 0);
      updateTemplate.run(formal, "debt");
    }
  },
};
