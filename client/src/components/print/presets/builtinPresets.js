/**
 * builtinPresets.js — curated built-in design presets (see presetEngine.js
 * for the preset shape and apply semantics).
 *
 * Authored as a matrix (header treatment × table style × totals treatment ×
 * density × typography) then curated per shop type. Every preset must be
 * recognizable AT THUMBNAIL SIZE — differences are structural (frames, block
 * order, giant numbers, column sets, dividers, fonts), not font-size nudges.
 *
 * Thermal safety (roll): text stays #000 (the renderer coerces light colors),
 * no colored backgrounds (1-bit heads), table fonts ≥ 9px, contrast via
 * borders/weight/size — everything here prints crisply on a 203dpi head.
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

// box helpers — thermal-safe frames (pure black)
const frame = (w = 1, style = "solid", padding = 4) => ({ borderWidth: w, borderStyle: style, borderColor: "#000", padding });
const div = (id, after, style = "solid") => ({ id, type: "divider", after, props: { style } });
const gap = (id, after, height = 6) => ({ id, type: "spacer", after, props: { height } });
const note = (id, after, text, props = {}) => ({ id, type: "custom_text", after, props: { text, align: "center", ...props } });

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

const pagePreset = (id, name, nameEn, { headerStyle = "band", headerMetaAlign, table = "gridZebra", perBlock = {}, inserted = [], order, flat = {}, tags = [], sizes = ["A4", "A5"] } = {}) => ({
  id, family: "page", sizes, name, nameEn, tags,
  layout: {
    ...(order ? { order } : {}),
    headerStyle,
    ...(headerMetaAlign ? { headerMetaAlign } : {}),
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
/** Insert a registry block that's not in the default order (e.g. order_number). */
function withBlockAfter(baseOrder, block, afterItem) {
  if (baseOrder.includes(block)) return moveAfter(baseOrder, block, afterItem);
  const arr = [...baseOrder];
  arr.splice(arr.indexOf(afterItem) + 1, 0, block);
  return arr;
}
/** Drop blocks from an order (paper-savers / tickets hide whole sections). */
const without = (baseOrder, ...blocks) => baseOrder.filter((x) => !blocks.includes(x));

/* ---- column bundles (perBlock.items_table.columns) ---- */

const col = (key, label, align = "center") => ({ key, label, visible: true, align });
const R3 = [col("name", "الصنف", "right"), col("qty", "كمية"), col("total", "إجمالي", "left")];
const R3_PRICE = [col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const R_KITCHEN = [col("name", "الصنف", "right"), col("qty", "كمية")];
const R_BILINGUAL_4 = [col("name", "الصنف / Item", "right"), col("qty", "كمية / Qty"), col("price", "سعر / Price"), col("total", "إجمالي / Total", "left")];
const R_BILINGUAL_3 = [col("name", "الصنف / Item", "right"), col("qty", "كمية / Qty"), col("total", "إجمالي / Total", "left")];
const R_SUPERMARKET = [col("code", "كود"), col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const R_WHOLESALE = [col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "كمية"), col("discount", "خصم"), col("total", "إجمالي", "left")];
const R_ELECTRONICS = [col("code", "الموديل"), col("name", "الجهاز", "right"), col("qty", "عدد"), col("total", "إجمالي", "left")];

const P_STD = [col("code", "كود"), col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const P_SIMPLE = [col("name", "الصنف", "right"), col("qty", "الكمية"), col("price", "السعر"), col("total", "الإجمالي", "left")];
const P_BILINGUAL = [col("code", "كود / Code"), col("name", "الصنف / Item", "right"), col("qty", "كمية / Qty"), col("price", "سعر / Price"), col("total", "الإجمالي / Total", "left")];
const P_DETAILED = [col("code", "كود"), col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "كمية"), col("price", "سعر"), col("discount", "خصم"), col("total", "إجمالي", "left")];
const P_WHOLESALE = [col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "كمية"), col("discount", "خصم"), col("total", "إجمالي", "left")];
const P_DELIVERY = [col("code", "كود"), col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "الكمية")];
const P_RESTAURANT = [col("name", "الطبق", "right"), col("qty", "عدد"), col("price", "سعر"), col("total", "إجمالي", "left")];

