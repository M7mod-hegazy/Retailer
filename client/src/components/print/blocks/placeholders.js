/**
 * placeholders.js — dynamic tokens for custom/header/footer print text.
 *
 * Users type Arabic tokens like "شكراً {اسم_العميل}!" in the Studio (it offers
 * an insert-variable picker) and they resolve from the invoice at render time.
 * Pure string replacement — no expression evaluation, no code execution.
 * Unknown tokens are left as-is so typos are visible on the preview.
 */

import { computeTotals, smartFormat, g } from "./blockUtils";

export const PLACEHOLDER_KEYS = [
  "رقم_الفاتورة", "اسم_العميل", "التاريخ", "الوقت", "الإجمالي",
  "الكاشير", "الفرع", "اسم_الشركة", "الهاتف", "الرقم_الضريبي",
];

/** Build the token→value map for one invoice + settings. */
export function placeholderValues(invoice = {}, s = {}) {
  const dt = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const { grandTotal } = computeTotals(invoice, s);
  return {
    "رقم_الفاتورة": invoice.invoice_number || invoice.doc_number || invoice.number || "",
    "اسم_العميل": invoice.customer_name || "",
    "التاريخ": dt.toLocaleDateString("ar-EG"),
    "الوقت": dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    "الإجمالي": `${g(s, "currency_symbol")} ${smartFormat(grandTotal, s)}`,
    "الكاشير": invoice.cashier_name || invoice.cashier || "",
    "الفرع": invoice.branch_name || s.branch_name || "",
    "اسم_الشركة": s.company_name || "",
    "الهاتف": s.phone || s.company_phone || "",
    "الرقم_الضريبي": s.tax_id || "",
  };
}

/** Replace {token} occurrences in text; unknown tokens stay visible. */
export function resolvePlaceholders(text, invoice, s) {
  const str = String(text || "");
  if (!str.includes("{")) return str;
  const values = placeholderValues(invoice, s);
  return str.replace(/\{([^{}]+)\}/g, (match, key) => {
    const k = key.trim();
    return Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : match;
  });
}
