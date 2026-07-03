/**
 * builtinPresets.js — curated built-in design presets (see presetEngine.js
 * for the preset shape and apply semantics).
 *
 * Authored as a matrix (header treatment × table style × totals style ×
 * density) then curated with real names, so the library stays maintainable.
 * Every preset remains fully editable after applying.
 *
 * Coverage: 20+ presets for EACH paper size (80mm, 58mm, A4, A5). Most roll
 * presets suit both roll sizes; a few are size-specific (dense multi-column
 * only makes sense on 80mm, ultra-compact only on 58mm). Same idea for page:
 * most suit both A4/A5, a few are size-specific.
 */

import { DEFAULT_ORDER } from "../families/defaultOrder";

/* ---- matrix vocabulary (shared fragments) ---- */

const ROLL_TABLE = {
  grid: { tableBorder: "grid" },
  lines: { tableBorder: "lines" },
  open: { tableBorder: "none" },
};

const PAGE_TABLE = {
  grid: { tableBorder: "grid", zebra: false },
  gridZebra: { tableBorder: "grid", zebra: true },
  lines: { tableBorder: "lines", zebra: false },
  linesZebra: { tableBorder: "lines", zebra: true },
  open: { tableBorder: "none", zebra: false },
  openZebra: { tableBorder: "none", zebra: true },
};

const COMPACT_FLAT = { body_font_size: 10, item_font_size: 10, footer_font_size: 9, header_font_size: 13 };
const COMFORT_FLAT = { body_font_size: 12, item_font_size: 12, footer_font_size: 10, header_font_size: 16 };
// Legibility-floor density for 58mm-only tickets (see ROLL_MIN_BODY_PX /
// ROLL_MIN_TABLE_PX in blockUtils.js) — never smaller than the printable floor.
const ULTRA_COMPACT_FLAT = { body_font_size: 10, item_font_size: 9, footer_font_size: 8, header_font_size: 12 };

const rollPreset = (id, name, nameEn, { table = "grid", density = "comfort", perBlock = {}, inserted = [], order, flat = {}, tags = [], sizes = ["80mm", "58mm"] } = {}) => ({
  id, family: "roll", sizes, name, nameEn, tags,
  layout: {
    ...(order ? { order } : {}),
    perBlock: { ...perBlock, items_table: { ...ROLL_TABLE[table], ...(perBlock.items_table || {}) } },
    inserted,
  },
  flat: {
    ...(density === "compact" ? COMPACT_FLAT : density === "ultra" ? ULTRA_COMPACT_FLAT : COMFORT_FLAT),
    ...flat,
  },
});

const pagePreset = (id, name, nameEn, { headerStyle = "band", table = "gridZebra", perBlock = {}, inserted = [], order, flat = {}, tags = [], sizes = ["A4", "A5"] } = {}) => ({
  id, family: "page", sizes, name, nameEn, tags,
  layout: {
    ...(order ? { order } : {}),
    headerStyle,
    perBlock: { ...perBlock, items_table: { ...PAGE_TABLE[table], ...(perBlock.items_table || {}) } },
    inserted,
  },
  flat,
});

/** Reorder an existing block within a base order (no add/remove — stays valid). */
function moveAfter(baseOrder, item, afterItem) {
  const arr = baseOrder.filter((x) => x !== item);
  const idx = arr.indexOf(afterItem);
  arr.splice(idx + 1, 0, item);
  return arr;
}

/* ---- column bundles (perBlock.items_table.columns) ---- */

