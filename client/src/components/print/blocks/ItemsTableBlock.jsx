import React from "react";
import { g, smartFormat, formatPrintDigits, resolveThermalColumns, defaultThermalKeys, rollPaperWidthMm, maxThermalColumns } from "./blockUtils";

const lineTotalOf = (line) =>
  ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
const priceOf = (line) => (Number(line.unit_price) || Number(line.unit_cost) || 0);
const codeOf = (line) => line.sku || line.code || line.item_code || line.barcode || line.product_code || "";
const nameOf = (line) => {
  const base = line.product_name || line.item_name || line.name || "";
  if (line.sold_unit_name) {
    const q = line.sold_unit_qty != null ? line.sold_unit_qty : "";
    return `${base} — ${q} ${line.sold_unit_name}`.trim();
  }
  return base;
};
const unitOf = (line) => line.unit_name || line.sold_unit_name || "";
const discountOf = (line, s) => smartFormat(Number(line.discount_amount) || 0, s);

const VALUE = {
  code: (line) => codeOf(line),
  name: (line) => nameOf(line),
  unit: (line) => unitOf(line),
  qty: (line, s) => formatPrintDigits(s, String(line.quantity)),
  price: (line, s, props) => {
    if (props?.hideZeroPrice && priceOf(line) === 0) return "";
    return smartFormat(priceOf(line), s);
  },
  discount: (line, s) => discountOf(line, s),
  total: (line, s, props) => {
    if (props?.hideZeroPrice && lineTotalOf(line) === 0) return "";
    return smartFormat(lineTotalOf(line), s);
  },
};
const HEADER = { code: "كود", name: "المنتج", unit: "الوحدة", qty: "كمية", price: "سعر", discount: "الخصم", total: "إجمالي" };

function useInvoiceKeys(s) {
  const raw = s?.invoice_print_column_keys;
  if (Array.isArray(raw) && raw.length > 0) {
    const valid = raw.filter(k => VALUE[k]);
    return valid.length ? valid : null;
  }
  return null;
}

// Roll honors legacy thermal columns; page reproduces the PrintA4Doc table.
// When `props.columns` is supplied (by the Designer), the table is driven by it
// (visibility, order, alignment, labels). Without it, output is unchanged.
// Realistic mock product lines for editing preview — covers all column types:
// code, name, unit, qty, price, discount, total
const MOCK_LINES = [
  { product_name: "قميص قطني أبيض", quantity: 2, unit_price: 85, unit_name: "قطعة", sku: "SH-001", discount_amount: 0 },
  { product_name: "بنطلون جينز أزرق", quantity: 1, unit_price: 230, unit_name: "قطعة", sku: "PA-042", discount_amount: 20 },
  { product_name: "حزام جلد بني", quantity: 1, unit_price: 75, unit_name: "قطعة", sku: "BL-018", discount_amount: 0 },
];

