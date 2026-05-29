import React from "react";
import { g } from "./blockUtils";

const lineTotalOf = (line) =>
  ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
const codeOf = (line) => line.sku || line.barcode || line.product_code || "";
const nameOf = (line) => line.product_name || line.item_name || line.name || "";

// Roll honors legacy thermal columns; page reproduces the PrintA4Doc table.
export default function ItemsTableBlock({ invoice = {}, settings: s, props = {}, family }) {
  const lines = invoice.lines || [];
  const accent = g(s, "accent_color");
  const fontSize = `${g(s, "item_font_size")}px`;
  const showCode = props.columns
    ? props.columns.some((c) => c.key === "code" && c.visible !== false)
    : g(s, "show_item_code") !== false;

  if (family === "page") {
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
              <td style={{ textAlign: "center", padding: "3px 6px" }}>{(Number(line.unit_price) || Number(line.unit_cost) || 0).toFixed(2)}</td>
              <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: 700 }}>{lineTotalOf(line).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const solid = `1px solid ${accent}`;
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
