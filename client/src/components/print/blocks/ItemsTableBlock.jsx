import React from "react";
import { g } from "./blockUtils";

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
const discountOf = (line) => (Number(line.discount_amount) || 0).toFixed(2);

const VALUE = {
  code: (line) => codeOf(line),
  name: (line) => nameOf(line),
  unit: (line) => unitOf(line),
  qty: (line) => line.quantity,
  price: (line) => priceOf(line).toFixed(2),
  discount: (line) => discountOf(line),
  total: (line) => lineTotalOf(line).toFixed(2),
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
  const invoiceKeys = designerCols ? null : useInvoiceKeys(s);
  const cols = designerCols || (invoiceKeys ? invoiceKeys.map(k => ({ key: k, label: HEADER[k] })) : null);
  // Optional table styling (Designer): zebra rows + border style.
  const zebra = props.zebra !== false; // default on
  const border = props.tableBorder || "none"; // 'none' | 'lines' | 'grid'
  const cellBorder = border === "grid" ? { border: "1px solid #e2e8f0" } : border === "lines" ? { borderBottom: "1px solid #e2e8f0" } : {};

  if (family === "page") {
    const showCode = designerCols ? designerCols.some((c) => c.key === "code") : (invoiceKeys ? invoiceKeys.includes("code") : g(s, "show_item_code") !== false);
    if (cols) {
      const showRowNum = !invoiceKeys || invoiceKeys.length <= 5;
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
                  }}>{VALUE[c.key](line)}</td>
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
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700 }}>{line.quantity}</td>
              <td style={{ textAlign: "center", padding: "3px 6px", fontWeight: 700 }}>{priceOf(line).toFixed(2)}</td>
              <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: 800 }}>{lineTotalOf(line).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Roll: merge code + name into a single "الصنف" column (~50% width).
  // "SKU - product name" on one line saves horizontal space on narrow thermal paper.
  const showPrice = invoiceKeys ? invoiceKeys.includes("price") : false;

  const mergedItemName = (line) => {
    const code = codeOf(line);
    const name = nameOf(line);
    return code ? `${code} - ${name}` : name;
  };

  const cell = { padding: "3px 5px", fontWeight: 800 };
  const headCell = { padding: "3px 5px", fontWeight: 800, color: "#fff", textAlign: "center" };

  if (cols) {
    // Drop the separate 'code' column — always inline it into 'name' as "SKU - name".
    const displayCols = cols.filter(c => c.key !== "code");
    return (
      <table style={{ width: "100%", fontSize, borderCollapse: "collapse", fontWeight: 700 }}>
        <thead>
          <tr style={{ background: "#000" }}>
            {displayCols.map((c) => (
              <th key={c.key} style={{
                ...headCell,
                textAlign: c.align || (c.key === "name" ? "right" : "center"),
                ...(c.key === "name" ? { width: "60%" } : {}),
              }}>
                {c.key === "name" ? "الصنف" : (c.label || HEADER[c.key])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              {displayCols.map((c) => (
                <td key={c.key} style={{
                  textAlign: c.align || (c.key === "qty" ? "center" : c.key === "total" ? "left" : "right"),
                  padding: "2px 4px", fontWeight: 700,
                  ...(c.key === "name" ? { width: "60%", wordBreak: "break-word" } : { whiteSpace: "nowrap" }),
                }}>
                  {c.key === "name" ? mergedItemName(line) : VALUE[c.key](line)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table style={{ width: "100%", fontSize, borderCollapse: "collapse", fontWeight: 800 }}>
      <thead>
        <tr style={{ background: "#000" }}>
          <th style={{ ...headCell, width: "60%", textAlign: "right" }}>الصنف</th>
          <th style={headCell}>كمية</th>
          {showPrice && <th style={headCell}>سعر</th>}
          <th style={headCell}>إجمالي</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            <td style={{ ...cell, textAlign: "right", width: "60%", wordBreak: "break-word" }}>{mergedItemName(line)}</td>
            <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap" }}>{line.quantity}</td>
            {showPrice && <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap" }}>{priceOf(line).toFixed(2)}</td>}
            <td style={{ ...cell, textAlign: "center", whiteSpace: "nowrap" }}>{lineTotalOf(line).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
