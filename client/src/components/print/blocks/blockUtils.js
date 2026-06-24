export const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV",
  receipt_header: "", receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 12, footer_font_size: 10,
  item_font_size: 12, print_font: "Tahoma", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44, qr_alignment: "right", qr_content: "",
  // Thermal print-head calibration. A real 80mm/58mm head can only print across a
  // band narrower than the paper (≈72mm/48mm) and that band is often offset from
  // the paper edges, so a receipt laid out edge-to-edge gets clipped on one side
  // and shows blank feed on the other — and symmetric margins can't fix the
  // asymmetry. `print_area_width` (mm, 0 = full paper) narrows the printed content
  // to the head's printable band; `print_shift_x` (mm, ±) slides it into that band.
  print_area_width: 0, print_shift_x: 0,
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

/** Physical roll paper width in mm for the active receipt size. */
export function rollPaperWidthMm(s) {
  return g(s, "receipt_width") === "58mm" ? 58 : 80;
}

/**
 * Standard printable band (mm) for a roll size — what a real thermal head can
 * actually reach, narrower than the paper. Used as the default so content isn't
 * clipped at the paper edge out of the box. (80mm paper ≈ 72mm, 58mm ≈ 48mm.)
 */
export function rollDefaultPrintWidthMm(paperMm) {
  return paperMm === 58 ? 48 : 72;
}

/**
 * Effective printed content width in mm: the calibrated band (`print_area_width`)
 * when explicitly set, otherwise the standard printable band for the paper size.
 * Never wider than the paper.
 */
export function rollPrintWidthMm(s) {
  const paper = rollPaperWidthMm(s);
  return paper - 2;
}

export const HEAVY_NUM = { fontWeight: 900 };
export const HEAVY_VAL = { fontWeight: 900 };

export function parseJsonArray(v) {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

export function smartFormat(n) {
  const num = Number(n || 0);
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString();
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
