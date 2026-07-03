import React from "react";
import { g, smartFormat, formatPrintDigits, resolveThermalColumns, defaultThermalKeys, rollPaperWidthMm } from "./blockUtils";

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
  // Optional table styling (Designer): zebra rows + border style.
  const zebra = props.zebra !== false; // default on
  const border = props.tableBorder || "none"; // 'none' | 'lines' | 'grid'
  const cellBorder = border === "grid" ? { border: "1px solid #e2e8f0" } : border === "lines" ? { borderBottom: "1px solid #e2e8f0" } : {};

  if (family === "page") {
    const pageInvoiceKeys = !designerCols ? useInvoiceKeys(s) : null;
    const showCode = designerCols ? designerCols.some((c) => c.key === "code") : (pageInvoiceKeys ? pageInvoiceKeys.includes("code") : g(s, "show_item_code") !== false);
    if (cols) {
      const showRowNum = !pageInvoiceKeys || pageInvoiceKeys.length <= 5;
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginBottom: "8px", fontWeight: 600 }}>
          <thead>
            <tr style={{ background: accent, color: "#fff", fontWeight: 700 }}>
              {showRowNum && <th style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, ...cellBorder }}>#</th>}
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: "center", padding: "4px 6px", fontWeight: 700, ...cellBorder, ...(c.key === "code" ? { fontSize: "10px" } : {}) }}>{c.label || HEADER[c.key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ background: zebra && i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                {showRowNum && <td style={{ padding: "3px 6px", color: "#475569", fontWeight: 700, ...cellBorder }}>{i + 1}</td>}
                {cols.map((c) => (
                  <td key={c.key} style={{
                    textAlign: c.align || (c.key === "name" ? "right" : c.key === "total" ? "left" : "center"),
                    padding: "3px 6px", fontWeight: 700, ...cellBorder,
                    ...(c.key === "code" ? { fontSize: "10px", color: "#334155", fontFamily: "monospace" } : {}),
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

  const headCell = { padding: "0 4px 3px", fontWeight: 900, textAlign: "center", fontSize: "10px", color: "#fff" };
  const cell = { padding: "2px 4px", fontWeight: 700 };
  // Thermal printers are 1-bit: light-gray hairlines dither to nothing on
  // paper. Roll tables must rule with pure black to actually print.
  const rb = "1px solid #000";

  if (cols) {
    const displayCols = cols.filter(c => c.key !== "code");
    return (
      <table style={{ width: "100%", fontSize, borderCollapse: "collapse", marginTop: "2px", border: rb }}>
        <thead>
          <tr style={{ background: "#000" }}>
            {displayCols.map((c, ci) => (
              <th key={c.key} style={{
                ...headCell,
                textAlign: c.align || (c.key === "name" ? "right" : "center"),
                ...(c.key === "name" ? { width: "60%" } : {}),
                borderBottom: "2px solid #000",
                borderLeft: ci > 0 ? rb : "none",
              }}>
                {c.key === "name" ? "الصنف" : (c.label || HEADER[c.key])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              {displayCols.map((c, ci) => (
                <td key={c.key} style={{
                  textAlign: c.align || (c.key === "qty" ? "center" : c.key === "total" ? "left" : "right"),
                  padding: "2px 4px", fontWeight: 700,
                  ...(c.key === "name" ? { width: "60%", wordBreak: "break-word" } : { whiteSpace: "nowrap" }),
                  borderBottom: rb,
                  borderLeft: ci > 0 ? rb : "none",
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
    <table style={{ width: "100%", fontSize, borderCollapse: "collapse", marginTop: "2px", border: rb }}>
      <thead>
        <tr style={{ background: "#000" }}>
          <th style={{ ...headCell, width: "60%", textAlign: "right", borderBottom: "2px solid #000", borderLeft: rb }}>الصنف</th>
          <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rb }}>كمية</th>
          {showPrice && <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rb }}>سعر</th>}
          <th style={{ ...headCell, borderBottom: "2px solid #000", borderLeft: rb }}>إجمالي</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            <td style={{ ...cell, textAlign: "right", width: "60%", wordBreak: "break-word", borderBottom: rb, borderLeft: rb }}>{mergedItemName(line)}</td>
            <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap", borderBottom: rb, borderLeft: rb }}>{formatPrintDigits(s, String(line.quantity))}</td>
            {showPrice && <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap", borderBottom: rb, borderLeft: rb }}>{smartFormat(priceOf(line), s)}</td>}
            <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap", borderBottom: rb, borderLeft: rb }}>{smartFormat(lineTotalOf(line), s)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
