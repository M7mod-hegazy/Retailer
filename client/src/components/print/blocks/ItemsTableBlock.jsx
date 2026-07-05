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
  price: (line, s) => smartFormat(priceOf(line), s),
  discount: (line, s) => discountOf(line, s),
  total: (line, s) => smartFormat(lineTotalOf(line), s),
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
export default function ItemsTableBlock({ invoice = {}, settings: s, props = {}, family }) {
  const lines = invoice.lines || [];
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

  if (family === "page") {
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
              <tr key={i} style={{ background: zebra && i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                {showRowNum && <td style={{ padding: `${pagePadY}px 6px`, color: "#475569", fontWeight: 700, ...cellBorder }}>{i + 1}</td>}
                {cols.map((c) => (
                  <td key={c.key} style={{
                    textAlign: c.align || (c.key === "name" ? "right" : c.key === "total" ? "left" : "center"),
                    padding: `${pagePadY}px 6px`, fontWeight: 700, ...cellBorder,
                    ...(c.key === "code" ? { fontSize: "10px", color: "#334155", fontFamily: "monospace" } : {}),
                    ...(c.key === "name" && nameWidth ? { width: `${nameWidth}%` } : {}),
                    ...(c.key === "total" ? { fontWeight: 800 } : {}),
                  }}>{VALUE[c.key](line, s)}</td>
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
            <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
              <td style={{ padding: "3px 6px", color: "#475569", fontWeight: 700 }}>{i + 1}</td>
              {showCode && <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "10px", color: "#334155", fontFamily: "monospace", fontWeight: 700 }}>{codeOf(line)}</td>}
              <td style={{ padding: "3px 6px", fontWeight: 700 }}>{nameOf(line)}</td>
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700 }}>{formatPrintDigits(s, String(line.quantity))}</td>
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700 }}>{smartFormat(priceOf(line), s)}</td>
              <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: 800 }}>{smartFormat(lineTotalOf(line), s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Roll: merge code + name into a single "الصنف" column (~50% width).
  // "SKU - product name" on one line saves horizontal space on narrow thermal paper.
  const showPrice = defaultThermalKeys(rollPaperWidthMm(s)).includes("price");

  const mergedItemName = (line) => {
    const code = codeOf(line);
    const name = nameOf(line);
    return code ? `${code} - ${name}` : name;
  };

  // Thermal printers are 1-bit: light-gray hairlines dither to nothing on
  // paper. Roll tables rule with pure black — but border MODE, thickness,
  // row density, name-column width and header size are all user-controlled.
  const rb = `${lw}px solid #000`;
  const rollOuter = border === "grid" ? { border: rb } : {};
  const rollV = (ci) => (border === "grid" && ci > 0 ? rb : "none");   // vertical rules
  const rollH = border === "none" ? "none" : rb;                        // row separators
  const rollNameW = `${nameWidth != null ? nameWidth : 60}%`;
  const rollPadY = rowPad != null ? rowPad : 2;
  const rollHeadFs = headerFontSize != null ? headerFontSize : 10;
  const rollDark = headerVariant !== "light";
  const headCell = {
    padding: "0 4px 3px", fontWeight: 900, textAlign: "center",
    fontSize: `${rollHeadFs}px`, color: rollDark ? "#fff" : "#000",
  };
  const rollHeadRow = rollDark ? { background: "#000" } : {};
  const cell = { padding: `${rollPadY}px 4px`, fontWeight: 700 };

  // Fixed table layout makes header dividers line up exactly with the body
  // cells (auto layout drifted when content widths varied) AND lets narrow
  // 58mm columns wrap instead of overflowing the band. A <colgroup> pins the
  // name column; the value columns split the rest evenly.
  const paperMm = rollPaperWidthMm(s);
  const rollMax = maxThermalColumns(paperMm); // 58mm → 3, 80mm → 4 (incl. name)
  const nameW = nameWidth != null ? nameWidth : 60;
  const rollColGroup = (valueCount) => {
    const others = valueCount; // non-name columns
    const each = others > 0 ? (100 - nameW) / others : 0;
    return (
      <colgroup>
        <col style={{ width: `${nameW}%` }} />
        {Array.from({ length: others }).map((_, i) => <col key={i} style={{ width: `${each}%` }} />)}
      </colgroup>
    );
  };

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
      // keep original left-to-right order
      const keep = new Set([...name, ...rest].map(c => c.key));
      displayCols = displayCols.filter(c => keep.has(c.key));
    }
    const valueCount = displayCols.filter(c => c.key !== "name").length;
    return (
      <table style={{ width: "100%", fontSize, borderCollapse: "collapse", tableLayout: "fixed", marginTop: "2px", ...rollOuter }}>
        {rollColGroup(valueCount)}
        {headerVariant !== "none" && (
        <thead>
          <tr style={rollHeadRow}>
            {displayCols.map((c, ci) => (
              <th key={c.key} style={{
                ...headCell,
                textAlign: c.align || (c.key === "name" ? "right" : "center"),
                borderBottom: "2px solid #000",
                borderLeft: rollV(ci),
                wordBreak: "break-word",
              }}>
                {c.key === "name" ? "الصنف" : (c.label || HEADER[c.key])}
              </th>
            ))}
          </tr>
        </thead>
        )}
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              {displayCols.map((c, ci) => (
                <td key={c.key} style={{
                  ...cell,
                  textAlign: c.align || (c.key === "qty" ? "center" : c.key === "total" ? "left" : "right"),
                  wordBreak: "break-word",
                  borderBottom: rollH,
                  borderLeft: rollV(ci),
                }}>
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
    <table style={{ width: "100%", fontSize, borderCollapse: "collapse", tableLayout: "fixed", marginTop: "2px", ...rollOuter }}>
      {rollColGroup(showPrice ? 3 : 2)}
      {headerVariant !== "none" && (
      <thead>
        <tr style={rollHeadRow}>
          <th style={{ ...headCell, textAlign: "right", borderBottom: "2px solid #000", borderLeft: rollV(1), wordBreak: "break-word" }}>الصنف</th>
          <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rollV(1) }}>كمية</th>
          {showPrice && <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rollV(1) }}>سعر</th>}
          <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rollV(1) }}>إجمالي</th>
        </tr>
      </thead>
      )}
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            <td style={{ ...cell, textAlign: "right", wordBreak: "break-word", borderBottom: rollH, borderLeft: rollV(1) }}>{mergedItemName(line)}</td>
            <td style={{ ...cell, textAlign: "center", wordBreak: "break-word", borderBottom: rollH, borderLeft: rollV(1) }}>{formatPrintDigits(s, String(line.quantity))}</td>
            {showPrice && <td style={{ ...cell, textAlign: "center", wordBreak: "break-word", borderBottom: rollH, borderLeft: rollV(1) }}>{smartFormat(priceOf(line), s)}</td>}
            <td style={{ ...cell, textAlign: "center", wordBreak: "break-word", borderBottom: rollH, borderLeft: rollV(1) }}>{smartFormat(lineTotalOf(line), s)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
