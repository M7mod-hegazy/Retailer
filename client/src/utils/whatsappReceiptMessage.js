// Resolve a WhatsApp message template by replacing {placeholders}.
// Supported placeholders: {name}, {invoice_no}, {total}, {shop}, {date},
// {payment_type}, {discount}, {items_count}, {cashier}, {items_table},
// {payment_breakdown}
import { PAYMENT_LABELS } from "../components/operations/docHelpers";

export function resolveTemplate(body, vars) {
  if (!body) return "";
  return body.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{${key}}`));
}

export function normalizeEgyptPhone(raw) {
  if (!raw) return "";
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "2" + d;
  if (!d.startsWith("2") && d.length === 10) d = "20" + d;
  return d;
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function formatPaymentBreakdown(payments) {
  if (!payments || payments.length === 0) return "";
  return payments
    .map(p => `${PAYMENT_LABELS[p.method] || p.method_name || p.method}: ${formatMoney(p.amount)} جنيه`)
    .join("\n");
}

function formatItemsTable(items) {
  if (!items || items.length === 0) return "";
  const rows = items.map(
    (it) =>
      `• ${it.item_name || it.name || "منتج"}\n  ${formatMoney(it.quantity || 0)} × ${formatMoney(it.unit_price || 0)} = ${formatMoney(it.line_total || it.total || 0)}`
  );
  return ["━━━ الأصناف ━━━", ...rows, "━━━━━━━━━━━━━━━━"].join("\n");
}

export function buildWhatsAppReceiptMessage({
  template,
  customerName,
  walkInName,
  invoiceNo,
  total,
  shopName,
  createdAt,
  paymentType,
  discount,
  itemsCount,
  cashierName,
  items,
  payments,
}) {
  const name = customerName || walkInName || "عميلنا";
  // total is a plain formatted number — templates spell out the currency word
  // themselves (e.g. "{total} جنيه"), so it must not carry a symbol already.
  const totalText = total !== undefined && total !== null ? formatMoney(total) : "";
  const dateText = createdAt
    ? new Date(createdAt).toLocaleString("ar-EG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  return resolveTemplate(template, {
    name,
    invoice_no: invoiceNo || "",
    total: totalText,
    shop: shopName || "",
    date: dateText,
    payment_type: PAYMENT_LABELS[paymentType] || paymentType || "",
    discount: discount ? formatMoney(discount) : "",
    items_count: itemsCount !== undefined && itemsCount !== null ? String(itemsCount) : "",
    cashier: cashierName || "",
    items_table: formatItemsTable(items),
    payment_breakdown: formatPaymentBreakdown(payments),
  });
}