const BILINGUAL_ROLL_COLS_4 = [
  { key: "name", label: "الصنف / Item", visible: true, align: "right" },
  { key: "qty", label: "كمية / Qty", visible: true, align: "center" },
  { key: "price", label: "سعر / Price", visible: true, align: "center" },
  { key: "total", label: "إجمالي / Total", visible: true, align: "left" },
];
const BILINGUAL_ROLL_COLS_3 = [
  { key: "name", label: "الصنف / Item", visible: true, align: "right" },
  { key: "qty", label: "كمية / Qty", visible: true, align: "center" },
  { key: "total", label: "إجمالي / Total", visible: true, align: "left" },
];
const KITCHEN_TICKET_COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
];
const DENSE_SUPERMARKET_COLS = [
  { key: "code", label: "كود", visible: true, align: "center" },
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
  { key: "price", label: "سعر", visible: true, align: "center" },
  { key: "total", label: "إجمالي", visible: true, align: "left" },
];
const WHOLESALE_DENSE_COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "unit", label: "الوحدة", visible: true, align: "center" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
  { key: "discount", label: "خصم", visible: true, align: "center" },
  { key: "total", label: "إجمالي", visible: true, align: "left" },
];
const FUEL_DENSE_COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "unit", label: "الوحدة", visible: true, align: "center" },
  { key: "qty", label: "الكمية", visible: true, align: "center" },
  { key: "price", label: "السعر", visible: true, align: "center" },
  { key: "total", label: "الإجمالي", visible: true, align: "left" },
];
const ULTRA_COMPACT_COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
  { key: "total", label: "إجمالي", visible: true, align: "left" },
];
const BILINGUAL_PAGE_COLS = [
  { key: "code", label: "كود / Code", visible: true, align: "center" },
  { key: "name", label: "الصنف / Item", visible: true, align: "right" },
  { key: "qty", label: "كمية / Qty", visible: true, align: "center" },
  { key: "price", label: "سعر / Price", visible: true, align: "center" },
  { key: "total", label: "الإجمالي / Total", visible: true, align: "left" },
];
const DELIVERY_PAGE_COLS = [
  { key: "code", label: "كود", visible: true, align: "center" },
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "unit", label: "الوحدة", visible: true, align: "center" },
  { key: "qty", label: "الكمية", visible: true, align: "center" },
];
const A4_DETAILED_COLS = [
  { key: "code", label: "كود", visible: true, align: "center" },
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "unit", label: "الوحدة", visible: true, align: "center" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
  { key: "price", label: "سعر", visible: true, align: "center" },
  { key: "discount", label: "خصم", visible: true, align: "center" },
  { key: "total", label: "إجمالي", visible: true, align: "left" },
];
const A4_WHOLESALE_COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "unit", label: "الوحدة", visible: true, align: "center" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
  { key: "discount", label: "خصم", visible: true, align: "center" },
  { key: "total", label: "إجمالي", visible: true, align: "left" },
];

// "barcode" already sits at the end of the roll default order (gated by
// show_barcode_line). The electronics preset wants it emphasized right under
// the items table — reorder the existing block instead of inserting a second
// one (inserting a duplicate "barcode" type would render it twice).
const ELECTRONICS_ROLL_ORDER = moveAfter(DEFAULT_ORDER.roll, "barcode", "items_table");

/* ---- curated library (extended by the preset authoring pass) ---- */

