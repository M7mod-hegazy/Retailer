// Rewrites all template variant bodies with comprehensive content that includes
// payment breakdown, discount, cashier, date, items_table, and other details.
// Renames old label names (e.g. "إيصال الشراء" → "قياسي — مفصل") to a consistent
// naming convention. Sets the Standard variant as active for most categories.
module.exports = {
  name: "182_refine_template_variants",
  up(db) {
    // ── helpers ──────────────────────────────────────────────────────
    const findByLabel = (cat, label) =>
      db.prepare("SELECT id, label FROM message_template_variants WHERE category=? AND label=?").get(cat, label);

    const renameLabel = (cat, oldLabel, newLabel) => {
      const row = findByLabel(cat, oldLabel);
      if (row) {
        db.prepare("UPDATE message_template_variants SET label=?, updated_at=datetime('now') WHERE id=?").run(newLabel, row.id);
        return row.id;
      }
      return null;
    };

    const upsert = (cat, label, body, isActive) => {
      let existing = findByLabel(cat, label);
      if (existing) {
        db.prepare("UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE id=?").run(body, existing.id);
        return existing.id;
      }
      const result = db.prepare(
        "INSERT INTO message_template_variants (category, label, body, channel, is_active, updated_at) VALUES (?,?,?,?,?,datetime('now'))"
      ).run(cat, label, body, "whatsapp", 0);
      return result.lastInsertRowid;
    };

    const setActive = (cat, label) => {
      const row = findByLabel(cat, label);
      if (!row) return;
      db.prepare("UPDATE message_template_variants SET is_active=0 WHERE category=?").run(cat);
      db.prepare("UPDATE message_template_variants SET is_active=1 WHERE id=?").run(row.id);
    };

    const syncTemplate = (cat, label) => {
      const active = db.prepare("SELECT * FROM message_template_variants WHERE category=? AND is_active=1").get(cat);
      if (active) {
        db.prepare("UPDATE message_templates SET body=?, channel=?, updated_at=datetime('now') WHERE kind=?").run(active.body, active.channel || "whatsapp", cat);
      }
    };

    // ── rename old labels ───────────────────────────────────────────
    const RENAMES = {
      receipt:        { "إيصال الشراء": "قياسي — مفصل" },
      return_receipt: { "إيصال المرتجع": "قياسي — مفصل" },
      birthday:       { "عيد الميلاد":   "قياسي — مفصل" },
      debt:           { "تذكير الدين":   "رسمي — مهذب" },
    };
    for (const [cat, mapping] of Object.entries(RENAMES)) {
      for (const [oldLbl, newLbl] of Object.entries(mapping)) {
        renameLabel(cat, oldLbl, newLbl);
      }
    }

    // ── receipt ─────────────────────────────────────────────────────
    const receiptStandard = `مرحباً {name}،

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
{shop}`;

    const receiptShort = `مرحباً {name}،
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 {total} جنيه
{shop}`;

    const receiptPremium = `┌─ {shop} ─┐

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
{shop}`;

    upsert("receipt", "قياسي — مفصل", receiptStandard, false);
    upsert("receipt", "مختصر — سريع", receiptShort, false);
    upsert("receipt", "بريميوم — فاخر", receiptPremium, false);
    setActive("receipt", "قياسي — مفصل");

    // ── return_receipt ──────────────────────────────────────────────
    const returnStandard = `مرحباً {name}،

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
{shop}`;

    const returnShort = `مرحباً {name}،
✅ تم استلام المرتجع
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 المسترد: {total} جنيه
{shop}`;

    const returnPremium = `┌─ {shop} ─┐

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
{shop}`;

    upsert("return_receipt", "قياسي — مفصل", returnStandard, false);
    upsert("return_receipt", "مختصر — سريع", returnShort, false);
    upsert("return_receipt", "بريميوم — فاخر", returnPremium, false);
    setActive("return_receipt", "قياسي — مفصل");

    // ── birthday ────────────────────────────────────────────────────
    const birthdayStandard = `🎂 كل عام وأنت بخير {name} 🎂

نهنئك بعيد ميلادك السعيد 🎉
نتمنى لك يوماً رائعاً 🎈

🎁 خصم خاص بمناسبة عيد ميلادك!
تفضل بزيارة {shop} اليوم

مع أطيب التمنيات 🎀
{shop}`;

    const birthdayShort = `🎂 كل عام وأنت بخير {name} 🎂🎉
🎁 خصم خاص بعيد ميلادك
تفضل بزيارة {shop} اليوم ❤️
{shop}`;

    const birthdayPremium = `✨ {shop} ✨

بمناسبة عيد ميلاد {name} 🎂

نرسل لك أطيب التهاني ❤️
ونتمنى لك سنة رائعة 🎉🎈

🎁 هديتك بانتظارك في المعرض

مع فائق الاحترام 🎀
{shop}`;

    upsert("birthday", "قياسي — مفصل", birthdayStandard, false);
    upsert("birthday", "مختصر — سريع", birthdayShort, false);
    upsert("birthday", "بريميوم — فاخر", birthdayPremium, false);
    setActive("birthday", "قياسي — مفصل");

    // ── debt ────────────────────────────────────────────────────────
    const debtFormal = `مرحباً {name}،

⏰ تذكير برصيد مستحق
━━━━━━━━━━━━━━━━
💰 المبلغ: {amount} جنيه
━━━━━━━━━━━━━━━━

نأمل التكرم بتسويته قريباً

للتواصل: {shop}

مع الشكر والتقدير 🙏
{shop}`;

    const debtShort = `مرحباً {name}،
⏰ تذكير: رصيد {amount} جنيه
نأمل التسوية 🙏
{shop}`;

    const debtFriendly = `مرحباً {name} العزيز،

تحية طيبة 🌸

⏰ رصيد مستحق: {amount} جنيه

يسعدنا استقبالك في {shop}
لتسوية الرصيد بوقت مناسب لك

وجودكم شرف لنا ❤️
{shop}`;

    upsert("debt", "رسمي — مهذب", debtFormal, false);
    upsert("debt", "مختصر — سريع", debtShort, false);
    upsert("debt", "ودود — لطيف", debtFriendly, false);
    setActive("debt", "رسمي — مهذب");

    // ── sync all active variants into message_templates ─────────────
    for (const cat of ["receipt", "return_receipt", "birthday", "debt"]) {
      syncTemplate(cat);
    }
  },
};
