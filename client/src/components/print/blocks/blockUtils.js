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
  show_notes: true,
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
  const subtotal = lines.reduce((sum, l) => sum + ((Number(l.unit_price) || Number(l.unit_cost) || 0) * Number(l.quantity)), 0);
  const headerDiscount = Number(invoice.discount) || 0;
  const headerIncrease = Number(invoice.increase) || 0;
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount_amount) || 0), 0) + headerDiscount;

  // Documents that carry tax snapshot fields are authoritative — tax_amount 0 means
  // "no tax was charged", NOT "derive from settings" (otherwise untaxed invoices would
  // print a phantom tax line). Stored docs without the fields (purchases, legacy
  // objects) that still carry a stored total get no derived tax either; the
  // settings-based derivation remains only for ad-hoc preview objects with no total.
  const hasTaxSnapshot = invoice.tax_amount !== undefined || invoice.tax_enabled !== undefined;
  const hasStoredTotal = invoice.total !== undefined && invoice.total !== null;
  let taxAmount, taxRate;
  if (hasTaxSnapshot) {
    taxAmount = Number(invoice.tax_amount) || 0;
    taxRate = Number(invoice.tax_rate) || 0;
  } else if (hasStoredTotal) {
    taxAmount = 0;
    taxRate = 0;
  } else {
    taxRate = parseFloat(g(s, "tax_rate") || 0);
    taxAmount = g(s, "show_tax") !== false ? (subtotal - totalDiscount) * (taxRate / 100) : 0;
  }

  // Use invoice.total as authoritative if present (handles exclusive vs inclusive correctly).
  const grandTotal = Number(invoice.total) > 0 ? Number(invoice.total) : subtotal - totalDiscount + taxAmount + headerIncrease;
  const paid = (invoice.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { subtotal, totalDiscount, totalIncrease: headerIncrease, taxAmount, grandTotal, paid, change: paid - grandTotal, taxRate };
}
