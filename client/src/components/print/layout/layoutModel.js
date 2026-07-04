// Layout data model for the Print Designer.
//
// The single source of truth stays the per-doc settings JSON. We *extend* it
// with a `layout` field (per size-family) — we never add a competing store.
// Visibility and shared fonts keep living in the existing top-level fields
// (show_*, *_font_size) so the simple panel and the Designer stay in sync.
// Designer-only concerns (order, inserted blocks, per-block style overrides,
// table columns, margins) live under `layout.<family>`.

import { DEFAULT_ORDER } from "../families/defaultOrder";
import { mergeFamilyLayouts, normalizeLayout } from "@shared/printLayout";

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
  notes: "show_notes",
  footer_text: "show_footer",
  qr: "show_qr",
};

// Style-override keys applied generically by LayoutRenderer as a wrapper.
export const STYLE_KEYS = [
  "fontSize", "color", "align", "bold", "italic", "width",
  "fontFamily", "lineHeight", "background", "padding",
  "borderWidth", "borderStyle", "borderColor", "borderRadius",
];

export function overrideStyle(o = {}) {
  if (!o) return null;
  const style = {};
  if (o.fontSize != null && o.fontSize !== "") style.fontSize = `${o.fontSize}px`;
  if (o.color) style.color = o.color;
  if (o.align) style.textAlign = o.align;
  if (o.bold != null) style.fontWeight = o.bold ? 900 : 400;
  if (o.italic) style.fontStyle = "italic";
  if (o.width != null && o.width !== "") style.width = typeof o.width === "number" ? `${o.width}%` : o.width;
  if (o.fontFamily) style.fontFamily = o.fontFamily;
  if (o.lineHeight != null && o.lineHeight !== "") style.lineHeight = o.lineHeight;
  return Object.keys(style).length ? style : null;
}

// Box styling (width, spacing, surface: background/padding/border/radius)
// lives on the wrapper element — values the inner block can't override.
// Returns a style object or null.
export function overrideBox(o = {}) {
  if (!o) return null;
  const style = {};
  if (o.width != null && o.width !== "") style.width = typeof o.width === "number" ? `${o.width}%` : o.width;
  if (o.marginTop != null && o.marginTop !== "") style.marginTop = `${o.marginTop}px`;
  if (o.marginBottom != null && o.marginBottom !== "") style.marginBottom = `${o.marginBottom}px`;
  if (o.background) style.background = o.background;
  if (o.padding != null && o.padding !== "" && Number(o.padding) !== 0) style.padding = `${o.padding}px`;
  if (o.borderWidth != null && Number(o.borderWidth) > 0) {
    style.border = `${o.borderWidth}px ${o.borderStyle || "solid"} ${o.borderColor || "#000"}`;
  }
  if (o.borderRadius != null && Number(o.borderRadius) > 0) style.borderRadius = `${o.borderRadius}px`;
  return Object.keys(style).length ? style : null;
}

// Font/color/weight/style/align must beat the block's own inline styles, so we
// emit scoped `!important` rules that target the wrapper and its descendants.
export function overrideCss(o = {}, selector) {
  if (!o) return "";
  const d = [];
  if (o.fontSize != null && o.fontSize !== "") d.push(`font-size:${o.fontSize}px !important`);
  if (o.color) d.push(`color:${o.color} !important`);
  if (o.bold != null) d.push(`font-weight:${o.bold ? 900 : 400} !important`);
  if (o.italic) d.push("font-style:italic !important");
  if (o.align) d.push(`text-align:${o.align} !important`);
  if (o.fontFamily) d.push(`font-family:${o.fontFamily} !important`);
  if (o.lineHeight != null && o.lineHeight !== "") d.push(`line-height:${o.lineHeight} !important`);
  if (!d.length) return "";
  return `${selector},${selector} *{${d.join(";")}}`;
}

export function seedFamilyLayout(family) {
  return {
    order: [...DEFAULT_ORDER[family]],
    inserted: [],
    // Columns live in perBlock.items_table.columns — the location the print
    // renderer reads. (The old top-level `columns` bag never reached paper.)
    perBlock: { items_table: { columns: defaultColumns(family) } },
    margins: {},
  };
}

// Re-exported for client callers; implementation is shared with the server
// route + migration so saved layouts normalize identically everywhere.
export { normalizeLayout, mergeFamilyLayouts };

/**
 * Effective layout for one family: _global scope layout under the per-doc
 * layout (per-doc wins), both normalized first. Either argument may be a full
 * settings object ({ layout: {...} }) or null.
 */
export function resolveEffectiveLayout(globalScopeSettings, docSettings, family) {
  const gl = normalizeLayout(globalScopeSettings || {}).settings.layout || {};
  const dl = normalizeLayout(docSettings || {}).settings.layout || {};
  return mergeFamilyLayouts(gl[family], dl[family]);
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
