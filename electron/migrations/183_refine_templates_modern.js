module.exports = {
  name: "183_refine_templates_modern",
  up(db) {
    const findByLabel = (cat, label) =>
      db.prepare("SELECT id, label, body FROM message_template_variants WHERE category=? AND label=?").get(cat, label);

    const updateBody = (cat, label, body) => {
      const row = findByLabel(cat, label);
      if (row) {
        db.prepare("UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE id=?").run(body, row.id);
        return row.id;
      }
      return null;
    };

    const syncActive = (cat) => {
      const active = db.prepare("SELECT body FROM message_template_variants WHERE category=? AND is_active=1").get(cat);
      if (active) {
        db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=?").run(active.body, cat);
      }
    };

    // ── receipt ───────────────
    updateBody("receipt", "قياسي — مفصل",
      `مرحباً {name}،

🛍️ فاتورة بيع
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

شكراً لتسوقك معنا ✨
{shop}`
    );
    updateBody("receipt", "مختصر — سريع",
      `مرحباً {name}،
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 {total} جنيه
{shop}`
    );
    updateBody("receipt", "بريميوم — فاخر",
      `┌─ {shop} ─┐

{name} العزيز،
شكراً لاختيارنا ❤️

📋 فاتورة رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

نتشرف بخدمتك دائماً ✨
{shop}`
    );

    // ── return_receipt ─────────
    updateBody("return_receipt", "قياسي — مفصل",
      `مرحباً {name}،

✅ تم إتمام المرتجع
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 المسترد: {total} جنيه

نأسف للإزعاج 🙏
{shop}`
    );
    updateBody("return_receipt", "مختصر — سريع",
      `مرحباً {name}،
✅ تم استلام المرتجع
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 المسترد: {total} جنيه
{shop}`
    );
    updateBody("return_receipt", "بريميوم — فاخر",
      `┌─ {shop} ─┐

{name} العزيز،

✅ تمت معالجة المرتجع

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

المنتجات المسترجعة:
{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 المسترد: {total} جنيه

نعتذر للإزعاج ❤️
{shop}`
    );

    // ── birthday ───────────────
    updateBody("birthday", "قياسي — مفصل",
      `🎂 كل عام وأنت بخير {name} 🎂

نهنئك بعيد ميلادك السعيد 🎉
نتمنى لك يوماً رائعاً 🎈

🎁 خصم خاص بمناسبة عيد ميلادك!
تفضل بزيارة {shop} اليوم

مع أطيب التمنيات 🎀
{shop}`
    );
    updateBody("birthday", "مختصر — سريع",
      `🎂 كل عام وأنت بخير {name} 🎂🎉
🎁 خصم خاص بعيد ميلادك
تفضل بزيارة {shop} اليوم ❤️
{shop}`
    );
    updateBody("birthday", "بريميوم — فاخر",
      `✨ {shop} ✨

بمناسبة عيد ميلاد {name} 🎂

نرسل لك أطيب التهاني ❤️
ونتمنى لك سنة رائعة 🎉🎈

🎁 هديتك بانتظارك في المعرض

مع فائق الاحترام 🎀
{shop}`
    );

    // ── debt ───────────────────
    updateBody("debt", "رسمي — مهذب",
      `مرحباً {name}،

⏰ تذكير برصيد مستحق
━━━━━━━━━━━━━━━━
💰 المبلغ: {amount} جنيه
━━━━━━━━━━━━━━━━

نأمل التكرم بتسويته قريباً

للتواصل: {shop}

مع الشكر والتقدير 🙏
{shop}`
    );
    updateBody("debt", "مختصر — سريع",
      `مرحباً {name}،
⏰ تذكير: رصيد {amount} جنيه
نأمل التسوية 🙏
{shop}`
    );
    updateBody("debt", "ودود — لطيف",
      `مرحباً {name} العزيز،

تحية طيبة 🌸

⏰ رصيد مستحق: {amount} جنيه

يسعدنا استقبالك في {shop}
لتسوية الرصيد بوقت مناسب لك

وجودكم شرف لنا ❤️
{shop}`
    );

    // ── sync active → message_templates ─────
    for (const cat of ["receipt", "return_receipt", "birthday", "debt"]) {
      syncActive(cat);
    }
  },
};
