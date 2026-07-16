// Add a "السبب" (reason) line to the return-payment Telegram template, and
// translate the payment method inside the body (the runtime now renders Arabic
// method labels — the template just interpolates {method}/{reason}).
//
// Only rewrites rows whose body is still the original seeded default, so an
// owner who customized the template keeps their version. Matches migrations
// 191 (detailed default) and 192 (short variant).
const OLD_DETAILED =
`↩️ *دفعة مرتجعة*
━━━━━━━━━━━━━━
العميل: {customer_name}
المبلغ: *{amount}*
الطريقة: {method}
التاريخ: {date}`;

const NEW_DETAILED =
`↩️ *دفعة مرتجعة*
━━━━━━━━━━━━━━
العميل: {customer_name}
المبلغ: *{amount}*
الطريقة: {method}
السبب: {reason}
التاريخ: {date}`;

const OLD_SHORT = `↩️ دفعة مرتجعة: {customer_name} | {amount} | {method}`;
const NEW_SHORT = `↩️ دفعة مرتجعة: {customer_name} | {amount} | {method} | {reason}`;

module.exports = {
  name: "206_telegram_return_payment_reason",
  up(db) {
    const category = "telegram_return_payment";

    // 1. Detailed variant + canonical message_templates row.
    try {
      db.prepare(
        "UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE category=? AND body=?"
      ).run(NEW_DETAILED, category, OLD_DETAILED);
    } catch (_) { /* table may not exist on un-migrated DB */ }

    try {
      db.prepare(
        "UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=? AND body=?"
      ).run(NEW_DETAILED, category, OLD_DETAILED);
    } catch (_) {}

    // 2. Short variant.
    try {
      db.prepare(
        "UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE category=? AND body=?"
      ).run(NEW_SHORT, category, OLD_SHORT);
    } catch (_) {}
  },
};
