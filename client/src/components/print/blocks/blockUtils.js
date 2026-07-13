export const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV",
  receipt_header: "أهلاً وسهلاً — نرحب بكم في متجرنا", receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 12, footer_font_size: 10,
  item_font_size: 12, print_font: "Tajawal", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  thermal_print_column_keys: null,
  margin_top: 4, margin_side: 4, qr_size: 44, qr_alignment: "right", qr_content: "",
  qr_mode: "free_text", print_numerals: "western",
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
  show_notes: true, receipt_notes: "",
  show_watermark: false, show_signature_lines: false, show_barcode_line: false,
  show_receiver_signature: false,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
  address_font_size: 9, address_alignment: "right",
  tax_id_font_size: 9, tax_id_alignment: "right",
  // Thermal contrast guard: coerce too-light colors to #000 on roll output
  // (1-bit heads can't dither light grays into anything visible).
  thermal_pure_black: true,
};

export const g = (s, k) => {
  const raw = (s[k] !== undefined && s[k] !== null) ? s[k] : DEFAULTS[k];
  if (k.startsWith("show_") || k.startsWith("logo_on_") || k === "thermal_pure_black") {
    if (raw === 0 || raw === "0" || raw === "false") return false;
    if (raw === 1 || raw === "1" || raw === "true") return true;
  }
  return raw;
};

/**
 * Perceived luminance (0=black..1=white) of a #rgb/#rrggbb color.
 * Returns 0 for anything unparseable (named colors, rgb()) — treated as dark,
 * i.e. left alone by the thermal guard.
 */
export function colorLuminance(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color || "").trim());
  if (!m) return 0;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const gr = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * gr + 0.0722 * b;
}

/**
 * Thermal color guard: on 1-bit thermal paper, light colors dither to nothing.
 * When `thermal_pure_black` is on (default), colors too light to print are
 * coerced to pure black for the roll family.
 */
export function rollSafeColor(s, color) {
  if (!color || !g(s, "thermal_pure_black")) return color;
  return colorLuminance(color) > 0.55 ? "#000" : color;
}

/** Legibility floors for thermal output (203dpi heads blur smaller text). */
export const ROLL_MIN_BODY_PX = 10;
export const ROLL_MIN_TABLE_PX = 9;

/** Clamp a roll font-size (px) to its legible floor. */
export function rollClampFontPx(px, min = ROLL_MIN_BODY_PX) {
  const n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return min;
  return Math.max(min, n);
}

/** Priority order for thermal columns — highest first. Used for auto-hide when over limit. */
const THERMAL_COL_PRIORITY = ["name", "qty", "total", "price", "unit", "discount"];

/** Default visible columns for a given roll paper size. */
export function defaultThermalKeys(paperMm) {
  if (paperMm <= 58) return ["name", "qty", "total"];
  return ["name", "qty", "price", "total"];
}

/** Max visible thermal columns for a given paper size. */
export function maxThermalColumns(paperMm) {
  return paperMm <= 58 ? 4 : 5;
}

/** Enforce column limit: drop lowest-priority columns when over max. */
export function enforceThermalColumnLimit(keys, paperMm) {
  const max = maxThermalColumns(paperMm);
  if (!Array.isArray(keys) || keys.length <= max) return keys;
  const priority = {};
  THERMAL_COL_PRIORITY.forEach((k, i) => priority[k] = i);
  const sorted = [...keys].sort((a, b) => (priority[a] ?? 999) - (priority[b] ?? 999));
  return sorted.slice(0, max);
}

/** Resolve effective thermal columns for a settings object. */
export function resolveThermalColumns(s) {
  const paper = rollPaperWidthMm(s);
  const raw = s?.thermal_print_column_keys;
  if (Array.isArray(raw) && raw.length > 0) {
    return enforceThermalColumnLimit(raw, paper);
  }
  return defaultThermalKeys(paper);
}

