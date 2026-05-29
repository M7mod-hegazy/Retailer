// Layout data model for the Print Designer.
//
// The single source of truth stays the per-doc settings JSON. We *extend* it
// with a `layout` field (per size-family) — we never add a competing store.
// Visibility and shared fonts keep living in the existing top-level fields
// (show_*, *_font_size) so the simple panel and the Designer stay in sync.
// Designer-only concerns (order, inserted blocks, per-block style overrides,
// table columns, margins) live under `layout.<family>`.

import { DEFAULT_ORDER } from "../families/defaultOrder";

export const FAMILIES = ["roll", "page"];

export function familyForSize(size) {
  return size === "58mm" || size === "80mm" ? "roll" : "page";
}

// Per-family default item-table columns (mirror the legacy tables).
export function defaultColumns(family) {
  if (family === "roll") {
    return [
      { key: "code", label: "كود", visible: true, align: "right" },
      { key: "name", label: "الصنف", visible: true, align: "right" },
      { key: "qty", label: "كمية", visible: true, align: "center" },
      { key: "total", label: "إجمالي", visible: true, align: "left" },
    ];
  }
  return [
    { key: "code", label: "كود", visible: true, align: "center" },
    { key: "name", label: "المنتج", visible: true, align: "right" },
    { key: "qty", label: "كمية", visible: true, align: "center" },
    { key: "price", label: "سعر", visible: true, align: "center" },
    { key: "total", label: "إجمالي", visible: true, align: "left" },
  ];
}

// Block types the simple panel exposes as show_* toggles. Hiding these writes
// the shared field (two-way sync); other blocks are hidden by dropping them
// from the family order.
export const SHOW_KEY = {
  logo: "show_logo",
  branch: "show_branch",
  address: "show_address",
  tax_id: "show_tax_id",
  doc_date: "show_invoice_date",
  customer: "show_customer_name",
  cashier: "show_cashier_name",
  subtotal: "show_subtotal",
  discount: "show_discount_line",
  tax: "show_tax",
  payments: "show_payment_details",
  footer_text: "show_footer",
  qr: "show_qr",
};

// Style-override keys applied generically by LayoutRenderer as a wrapper.
export const STYLE_KEYS = ["fontSize", "color", "align", "bold", "italic", "width"];

export function overrideStyle(o = {}) {
  if (!o) return null;
  const style = {};
  if (o.fontSize != null && o.fontSize !== "") style.fontSize = `${o.fontSize}px`;
  if (o.color) style.color = o.color;
  if (o.align) style.textAlign = o.align;
  if (o.bold != null) style.fontWeight = o.bold ? 900 : 400;
  if (o.italic) style.fontStyle = "italic";
  if (o.width != null && o.width !== "") style.width = typeof o.width === "number" ? `${o.width}%` : o.width;
  return Object.keys(style).length ? style : null;
}

export function seedFamilyLayout(family) {
  return {
    order: [...DEFAULT_ORDER[family]],
    inserted: [],
    perBlock: {},
    columns: { items_table: defaultColumns(family) },
    margins: {},
  };
}

// Returns a NEW settings object with layout.roll / layout.page seeded if absent.
// Existing layout entries are preserved untouched. Non-mutating.
export function ensureLayout(settings = {}) {
  const layout = { ...(settings.layout || {}) };
  FAMILIES.forEach((fam) => {
    if (!layout[fam]) layout[fam] = seedFamilyLayout(fam);
  });
  return { ...settings, layout };
}

let _id = 0;
export function newInsertId() {
  _id += 1;
  return `d_${Date.now().toString(36)}_${_id}`;
}
