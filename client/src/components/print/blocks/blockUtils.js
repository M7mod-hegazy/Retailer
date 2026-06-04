export const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV",
  receipt_header: "", receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 11, footer_font_size: 10,
  item_font_size: 11, print_font: "monospace", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44,
  show_cashier_name: true, show_customer_name: true, show_tax: true,
  show_footer: true, show_qr: false, show_logo: true,
  show_discount_line: true, show_payment_details: true, show_subtotal: true,
  show_phone: true, show_address: true, show_tax_id: true,
  show_branch: true, show_invoice_date: true,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
  address_font_size: 9, address_alignment: "right",
  tax_id_font_size: 9, tax_id_alignment: "right",
};

export const g = (s, k) => {
  const raw = (s[k] !== undefined && s[k] !== null) ? s[k] : DEFAULTS[k];
  if (k.startsWith("show_") || k.startsWith("logo_on_")) {
    if (raw === 0 || raw === "0" || raw === "false") return false;
    if (raw === 1 || raw === "1" || raw === "true") return true;
  }
  return raw;
};

export function parseJsonArray(v) {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

export function computeTotals(invoice = {}, s = {}) {
  const lines = invoice.lines || [];
  const taxRate = parseFloat(g(s, "tax_rate") || 0);
  const subtotal = lines.reduce((sum, l) => sum + ((Number(l.unit_price) || Number(l.unit_cost) || 0) * Number(l.quantity)), 0);
  // Header-level خصم/زيادة (e.g. on returns) — 0 for documents that don't pass them.
  const headerDiscount = Number(invoice.discount) || 0;
  const headerIncrease = Number(invoice.increase) || 0;
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount_amount) || 0), 0) + headerDiscount;
  const taxAmount = g(s, "show_tax") !== false ? (subtotal - totalDiscount) * (taxRate / 100) : 0;
  const grandTotal = subtotal - totalDiscount + taxAmount + headerIncrease;
  const paid = (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { subtotal, totalDiscount, totalIncrease: headerIncrease, taxAmount, grandTotal, paid, change: paid - grandTotal, taxRate };
}