/* ---- shared order variants ---- */

const RO = DEFAULT_ORDER.roll;
const PO = DEFAULT_ORDER.page;
const ELECTRONICS_ROLL_ORDER = moveAfter(RO, "barcode", "items_table");
const KITCHEN_ORDER = ["order_number", "doc_number", "doc_date", "items_table", "notes"];
const QUEUE_ORDER = ["company_name", "order_number", "doc_date", "footer_text"];
const TICKET_ORDER = withBlockAfter(["company_name", "doc_number", "doc_date", "customer", "items_table", "discount", "grand_total", "payments", "footer_text"], "order_number", "company_name");
const PICKUP_ORDER = ["company_name", "order_number", "customer", "doc_date", "items_table", "notes", "footer_text"];
const GRAB_ORDER = ["company_name", "doc_number", "items_table", "grand_total", "payments"];

/* ================================================================
 * ROLL LIBRARY — thermal 58/80mm
 * ================================================================ */

const ROLL_PRESETS = [
  // ── core directions ──
  rollPreset("roll-classic", "كلاسيكي", "Classic", {
    table: "grid",
    perBlock: { company_name: { bold: true, fontSize: 17 } },
    inserted: [div("d1", "cashier"), div("d2", "payments")],
    tags: ["classic"],
  }),
  rollPreset("roll-modern", "عصري", "Modern", {
    table: "lines",
    perBlock: {
      company_name: { fontSize: 24, bold: true, align: "center", fontFamily: "Cairo" },
      items_table: { headerVariant: "light" },
      grand_total: { variant: "plain", fontSize: 16 },
      doc_number: { fontFamily: "monospace", fontSize: 13, align: "center" },
    },
    inserted: [div("d1", "receipt_header_text", "dash")],
    flat: { print_font: "Cairo", show_branch: false },
    tags: ["modern"],
  }),
  rollPreset("roll-minimal", "بسيط هوائي", "Airy minimal", {
    table: "open",
    perBlock: {
      company_name: { fontSize: 13, align: "center" },
      items_table: { headerVariant: "none" },
      grand_total: { variant: "plain" },
      footer_text: { fontSize: 9, align: "center" },
    },
    inserted: [div("d1", "cashier", "wave"), div("d2", "grand_total", "wave"), gap("s1", "company_name", 8)],
    flat: { show_logo: false },
    tags: ["simple", "whitespace"],
  }),
  rollPreset("roll-framed", "مؤطَّر", "Framed", {
    table: "grid",
    perBlock: {
      company_name: { ...frame(2, "solid", 6), align: "center", bold: true, fontSize: 16, marginBottom: 6 },
      doc_number: { ...frame(1, "dashed", 4), align: "center", fontFamily: "monospace" },
      items_table: { headerVariant: "light" },
      grand_total: { variant: "boxed", fontSize: 16 },
    },
    tags: ["framed"],
  }),
  rollPreset("roll-luxury", "فاخر مزدوج", "Double luxury", {
    table: "lines",
    perBlock: {
      company_name: { ...frame(3, "double", 10), fontSize: 20, bold: true, align: "center", fontFamily: "Noto Sans Arabic", marginBottom: 8 },
      items_table: { headerVariant: "light" },
      grand_total: { variant: "boxed", fontSize: 18 },
      footer_text: { italic: true, align: "center" },
    },
    inserted: [gap("s1", "tax_id", 8), gap("s2", "payments", 8)],
    flat: { print_font: "Noto Sans Arabic" },
    tags: ["luxury", "elegant"],
  }),
  rollPreset("roll-elegant", "أنيق متمركز", "Centered elegant", {
    table: "open",
    perBlock: {
      company_name: { fontSize: 18, align: "center", fontFamily: "Noto Sans Arabic", lineHeight: 1.9 },
      branch: { align: "center" }, address: { align: "center" }, doc_number: { align: "center" },
      doc_date: { align: "center" }, customer: { align: "center" },
      items_table: { headerVariant: "none" },
      grand_total: { variant: "huge" },
    },
    inserted: [div("d1", "cashier", "wave"), div("d2", "payments", "wave")],
    flat: { print_font: "Noto Sans Arabic", logo_alignment: "center" },
    tags: ["elegant", "whitespace"],
  }),
  rollPreset("roll-mono", "محطة — أرقام واضحة", "Station mono", {
    table: "lines",
    perBlock: {
      items_table: { fontFamily: "monospace", headerVariant: "light" },
      doc_number: { fontFamily: "monospace", fontSize: 14, bold: true },
      grand_total: { variant: "plain", fontFamily: "monospace", fontSize: 16 },
      payments: { fontFamily: "monospace" },
    },
    inserted: [div("d1", "cashier", "dash"), div("d2", "payments", "dash")],
    tags: ["station", "dense"],
  }),

  // ── paper savers ──
  rollPreset("roll-compact", "موفر", "Compact", {
    table: "lines", density: "compact",
    perBlock: { items_table: { columns: R3 }, grand_total: { variant: "plain" } },
    flat: { show_branch: false, show_cashier_name: false, show_address: false },
    tags: ["compact"],
  }),
  rollPreset("roll-ultra", "موفر — أقصى توفير", "Ultra saver", {
    table: "open", density: "ultra", sizes: ["58mm"],
    perBlock: { items_table: { columns: R3, headerVariant: "none" }, company_name: { fontSize: 12, align: "center" }, grand_total: { variant: "plain" } },
    flat: { show_logo: false, show_branch: false, show_address: false, show_tax_id: false, show_cashier_name: false, show_footer: false },
    tags: ["compact", "ultra"],
  }),
  rollPreset("roll-compact-frame", "موفر مؤطَّر", "Compact framed", {
    table: "grid", density: "compact",
    perBlock: {
      items_table: { columns: R3 },
      grand_total: { variant: "boxed", fontSize: 14 },
      company_name: { bold: true, fontSize: 14, align: "center" },
    },
    flat: { show_cashier_name: false },
    tags: ["compact", "framed"],
  }),

  // ── bilingual ──
  rollPreset("roll-bilingual", "ثنائي اللغة", "Bilingual", {
    table: "grid", sizes: ["80mm"],
    perBlock: { items_table: { columns: R_BILINGUAL_4 }, company_name: { fontSize: 16, bold: true, align: "center" } },
    inserted: [note("n1", "footer_text", "Thank you for your visit!", { fontSize: 10, italic: true })],
    tags: ["bilingual"],
  }),
  rollPreset("roll-bilingual-compact", "ثنائي اللغة — مضغوط", "Bilingual compact", {
    table: "lines", density: "compact",
    perBlock: { items_table: { columns: R_BILINGUAL_3, headerVariant: "light" }, grand_total: { variant: "plain" } },
    inserted: [note("n1", "footer_text", "Thank you!", { fontSize: 9, italic: true })],
    tags: ["bilingual", "compact"],
  }),

  // ── restaurant / order tickets ──
  rollPreset("roll-kitchen", "تذكرة مطبخ", "Kitchen ticket", {
    table: "grid", order: KITCHEN_ORDER,
    perBlock: {
      order_number: { fontSize: 52 },
      items_table: { columns: R_KITCHEN, fontSize: 14, bold: true },
      notes: { ...frame(2, "dashed", 5), fontSize: 13, bold: true },
    },
    tags: ["ticket", "kitchen", "restaurant"],
  }),
  rollPreset("roll-ticket-customer", "تذكرة طلب — نسخة العميل", "Order ticket — customer", {
    table: "lines", order: TICKET_ORDER,
    perBlock: {
      order_number: { fontSize: 40 },
      items_table: { columns: R3, headerVariant: "light" },
      grand_total: { variant: "boxed", fontSize: 16 },
    },
    tags: ["ticket", "restaurant"],
  }),
  rollPreset("roll-queue", "رقم الانتظار", "Queue number", {
    table: "open", order: QUEUE_ORDER,
    perBlock: {
      order_number: { fontSize: 64 },
      company_name: { fontSize: 14, align: "center" },
      footer_text: { ...frame(1, "dashed", 4), align: "center", fontSize: 11 },
    },
    flat: { receipt_footer: "يرجى انتظار النداء — شكراً لصبركم" },
    tags: ["ticket", "restaurant"],
  }),
  rollPreset("roll-pickup", "استلام — مطعم", "Restaurant pickup", {
    table: "grid", order: PICKUP_ORDER,
    perBlock: {
      order_number: { fontSize: 44 },
      customer: { fontSize: 14, bold: true, ...frame(1, "solid", 4) },
      items_table: { columns: R_KITCHEN, fontSize: 13, bold: true },
    },
    tags: ["ticket", "delivery", "restaurant"],
  }),

  // ── shop verticals ──
  rollPreset("roll-supermarket", "سوبرماركت كثيف", "Dense supermarket", {
    table: "grid", density: "compact", sizes: ["80mm"],
    order: without(RO, "receipt_header_text", "notes"),
    perBlock: { items_table: { columns: R_SUPERMARKET, fontSize: 9 }, company_name: { fontSize: 14, bold: true } },
    flat: { show_cashier_name: true, show_logo: false },
    tags: ["dense", "supermarket"],
  }),
  rollPreset("roll-wholesale", "جملة", "Wholesale", {
    table: "grid", density: "compact", sizes: ["80mm"],
    perBlock: {
      items_table: { columns: R_WHOLESALE, fontSize: 9, headerVariant: "light" },
      grand_total: { variant: "plain" },
      doc_number: { ...frame(1, "solid", 3), fontFamily: "monospace", fontSize: 12 },
    },
    flat: { show_logo: false },
    tags: ["dense", "wholesale"],
  }),
  rollPreset("roll-cafe", "كافيه", "Cafe", {
    table: "lines",
    perBlock: {
      company_name: { fontSize: 22, bold: true, align: "center", fontFamily: "Cairo" },
      items_table: { columns: R3, fontSize: 12, headerVariant: "none" },
      grand_total: { variant: "huge" },
    },
    inserted: [
      div("d1", "receipt_header_text", "wave"),
      note("n1", "payments", "شكراً {اسم_العميل} — نراك قريباً ☕", { bold: true, fontSize: 11 }),
    ],
    flat: { print_font: "Cairo" },
    tags: ["cafe", "modern"],
  }),
  rollPreset("roll-pharmacy", "صيدلية", "Pharmacy", {
    table: "grid",
    perBlock: {
      items_table: { columns: R3_PRICE, fontSize: 10, headerVariant: "light" },
      grand_total: { variant: "boxed" },
      tax_id: { ...frame(1, "solid", 3), fontSize: 10, bold: true, align: "center" },
      company_name: { fontSize: 15, bold: true },
    },
    flat: { print_font: "Noto Sans Arabic", show_tax_id: true },
    tags: ["pharmacy", "compliance"],
  }),
  rollPreset("roll-boutique", "بوتيك", "Boutique", {
    table: "open",
    perBlock: {
      company_name: { fontSize: 19, align: "center", fontFamily: "Noto Sans Arabic", lineHeight: 2 },
      items_table: { columns: R3, headerVariant: "none" },
      grand_total: { variant: "huge" },
      footer_text: { italic: true, align: "center", fontSize: 10 },
    },
    inserted: [gap("s1", "logo", 6), div("d1", "customer", "wave"), gap("s2", "grand_total", 6)],
    flat: { logo_max_height: 70, logo_alignment: "center", show_cashier_name: false, print_font: "Noto Sans Arabic" },
    tags: ["boutique", "elegant"],
  }),
  rollPreset("roll-electronics", "إلكترونيات + ضمان", "Electronics + warranty", {
    table: "grid", sizes: ["80mm"],
    order: ELECTRONICS_ROLL_ORDER,
    perBlock: { items_table: { columns: R_ELECTRONICS, fontSize: 10 }, grand_total: { variant: "boxed" } },
    inserted: [note("n1", "grand_total", "الضمان سنتان من تاريخ الفاتورة — يرجى الاحتفاظ بالإيصال", { ...frame(1, "dashed", 4), fontSize: 10, bold: true })],
    flat: { show_barcode_line: true },
    tags: ["electronics", "warranty"],
  }),
  rollPreset("roll-delivery", "توصيل", "Delivery", {
    table: "lines",
    order: withBlockAfter(RO, "order_number", "doc_date"),
    perBlock: {
      order_number: { fontSize: 36 },
      customer: { ...frame(2, "solid", 5), fontSize: 13, bold: true },
      items_table: { columns: R3, headerVariant: "light" },
    },
    flat: { address_position: "top" },
    tags: ["delivery"],
  }),
  rollPreset("roll-services", "خدمات وصيانة", "Services", {
    table: "lines",
    perBlock: {
      items_table: { columns: R3, headerVariant: "none" },
      grand_total: { variant: "plain" },
      notes: { ...frame(1, "solid", 5), fontSize: 11, marginTop: 4 },
      doc_number: { fontFamily: "monospace", bold: true },
    },
    inserted: [note("n1", "payments", "استلمتُ الخدمة بحالة جيدة — التوقيع: ______________", { fontSize: 10, align: "right", marginTop: 10 })],
    tags: ["service"],
  }),
  rollPreset("roll-zatca", "زاتكا ZATCA", "ZATCA compliant", {
    table: "grid",
    perBlock: {
      tax_id: { ...frame(1, "solid", 3), bold: true, align: "center", fontSize: 11 },
      items_table: { columns: R3_PRICE, fontSize: 10 },
    },
    flat: { qr_mode: "zatca", show_qr: true, qr_size: 70, qr_alignment: "center", print_font: "Noto Sans Arabic", show_tax_id: true },
    tags: ["zatca", "compliance"],
  }),
  rollPreset("roll-barcode-retail", "تجزئة بباركود", "Retail barcode", {
    table: "grid", density: "compact",
    perBlock: { items_table: { columns: R3_PRICE, fontSize: 9, headerVariant: "light" }, grand_total: { variant: "plain" } },
    flat: { show_barcode_line: true, show_qr: false, show_logo: false },
    tags: ["retail", "dense"],
  }),
  rollPreset("roll-grab", "سريع — بيع خاطف", "Grab & go", {
    table: "lines", order: GRAB_ORDER,
    perBlock: {
      company_name: { fontSize: 13, align: "center" },
      items_table: { columns: R_KITCHEN, fontSize: 13, bold: true, headerVariant: "none" },
      grand_total: { variant: "huge" },
    },
    tags: ["compact", "kiosk"],
  }),
  rollPreset("roll-kiosk", "كشك مبسّط", "Simple kiosk", {
    table: "open",
    order: without(RO, "branch", "address", "tax_id", "cashier", "notes"),
    perBlock: {
      company_name: { fontSize: 16, align: "center", bold: true },
      grand_total: { variant: "plain", fontSize: 16 },
      items_table: { columns: R3, headerVariant: "none" },
    },
    inserted: [div("d1", "receipt_header_text", "dash"), div("d2", "items_table", "dash")],
    tags: ["kiosk", "simple"],
  }),
  rollPreset("roll-promo", "عروض وترويج", "Promo", {
    table: "lines",
    perBlock: {
      receipt_header_text: { ...frame(2, "dashed", 6), bold: true, fontSize: 13, align: "center" },
      grand_total: { fontSize: 15 },
    },
    inserted: [note("n1", "footer_text", "🎁 اعرض هذا الإيصال واحصل على خصم ٥٪ في زيارتك القادمة", { ...frame(1, "dashed", 5), bold: true, fontSize: 10 })],
    tags: ["promo", "retail"],
  }),
];

