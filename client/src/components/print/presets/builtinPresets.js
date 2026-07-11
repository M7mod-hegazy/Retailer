/**
 * builtinPresets.js — curated built-in design presets.
 *
 * Each preset is custom-tailored for a specific business category, ensuring distinct
 * visual identities, structure, typography, cell heights, borders, and line treatments.
 *
 * Thermal safety (roll): text stays #000 (renderer coerces light colors),
 * no colored backgrounds, table fonts ≥ 9px, high contrast via borders/weight/size.
 */

import { DEFAULT_ORDER } from "../families/defaultOrder";

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

// Roll-specific columns
const R_CLASSIC = [col("name", "الصنف", "right"), col("qty", "كمية"), col("total", "إجمالي", "left")];
const R_DETAILED = [col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const R_KITCHEN = [col("name", "الصنف", "right"), col("qty", "كمية")];
const R_BILINGUAL = [col("name", "الصنف / Item", "right"), col("qty", "الكمية / Qty"), col("total", "الإجمالي / Total", "left")];
const R_SUPERMARKET = [col("code", "كود"), col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const R_WHOLESALE = [col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "كمية"), col("discount", "خصم"), col("total", "إجمالي", "left")];
const R_MINIMAL = [col("name", "الصنف", "right"), col("total", "إجمالي", "left")];

// Page-specific columns
const P_STANDARD = [col("code", "كود"), col("name", "الصنف", "right"), col("qty", "كمية"), col("price", "سعر"), col("total", "إجمالي", "left")];
const P_SIMPLE = [col("name", "الصنف", "right"), col("qty", "الكمية"), col("price", "السعر"), col("total", "الإجمالي", "left")];
const P_BILINGUAL = [col("code", "الكود / Code"), col("name", "الصنف / Item", "right"), col("qty", "الكمية / Qty"), col("price", "السعر / Price"), col("total", "الإجمالي / Total", "left")];
const P_DETAILED = [col("code", "الكود"), col("name", "اسم الصنف", "right"), col("unit", "الوحدة"), col("qty", "الكمية"), col("price", "السعر", "left"), col("discount", "الخصم", "left"), col("total", "الإجمالي", "left")];
const P_WHOLESALE = [col("name", "الصنف", "right"), col("unit", "الوحدة"), col("qty", "الكمية"), col("price", "سعر الجملة"), col("discount", "الخصم الممنوح"), col("total", "صافي الإجمالي", "left")];
const P_DELIVERY = [col("code", "الكود"), col("name", "الصنف والوصف", "right"), col("unit", "الوحدة"), col("qty", "الكمية المطلوبة")];
const P_RESTAURANT = [col("name", "الطبق / الطلب", "right"), col("qty", "عدد"), col("price", "سعر"), col("total", "إجمالي", "left")];

/* ---- shared order variants ---- */

const RO = DEFAULT_ORDER.roll;
const PO = DEFAULT_ORDER.page;

const KITCHEN_ORDER = ["order_number", "doc_number", "doc_date", "items_table", "notes", "barcode", "receiver_signature"];
const QUEUE_ORDER = ["company_name", "order_number", "doc_date", "footer_text", "barcode", "receiver_signature"];
const TICKET_ORDER = ["company_name", "order_number", "doc_number", "doc_date", "customer", "items_table", "discount", "grand_total", "payments", "footer_text", "barcode", "receiver_signature"];
const PICKUP_ORDER = ["company_name", "order_number", "customer", "doc_date", "items_table", "notes", "footer_text", "barcode", "receiver_signature"];

/* ---- builders ---- */

const frame = (w = 1, style = "solid", padding = 4, color = "#000") => ({ borderWidth: w, borderStyle: style, borderColor: color, padding });
const div = (id, after, style = "solid") => ({ id, type: "divider", after, props: { style } });
const gap = (id, after, height = 6) => ({ id, type: "spacer", after, props: { height } });
const note = (id, after, text, props = {}) => ({ id, type: "custom_text", after, props: { text, align: "center", ...props } });

const rollPreset = (id, name, nameEn, { table = "grid", perBlock = {}, inserted = [], order, flat = {}, tags = [], sizes = ["80mm", "58mm"] } = {}) => ({
  id, family: "roll", sizes, name, nameEn, tags,
  layout: {
    ...(order ? { order } : {}),
    perBlock: {
      ...perBlock,
      items_table: {
        tableBorder: table,
        ...(perBlock.items_table || {}),
      },
    },
    inserted,
  },
  flat: {
    body_font_size: 11,
    item_font_size: 11,
    footer_font_size: 9,
    header_font_size: 14,
    show_qr: false,
    show_barcode_line: true,
    show_receiver_signature: true,
    ...flat,
  },
});

const pagePreset = (id, name, nameEn, { headerStyle = "band", headerMetaAlign, pageLayoutType = "standard", table = "gridZebra", perBlock = {}, inserted = [], order, flat = {}, tags = [], sizes = ["A4", "A5"] } = {}) => ({
  id, family: "page", sizes, name, nameEn, tags,
  layout: {
    ...(order ? { order } : {}),
    headerStyle,
    pageLayoutType,
    ...(headerMetaAlign ? { headerMetaAlign } : {}),
    perBlock: {
      ...perBlock,
      items_table: {
        tableBorder: table.includes("grid") ? "grid" : table.includes("lines") ? "lines" : "none",
        zebra: table.includes("Zebra"),
        ...(perBlock.items_table || {}),
      },
    },
    inserted,
  },
  flat: {
    accent_color: "#1e3a8a",
    print_font: "Cairo",
    ...flat,
  },
});

/* ================================================================
 * ROLL LIBRARY — Thermal 58/80mm (29 presets)
 * ================================================================ */

const ROLL_PRESETS = [
  /* ── 1. Dense Utilitarian: Traditional Grocery ── */
  rollPreset("roll-classic", "تموينات تقليدية", "Traditional Grocery", {
    table: "grid",
    perBlock: {
      company_name: { variant: "retro-brutalist", fontSize: 16, bold: true, align: "center" },
      items_table: { columns: R_CLASSIC, rowPad: 2, headerVariant: "dark" },
      grand_total: { variant: "plain", labelSize: 12, amountSize: 13 },
      payments: { variant: "table-row" },
      subtotal: { variant: "plain" },
      discount: { variant: "standard" },
      tax: { variant: "ruled" },
      customer: { variant: "standard" },
      cashier: { variant: "standard" },
      notes: { variant: "standard" },
      doc_number: { variant: "standard" },
      tax_id: { variant: "standard" },
      doc_date: { variant: "standard" },
      footer_text: { variant: "standard" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [div("d1", "cashier", "solid"), div("d2", "payments", "solid")],
    flat: { print_font: "Tahoma", show_logo: false, show_receiver_signature: true },
    tags: ["classic", "dense"],
  }),

  /* ── 2. Dense Utilitarian: Supermarket Dense ── */
  rollPreset("roll-supermarket", "أسواق مركزية وسوبرماركت", "Supermarket Dense", {
    table: "grid",
    sizes: ["80mm"],
    perBlock: {
      company_name: { fontSize: 13, bold: true, align: "center", underline: false },
      items_table: { columns: R_SUPERMARKET, rowPad: 1, headerVariant: "dark", headerFontSize: 9 },
      grand_total: { variant: "plain", labelSize: 11, amountSize: 12 },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "boxed" },
      discount: { variant: "underline-accent" },
      tax: { variant: "inline" },
      customer: { variant: "stacked" },
      cashier: { variant: "badge" },
      doc_number: { showLabel: true },
      doc_date: { variant: "badge" },
      footer_text: { variant: "standard", fontSize: 8 },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 9,
      header_font_size: 13,
      show_cashier_name: true,
      show_logo: false,
      print_font: "Tahoma",
    },
    tags: ["dense", "supermarket"],
  }),

  /* ── 3. Dense Utilitarian: Wholesale Warehouse ── */
  rollPreset("roll-wholesale", "فواتير بيع جملة مكثفة", "Wholesale Warehouse", {
    table: "grid",
    sizes: ["80mm"],
    perBlock: {
      company_name: { fontFamily: "monospace", fontSize: 14, bold: true, align: "center", underline: false },
      items_table: { columns: R_WHOLESALE, rowPad: 1, headerVariant: "light", nameWidth: 50 },
      grand_total: { variant: "dual-row", labelSize: 11, amountSize: 13 },
      payments: { variant: "table-row" },
      subtotal: { variant: "plain", label: "المجموع الفرعي" },
      discount: { variant: "badge" },
      tax: { variant: "ruled" },
      doc_number: { ...frame(1, "solid", 3), fontFamily: "monospace", fontSize: 12 },
      doc_date: { variant: "ruled" },
      notes: { variant: "quote" },
      footer_text: { variant: "underline-accent" },
      receiver_signature: { variant: "standard", compact: true },
      barcode: { variant: "standard" },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 9,
      header_font_size: 13,
      show_logo: false,
      print_font: "Tahoma",
      show_receiver_signature: true,
    },
    tags: ["dense", "wholesale"],
  }),

  /* ── 4. Dense Utilitarian: Ultra Saver 58mm ── */
  rollPreset("roll-ultra", "سوبرماركت فائق التوفير", "Ultra Saver 58mm", {
    table: "none",
    sizes: ["58mm"],
    perBlock: {
      items_table: { columns: R_CLASSIC, headerVariant: "none", rowPad: 0 },
      grand_total: { variant: "plain", labelSize: 10, amountSize: 11 },
      payments: { variant: "badge-pill", showChange: false },
      tax: { variant: "inline", showRate: false },
      doc_number: { showLabel: false },
      doc_date: { showTime: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 9,
      header_font_size: 11,
      show_logo: false,
      show_branch: false,
      show_address: false,
      show_tax_id: false,
      show_cashier_name: false,
      show_footer: false,
      print_font: "Tahoma",
    },
    tags: ["compact", "ultra"],
  }),

  /* ── 5. Dense Utilitarian: Compact Pharmacy ── */
  rollPreset("roll-compact", "صيدلية سريعة موفرة", "Compact Pharmacy", {
    table: "lines",
    perBlock: {
      company_name: { ...frame(2, "solid", 4), bold: true, fontSize: 12, align: "center" },
      items_table: { columns: R_CLASSIC, rowPad: 1, headerVariant: "dark" },
      grand_total: { variant: "plain", labelSize: 11, amountSize: 12 },
      payments: { variant: "table-row", showChange: false },
      subtotal: { variant: "badge" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      doc_number: { variant: "boxed" },
      tax_id: { variant: "inline" },
      doc_date: { variant: "badge" },
      notes: { variant: "alert" },
      footer_text: { variant: "boxed" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 10,
      header_font_size: 12,
      show_branch: false,
      show_cashier_name: false,
      show_address: false,
      print_font: "Tahoma",
    },
    tags: ["compact", "pharmacy"],
  }),

  /* ── 6. Clean Minimal: Airy Specialty Cafe ── */
  rollPreset("roll-minimal", "قهوة مختصة هوائية", "Airy Specialty Cafe", {
    table: "none",
    perBlock: {
      company_name: { fontSize: 18, align: "center", bold: false, fontFamily: "Cairo", variant: "underline-accent", underline: false, slogan: " Specialty Coffee", sloganSize: 9, sloganAlign: "center", sloganItalic: true },
      items_table: { variant: "minimalist-list", columns: R_MINIMAL, rowPad: 6 },
      grand_total: { variant: "huge", amountSize: 22, labelSize: 10 },
      payments: { variant: "badge-pill", renameMap: { cash: "نقداً", card: "شبكة" } },
      subtotal: { variant: "plain", label: "" },
      discount: { variant: "badge" },
      tax: { variant: "inline", showRate: false },
      customer: { variant: "stacked" },
      cashier: { variant: "inline" },
      notes: { variant: "quote" },
      doc_date: { variant: "ruled" },
      footer_text: { italic: true, align: "center", fontSize: 9 },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [div("d1", "cashier", "wave"), div("d2", "grand_total", "wave"), gap("s1", "company_name", 16)],
    flat: { print_font: "Cairo", show_logo: false, show_branch: false, show_address: false, show_tax_id: false },
    tags: ["simple", "whitespace", "cafe"],
  }),

  /* ── 7. Clean Minimal: Elegant Royal Jewelry ── */
  rollPreset("roll-elegant", "صالون مجوهرات وساعات", "Elegant Royal Jewelry", {
    table: "none",
    perBlock: {
      company_name: { fontSize: 18, align: "center", fontFamily: "Cairo", lineHeight: 2, variant: "stacked-bilingual", underline: false, slogan: "Jewelry & Watches", sloganSize: 10, sloganAlign: "center", sloganItalic: true },
      branch: { align: "center" },
      address: { align: "center" },
      doc_number: { align: "center", showLabel: false },
      doc_date: { align: "center", showTime: false },
      customer: { variant: "stacked", label: "العميل المميز" },
      items_table: { variant: "minimalist-list", columns: R_MINIMAL, rowPad: 5 },
      grand_total: { variant: "huge", amountSize: 20, decor: "✦", decorPos: "before" },
      payments: { variant: "badge-pill", showChange: false },
      discount: { variant: "plain" },
      tax: { variant: "inline", showRate: false },
      cashier: { variant: "inline" },
      notes: { variant: "quote" },
      footer_text: { italic: true, align: "center", fontSize: 10 },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [div("d1", "cashier", "double"), div("d2", "payments", "double")],
    flat: { print_font: "Cairo", logo_alignment: "center" },
    tags: ["elegant", "whitespace", "luxury"],
  }),

  /* ── 8. Clean Minimal: Elegant Fashion Boutique ── */
  rollPreset("roll-boutique", "بوتيك أزياء راقية", "Elegant Fashion Boutique", {
    table: "none",
    perBlock: {
      company_name: { fontSize: 18, align: "center", fontFamily: "Cairo", lineHeight: 2, underline: false },
      items_table: { variant: "cards", columns: R_MINIMAL, headerVariant: "none", rowPad: 5 },
      grand_total: { variant: "split-amount", amountSize: 18 },
      payments: { variant: "badge-pill", renameMap: { cash: "نقدي", card: "مدى" } },
      subtotal: { variant: "boxed" },
      discount: { variant: "underline-accent" },
      tax: { variant: "inline" },
      customer: { variant: "boxed", showPhone: true },
      cashier: { variant: "badge" },
      notes: { variant: "quote" },
      doc_number: { variant: "giant" },
      doc_date: { variant: "badge" },
      footer_text: { italic: true, align: "center", fontSize: 10 },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [gap("s1", "logo", 6), div("d1", "customer", "dotted"), gap("s2", "grand_total", 6)],
    flat: { logo_max_height: 70, logo_alignment: "center", show_cashier_name: false, print_font: "Cairo" },
    tags: ["boutique", "elegant"],
  }),

  /* ── 9. Clean Minimal: Boutique Minimal ── */
  rollPreset("roll-modern", "بوتيك أزياء عصري", "Boutique Minimal", {
    table: "none",
    perBlock: {
      company_name: { fontSize: 20, bold: true, align: "center", fontFamily: "Cairo", marginBottom: 8, variant: "initial-cap", underline: false, slogan: "Fashion Boutique", sloganSize: 10, sloganAlign: "center" },
      items_table: { variant: "cards", headerVariant: "light", columns: R_MINIMAL, rowPad: 5, lineWidth: 2 },
      grand_total: { variant: "band", amountSize: 16, bold: true, label: "الإجمالي النهائي" },
      payments: { variant: "status-stamp" },
      subtotal: { variant: "badge" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "two-column" },
      cashier: { variant: "inline" },
      notes: { variant: "boxed" },
      doc_number: { fontFamily: "monospace", fontSize: 12, align: "center" },
      tax_id: { variant: "badge" },
      doc_date: { variant: "inline" },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [div("d1", "receipt_header_text", "dash"), gap("s1", "company_name", 12)],
    flat: { print_font: "Cairo", show_branch: false, show_address: false },
    tags: ["modern", "whitespace"],
  }),

  /* ── 10. Clean Minimal: Kiosk Minimal Print ── */
  rollPreset("roll-kiosk", "كشك خدمات بسيط مقتضب", "Kiosk Minimal Print", {
    table: "none",
    perBlock: {
      company_name: { fontSize: 15, align: "center", bold: true, underline: false },
      items_table: { variant: "minimalist-list", columns: R_MINIMAL, headerVariant: "none", rowPad: 2 },
      grand_total: { variant: "huge", fontSize: 15, amountSize: 18 },
      payments: { variant: "badge-pill", showChange: false },
      discount: { variant: "badge" },
      tax: { variant: "inline", showRate: false },
      doc_number: { showLabel: false },
      doc_date: { showTime: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    inserted: [div("d1", "receipt_header_text", "dash"), div("d2", "items_table", "dash")],
    flat: { print_font: "Cairo" },
    tags: ["kiosk", "simple"],
  }),

  /* ── 11. Boxed & Framed: Tech Framed ── */
  rollPreset("roll-framed", "معرض أجهزة مؤطر", "Tech Framed", {
    table: "grid",
    perBlock: {
      company_name: { ...frame(2, "solid", 8), align: "center", bold: true, fontSize: 16, marginBottom: 8, underline: false, variant: "underline-accent" },
      doc_number: { ...frame(1, "dashed", 5), align: "center", fontFamily: "monospace", variant: "boxed" },
      items_table: { headerVariant: "light", columns: R_DETAILED, rowPad: 3, lineWidth: 2 },
      grand_total: { variant: "boxed", fontSize: 15 },
      payments: { variant: "table-row" },
      subtotal: { variant: "boxed" },
      discount: { variant: "badge" },
      tax: { variant: "ruled" },
      customer: { variant: "boxed" },
      cashier: { variant: "boxed" },
      notes: { variant: "boxed" },
      tax_id: { variant: "boxed" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "boxed" },
      barcode: { variant: "framed" },
      receiver_signature: { variant: "standard", compact: true, showStamp: true },
    },
    inserted: [div("d1", "items_table", "dashed")],
    flat: { print_font: "Tahoma", show_receiver_signature: true },
    tags: ["framed", "electronics"],
  }),

  /* ── 12. Boxed & Framed: Juice Kiosk Compact ── */
  rollPreset("roll-compact-frame", "بوفيه وعصائر مؤطر", "Juice Kiosk Compact", {
    table: "grid",
    perBlock: {
      company_name: { ...frame(3, "double", 6), bold: true, fontSize: 13, align: "center", underline: false },
      items_table: { columns: R_CLASSIC, rowPad: 1, headerVariant: "light" },
      grand_total: { variant: "boxed", fontSize: 13 },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "badge" },
      discount: { variant: "underline-accent" },
      tax: { variant: "inline" },
      doc_number: { ...frame(1, "solid", 3), variant: "boxed" },
      doc_date: { variant: "badge" },
      notes: { variant: "alert" },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 10,
      header_font_size: 13,
      show_cashier_name: false,
      print_font: "Cairo",
    },
    tags: ["compact", "framed"],
  }),

  /* ── 13. Boxed & Framed: Luxury Perfumery ── */
  rollPreset("roll-luxury", "عطور وبخور فاخر", "Luxury Perfumery", {
    table: "lines",
    perBlock: {
      company_name: { ...frame(3, "double", 10), fontSize: 19, bold: true, align: "center", fontFamily: "Cairo", marginBottom: 8, variant: "initial-cap", underline: false, slogan: "Luxury Oud & Perfume", sloganSize: 10, sloganAlign: "center", sloganItalic: true },
      items_table: { variant: "cards", headerVariant: "light", columns: R_MINIMAL, rowPad: 4, lineWidth: 2 },
      grand_total: { variant: "receipt-tape", fontSize: 16, decor: "✦", decorPos: "both" },
      payments: { variant: "status-stamp", showChange: false },
      subtotal: { variant: "badge", label: "المجموع" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "stacked", label: "العميل VIP" },
      cashier: { variant: "inline" },
      notes: { variant: "quote" },
      doc_number: { variant: "giant", showLabel: false },
      tax_id: { variant: "badge" },
      doc_date: { variant: "ruled" },
      footer_text: { ...frame(1, "dotted", 5), italic: true, align: "center", fontSize: 10 },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [gap("s1", "tax_id", 8), div("d1", "grand_total", "dots"), gap("s2", "payments", 8)],
    flat: { print_font: "Cairo" },
    tags: ["luxury", "elegant"],
  }),

  /* ── 14. Ticket/Order-Led: Kitchen Prep Ticket ── */
  rollPreset("roll-kitchen", "تذكرة تحضير مطبخ ضخمة", "Kitchen Prep Ticket", {
    table: "grid",
    order: KITCHEN_ORDER,
    perBlock: {
      order_number: { fontSize: 50, bold: true, align: "center", variant: "huge" },
      items_table: { columns: R_KITCHEN, fontSize: 15, bold: true, rowPad: 5, headerVariant: "dark" },
      notes: { ...frame(2, "dashed", 6), fontSize: 13, bold: true, variant: "alert" },
      doc_number: { variant: "giant", showLabel: false },
      doc_date: { variant: "ruled" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: { print_font: "Cairo" },
    tags: ["ticket", "kitchen", "restaurant"],
  }),

  /* ── 15. Ticket/Order-Led: Fastfood Ticket ── */
  rollPreset("roll-ticket-customer", "تذكرة وجبات سريعة", "Fastfood Ticket", {
    table: "lines",
    order: TICKET_ORDER,
    perBlock: {
      company_name: { fontSize: 16, bold: true, align: "center", underline: false },
      order_number: { fontSize: 38, bold: true, align: "center", variant: "badge" },
      items_table: { columns: R_CLASSIC, headerVariant: "light", rowPad: 3 },
      grand_total: { variant: "receipt-tape", fontSize: 15 },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "plain" },
      discount: { variant: "badge" },
      tax: { variant: "inline", showRate: false },
      customer: { variant: "standard" },
      doc_date: { showTime: false },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: { print_font: "Cairo" },
    tags: ["ticket", "restaurant"],
  }),

  /* ── 16. Ticket/Order-Led: Service Queue Ticket ── */
  rollPreset("roll-queue", "تذكرة انتظار رقمية", "Service Queue Ticket", {
    table: "none",
    order: QUEUE_ORDER,
    perBlock: {
      order_number: { fontSize: 60, bold: true, align: "center", variant: "boxed" },
      company_name: { fontSize: 14, align: "center", bold: true, underline: false },
      footer_text: { ...frame(1, "dashed", 5), align: "center", fontSize: 11, variant: "boxed" },
      doc_date: { showTime: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: { receipt_footer: "يرجى الانتظار لحين مناداة رقمك — شكراً لكم", print_font: "Cairo" },
    tags: ["ticket", "restaurant"],
  }),

  /* ── 17. Ticket/Order-Led: Drive-thru Pickup ── */
  rollPreset("roll-pickup", "استلم وجبات سفري سيارات", "Drive-thru Pickup", {
    table: "grid",
    order: PICKUP_ORDER,
    perBlock: {
      company_name: { fontSize: 14, align: "center", underline: false },
      order_number: { fontSize: 42, bold: true, align: "center", variant: "huge" },
      customer: { fontSize: 14, bold: true, ...frame(1, "solid", 4), align: "center", variant: "boxed", showPhone: true },
      items_table: { columns: R_KITCHEN, fontSize: 13, bold: true, rowPad: 4, headerVariant: "dark" },
      grand_total: { variant: "plain" },
      payments: { variant: "table-row" },
      notes: { variant: "alert" },
      doc_date: { showTime: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: { print_font: "Cairo" },
    tags: ["ticket", "delivery", "restaurant"],
  }),

  /* ── 18. Compliance: Clinical Pharmacy Roll ── */
  rollPreset("roll-pharmacy", "صيدلية ومستحضرات طبية", "Clinical Pharmacy Roll", {
    table: "grid",
    perBlock: {
      company_name: { fontSize: 15, bold: true, align: "right", underline: false },
      items_table: { columns: R_DETAILED, fontSize: 10, headerVariant: "light", rowPad: 3, lineWidth: 2 },
      grand_total: { variant: "stripe" },
      payments: { variant: "table-row" },
      subtotal: { variant: "plain" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "two-column" },
      cashier: { variant: "badge" },
      notes: { variant: "alert" },
      tax_id: { ...frame(1, "solid", 3), fontSize: 10, bold: true, align: "center", variant: "boxed" },
      doc_number: { variant: "standard" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "underline-accent" },
      receiver_signature: { variant: "boxed", compact: true, showStamp: true },
      barcode: { variant: "standard" },
    },
    flat: { print_font: "Noto Sans Arabic", show_tax_id: true, show_receiver_signature: true },
    tags: ["pharmacy", "compliance"],
  }),

  /* ── 19. Compliance: Saudi ZATCA Compliant ── */
  rollPreset("roll-zatca", "فاتورة ضريبية مبسطة ZATCA", "Saudi ZATCA Compliant", {
    table: "grid",
    perBlock: {
      company_name: { fontSize: 15, bold: true, align: "center", underline: false },
      tax_id: { ...frame(1, "solid", 3), bold: true, align: "center", fontSize: 11, variant: "badge" },
      doc_number: { fontFamily: "monospace", variant: "boxed" },
      items_table: { columns: R_DETAILED, fontSize: 10, rowPad: 2, headerVariant: "dark", lineWidth: 2 },
      grand_total: { variant: "dual-row", labelSize: 11, amountSize: 13 },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "boxed" },
      discount: { variant: "badge" },
      tax: { variant: "ruled" },
      customer: { variant: "stacked" },
      cashier: { variant: "inline" },
      notes: { variant: "boxed" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "centered" },
      receiver_signature: { variant: "split", compact: true },
      barcode: { variant: "standard" },
    },
    flat: { qr_mode: "zatca", show_qr: true, qr_size: 75, qr_alignment: "center", print_font: "Noto Sans Arabic", show_tax_id: true, show_receiver_signature: true },
    tags: ["zatca", "compliance"],
  }),

  /* ── 20. Compliance: Egypt ETA e-Receipt ── */
  rollPreset("roll-eta", "إيصال ضريبي إلكتروني ETA", "Egypt ETA e-Receipt", {
    table: "grid",
    perBlock: {
      company_name: { bold: true, fontSize: 14, align: "center", underline: false, variant: "stacked-bilingual" },
      tax_id: { ...frame(1, "solid", 3), bold: true, align: "center", fontSize: 11, fontFamily: "monospace", variant: "inline" },
      doc_number: { fontFamily: "monospace", fontSize: 10, align: "center", variant: "giant" },
      items_table: { columns: R_DETAILED, fontSize: 10, rowPad: 2, headerVariant: "light", lineWidth: 1 },
      grand_total: { variant: "tag", labelSize: 12, amountSize: 13 },
      payments: { variant: "status-stamp" },
      subtotal: { variant: "plain" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "boxed" },
      cashier: { variant: "badge" },
      notes: { variant: "alert" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "underline-accent" },
      receiver_signature: { variant: "boxed", compact: true, showId: true, showStamp: true },
      barcode: { variant: "standard" },
    },
    inserted: [div("d1", "cashier", "solid"), div("d2", "payments", "solid")],
    flat: { qr_mode: "eta", show_qr: true, qr_size: 75, qr_alignment: "center", print_font: "Noto Sans Arabic", show_tax_id: true, show_branch: true, show_receiver_signature: true },
    tags: ["eta", "compliance", "egypt"],
  }),

  /* ── 21. Decorative/Luxury: Cozy Bakery Cafe ── */
  rollPreset("roll-cafe", "مقهى ومخبوزات هادئة", "Cozy Bakery Cafe", {
    table: "lines",
    perBlock: {
      company_name: { fontSize: 22, bold: true, align: "center", fontFamily: "Cairo", underline: false, slogan: "المخبوزات الطازجة يومياً", sloganSize: 10, sloganAlign: "center", sloganItalic: true },
      items_table: { variant: "cards", columns: R_MINIMAL, fontSize: 12, headerVariant: "none", rowPad: 4, lineWidth: 1 },
      grand_total: { variant: "huge", decor: "☕", decorPos: "before" },
      payments: { variant: "badge-pill", renameMap: { cash: "نقداً", card: "مدى/فيزا" } },
      subtotal: { variant: "boxed", label: "" },
      discount: { variant: "badge" },
      tax: { variant: "inline", showRate: false },
      customer: { variant: "stacked" },
      cashier: { variant: "inline" },
      notes: { variant: "quote" },
      doc_number: { showLabel: false },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [
      div("d1", "receipt_header_text", "wave"),
      note("n1", "payments", "شكراً لزيارتكم — نتطلع لخدمتكم مجدداً ☕", { bold: true, fontSize: 10 }),
    ],
    flat: { print_font: "Cairo" },
    tags: ["cafe", "modern"],
  }),

  /* ── 22. Decorative/Luxury: Hypermarket Bilingual ── */
  rollPreset("roll-bilingual", "هايبرماركت ثنائي اللغة", "Hypermarket Bilingual", {
    table: "grid",
    sizes: ["80mm"],
    perBlock: {
      company_name: { fontSize: 16, bold: true, align: "center", fontFamily: "Cairo", variant: "stacked-bilingual", underline: false },
      items_table: { columns: R_BILINGUAL, rowPad: 3, headerVariant: "dark" },
      grand_total: { variant: "band", amountSize: 14 },
      payments: { variant: "table-row" },
      subtotal: { variant: "plain" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "two-column" },
      cashier: { variant: "standard" },
      notes: { variant: "standard" },
      doc_number: { variant: "standard" },
      doc_date: { variant: "standard" },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [note("n1", "footer_text", "Thank you for your visit! / شكراً لزيارتكم", { fontSize: 10, italic: true })],
    flat: { print_font: "Cairo" },
    tags: ["bilingual"],
  }),

  /* ── 23. Decorative/Luxury: Bilingual Bakery ── */
  rollPreset("roll-bilingual-compact", "مخبز ثنائي اللغة مضغوط", "Bilingual Bakery", {
    table: "lines",
    perBlock: {
      company_name: { fontSize: 14, bold: true, align: "center", underline: false },
      items_table: { columns: R_BILINGUAL, headerVariant: "light", rowPad: 1 },
      grand_total: { variant: "receipt-tape" },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "plain" },
      discount: { variant: "badge" },
      tax: { variant: "inline" },
      doc_number: { showLabel: false },
      doc_date: { showTime: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    inserted: [note("n1", "footer_text", "We hope to see you again! / نرجو زيارتنا مجدداً", { fontSize: 9, italic: true })],
    flat: {
      body_font_size: 10,
      item_font_size: 10,
      header_font_size: 12,
      print_font: "Cairo",
    },
    tags: ["bilingual", "compact"],
  }),

  /* ── 24. Specialty: Mechanical Repair Mono ── */
  rollPreset("roll-mono", "ورشة صيانة ميكانيكية", "Mechanical Repair Mono", {
    table: "lines",
    perBlock: {
      company_name: { fontFamily: "monospace", fontSize: 15, bold: true, align: "right", underline: false },
      items_table: { fontFamily: "monospace", headerVariant: "light", columns: R_DETAILED, rowPad: 1, lineWidth: 1, headerFontSize: 9 },
      doc_number: { fontFamily: "monospace", fontSize: 13, bold: true, variant: "giant" },
      grand_total: { variant: "receipt-tape", fontFamily: "monospace", fontSize: 15 },
      payments: { fontFamily: "monospace", variant: "table-row" },
      subtotal: { variant: "plain" },
      discount: { variant: "underline-accent" },
      tax: { variant: "inline" },
      customer: { variant: "two-column" },
      cashier: { variant: "inline" },
      notes: { ...frame(1, "dashed", 4), variant: "alert" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "standard" },
      barcode: { variant: "compact" },
      receiver_signature: { variant: "standard", compact: true, showId: true },
    },
    inserted: [div("d1", "cashier", "dash"), div("d2", "payments", "dash")],
    flat: { print_font: "monospace", show_receiver_signature: true },
    tags: ["station", "dense", "service", "mono"],
  }),

  /* ── 25. Specialty: Tech Store & Warranty ── */
  rollPreset("roll-electronics", "إلكترونيات وضمان للأجهزة", "Tech Store & Warranty", {
    table: "grid",
    sizes: ["80mm"],
    order: moveAfter(RO, "barcode", "items_table"),
    perBlock: {
      company_name: { fontSize: 16, bold: true, align: "center", underline: false },
      items_table: { columns: R_SUPERMARKET, fontSize: 10, rowPad: 3, headerVariant: "dark", lineWidth: 2, nameWidth: 50 },
      grand_total: { variant: "boxed" },
      payments: { variant: "badge-pill" },
      subtotal: { variant: "boxed" },
      discount: { variant: "badge" },
      tax: { variant: "ruled" },
      customer: { variant: "stacked" },
      cashier: { variant: "badge" },
      notes: { ...frame(1, "dashed", 5), fontSize: 10, bold: true, variant: "alert" },
      doc_number: { ...frame(1, "solid", 3), variant: "boxed" },
      tax_id: { variant: "badge" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "underline-accent" },
      barcode: { variant: "centered" },
      receiver_signature: { variant: "standard", compact: true, showStamp: true },
    },
    inserted: [note("n1", "grand_total", "الضمان يسري لمدة سنتين من تاريخ الفاتورة. يرجى إبراز هذا الإيصال عند الصيانة.", { ...frame(1, "dashed", 5), fontSize: 10, bold: true })],
    flat: { show_barcode_line: true, print_font: "Cairo", show_receiver_signature: true },
    tags: ["electronics", "warranty"],
  }),

  /* ── 26. Specialty: Food & Parcel Delivery ── */
  rollPreset("roll-delivery", "توصيل طلبات منازل", "Food & Parcel Delivery", {
    table: "lines",
    order: withBlockAfter(RO, "order_number", "doc_date"),
    perBlock: {
      order_number: { fontSize: 34, bold: true, align: "center", variant: "badge" },
      customer: { ...frame(2, "solid", 6), fontSize: 13, bold: true, variant: "boxed", showPhone: true, showAddress: true },
      items_table: { columns: R_CLASSIC, headerVariant: "light", rowPad: 3 },
      grand_total: { variant: "split-amount", amountSize: 16 },
      payments: { variant: "table-row" },
      subtotal: { variant: "plain" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      cashier: { variant: "inline" },
      notes: { variant: "alert" },
      doc_date: { showTime: false },
      footer_text: { variant: "centered" },
      receiver_signature: { variant: "split", compact: true, showDate: false },
      barcode: { variant: "standard" },
    },
    flat: { print_font: "Cairo", show_receiver_signature: true },
    tags: ["delivery"],
  }),

  /* ── 27. Specialty: Service Workshop Receipt ── */
  rollPreset("roll-services", "صيانة وخدمات فنية", "Service Workshop Receipt", {
    table: "lines",
    perBlock: {
      company_name: { fontSize: 15, bold: true, align: "center", underline: false, variant: "retro-brutalist" },
      items_table: { columns: R_CLASSIC, headerVariant: "none", rowPad: 3 },
      grand_total: { variant: "plain" },
      notes: { ...frame(1, "solid", 5), fontSize: 11, marginTop: 4, variant: "boxed" },
      doc_number: { fontFamily: "monospace", bold: true, variant: "giant" },
      payments: { variant: "status-stamp" },
      subtotal: { variant: "badge" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "stacked" },
      cashier: { variant: "badge" },
      doc_date: { variant: "ruled" },
      footer_text: { variant: "underline-accent" },
      barcode: { variant: "framed" },
      receiver_signature: { variant: "standard", compact: false, showStamp: true, showId: true },
    },
    inserted: [note("n1", "payments", "استلمت المستند / الخدمة والمنتج بحالة ممتازة\nالتوقيع: ________________________", { fontSize: 10, align: "right", marginTop: 12 })],
    flat: { print_font: "Cairo", show_receiver_signature: true },
    tags: ["service"],
  }),

  /* ── 28. Specialty: Retail Barcode Roll ── */
  rollPreset("roll-barcode-retail", "تجزئة مع باركود الفاتورة", "Retail Barcode Roll", {
    table: "grid",
    perBlock: {
      company_name: { fontSize: 14, bold: true, align: "center", underline: false },
      items_table: { columns: R_DETAILED, rowPad: 2, headerVariant: "light", lineWidth: 1, headerFontSize: 9 },
      grand_total: { variant: "band" },
      payments: { variant: "badge-pill", showChange: false },
      subtotal: { variant: "plain" },
      discount: { variant: "badge" },
      tax: { variant: "inline" },
      customer: { variant: "stacked" },
      cashier: { variant: "inline" },
      notes: { variant: "standard" },
      doc_number: { variant: "standard" },
      doc_date: { variant: "badge" },
      footer_text: { variant: "centered" },
      barcode: { variant: "standard", textFontSize: 9 },
      receiver_signature: { variant: "standard", compact: true },
    },
    flat: {
      body_font_size: 10,
      item_font_size: 10,
      header_font_size: 12,
      show_barcode_line: true,
      show_qr: false,
      show_logo: false,
      print_font: "Tahoma",
    },
    tags: ["retail", "dense"],
  }),

  /* ── 29. Specialty: Grab & Go Stall ── */
  rollPreset("roll-grab", "أكشاك بيع سريع خاطف", "Grab & Go Stall", {
    table: "lines",
    order: ["company_name", "doc_number", "items_table", "grand_total", "payments", "barcode", "receiver_signature"],
    perBlock: {
      company_name: { fontSize: 13, align: "center", bold: true, underline: false },
      items_table: { columns: R_CLASSIC, fontSize: 12, bold: true, headerVariant: "none", rowPad: 2 },
      grand_total: { variant: "huge", decor: "🔥", decorPos: "before" },
      payments: { variant: "badge-pill", showChange: false },
      discount: { variant: "badge" },
      tax: { variant: "inline", showRate: false },
      doc_number: { showLabel: false },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "compact", compact: true },
    },
    flat: { print_font: "Tahoma" },
    tags: ["compact", "kiosk"],
  }),

  /* ── 30. Specialty: Promo Discount Slip ── */
  rollPreset("roll-promo", "تخفيضات وعروض ترويجية", "Promo Discount Slip", {
    table: "lines",
    perBlock: {
      company_name: { ...frame(2, "dashed", 8), fontSize: 15, bold: true, align: "center", fontFamily: "Cairo", underline: false },
      receipt_header_text: { ...frame(2, "dashed", 6), bold: true, fontSize: 12, align: "center" },
      grand_total: { fontSize: 14, variant: "receipt-tape", decor: "🎁", decorPos: "before" },
      payments: { variant: "status-stamp" },
      subtotal: { variant: "boxed" },
      discount: { variant: "underline-accent" },
      tax: { variant: "ruled" },
      customer: { variant: "boxed" },
      cashier: { variant: "badge" },
      doc_number: { variant: "giant" },
      doc_date: { variant: "ruled" },
      notes: { variant: "alert" },
      footer_text: { ...frame(1, "dashed", 5), variant: "underline-accent", fontSize: 10, bold: true },
      barcode: { variant: "standard" },
      receiver_signature: { variant: "standard", compact: true },
    },
    inserted: [note("n1", "footer_text", "🎁 استخدم هذا الإيصال للحصول على خصم بقيمة 10% لطلبك القادم!", { ...frame(1, "dashed", 5), bold: true, fontSize: 10 })],
    flat: { print_font: "Cairo" },
    tags: ["promo", "retail"],
  }),
];

/* ================================================================
 * PAGE LIBRARY — A4 / A5 (full color) (29 presets)
 * Every preset has a UNIQUE layout + block variant combination.
 * No two presets share the same visual skeleton.
 * ================================================================ */

const PAGE_PRESETS = [
  // ── 1. Corporate Modern — split-header + full-width stripe total ──
  pagePreset("page-modern", "مؤسسات تجارية - كحلي عصري", "Corporate Modern Blue", {
    pageLayoutType: "split-header",
    headerStyle: "asymmetric",
    table: "linesZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "lines", zebra: true, rowPad: 5, variant: "standard" },
      grand_total: { variant: "stripe" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#1e293b", print_font: "Cairo" },
    tags: ["modern"],
  }),

  // ── 2. Classic Navy — executive double-border frame ──
  pagePreset("page-classic", "كلاسيكي فاخر بإطار كامل", "Classic Navy Framed", {
    pageLayoutType: "executive",
    headerStyle: "classic",
    table: "grid",
    perBlock: {
      items_table: { columns: P_DETAILED, tableBorder: "grid", zebra: false, lineWidth: 1, rowPad: 4, variant: "standard" },
      company_name: { fontSize: 24, bold: true, align: "right", variant: "retro-brutalist" },
      grand_total: { variant: "boxed", fontSize: 16 },
      payments: { variant: "table-row" },
    },
    inserted: [div("d1", "customer", "solid"), gap("s1", "customer", 8)],
    flat: { accent_color: "#1e40af", print_font: "Cairo" },
    tags: ["classic"],
  }),

  // ── 3. Fine Arts — minimal-top, no bg, minimalist list ──
  pagePreset("page-minimal", "مبسط هوائي للمعارض الفنية", "Fine Arts Minimalist", {
    pageLayoutType: "minimal-top",
    headerStyle: "inline",
    table: "none",
    headerMetaAlign: "left",
    perBlock: {
      items_table: { columns: P_SIMPLE, headerVariant: "light", tableBorder: "none", zebra: false, rowPad: 8, variant: "minimalist-list" },
      grand_total: { variant: "plain", amountSize: 20 },
      company_name: { fontSize: 22, bold: false, variant: "underline-accent" },
    },
    inserted: [gap("s1", "logo", 14)],
    flat: { accent_color: "#0f172a", show_branch: false, show_cashier_name: false, print_font: "Tajawal" },
    tags: ["simple", "whitespace"],
  }),

  // ── 4. Professional Consultation — letterhead + dual-row tafqeet ──
  pagePreset("page-formal", "فاتورة استشارات رسمية", "Professional Consultation Service", {
    pageLayoutType: "letterhead",
    headerStyle: "classic",
    table: "lines",
    perBlock: {
      items_table: { columns: P_DETAILED, tableBorder: "lines", zebra: false, rowPad: 5, variant: "standard" },
      footer_text: { italic: true },
      grand_total: { variant: "dual-row" },
      payments: { variant: "table-row" },
    },
    flat: { accent_color: "#7f1d1d", print_font: "Noto Sans Arabic", show_signature_lines: true, show_watermark: true, watermark_text: "فاتورة استشارات رسمية" },
    tags: ["formal"],
  }),

  // ── 5. Internal Draft — standard brutalist + plain total + watermark ──
  pagePreset("page-draft", "مسودة تداول داخلي", "Internal Draft Blueprint", {
    pageLayoutType: "standard",
    headerStyle: "brutalist",
    table: "none",
    perBlock: {
      items_table: { columns: P_SIMPLE, tableBorder: "none", rowPad: 4, variant: "ledger" },
      grand_total: { variant: "receipt-tape" },
    },
    flat: { accent_color: "#64748b", show_watermark: true, watermark_text: "مسودة عمل غير جاهزة للعميل" },
    tags: ["draft"],
  }),

  // ── 6. Royal Salon — minimal-top + cards items + huge total ──
  pagePreset("page-elegant", "صالون مجوهرات فاخر رويال", "Elegant Royal Salon", {
    pageLayoutType: "minimal-top",
    headerStyle: "badge",
    table: "none",
    headerMetaAlign: "center",
    perBlock: {
      items_table: { columns: P_SIMPLE, headerVariant: "none", rowPad: 8, variant: "cards" },
      grand_total: { variant: "tag", amountSize: 18 },
      company_name: { fontFamily: "Cairo", fontSize: 26, align: "center", bold: true, variant: "initial-cap" },
      footer_text: { italic: true, align: "center" },
      payments: { variant: "badge-pill" },
    },
    inserted: [gap("s1", "logo", 16)],
    flat: { accent_color: "#7c3aed", print_font: "Cairo", show_branch: false, show_cashier_name: false },
    tags: ["elegant", "whitespace"],
  }),

  // ── 7. Engineering Letterhead — letterhead + dual-row + signature grid ──
  pagePreset("page-letterhead", "خطابات ومقاولات بترويسة خطية", "Engineering Letterhead", {
    pageLayoutType: "letterhead",
    headerStyle: "centered",
    table: "lines",
    headerMetaAlign: "left",
    perBlock: {
      company_name: { fontSize: 26, bold: true, fontFamily: "Cairo", align: "right", variant: "underline-accent" },
      branch: { fontSize: 11, align: "right" },
      items_table: { columns: P_WHOLESALE, headerVariant: "light", tableBorder: "lines", rowPad: 4, variant: "standard" },
      grand_total: { variant: "receipt-tape" },
      payments: { variant: "table-row" },
    },
    inserted: [div("d1", "receipt_header_text", "solid"), gap("s1", "receipt_header_text", 12)],
    flat: { accent_color: "#b45309", show_signature_lines: true, show_cashier_name: false },
    tags: ["letterhead", "formal"],
  }),

  // ── 8. Wholesale Economy — standard minimal + ledger items + receipt-tape ──
  pagePreset("page-compact", "توفير المساحة وتجارة الجملة", "Wholesale Economy Page", {
    pageLayoutType: "standard",
    headerStyle: "minimal",
    table: "lines",
    headerMetaAlign: "right",
    perBlock: {
      items_table: { columns: P_STANDARD, fontSize: 10, rowPad: 2, tableBorder: "none", variant: "ledger" },
      grand_total: { variant: "receipt-tape", labelSize: 10, amountSize: 13 },
    },
    flat: { accent_color: "#374151", body_font_size: 10, item_font_size: 10, header_font_size: 13, footer_font_size: 8 },
    tags: ["compact"],
  }),

  // ── 9. Tech Corporate — sidebar solid + stripe total ──
  pagePreset("page-navy", "كحلي أنيق للشركات التقنية", "Tech Corporate Deep Navy", {
    pageLayoutType: "sidebar",
    headerStyle: "band",
    table: "lines",
    perBlock: {
      items_table: { columns: P_STANDARD, fontFamily: "monospace", tableBorder: "lines", rowPad: 4, variant: "standard" },
      grand_total: { variant: "stripe", background: "#1e3a8a" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#1e3a8a" },
    tags: ["dark", "modern"],
  }),

  // ── 10. Cosmetics Emerald — split-header + band total ──
  pagePreset("page-emerald", "زمردي لمستحضرات التجميل الطبيعية", "Emerald Cosmetics Clean", {
    pageLayoutType: "split-header",
    headerStyle: "badge",
    table: "gridZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "stripe", background: "#047857" },
      company_name: { variant: "stacked-bilingual" },
    },
    flat: { accent_color: "#047857" },
    tags: ["modern"],
  }),

  // ── 11. Bespoke Atelier — split-header boxed header + dual-row + pull-quote company ──
  pagePreset("page-burgundy", "Atelier صالون خياطة رجالي مخصص", "Bespoke Atelier Burgundy", {
    pageLayoutType: "split-header",
    headerStyle: "boxed",
    table: "lines",
    perBlock: {
      items_table: { columns: P_SIMPLE, tableBorder: "lines", rowPad: 5, variant: "standard" },
      company_name: { fontFamily: "Cairo", fontSize: 22, variant: "underline-accent" },
      grand_total: { variant: "dual-row" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#7f1d1d", print_font: "Cairo" },
    tags: ["classic", "elegant"],
  }),

  // ── 12. E-Commerce — ticket layout + centered total stripe ──
  pagePreset("page-royal", "متجر إلكتروني أزرق ملكي", "Royal Blue E-Commerce", {
    pageLayoutType: "ticket",
    headerStyle: "brutalist",
    table: "linesZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "lines", zebra: true, rowPad: 5, variant: "standard" },
      grand_total: { variant: "stripe", background: "#1d4ed8" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#1d4ed8", print_font: "Cairo" },
    tags: ["modern"],
  }),

  // ── 13. Photo Studio — minimal-top + centered + boxed total ──
  pagePreset("page-charcoal", "استوديو تصوير فحمي مبسّط", "Minimalist Charcoal Studio", {
    pageLayoutType: "minimal-top",
    headerStyle: "centered",
    table: "grid",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", rowPad: 4, variant: "standard" },
      doc_number: { fontFamily: "monospace", fontSize: 13, bold: true },
      grand_total: { variant: "split-amount", amountSize: 24 },
      company_name: { variant: "initial-cap", fontSize: 22 },
    },
    flat: { accent_color: "#111827" },
    tags: ["dark", "simple"],
  }),

  // ── 14. Dates & Sweets — minimal-top classic + tag total (warm palette) ──
  pagePreset("page-brown", "حلويات وتمور شرقية كلاسيك", "Traditional Dates & Sweets", {
    pageLayoutType: "minimal-top",
    headerStyle: "classic",
    table: "linesZebra",
    perBlock: {
      items_table: { columns: P_SIMPLE, tableBorder: "lines", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "tag" },
      company_name: { variant: "retro-brutalist" },
    },
    flat: { accent_color: "#78350f" },
    tags: ["classic"],
  }),

  // ── 15. Bilingual Trade — split-header + bilingual columns ──
  pagePreset("page-bilingual", "تجارة ممتدة ثنائية اللغة", "Bilingual Trade Emerald", {
    pageLayoutType: "split-header",
    headerStyle: "inline",
    table: "linesZebra",
    perBlock: {
      items_table: { columns: P_BILINGUAL, tableBorder: "lines", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "stripe" },
      company_name: { variant: "stacked-bilingual" },
    },
    inserted: [note("n1", "footer_text", "This is a computer-generated document. / هذا المستند تم إنشاؤه آلياً ولا يحتاج لختم", { fontSize: 9, italic: true, align: "left" })],
    flat: { accent_color: "#047857" },
    tags: ["bilingual"],
  }),

  // ── 16. Cultural Library — executive + grid + bilingual ──
  pagePreset("page-bilingual-classic", "مكتبة وثقافة كلاسيكية ثنائية", "Cultural Library Bilingual", {
    pageLayoutType: "executive",
    headerStyle: "band",
    table: "grid",
    perBlock: {
      items_table: { columns: P_BILINGUAL, tableBorder: "grid", rowPad: 3, variant: "standard" },
      grand_total: { variant: "receipt-tape" },
      payments: { variant: "table-row" },
    },
    flat: { accent_color: "#7f1d1d" },
    tags: ["bilingual", "classic"],
  }),

  // ── 17. Technical Quotation — letterhead + bank details + receipt-tape ──
  pagePreset("page-quotation", "عرض سعر هندسي احترافي", "Pro Technical Quotation", {
    pageLayoutType: "letterhead",
    headerStyle: "boxed",
    table: "lines",
    order: without(PO, "payments"),
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "lines", rowPad: 5, variant: "standard" },
      grand_total: { variant: "receipt-tape" },
    },
    inserted: [
      { id: "b1", type: "bank_details", after: "notes", props: { bankName: "مصرف الراجحي", accountName: "مؤسسة النجم الذهبي للتجارة", iban: "SA8080000001234567890123" } },
      note("n1", "grand_total", "هذا العرض سارٍ لمدة 15 يوماً من تاريخ الإصدار. الأسعار تشمل التركيب والضمان.", { ...frame(1, "dashed", 7, "#0369a1"), bold: true, fontSize: 11 })
    ],
    flat: { accent_color: "#0369a1", show_signature_lines: true },
    tags: ["quotation", "formal"],
  }),

  // ── 18. Warehouse Release — split-header + delivery columns + plain total ──
  pagePreset("page-delivery", "إذن تسليم بضائع ومخازن", "Warehouse Goods Release Note", {
    pageLayoutType: "split-header",
    headerStyle: "centered",
    table: "grid",
    perBlock: {
      items_table: { columns: P_DELIVERY, tableBorder: "grid", rowPad: 4, variant: "standard" },
      doc_number: { fontFamily: "monospace", fontSize: 15, bold: true },
      notes: { ...frame(1, "solid", 6, "#b45309"), fontSize: 11 },
      grand_total: { variant: "plain" },
    },
    flat: { accent_color: "#b45309", show_signature_lines: true },
    tags: ["delivery"],
  }),

  // ── 19. Credit Statement — executive minimal + ledger items + plain total ──
  pagePreset("page-statement", "كشف حساب مالي عملاء آجل", "Client Credit Statement", {
    pageLayoutType: "executive",
    headerStyle: "minimal",
    table: "grid",
    perBlock: {
      items_table: { columns: P_DETAILED, fontSize: 10, headerVariant: "light", tableBorder: "none", rowPad: 3, variant: "ledger" },
      grand_total: { variant: "plain" },
    },
    flat: { accent_color: "#334155", body_font_size: 10, item_font_size: 10 },
    tags: ["statement", "dense"],
  }),

  // ── 20. ZATCA Tax Invoice — executive boxed + QR prominent + stripe total ──
  pagePreset("page-zatca", "فاتورة ضريبية مبسطة ممتثلة ZATCA", "Tax Invoice ZATCA Compliant", {
    pageLayoutType: "executive",
    headerStyle: "boxed",
    table: "lines",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "lines", rowPad: 4, variant: "standard" },
      tax_id: { bold: true, fontSize: 12 },
      grand_total: { variant: "stripe" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#065f46", qr_mode: "zatca", show_qr: true, qr_size: 75, qr_alignment: "center", show_tax_id: true },
    tags: ["zatca", "compliance"],
  }),

  // ── 21. ETA e-Receipt — executive boxed + QR centered + compliance grid ──
  pagePreset("page-eta", "إيصال ضريبي إلكتروني ETA", "Egypt ETA e-Receipt", {
    pageLayoutType: "executive",
    headerStyle: "boxed",
    table: "grid",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", rowPad: 4, variant: "standard" },
      tax_id: { bold: true, fontSize: 12, fontFamily: "monospace" },
      grand_total: { variant: "stripe" },
      payments: { variant: "badge-pill" },
      doc_number: { fontFamily: "monospace", fontSize: 11, bold: true },
    },
    flat: { accent_color: "#1e3a5f", qr_mode: "eta", show_qr: true, qr_size: 75, qr_alignment: "center", show_tax_id: true, show_branch: true, print_font: "Noto Sans Arabic" },
    tags: ["eta", "compliance", "egypt"],
  }),

  // ── 22. Appliance Warranty — executive frame + boxed total ──
  pagePreset("page-warranty", "شهادة وضمان أجهزة كهربائية", "Official Appliance Warranty", {
    pageLayoutType: "executive",
    headerStyle: "classic",
    table: "gridZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "dual-row" },
      payments: { variant: "table-row" },
    },
    inserted: [note("n1", "notes", "شهادة ضمان رسمي: الأجهزة الموضحة أعلاه تقع تحت ضمان الشركة المعتمد لمدة سنتين ضد عيوب التصنيع.", { ...frame(1, "solid", 8, "#1f2937"), fontSize: 10, align: "right" })],
    flat: { accent_color: "#1f2937", show_signature_lines: true },
    tags: ["warranty", "formal"],
  }),

  // ── 22. Kids Fashion — sidebar classic + stripe total + barcode ──
  pagePreset("page-retail", "تجارة تجزئة أزياء ملابس أطفال", "Kids Fashion Retail A4", {
    pageLayoutType: "sidebar",
    headerStyle: "classic",
    table: "linesZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "lines", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "stripe", background: "#4338ca" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#4338ca", show_barcode_line: true },
    tags: ["retail"],
  }),

  // ── 23. Food Distribution — letterhead band + ledger + receipt-tape ──
  pagePreset("page-wholesale", "بيع جملة وتوزيع مواد غذائية", "Food Distribution Wholesale", {
    pageLayoutType: "letterhead",
    headerStyle: "band",
    table: "lines",
    perBlock: {
      items_table: { columns: P_WHOLESALE, fontSize: 10, tableBorder: "none", rowPad: 2, variant: "ledger" },
      grand_total: { variant: "receipt-tape" },
      payments: { variant: "table-row" },
    },
    flat: { accent_color: "#374151", body_font_size: 10, item_font_size: 10 },
    tags: ["wholesale", "dense"],
  }),

  // ── 24. Hypermarket A4 — ticket badge + large grid table ──
  pagePreset("page-supermarket", "هايبر ماركت وأسواق غذاء أخضر", "Grocery Hypermarket A4", {
    pageLayoutType: "ticket",
    headerStyle: "badge",
    table: "gridZebra",
    perBlock: {
      items_table: { columns: P_DETAILED, fontSize: 10, tableBorder: "grid", zebra: true, rowPad: 3, variant: "standard" },
      grand_total: { variant: "stripe", background: "#15803d" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#15803d", item_font_size: 10 },
    tags: ["supermarket", "dense"],
  }),

  // ── 25. Restaurant Dining — ticket layout + huge order number ──
  pagePreset("page-restaurant", "قائمة طعام وخدمات صالة مطعم", "Warm Restaurant Dining", {
    pageLayoutType: "ticket",
    headerStyle: "centered",
    table: "linesZebra",
    order: withBlockAfter(PO, "order_number", "doc_date"),
    perBlock: {
      order_number: { fontSize: 48, bold: true, align: "center" },
      items_table: { columns: P_RESTAURANT, tableBorder: "lines", zebra: true, rowPad: 6, variant: "standard" },
      grand_total: { variant: "stripe", background: "#b45309" },
      payments: { variant: "badge-pill" },
    },
    flat: { accent_color: "#b45309", print_font: "Cairo" },
    tags: ["restaurant", "ticket"],
  }),

  // ── 26. Luxury Oud & Jewelry — minimal-top asymmetric + cards items + tag total ──
  pagePreset("page-boutique", "معرض مجوهرات وعطور فاخرة", "Luxury Oud & Jewelry Salon", {
    pageLayoutType: "minimal-top",
    headerStyle: "asymmetric",
    table: "none",
    headerMetaAlign: "center",
    perBlock: {
      company_name: { fontFamily: "Cairo", fontSize: 26, align: "center", bold: true, variant: "retro-brutalist" },
      items_table: { columns: P_SIMPLE, headerVariant: "none", tableBorder: "none", rowPad: 8, variant: "cards" },
      grand_total: { variant: "tag", amountSize: 20 },
      payments: { variant: "badge-pill" },
    },
    inserted: [div("d1", "customer", "wave"), div("d2", "payments", "wave")],
    flat: { accent_color: "#7f1d1d", print_font: "Cairo" },
    tags: ["boutique", "elegant"],
  }),

  // ── 27. Medical Pharmacy — standard asymmetric + grid + dual-row ──
  pagePreset("page-pharmacy", "صيدلية ورعاية طبية علاجية", "Green Cross Medical Pharmacy", {
    pageLayoutType: "standard",
    headerStyle: "asymmetric",
    table: "grid",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", rowPad: 4, variant: "standard" },
      tax_id: { bold: true, fontSize: 11 },
      grand_total: { variant: "dual-row" },
      payments: { variant: "table-row" },
    },
    flat: { accent_color: "#047857", print_font: "Noto Sans Arabic", show_tax_id: true },
    tags: ["pharmacy", "compliance"],
  }),

  // ── 28. Smartphones & Electronics — split-header + monospace + stripe ──
  pagePreset("page-electronics", "معرض الهواتف الذكية والأجهزة", "Blue Tech & Smartphones", {
    pageLayoutType: "split-header",
    headerStyle: "asymmetric",
    table: "gridZebra",
    perBlock: {
      items_table: { columns: P_STANDARD, tableBorder: "grid", zebra: true, rowPad: 4, variant: "standard" },
      grand_total: { variant: "stripe", background: "#1d4ed8" },
      payments: { variant: "badge-pill" },
      doc_number: { fontFamily: "monospace", bold: true },
    },
    inserted: [note("n1", "notes", "الضمان يسري من تاريخ الشراء. يسمح بالاستبدال خلال 7 أيام بحالته الأصلية دون فك التغليف.", { ...frame(1, "dashed", 6, "#1d4ed8"), fontSize: 10 })],
    flat: { accent_color: "#1d4ed8", show_barcode_line: true },
    tags: ["electronics", "warranty"],
  }),

  // ── 29. Teal Services & Maintenance — letterhead classic + service cols + dual-row ──
  pagePreset("page-services", "شركة خدمات تركواز ممتدة", "Teal Services & Maintenance", {
    pageLayoutType: "letterhead",
    headerStyle: "classic",
    table: "lines",
    headerMetaAlign: "right",
    perBlock: {
      items_table: { columns: [col("name", "الخدمة / البيان المالي", "right"), col("qty", "ساعات العمل"), col("price", "السعر بالساعة"), col("total", "الإجمالي النهائي", "left")], tableBorder: "lines", rowPad: 5, variant: "standard" },
      notes: { ...frame(1, "solid", 6, "#0e7490") },
      grand_total: { variant: "dual-row" },
      payments: { variant: "table-row" },
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
