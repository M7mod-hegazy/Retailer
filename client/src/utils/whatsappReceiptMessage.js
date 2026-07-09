// Resolve a WhatsApp message template by replacing {placeholders}.
// Supported placeholders: {name}, {invoice_no}, {total}, {shop}

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

export function buildWhatsAppReceiptMessage({
  template,
  customerName,
  walkInName,
  invoiceNo,
  total,
  shopName,
  currencySymbol = "ج",
}) {
  const name = customerName || walkInName || "عميلنا";
  const totalText = total !== undefined && total !== null
    ? `${Number(total).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currencySymbol}`
    : "";

  return resolveTemplate(template, {
    name,
    invoice_no: invoiceNo || "",
    total: totalText,
    shop: shopName || "",
  });
}
