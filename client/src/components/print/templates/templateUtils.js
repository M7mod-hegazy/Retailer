/**
 * Shared style helpers for all template-based print components.
 * Every visual property is settings-driven — zero hardcoded values here.
 */

/**
 * Root container style — font, font-size, direction, padding, overflow.
 * Templates spread this onto their root div.
 */
export function rootStyle(s = {}) {
  const {
    print_font = "Cairo",
    item_font_size = 11,
    page_padding = 16,
  } = s;
  return {
    fontFamily: `${print_font}, "Tahoma", Arial, sans-serif`,
    direction: "rtl",
    fontSize: item_font_size,
    color: "#1e293b",
    background: "#fff",
    maxWidth: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    padding: page_padding,
  };
}

/**
 * Table rendering context — consumes table_* settings and returns
 * style factory functions so every table in every template looks consistent.
 */
export function tableCtx(s = {}) {
  const {
    accent_color = "#1e40af",
    table_header_style = "filled",
    table_border = "rows",
    table_zebra,
    table_row_pad = 7,
    item_font_size = 11,
  } = s;

  const zebra = table_zebra !== false; // default ON
  const isGrid = table_border === "grid";
  const isNone = table_border === "none";

  // table <thead> row style
  const theadRowStyle = {
    background:
      table_header_style === "filled" ? accent_color
      : table_header_style === "light" ? `${accent_color}18`
      : "#f8fafc",
    color: table_header_style === "filled" ? "#fff" : "#334155",
    borderBottom:
      table_header_style === "line" ? `2px solid ${accent_color}` : "none",
  };

  // <th> base style
  const thStyle = (extra = {}) => ({
    padding: `${table_row_pad}px 8px`,
    textAlign: "right",
    fontWeight: 900,
    fontSize: item_font_size - 0.5,
    border: isGrid ? `1px solid ${accent_color}44` : "none",
    ...extra,
  });

  // <tr> style factory
  const trStyle = (i) => ({
    background: zebra ? (i % 2 === 0 ? "#f8fafc" : "#fff") : "#fff",
    borderBottom: isNone ? "none" : "1px solid #e2e8f0",
  });

  // <td> style factory
  const tdStyle = (extra = {}) => ({
    padding: `${table_row_pad}px 8px`,
    fontSize: item_font_size,
    border: isGrid ? "1px solid #e2e8f0" : "none",
    ...extra,
  });

  // <tfoot> totals row
  const tfootStyle = {
    background: "#f1f5f9",
    borderTop: "2px solid #cbd5e1",
  };
  const tfootTdStyle = (extra = {}) => ({
    padding: `${table_row_pad + 1}px 8px`,
    fontWeight: 900,
    fontSize: item_font_size,
    ...extra,
  });

  return { theadRowStyle, thStyle, trStyle, tdStyle, tfootStyle, tfootTdStyle };
}

/**
 * Document-level header context — driven by settings.header_style.
 * Returns everything a template needs to render its header zone.
 *
 * header_style values:
 *   "strip"   — brand on a vertical accent strip, doc-identity on white right pane (default)
 *   "band"    — full-width horizontal accent band across top
 *   "classic" — white/bordered header, accent used for bottom border only
 *   "minimal" — no backgrounds or borders, just whitespace
 */
export function headerCtx(s = {}) {
  const { accent_color = "#1e40af", header_style = "strip" } = s;
  return {
    style: header_style,
    accent: accent_color,
    isBand:    header_style === "band",
    isStrip:   header_style === "strip" || !header_style,
    isClassic: header_style === "classic",
    isMinimal: header_style === "minimal",
  };
}

/** Tiny footer divider style at bottom of every template. */
export function footerDivider(accent_color = "#1e40af") {
  return {
    marginTop: 14,
    paddingTop: 10,
    borderTop: `2px solid ${accent_color}22`,
    display: "flex",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#94a3b8",
  };
}
