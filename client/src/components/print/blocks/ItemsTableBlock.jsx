import React from "react";
import { g } from "./blockUtils";

const lineTotalOf = (line) =>
  ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
const priceOf = (line) => (Number(line.unit_price) || Number(line.unit_cost) || 0);
const codeOf = (line) => line.sku || line.code || line.item_code || line.barcode || line.product_code || "";
const nameOf = (line) => line.product_name || line.item_name || line.name || "";

const VALUE = {
  code: (line) => codeOf(line),
  name: (line) => nameOf(line),
  qty: (line) => line.quantity,
  price: (line) => priceOf(line).toFixed(2),
  total: (line) => lineTotalOf(line).toFixed(2),
};
const HEADER = { code: "كود", name: "المنتج", qty: "كمية", price: "سعر", total: "إجمالي" };

// Roll honors legacy thermal columns; page reproduces the PrintA4Doc table.
// When `props.columns` is supplied (by the Designer), the table is driven by it
// (visibility, order, alignment, labels). Without it, output is unchanged.
export default function ItemsTableBlock({ invoice = {}, settings: s, props = {}, family }) {
  const lines = invoice.lines || [];
  const accent = g(s, "accent_color");
  const fontSize = `${g(s, "item_font_size")}px`;
  const cols = Array.isArray(props.columns) && props.columns.length
    ? props.columns.filter((c) => c.visible !== false && VALUE[c.key])
    : null;
  // Optional table styling (Designer): zebra rows + border style.
  const zebra = props.zebra !== false; // default on
  const border = props.tableBorder || "none"; // 'none' | 'lines' | 'grid'
  const cellBorder = border === "grid" ? { border: "1px solid #e2e8f0" } : border === "lines" ? { borderBottom: "1px solid #e2e8f0" } : {};

  if (family === "page") {
    const showCode = cols ? cols.some((c) => c.key === "code") : g(s, "show_item_code") !== false;
    if (cols) {
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginBottom: "8px" }}>
          <thead>
            <tr style={{ background: accent, color: "#fff" }}>
              <th style={{ textAlign: "right", padding: "4px 6px", ...cellBorder }}>#</th>
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: c.align || "right", padding: "4px 6px", ...cellBorder, ...(c.key === "code" ? { fontSize: "9px", opacity: 0.85 } : {}) }}>{c.label || HEADER[c.key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ background: zebra && i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                <td style={{ padding: "3px 6px", color: "#94a3b8", ...cellBorder }}>{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.key} style={{
                    textAlign: c.align || (c.key === "name" ? "right" : c.key === "total" ? "left" : "center"),
                    padding: "3px 6px", ...cellBorder,
                    ...(c.key === "code" ? { fontSize: "9px", color: "#94a3b8", fontFamily: "monospace" } : {}),
                    ...(c.key === "name" ? { fontWeight: 600 } : {}),
                    ...(c.key === "total" ? { fontWeight: 700 } : {}),
                  }}>{VALUE[c.key](line)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize, marginBottom: "8px" }}>
        <thead>
          <tr style={{ background: accent, color: "#fff" }}>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>#</th>
            {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "9px", opacity: 0.85 }}>كود</th>}
            <th style={{ textAlign: "right", padding: "4px 6px" }}>المنتج</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>كمية</th>
            <th style={{ textAlign: "center", padding: "4px 6px" }}>سعر</th>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>إجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
              <td style={{ padding: "3px 6px", color: "#94a3b8" }}>{i + 1}</td>
              {showCode && <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "9px", color: "#94a3b8", fontFamily: "monospace" }}>{codeOf(line)}</td>}
              <td style={{ padding: "3px 6px", fontWeight: 600 }}>{nameOf(line)}</td>
              <td style={{ textAlign: "center", padding: "3px 6px" }}>{line.quantity}</td>
              <td style={{ textAlign: "center", padding: "3px 6px" }}>{priceOf(line).toFixed(2)}</td>
              <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: 700 }}>{lineTotalOf(line).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const solid = `1px solid ${accent}`;
  if (cols) {
    return (
      <table style={{ width: "100%", fontSize, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: solid }}>
            {cols.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "right", paddingBottom: "3px", ...(c.key === "code" ? { opacity: 0.6, fontSize: "9px" } : {}) }}>{c.label || (c.key === "name" ? "الصنف" : HEADER[c.key])}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} style={{
                  textAlign: c.align || (c.key === "qty" ? "center" : c.key === "total" ? "left" : "right"),
                  padding: "2px 0",
                  ...(c.key === "code" ? { fontSize: "9px", opacity: 0.6, fontFamily: "monospace" } : {}),
                }}>{VALUE[c.key](line)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const showCode = g(s, "show_item_code") !== false;
  return (
    <table style={{ width: "100%", fontSize, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: solid }}>
          {showCode && <th style={{ textAlign: "right", paddingBottom: "3px", opacity: 0.6, fontSize: "9px" }}>كود</th>}
          <th style={{ textAlign: "right", paddingBottom: "3px" }}>الصنف</th>
          <th style={{ textAlign: "center" }}>كمية</th>
          <th style={{ textAlign: "left" }}>إجمالي</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            {showCode && <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px", opacity: 0.6, fontFamily: "monospace" }}>{codeOf(line)}</td>}
            <td style={{ textAlign: "right", padding: "2px 0" }}>{nameOf(line)}</td>
            <td style={{ textAlign: "center" }}>{line.quantity}</td>
            <td style={{ textAlign: "left" }}>{lineTotalOf(line).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