export default function ItemsTableBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const realLines = invoice.lines || [];
  const lines = realLines.length > 0 ? realLines : (editing ? MOCK_LINES : []);
  if (!lines.length) return null;
  const accent = g(s, "accent_color");
  const fontSize = `${g(s, "item_font_size")}px`;
  const designerCols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false && VALUE[c.key])
    : null;
  let cols = null;
  if (designerCols) {
    cols = designerCols;
  } else if (family === "roll") {
    const thermalKeys = resolveThermalColumns(s);
    if (thermalKeys.length > 0) {
      cols = thermalKeys.map(k => ({ key: k, label: HEADER[k] }));
    }
  } else {
    const invoiceKeys = useInvoiceKeys(s);
    if (invoiceKeys) {
      cols = invoiceKeys.map(k => ({ key: k, label: HEADER[k] }));
    }
  }
  // Deep table styling (Studio) — every knob below is consumed for real:
  //   zebra (page)          — striped rows
  //   tableBorder           — "grid" | "lines" | "none" (honored on ROLL too)
  //   headerVariant         — "dark" filled band | "light" underlined | "none"
  //   lineWidth             — rule thickness in px (1-3)
  //   lineColor (page)      — rule color (roll stays pure black for thermal)
  //   headerBg/headerColor (page) — filled-header colors (default: accent/#fff)
  //   rowPad                — vertical cell padding in px (row density)
  //   nameWidth             — item-name column width in %
  //   headerFontSize        — header row font size in px
  //   showRowNum (page)     — force the # column on/off
  const zebra = props.zebra !== false; // default on
  const lw = Math.max(1, Math.min(4, Number(props.lineWidth) || 1));
  const rowPad = props.rowPad != null ? Math.max(0, Number(props.rowPad)) : null;
  const nameWidth = props.nameWidth != null ? Math.max(20, Math.min(85, Number(props.nameWidth))) : null;
  const headerFontSize = props.headerFontSize != null ? Number(props.headerFontSize) : null;
  // Roll historically always drew the full grid — keep that as the roll
  // default so raw documents don't change, but honor explicit choices.
  const border = props.tableBorder || (family === "roll" ? "grid" : "none");
  const headerVariant = props.headerVariant || "dark";
  const lineColor = props.lineColor || "#e2e8f0";
  const cellBorder = border === "grid" ? { border: `${lw}px solid ${lineColor}` } : border === "lines" ? { borderBottom: `${lw}px solid ${lineColor}` } : {};
  const pageHeadRow = headerVariant === "light"
    ? { background: "transparent", color: props.headerColor || accent, fontWeight: 900, borderBottom: `2px solid ${props.headerColor || accent}` }
    : { background: props.headerBg || accent, color: props.headerColor || "#fff", fontWeight: 700 };
  const pagePadY = rowPad != null ? rowPad : 3;
  const pageHeadFs = headerFontSize != null ? { fontSize: `${headerFontSize}px` } : {};
  
  const cellValign = props.cellValign || "middle";
  const zebraBg = props.zebraBgColor || "#f8fafc";
  const textColor = props.textColor || "#000";

  // Hoisted so both the page and roll branches can use it.
  const mergedItemName = (line) => {
    const code = codeOf(line);
    const name = nameOf(line);
    return code ? `${code} - ${name}` : name;
  };

  if (family === "roll") {
    const currencySymbol = g(s, "currency_symbol");

    // ── Variant: Cards (stacked block per item, dashed separators) ──
    if (props.variant === "cards") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ borderTop: i > 0 ? "1px dashed #000" : "none", padding: "3px 0" }}>
              <div style={{ fontWeight: 900 }}>{mergedItemName(line)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em" }}>
                <span>{formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)}</span>
                <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Minimalist List (borderless, one line per item) ──
    if (props.variant === "minimalist-list") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
              <span>{mergedItemName(line)} ×{formatPrintDigits(s, String(line.quantity))}</span>
              <span style={{ fontWeight: 800 }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Compact (dense single-line items, no padding) ──
    if (props.variant === "compact") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize: "0.9em", marginBottom: "2px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: 0, lineHeight: 1.3 }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mergedItemName(line)}</span>
              <span style={{ fontWeight: 900, marginInlineStart: "4px", whiteSpace: "nowrap" }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Borderless (no grid lines, just separators) ──
    if (props.variant === "borderless") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dotted #999" }}>
              <span>{mergedItemName(line)} ×{formatPrintDigits(s, String(line.quantity))}</span>
              <span style={{ fontWeight: 800 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Receipt (classic thermal receipt: dotted dividers, qty×price per line) ──
    if (props.variant === "receipt") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "1px 0", marginBottom: "2px", textAlign: "center", fontWeight: 900, fontSize: "0.9em" }}>
            ── الأصناف ──
          </div>
          {lines.map((line, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 0" }}>
                <span style={{ fontWeight: 900 }}>{mergedItemName(line)}</span>
                <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85em", color: "#475569", paddingBottom: "2px", borderBottom: "1px dotted #999" }}>
                <span>{formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)}</span>
                <span>{currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Ticket (order ticket: numbered prefix, bold amounts) ──
    if (props.variant === "ticket") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: "4px", padding: "2px 0", borderBottom: "1px solid #000" }}>
              <span style={{ fontWeight: 900, minWidth: "18px", textAlign: "center", borderInlineEnd: "1px solid #000", paddingInlineEnd: "4px" }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontWeight: 700 }}>{mergedItemName(line)}</span>
              <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Ledger (monospace, fixed-width columns, old-school) ──
    if (props.variant === "ledger") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize: "0.85em", marginBottom: "4px", color: "#000", fontFamily: "monospace" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderBottom: "2px solid #000", paddingBottom: "2px", marginBottom: "2px" }}>
            <span>الصنف</span>
            <span>كمية</span>
            <span>إجمالي</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", background: i % 2 === 0 ? "#f1f5f9" : "transparent" }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{mergedItemName(line)}</span>
              <span style={{ width: "24px", textAlign: "center" }}>{formatPrintDigits(s, String(line.quantity))}</span>
              <span style={{ fontWeight: 900, minWidth: "50px", textAlign: "left" }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Dashed (dashed box around each item) ──
    if (props.variant === "dashed") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ border: "1px dashed #000", padding: "3px 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 900 }}>{mergedItemName(line)}</span>
                <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
              <div style={{ fontSize: "0.85em", color: "#475569" }}>
                {formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)} {currencySymbol}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Boxed Items (each item in a solid box) ──
    if (props.variant === "boxed-items") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ border: "1px solid #000", padding: "2px 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 900 }}>{mergedItemName(line)}</span>
                <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Numbered (bullets with dot leaders) ──
    if (props.variant === "numbered") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "4px", padding: "1px 0" }}>
              <span style={{ fontWeight: 900, minWidth: "14px" }}>{i + 1}.</span>
              <span style={{ fontWeight: 700 }}>{nameOf(line)}</span>
              <span style={{ flex: 1, borderBottom: "1px dotted #000", marginInline: "2px", minWidth: "20px" }} />
              <span style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Two-line (name on line 1, qty × price → total on line 2, no borders) ──
    if (props.variant === "two-line") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i}>
              <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{mergedItemName(line)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em", color: "#475569" }}>
                <span>{formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)} {currencySymbol}</span>
                <span style={{ fontWeight: 900, color: "#000" }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Striped (alternating background for thermal) ──
    if (props.variant === "striped") {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize, marginBottom: "4px", color: "#000" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: i % 2 === 0 ? "#e2e8f0" : "transparent" }}>
              <span style={{ fontWeight: 700 }}>{mergedItemName(line)}</span>
              <span style={{ fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Receipt-wide (wider format for 80mm: name, qty, price, total in 4 cols) ──
    if (props.variant === "receipt-wide") {
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em", marginBottom: "4px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #000" }}>
              <th style={{ textAlign: "right", padding: "1px 2px", fontWeight: 900 }}>الصنف</th>
              <th style={{ textAlign: "center", padding: "1px 2px", fontWeight: 900 }}>ك</th>
              <th style={{ textAlign: "center", padding: "1px 2px", fontWeight: 900 }}>سعر</th>
              <th style={{ textAlign: "left", padding: "1px 2px", fontWeight: 900 }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px dotted #000" }}>
                <td style={{ padding: "1px 2px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50%" }}>{nameOf(line)}</td>
                <td style={{ padding: "1px 2px", textAlign: "center" }}>{formatPrintDigits(s, String(line.quantity))}</td>
                <td style={{ padding: "1px 2px", textAlign: "center" }}>{smartFormat(priceOf(line), s)}</td>
                <td style={{ padding: "1px 2px", textAlign: "left", fontWeight: 900 }}>{smartFormat(lineTotalOf(line), s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }

  if (family === "page") {
    // ── Variant: Cards (Boutique layout cards deck) ──
    if (props.variant === "cards") {
      const currencySymbol = g(s, "currency_symbol");
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px", fontSize }}>
          {lines.map((line, i) => (
            <div 
              key={i} 
              style={{
                border: `1px solid ${lineColor}`,
                borderRadius: "8px",
                padding: "8px 12px",
                background: zebra && i % 2 === 0 ? zebraBg : "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                color: textColor,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 800, fontSize: "1.05em", color: textColor }}>{nameOf(line)}</span>
                {codeOf(line) && <span style={{ fontSize: "0.85em", color: "#64748b", fontFamily: "monospace" }}>SKU: {codeOf(line)}</span>}
                <span style={{ fontSize: "0.9em", color: "#475569" }}>
                  {formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)} {currencySymbol}
                  {Number(line.discount_amount) > 0 && <span style={{ color: "#dc2626", marginRight: "6px" }}> (خصم -{smartFormat(Number(line.discount_amount), s)})</span>}
                </span>
              </div>
              <div style={{ textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "0.8em", color: "#64748b" }}>الإجمالي</span>
                <span style={{ fontWeight: 900, fontSize: "1.15em", color: accent }}>{smartFormat(lineTotalOf(line), s)} {currencySymbol}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Minimalist List (Cafe/Studio clean list) ──
    if (props.variant === "minimalist-list") {
      const currencySymbol = g(s, "currency_symbol");
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", fontSize, borderBottom: `1px solid ${lineColor}`, paddingBottom: "6px", color: textColor }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: textColor }}>
              <span style={{ fontWeight: 700 }}>
                {nameOf(line)}
                <span style={{ color: "#64748b", fontSize: "0.9em", marginRight: "8px" }}>
                  ({formatPrintDigits(s, String(line.quantity))} × {smartFormat(priceOf(line), s)})
                </span>
              </span>
              <span style={{ fontWeight: 800, color: textColor }}>
                {smartFormat(lineTotalOf(line), s)} {currencySymbol}
              </span>
            </div>
          ))}
        </div>
      );
    }

    // ── Variant: Ledger (old-school alternating gray, monospace amounts) ──
    if (props.variant === "ledger") {
      const currencySymbol = g(s, "currency_symbol");
      return (
        <div style={{ marginBottom: "8px", fontSize, fontFamily: "monospace", color: textColor }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: "0",
            borderBottom: "2px solid #1e293b",
            paddingBottom: "3px",
            marginBottom: "2px",
            fontSize: "9px",
            fontWeight: 900,
            color: "#1e293b",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            <span>الصنف</span>
            <span style={{ textAlign: "center", minWidth: "36px" }}>كمية</span>
            <span style={{ textAlign: "center", minWidth: "52px" }}>سعر</span>
            <span style={{ textAlign: "left", minWidth: "60px" }}>إجمالي</span>
          </div>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: "0",
                padding: "3px 0",
                background: i % 2 === 0 ? zebraBg : "transparent",
                borderBottom: "1px solid #cbd5e1",
              }}
            >
              <span style={{ fontWeight: 700, color: textColor, paddingRight: "4px" }}>{nameOf(line)}</span>
              <span style={{ textAlign: "center", minWidth: "36px", color: "#475569" }}>{formatPrintDigits(s, String(line.quantity))}</span>
              <span style={{ textAlign: "center", minWidth: "52px", color: "#475569" }}>{smartFormat(priceOf(line), s)}</span>
              <span style={{ textAlign: "left", minWidth: "60px", fontWeight: 800, color: textColor }}>{smartFormat(lineTotalOf(line), s)}</span>
            </div>
          ))}
        </div>
      );
    }


    const pageInvoiceKeys = !designerCols ? useInvoiceKeys(s) : null;
    const showCode = designerCols ? designerCols.some((c) => c.key === "code") : (pageInvoiceKeys ? pageInvoiceKeys.includes("code") : g(s, "show_item_code") !== false);
    if (cols) {
      const showRowNum = props.showRowNum != null ? !!props.showRowNum : (!pageInvoiceKeys || pageInvoiceKeys.length <= 5);
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginBottom: "8px", fontWeight: 600 }}>
          {headerVariant !== "none" && (
          <thead>
            <tr style={pageHeadRow}>
              {showRowNum && <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: "inherit", ...cellBorder, ...pageHeadFs }}>#</th>}
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: "center", padding: "4px 6px", fontWeight: "inherit", ...cellBorder, ...pageHeadFs, ...(c.key === "code" ? { fontSize: "10px" } : {}), ...(c.key === "name" && nameWidth ? { width: `${nameWidth}%` } : {}) }}>{c.label || HEADER[c.key]}</th>
              ))}
            </tr>
          </thead>
          )}
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ background: zebra && i % 2 === 0 ? zebraBg : "#fff" }}>
                {showRowNum && <td style={{ padding: `${pagePadY}px 6px`, color: "#475569", fontWeight: 700, ...cellBorder, verticalAlign: cellValign }}>{i + 1}</td>}
                {cols.map((c) => (
                  <td key={c.key} style={{
                    textAlign: c.align || (c.key === "name" ? "right" : c.key === "total" ? "left" : "center"),
                    padding: `${pagePadY}px 6px`, fontWeight: 700, ...cellBorder,
                    verticalAlign: cellValign,
                    color: textColor,
                    ...(c.key === "code" ? { fontSize: "10px", color: "#334155", fontFamily: "monospace" } : {}),
                    ...(c.key === "name" && nameWidth ? { width: `${nameWidth}%` } : {}),
                    ...(c.key === "total" ? { fontWeight: 800 } : {}),
                  }}>{VALUE[c.key](line, s, props)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginBottom: "8px", fontWeight: 600 }}>
        <thead>
          <tr style={{ background: accent, color: "#fff", fontWeight: 700 }}>
            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>#</th>
            {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "10px", fontWeight: 700 }}>كود</th>}
            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>المنتج</th>
            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>كمية</th>
            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>سعر</th>
            <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700 }}>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? zebraBg : "#fff" }}>
              <td style={{ padding: "3px 6px", color: "#475569", fontWeight: 700, verticalAlign: cellValign }}>{i + 1}</td>
              {showCode && <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: 700, verticalAlign: cellValign }}>{codeOf(line)}</td>}
              <td style={{ padding: "3px 6px", fontWeight: 700, verticalAlign: cellValign, color: textColor }}>{nameOf(line)}</td>
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700, verticalAlign: cellValign, color: textColor }}>{formatPrintDigits(s, String(line.quantity))}</td>
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700, verticalAlign: cellValign, color: textColor }}>{VALUE.price(line, s, props)}</td>
              <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: 800, verticalAlign: cellValign, color: textColor }}>{VALUE.total(line, s, props)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Roll: merge code + name into a single "الصنف" column (~50% width).
  // "SKU - product name" on one line saves horizontal space on narrow thermal paper.
  const showPrice = defaultThermalKeys(rollPaperWidthMm(s)).includes("price");

  // Thermal printers are 1-bit: light-gray hairlines dither to nothing on
  // paper. Roll tables rule with pure black — border MODE, thickness, density,
  // name-width and header size are all user-controlled. Uniform per-cell
  // borders (with border-collapse) are what make EVERY divider line up: a
  // shared edge between two cells is one merged line, never a gap.
  const rb = `${lw}px solid #000`;
  const rollPadY = rowPad != null ? rowPad : 2;
  const rollHeadFs = headerFontSize != null ? headerFontSize : 10;
  const rollDark = headerVariant !== "light";
  // per-cell border by mode: grid = full box, lines = bottom only, none = bare
  const bodyBorder = border === "grid" ? { border: rb } : border === "lines" ? { borderBottom: rb } : {};
  const headBorder = border === "grid" ? { borderTop: rb, borderLeft: rb, borderRight: rb, borderBottom: "2px solid #000" } : { borderBottom: "2px solid #000" };
  const headCell = {
    ...headBorder, padding: "1px 4px 3px", fontWeight: 900, textAlign: "center",
    fontSize: `${rollHeadFs}px`, color: rollDark ? "#fff" : "#000",
    whiteSpace: "nowrap", overflow: "hidden",
  };
  const rollHeadRow = rollDark ? { background: "#000" } : {};
  const cell = { ...bodyBorder, padding: `${rollPadY}px 4px`, fontWeight: 700, wordBreak: "break-word" };

  // Fixed layout + <colgroup> pin column widths so header dividers sit exactly
  // above body dividers and 58mm columns wrap instead of overflowing the band.
  const paperMm = rollPaperWidthMm(s);
  const rollMax = maxThermalColumns(paperMm); // 58mm → 3, 80mm → 4 (incl. name)
  const nameW = nameWidth != null ? nameWidth : 60;
  const rollColGroup = (others) => {
    const each = others > 0 ? (100 - nameW) / others : 0;
    return (
      <colgroup>
        <col style={{ width: `${nameW}%` }} />
        {Array.from({ length: others }).map((_, i) => <col key={i} style={{ width: `${each}%` }} />)}
      </colgroup>
    );
  };
  const rollTable = { width: "100%", fontSize, borderCollapse: "collapse", tableLayout: "fixed", marginTop: "2px" };

  if (cols) {
    // Enforce the paper's column ceiling so 58mm never overflows: keep the name
    // column + the highest-value columns (total/price/qty) up to the cap.
    let displayCols = cols.filter(c => c.key !== "code");
    if (displayCols.length > rollMax) {
      const PRIORITY = { name: 5, total: 4, qty: 3, price: 2, discount: 1, unit: 0 };
      const name = displayCols.filter(c => c.key === "name");
      const rest = displayCols.filter(c => c.key !== "name")
        .sort((a, b) => (PRIORITY[b.key] || 0) - (PRIORITY[a.key] || 0))
        .slice(0, Math.max(1, rollMax - name.length));
      const keep = new Set([...name, ...rest].map(c => c.key));
      displayCols = displayCols.filter(c => keep.has(c.key));
    }
    const valueCount = displayCols.filter(c => c.key !== "name").length;
    return (
      <table style={rollTable}>
        {rollColGroup(valueCount)}
        {headerVariant !== "none" && (
        <thead>
          <tr style={rollHeadRow}>
            {displayCols.map((c) => (
              <th key={c.key} style={{ ...headCell, textAlign: c.align || (c.key === "name" ? "right" : "center") }}>
                {c.key === "name" ? "الصنف" : (c.label || HEADER[c.key])}
              </th>
            ))}
          </tr>
        </thead>
        )}
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              {displayCols.map((c) => (
                <td key={c.key} style={{ ...cell, textAlign: c.align || (c.key === "qty" ? "center" : c.key === "total" ? "left" : "right") }}>
                  {c.key === "name" ? mergedItemName(line) : VALUE[c.key](line, s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table style={rollTable}>
      {rollColGroup(showPrice ? 3 : 2)}
      {headerVariant !== "none" && (
      <thead>
        <tr style={rollHeadRow}>
          <th style={{ ...headCell, textAlign: "right" }}>الصنف</th>
          <th style={headCell}>كمية</th>
          {showPrice && <th style={headCell}>سعر</th>}
          <th style={headCell}>إجمالي</th>
        </tr>
      </thead>
      )}
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            <td style={{ ...cell, textAlign: "right" }}>{mergedItemName(line)}</td>
            <td style={{ ...cell, textAlign: "center" }}>{formatPrintDigits(s, String(line.quantity))}</td>
            {showPrice && <td style={{ ...cell, textAlign: "center" }}>{smartFormat(priceOf(line), s)}</td>}
            <td style={{ ...cell, textAlign: "center" }}>{smartFormat(lineTotalOf(line), s)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