/* ================================================================
 * PAGE LIBRARY — A4 / A5 (full color)
 * ================================================================ */

const PAGE_PRESETS = [
  // ── core directions (distinct accents so thumbnails differ instantly) ──
  pagePreset("page-modern", "عصري", "Modern", {
    headerStyle: "band", table: "linesZebra",
    perBlock: { items_table: { columns: P_STD } },
    flat: { accent_color: "#1e293b", print_font: "Cairo" },
    tags: ["modern"],
  }),
  pagePreset("page-classic", "كلاسيكي", "Classic", {
    headerStyle: "classic", table: "grid",
    perBlock: { items_table: { columns: P_STD } },
    flat: { accent_color: "#111827" },
    tags: ["classic"],
  }),
  pagePreset("page-minimal", "بسيط", "Minimal", {
    headerStyle: "minimal", table: "open", headerMetaAlign: "left",
    perBlock: { items_table: { columns: P_SIMPLE, headerVariant: "light" }, grand_total: { variant: "plain" } },
    flat: { accent_color: "#0f172a" },
    tags: ["simple", "whitespace"],
  }),
  pagePreset("page-formal", "رسمي بتوقيعات", "Formal", {
    headerStyle: "classic", table: "lines",
    perBlock: { items_table: { columns: P_STD }, footer_text: { italic: true } },
    flat: { accent_color: "#334155", print_font: "Noto Sans Arabic", show_signature_lines: true },
    tags: ["formal"],
  }),
  pagePreset("page-draft", "مسودة", "Draft", {
    headerStyle: "minimal", table: "open",
    perBlock: { items_table: { columns: P_SIMPLE } },
    flat: { accent_color: "#64748b", show_watermark: true, watermark_text: "مسودة" },
    tags: ["draft"],
  }),
  pagePreset("page-elegant", "أنيق", "Elegant", {
    headerStyle: "minimal", table: "open", headerMetaAlign: "center",
    perBlock: {
      items_table: { columns: P_SIMPLE, headerVariant: "light" },
      grand_total: { variant: "huge" },
      company_name: { fontFamily: "Noto Sans Arabic", fontSize: 22 },
      footer_text: { italic: true, align: "center" },
    },
    inserted: [div("d1", "customer", "wave")],
    flat: { accent_color: "#57534e", print_font: "Noto Sans Arabic" },
    tags: ["elegant", "whitespace"],
  }),
  pagePreset("page-letterhead", "ترويسة رسمية", "Letterhead", {
    headerStyle: "minimal", table: "lines", headerMetaAlign: "left",
    perBlock: {
      company_name: { fontSize: 26, bold: true, fontFamily: "Cairo" },
      branch: { fontSize: 12 },
      receipt_header_text: { italic: true },
      items_table: { headerVariant: "light" },
      grand_total: { variant: "boxed" },
    },
    inserted: [div("d1", "receipt_header_text", "solid")],
    flat: { accent_color: "#78350f", show_signature_lines: true },
    tags: ["letterhead", "formal"],
  }),
  pagePreset("page-compact", "مضغوط", "Compact", {
    headerStyle: "classic", table: "lines", headerMetaAlign: "right",
    perBlock: { items_table: { columns: P_STD, fontSize: 9 } },
    flat: { accent_color: "#0f172a", body_font_size: 10, item_font_size: 9, header_font_size: 13, footer_font_size: 8 },
    tags: ["compact"],
  }),

  // ── color series (band + treatments) ──
  pagePreset("page-navy", "كحلي داكن", "Dark navy", {
    headerStyle: "band", table: "lines",
    perBlock: {
      items_table: { columns: P_STD, fontFamily: "monospace" },
      grand_total: { background: "#1e3a8a", color: "#ffffff", padding: 8, borderRadius: 6 },
    },
    flat: { accent_color: "#1e3a8a" },
    tags: ["dark", "modern"],
  }),
  pagePreset("page-emerald", "زمردي", "Emerald", {
    headerStyle: "band", table: "gridZebra",
    perBlock: { items_table: { columns: P_STD } },
    flat: { accent_color: "#047857" },
    tags: ["modern"],
  }),
  pagePreset("page-burgundy", "نبيذي", "Burgundy", {
    headerStyle: "classic", table: "lines",
    perBlock: { items_table: { columns: P_SIMPLE }, company_name: { fontFamily: "Noto Sans Arabic" } },
    flat: { accent_color: "#7f1d1d", print_font: "Noto Sans Arabic" },
    tags: ["classic", "elegant"],
  }),
  pagePreset("page-royal", "أزرق ملكي", "Royal blue", {
    headerStyle: "band", table: "openZebra",
    perBlock: {
      items_table: { columns: P_STD },
      grand_total: { background: "#1d4ed8", color: "#ffffff", padding: 8, borderRadius: 8 },
    },
    flat: { accent_color: "#1d4ed8", print_font: "Cairo" },
    tags: ["modern"],
  }),
  pagePreset("page-charcoal", "فحمي", "Charcoal", {
    headerStyle: "minimal", table: "grid",
    perBlock: {
      items_table: { columns: P_STD },
      doc_number: { fontFamily: "monospace", fontSize: 14 },
      grand_total: { variant: "boxed" },
    },
    flat: { accent_color: "#111827" },
    tags: ["dark", "simple"],
  }),
  pagePreset("page-brown", "بني دافئ", "Warm brown", {
    headerStyle: "classic", table: "linesZebra",
    perBlock: { items_table: { columns: P_SIMPLE }, grand_total: { variant: "plain" } },
    flat: { accent_color: "#78350f" },
    tags: ["classic"],
  }),

  // ── bilingual ──
  pagePreset("page-bilingual", "ثنائي اللغة", "Bilingual", {
    headerStyle: "band", table: "linesZebra",
    perBlock: { items_table: { columns: P_BILINGUAL } },
    inserted: [note("n1", "footer_text", "This is a computer-generated invoice.", { fontSize: 9, italic: true, align: "left" })],
    flat: { accent_color: "#047857" },
    tags: ["bilingual"],
  }),
  pagePreset("page-bilingual-classic", "ثنائي اللغة — كلاسيكي", "Bilingual classic", {
    headerStyle: "classic", table: "grid",
    perBlock: { items_table: { columns: P_BILINGUAL } },
    flat: { accent_color: "#7f1d1d" },
    tags: ["bilingual", "classic"],
  }),

  // ── business docs ──
  pagePreset("page-quotation", "عرض سعر", "Quotation", {
    headerStyle: "classic", table: "lines",
    order: without(PO, "payments"),
    perBlock: { items_table: { columns: P_STD } },
    inserted: [note("n1", "grand_total", "هذا العرض ساري لمدة ١٥ يوماً من تاريخه — الأسعار شاملة الضريبة", { ...frame(1, "dashed", 6), bold: true, fontSize: 11 })],
    flat: { accent_color: "#0369a1", show_signature_lines: true },
    tags: ["quotation", "formal"],
  }),
  pagePreset("page-delivery", "إذن تسليم", "Delivery note", {
    headerStyle: "band", table: "grid",
    perBlock: {
      items_table: { columns: P_DELIVERY },
      doc_number: { fontFamily: "monospace", fontSize: 16, bold: true },
      notes: { ...frame(1, "solid", 6), fontSize: 11 },
    },
    flat: { accent_color: "#b45309", show_signature_lines: true },
    tags: ["delivery"],
  }),
  pagePreset("page-statement", "كشف مفصَّل", "Detailed statement", {
    headerStyle: "classic", table: "grid",
    perBlock: { items_table: { columns: P_DETAILED, fontSize: 9, headerVariant: "light" }, grand_total: { variant: "plain" } },
    flat: { accent_color: "#334155", body_font_size: 10, item_font_size: 9 },
    tags: ["statement", "dense"],
  }),
  pagePreset("page-zatca", "زاتكا ZATCA", "ZATCA compliant", {
    headerStyle: "band", table: "lines",
    perBlock: {
      items_table: { columns: P_STD },
      tax_id: { bold: true, fontSize: 12 },
    },
    flat: { accent_color: "#065f46", qr_mode: "zatca", show_qr: true, qr_size: 72, qr_alignment: "center", show_tax_id: true },
    tags: ["zatca", "compliance"],
  }),
  pagePreset("page-warranty", "فاتورة بضمان", "Warranty invoice", {
    headerStyle: "classic", table: "gridZebra",
    perBlock: { items_table: { columns: P_STD } },
    inserted: [note("n1", "notes", "شهادة ضمان: يخضع هذا المنتج لضمان المصنع لمدة ٢٤ شهراً من تاريخ الفاتورة. لا يشمل الضمان سوء الاستخدام.", { ...frame(1, "solid", 8), fontSize: 10, align: "right" })],
    flat: { accent_color: "#1f2937", show_signature_lines: true },
    tags: ["warranty", "formal"],
  }),
  pagePreset("page-retail", "تجزئة بباركود", "Retail barcode", {
    headerStyle: "band", table: "linesZebra",
    perBlock: { items_table: { columns: P_STD } },
    flat: { accent_color: "#4338ca", show_barcode_line: true },
    tags: ["retail"],
  }),

  // ── verticals ──
  pagePreset("page-wholesale", "جملة", "Wholesale", {
    headerStyle: "classic", table: "lines",
    perBlock: { items_table: { columns: P_WHOLESALE, fontSize: 10 } },
    flat: { accent_color: "#374151", body_font_size: 10, item_font_size: 10 },
    tags: ["wholesale", "dense"],
  }),
  pagePreset("page-supermarket", "سوبرماركت", "Supermarket", {
    headerStyle: "band", table: "gridZebra",
    perBlock: { items_table: { columns: P_DETAILED, fontSize: 9 } },
    flat: { accent_color: "#15803d", item_font_size: 9 },
    tags: ["supermarket", "dense"],
  }),
  pagePreset("page-restaurant", "فاتورة مطعم", "Restaurant bill", {
    headerStyle: "band", table: "linesZebra",
    order: withBlockAfter(PO, "order_number", "doc_date"),
    perBlock: {
      order_number: { fontSize: 40 },
      items_table: { columns: P_RESTAURANT },
    },
    flat: { accent_color: "#b45309", print_font: "Cairo" },
    tags: ["restaurant", "ticket"],
  }),
  pagePreset("page-boutique", "بوتيك", "Boutique", {
    headerStyle: "minimal", table: "open", headerMetaAlign: "center",
    perBlock: {
      company_name: { fontFamily: "Cairo", fontSize: 24 },
      items_table: { columns: P_SIMPLE, headerVariant: "none" },
      grand_total: { variant: "boxed" },
    },
    inserted: [div("d1", "customer", "wave"), div("d2", "payments", "wave")],
    flat: { accent_color: "#7f1d1d", print_font: "Cairo" },
    tags: ["boutique", "elegant"],
  }),
  pagePreset("page-pharmacy", "صيدلية", "Pharmacy", {
    headerStyle: "classic", table: "grid",
    perBlock: {
      items_table: { columns: P_STD },
      tax_id: { bold: true, fontSize: 12 },
    },
    flat: { accent_color: "#047857", print_font: "Noto Sans Arabic", show_tax_id: true },
    tags: ["pharmacy", "compliance"],
  }),
  pagePreset("page-electronics", "إلكترونيات", "Electronics", {
    headerStyle: "band", table: "gridZebra",
    perBlock: { items_table: { columns: P_STD } },
    inserted: [note("n1", "notes", "الضمان سنتان — تُقبل الاستبدالات خلال ١٤ يوماً بحالة العبوة الأصلية.", { ...frame(1, "dashed", 6), fontSize: 10 })],
    flat: { accent_color: "#1d4ed8", show_barcode_line: true },
    tags: ["electronics", "warranty"],
  }),
  pagePreset("page-services", "خدمات وأتعاب", "Services", {
    headerStyle: "minimal", table: "lines", headerMetaAlign: "right",
    perBlock: {
      items_table: { columns: [col("name", "البيان", "right"), col("qty", "الوحدات"), col("price", "سعر الوحدة"), col("total", "الإجمالي", "left")] },
      notes: { ...frame(1, "solid", 6) },
    },
    flat: { accent_color: "#0e7490", show_signature_lines: true },
    tags: ["service", "formal"],
  }),
];

export const BUILTIN_PRESETS = [...ROLL_PRESETS, ...PAGE_PRESETS];

export function presetsForSize(size) {
  return BUILTIN_PRESETS.filter((p) => !p.sizes || !p.sizes.length || p.sizes.includes(size));
}

export const DEFAULT_PRESET_ID = { roll: "roll-classic", page: "page-modern" };