/** Physical roll paper width in mm for the active receipt size. Accepts custom
 *  widths ("57mm", "76mm", "110mm", …) in addition to the standard 58/80. */
export function rollPaperWidthMm(s) {
  const raw = String(g(s, "receipt_width") || "80mm");
  const mm = parseFloat(raw);
  if (Number.isFinite(mm) && mm >= 20 && mm <= 210) return mm;
  return 80;
}

/**
 * Standard printable band (mm) for a roll size — what a real thermal head can
 * actually reach, narrower than the paper. Used as the default so content isn't
 * clipped at the paper edge out of the box. (80mm paper ≈ 72mm, 58mm ≈ 48mm;
 * other widths use the common head margins until calibrated.)
 */
export function rollDefaultPrintWidthMm(paperMm) {
  if (paperMm === 58) return 48;
  if (paperMm === 80) return 72;
  return Math.max(20, paperMm - (paperMm <= 60 ? 10 : 8));
}

/**
 * Effective printed content width in mm: the calibrated band (`print_area_width`)
 * when explicitly set, otherwise the standard printable band for the paper size.
 * Never wider than the paper.
 */
export function rollPrintWidthMm(s) {
  const paper = rollPaperWidthMm(s);
  const calibrated = Number(g(s, "print_area_width")) || 0;
  const band = calibrated > 0 ? calibrated : rollDefaultPrintWidthMm(paper);
  return Math.min(paper, band);
}

/**
 * Horizontal calibration shift in mm (±). Slides the printed band inside the
 * paper so it lands on the head's real printable area. Positive = toward the
 * physical right edge of the paper.
 */
export function rollShiftXMm(s) {
  const shift = Number(g(s, "print_shift_x"));
  return Number.isFinite(shift) ? shift : 0;
}

/**
 * Physical left offset (mm) of the printed band inside the paper: centered
 * band plus the calibration shift, clamped so the band never leaves the paper.
 */
export function rollBandLeftMm(s) {
  const paper = rollPaperWidthMm(s);
  const band = rollPrintWidthMm(s);
  const centered = (paper - band) / 2;
  const left = centered + rollShiftXMm(s);
  return Math.min(Math.max(0, left), Math.max(0, paper - band));
}

export const HEAVY_NUM = { fontWeight: 900 };
export const HEAVY_VAL = { fontWeight: 900 };

export function parseJsonArray(v) {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

const ARABIC_INDIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * Maps western digits 0-9 to Arabic-Indic ٠-٩ in `str` when settings have
 * `print_numerals: "arabic"`; returns `str` unchanged otherwise (default
 * "western"). Non-digit characters, including ".", pass through untouched.
 * Only call this at display choke points (prices/qty/totals) — never on
 * barcode content, QR content, or invoice numbers, which must stay
 * machine-readable western digits.
 */
export function formatPrintDigits(s, str) {
  const value = String(str);
  if (g(s, "print_numerals") !== "arabic") return value;
  return value.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * Format a number to at most 2 decimal places for display. When `s` (settings)
 * is passed, also applies `formatPrintDigits` — the shared choke point that
 * lets item prices/qty/totals and money blocks honor `print_numerals`.
 * Omitting `s` keeps the legacy western-digit behavior unchanged.
 */
export function smartFormat(n, s) {
  const num = Number(n || 0);
  const rounded = Math.round(num * 100) / 100;
  const str = rounded.toString();
  return s !== undefined ? formatPrintDigits(s, str) : str;
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
  const rawPayments = invoice.payments;
  const paymentsArr = Array.isArray(rawPayments)
    ? rawPayments
    : (typeof rawPayments === "string" ? (() => { try { return JSON.parse(rawPayments); } catch { return []; } })() : []);
  const paid = paymentsArr.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return { subtotal, totalDiscount, totalIncrease: headerIncrease, taxAmount, grandTotal, paid, change: paid - grandTotal, taxRate };
}