export const BUILTIN_PRESETS = [
  // ================= ROLL — core structural directions (80mm + 58mm) =================
  rollPreset("roll-classic", "كلاسيكي", "Classic", {
    table: "grid",
    perBlock: { company_name: { bold: true, fontSize: 16 } },
    tags: ["classic"],
  }),
  rollPreset("roll-modern", "عصري", "Modern", {
    table: "lines",
    perBlock: {
      company_name: { bold: true, fontSize: 16 },
      doc_number: { bold: true },
      grand_total: { bold: true, fontSize: 15 },
    },
    tags: ["modern"],
  }),
  rollPreset("roll-simple", "بسيط", "Simple", {
    table: "open",
    perBlock: { company_name: { fontSize: 15, marginBottom: 4 } },
    inserted: [
      { id: "ins-space-head", type: "spacer", after: "company_name", props: { height: 6 } },
      { id: "ins-space-items", type: "spacer", after: "items_table", props: { height: 6 } },
    ],
    tags: ["simple", "whitespace"],
  }),
  rollPreset("roll-framed", "مؤطَّر", "Framed", {
    table: "lines",
    inserted: [
      { id: "ins-div-head", type: "divider", after: "address", props: { style: "solid" } },
      { id: "ins-div-preitems", type: "divider", after: "customer", props: { style: "dash" } },
      { id: "ins-div-pretotals", type: "divider", after: "items_table", props: { style: "dash" } },
      { id: "ins-div-prefooter", type: "divider", after: "payments", props: { style: "solid" } },
    ],
    tags: ["framed"],
  }),
  rollPreset("roll-elegant-compact", "أنيق مضغوط", "Elegant Compact", {
    table: "lines", density: "compact",
    perBlock: { company_name: { bold: true, fontSize: 14 } },
    flat: { show_notes: false },
    tags: ["compact", "elegant"],
  }),
  rollPreset("roll-saver", "موفر — مضغوط", "Paper Saver", {
    table: "lines", density: "compact",
    flat: { show_notes: false, show_branch: false },
    tags: ["compact"],
  }),
  rollPreset("roll-saver-lite", "موفر — بلا حدود", "Ink Saver", {
    table: "open", density: "compact",
    flat: { show_notes: false, show_branch: false, show_address: false },
    tags: ["compact"],
  }),
  rollPreset("roll-bilingual", "ثنائي اللغة", "Bilingual", {
    table: "grid",
    perBlock: { items_table: { columns: BILINGUAL_ROLL_COLS_4 } },
    tags: ["bilingual"],
  }),
  rollPreset("roll-bilingual-compact", "ثنائي اللغة — مضغوط", "Bilingual Compact", {
    table: "lines", density: "compact",
    perBlock: { items_table: { columns: BILINGUAL_ROLL_COLS_3 } },
    tags: ["bilingual", "compact"],
  }),
  rollPreset("roll-ticket-kitchen", "تذكرة طلب — عميل ومطبخ", "Kitchen Order Ticket", {
    table: "lines",
    perBlock: {
      items_table: { columns: KITCHEN_TICKET_COLS },
      customer: { bold: true, fontSize: 13 },
    },
    inserted: [
      { id: "ins-order-no", type: "order_number", after: "doc_number", props: { fontSize: 28, label: "رقم الطلب" } },
    ],
    tags: ["ticket"],
  }),
  rollPreset("roll-ticket-queue", "رقم الانتظار", "Queue Number", {
    table: "open", density: "compact",
    inserted: [
      { id: "ins-order-no-big", type: "order_number", after: "doc_number", props: { fontSize: 54, label: "رقم الانتظار" } },
    ],
    flat: { show_notes: false },
    tags: ["ticket"],
  }),
  rollPreset("roll-ticket-pickup", "استلام + مطعم", "Pickup & Restaurant", {
    table: "lines",
    perBlock: { customer: { bold: true, fontSize: 14 } },
    inserted: [
      { id: "ins-order-no-pickup", type: "order_number", after: "doc_number", props: { fontSize: 30, label: "رقم الاستلام" } },
    ],
    tags: ["ticket"],
  }),
  rollPreset("roll-boutique", "بوتيك أزياء", "Fashion Boutique", {
    table: "open",
    perBlock: { company_name: { align: "center", bold: true, fontSize: 18 } },
    inserted: [
      { id: "ins-wave-head", type: "divider", after: "company_name", props: { style: "wave" } },
      { id: "ins-wave-foot", type: "divider", after: "items_table", props: { style: "wave" } },
      { id: "ins-thanks", type: "custom_text", after: "footer_text", props: { text: "شكراً لتسوقك معنا يا {اسم_العميل} ✦", align: "center", fontSize: 11, bold: true } },
    ],
    tags: ["boutique"],
  }),
  rollPreset("roll-pharmacy", "صيدلية", "Pharmacy", {
    table: "lines",
    perBlock: { tax_id: { bold: true, fontSize: 12, align: "center" } },
    inserted: [
      { id: "ins-div-pharm", type: "divider", after: "tax_id", props: { style: "solid" } },
    ],
    tags: ["pharmacy"],
  }),
  rollPreset("roll-cafe", "كافيه", "Cafe", {
    table: "open",
    perBlock: { company_name: { bold: true, fontSize: 18 } },
    inserted: [
      { id: "ins-dots-head", type: "divider", after: "company_name", props: { style: "dots" } },
      { id: "ins-dots-foot", type: "divider", after: "items_table", props: { style: "dots" } },
    ],
    tags: ["cafe"],
  }),
  rollPreset("roll-electronics", "إلكترونيات", "Electronics", {
    table: "grid",
    order: ELECTRONICS_ROLL_ORDER,
    flat: { show_barcode_line: true },
    tags: ["electronics"],
  }),
  rollPreset("roll-delivery", "توصيل", "Delivery", {
    table: "lines",
    perBlock: { customer: { bold: true, fontSize: 14 }, address: { bold: true } },
    inserted: [
      { id: "ins-phone-note", type: "custom_text", after: "customer", props: { text: "هاتف التواصل: {الهاتف}", align: "right", fontSize: 11 } },
    ],
    tags: ["delivery"],
  }),
  rollPreset("roll-zatca", "ZATCA — فاتورة ضريبية مبسطة", "ZATCA Simplified", {
    table: "grid",
    perBlock: { tax_id: { bold: true } },
    flat: { qr_mode: "zatca", show_qr: true, qr_size: 64, qr_alignment: "center" },
    tags: ["zatca", "compliance"],
  }),
  rollPreset("roll-salon", "صالون وتجميل", "Salon", {
    table: "open",
    perBlock: { customer: { bold: true, fontSize: 13 } },
    inserted: [
      { id: "ins-dots-salon", type: "divider", after: "items_table", props: { style: "dots" } },
      { id: "ins-note-salon", type: "custom_text", after: "footer_text", props: { text: "نتمنى لك تجربة رائعة ✦", align: "center", fontSize: 11 } },
    ],
    tags: ["service"],
  }),
  rollPreset("roll-workshop", "ورشة صيانة", "Workshop", {
    table: "lines",
    perBlock: { notes: { bold: true, fontSize: 12 } },
    tags: ["service"],
  }),

  // ================= ROLL — 80mm-only (dense multi-column) =================
  rollPreset("roll-supermarket-dense", "سوبرماركت — كثيف", "Supermarket Dense", {
    table: "grid", density: "compact",
    perBlock: { items_table: { columns: DENSE_SUPERMARKET_COLS } },
    sizes: ["80mm"],
    tags: ["dense", "supermarket"],
  }),
  rollPreset("roll-wholesale-dense", "جملة — تفصيلي", "Wholesale Detailed", {
    table: "grid", density: "compact",
    perBlock: { items_table: { columns: WHOLESALE_DENSE_COLS } },
    sizes: ["80mm"],
    tags: ["dense", "wholesale"],
  }),
  rollPreset("roll-fuel-station", "محطة وقود", "Fuel Station", {
    table: "grid", density: "compact",
    perBlock: { items_table: { columns: FUEL_DENSE_COLS } },
    sizes: ["80mm"],
    tags: ["dense"],
  }),

  // ================= ROLL — 58mm-only (ultra compact) =================
  rollPreset("roll-ultra-compact", "فائق الإيجاز", "Ultra Compact", {
    table: "open", density: "ultra",
    perBlock: { items_table: { columns: ULTRA_COMPACT_COLS } },
    flat: { show_notes: false, show_branch: false, show_address: false },
    sizes: ["58mm"],
    tags: ["compact", "ultra"],
  }),
  rollPreset("roll-58-kiosk", "كشك سريع", "Quick Kiosk", {
    table: "open", density: "ultra",
    perBlock: { items_table: { columns: ULTRA_COMPACT_COLS } },
    inserted: [
      { id: "ins-order-no-kiosk", type: "order_number", after: "doc_number", props: { fontSize: 20, label: "" } },
    ],
    flat: { show_notes: false, show_branch: false },
    sizes: ["58mm"],
    tags: ["compact", "ticket"],
  }),
  rollPreset("roll-58-zatca-mini", "ضريبي مصغر", "Mini ZATCA", {
    table: "lines", density: "ultra",
    perBlock: { items_table: { columns: ULTRA_COMPACT_COLS }, tax_id: { bold: true } },
    flat: { qr_mode: "zatca", show_qr: true, qr_size: 44, qr_alignment: "center", show_notes: false },
    sizes: ["58mm"],
    tags: ["compact", "zatca"],
  }),

  // ================= PAGE — core structural directions (A4 + A5) =================
  pagePreset("page-modern", "عصري", "Modern", {
    headerStyle: "band", table: "gridZebra",
    tags: ["modern"],
  }),
  pagePreset("page-classic", "كلاسيكي", "Classic", {
    headerStyle: "classic", table: "grid",
    tags: ["classic"],
  }),
  pagePreset("page-minimal", "بسيط", "Minimal", {
    headerStyle: "minimal", table: "open",
    tags: ["simple"],
  }),
  pagePreset("page-formal", "رسمي", "Formal", {
    headerStyle: "classic", table: "lines",
    flat: { show_signature_lines: true },
    tags: ["formal"],
  }),
  pagePreset("page-draft", "مسودة", "Draft", {
    headerStyle: "minimal", table: "open",
    flat: { show_watermark: true, watermark_text: "مسودة" },
    tags: ["draft"],
  }),
  pagePreset("page-bilingual", "ثنائي اللغة", "Bilingual", {
    headerStyle: "band", table: "gridZebra",
    perBlock: { items_table: { columns: BILINGUAL_PAGE_COLS } },
    tags: ["bilingual"],
  }),
  pagePreset("page-bilingual-classic", "ثنائي اللغة — كلاسيكي", "Bilingual Classic", {
    headerStyle: "classic", table: "grid",
    perBlock: { items_table: { columns: BILINGUAL_PAGE_COLS } },
    tags: ["bilingual", "classic"],
  }),
  pagePreset("page-compact-pro", "احترافي مضغوط", "Compact Professional", {
    headerStyle: "band", table: "lines",
    flat: { body_font_size: 11, item_font_size: 10, footer_font_size: 9, header_font_size: 14 },
    tags: ["compact"],
  }),
  pagePreset("page-letterhead", "ترويسة رسمية", "Letterhead", {
    headerStyle: "minimal", table: "open",
    perBlock: { company_name: { marginBottom: 8 }, address: { marginTop: 4 } },
    tags: ["formal", "letterhead"],
  }),
  pagePreset("page-dark-navy", "كحلي داكن", "Dark Navy", {
    headerStyle: "band", table: "gridZebra",
    flat: { accent_color: "#0f172a" },
    tags: ["dark"],
  }),
  pagePreset("page-dark-blue", "أزرق داكن", "Dark Blue", {
    headerStyle: "band", table: "gridZebra",
    flat: { accent_color: "#1e3a8a" },
    tags: ["dark"],
  }),
  pagePreset("page-dark-brown", "بني داكن", "Dark Brown", {
    headerStyle: "classic", table: "lines",
    flat: { accent_color: "#7c2d12" },
    tags: ["dark"],
  }),
  pagePreset("page-dark-green", "أخضر داكن", "Dark Green", {
    headerStyle: "band", table: "gridZebra",
    flat: { accent_color: "#14532d" },
    tags: ["dark"],
  }),
  pagePreset("page-quotation", "عرض سعر", "Quotation", {
    headerStyle: "classic", table: "lines",
    flat: { show_signature_lines: true, receipt_footer: "هذا العرض ساري لمدة 7 أيام من تاريخه" },
    inserted: [
      { id: "ins-validity", type: "custom_text", after: "footer_text", props: { text: "نشكركم على ثقتكم — بانتظار موافقتكم", align: "center", fontSize: 10 } },
    ],
    tags: ["quotation"],
  }),
  pagePreset("page-delivery-note", "إذن تسليم", "Delivery Note", {
    headerStyle: "classic", table: "grid",
    perBlock: { items_table: { columns: DELIVERY_PAGE_COLS } },
    flat: { show_tax: false, show_subtotal: false, show_discount_line: false, receipt_footer: "إذن تسليم بضاعة" },
    tags: ["delivery"],
  }),
  pagePreset("page-statement", "كشف حساب", "Account Statement", {
    headerStyle: "minimal", table: "lines",
    flat: { show_signature_lines: true, receipt_footer: "كشف حساب" },
    tags: ["statement"],
  }),
  pagePreset("page-zatca-invoice", "ضريبي معتمد", "ZATCA Invoice", {
    headerStyle: "classic", table: "grid",
    flat: { qr_mode: "zatca", show_qr: true },
    tags: ["zatca", "formal"],
  }),
  pagePreset("page-elegant", "أنيق", "Elegant", {
    headerStyle: "minimal", table: "lines",
    flat: { print_font: "Cairo" },
    tags: ["elegant"],
  }),
  pagePreset("page-thankyou-retail", "متجر — شكر", "Retail Thank You", {
    headerStyle: "band", table: "gridZebra",
    inserted: [
      { id: "ins-thanks-retail", type: "custom_text", after: "footer_text", props: { text: "شكراً لتسوقك معنا يا {اسم_العميل}", align: "center", fontSize: 11, bold: true } },
    ],
    tags: ["retail"],
  }),
  pagePreset("page-warranty", "بطاقة ضمان", "Warranty Card", {
    headerStyle: "classic", table: "lines",
    flat: { show_signature_lines: true },
    inserted: [
      { id: "ins-warranty-note", type: "custom_text", after: "footer_text", props: { text: "هذا المنتج مشمول بالضمان وفق الشروط والأحكام المعلنة", align: "center", fontSize: 10 } },
    ],
    tags: ["formal", "warranty"],
  }),

  // ================= PAGE — A4-only (dense multi-column) =================
  pagePreset("page-a4-detailed-report", "كشف تفصيلي", "Detailed Report", {
    headerStyle: "classic", table: "gridZebra",
    perBlock: { items_table: { columns: A4_DETAILED_COLS } },
    sizes: ["A4"],
    tags: ["dense"],
  }),
  pagePreset("page-a4-wholesale", "جملة — A4", "Wholesale A4", {
    headerStyle: "band", table: "gridZebra",
    perBlock: { items_table: { columns: A4_WHOLESALE_COLS } },
    sizes: ["A4"],
    tags: ["dense", "wholesale"],
  }),

  // ================= PAGE — A5-only (compact half-page) =================
  pagePreset("page-a5-compact-receipt", "إيصال نصف صفحة", "Half-Page Receipt", {
    headerStyle: "minimal", table: "lines",
    flat: { body_font_size: 11, item_font_size: 10, footer_font_size: 9, header_font_size: 13 },
    sizes: ["A5"],
    tags: ["compact"],
  }),
  pagePreset("page-a5-letterhead-mini", "ترويسة مصغرة", "Mini Letterhead", {
    headerStyle: "minimal", table: "open",
    flat: { body_font_size: 11, item_font_size: 10, footer_font_size: 9 },
    sizes: ["A5"],
    tags: ["compact", "formal"],
  }),
];

/** Presets applicable to one paper size ("58mm"/"80mm"/"A5"/"A4"). */
export function presetsForSize(size) {
  return BUILTIN_PRESETS.filter((p) => p.sizes.includes(size));
}

/** The out-of-the-box default preset id per family. */
export const DEFAULT_PRESET_ID = { roll: "roll-classic", page: "page-modern" };
