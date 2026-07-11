// The receipt/return_receipt templates only had {name} {invoice_no} {total} {shop}
// — too sparse, and {total} used to carry a baked-in currency symbol while the
// template text *also* spelled out "جنيه", producing "٢١٠ ج جنيه" (duplicated).
// client/src/utils/whatsappReceiptMessage.js now emits a plain number for
// {total} and exposes {date} {payment_type} {discount} {items_count} {cashier}.
// Only rewrites rows still holding the old default body — a body the owner
// already customized (different text) is left untouched.
const OLD_DEFAULTS = {
  receipt: "مرحباً {name}،\nشكراً لتسوقك معنا 🛍️\nفاتورة رقم: {invoice_no}\nالإجمالي: {total} جنيه\n{shop}",
  return_receipt: "مرحباً {name}،\nتم استلام مرتجعك بنجاح ✅\nفاتورة المرتجع رقم: {invoice_no}\nإجمالي المسترد: {total} جنيه\n{shop}",
};
const NEW_DEFAULTS = {
  receipt: "مرحباً {name}،\nشكراً لتسوقك معنا 🛍️\nفاتورة رقم: {invoice_no}\nالتاريخ: {date}\nعدد الأصناف: {items_count}\nطريقة الدفع: {payment_type}\nالإجمالي: {total} جنيه\n{shop}",
  return_receipt: "مرحباً {name}،\nتم استلام مرتجعك بنجاح ✅\nفاتورة المرتجع رقم: {invoice_no}\nالتاريخ: {date}\nإجمالي المسترد: {total} جنيه\n{shop}",
};

module.exports = {
  name: "178_richer_receipt_templates",
  up(db) {
    for (const [kind, oldBody] of Object.entries(OLD_DEFAULTS)) {
      const row = db.prepare("SELECT body FROM message_templates WHERE kind=?").get(kind);
      if (row && row.body === oldBody) {
        db.prepare("UPDATE message_templates SET body=?, updated_at=datetime('now') WHERE kind=?").run(NEW_DEFAULTS[kind], kind);
      }
      const variant = db.prepare("SELECT id, body FROM message_template_variants WHERE category=? AND is_active=1").get(kind);
      if (variant && variant.body === oldBody) {
        db.prepare("UPDATE message_template_variants SET body=?, updated_at=datetime('now') WHERE id=?").run(NEW_DEFAULTS[kind], variant.id);
      }
    }
  },
};
