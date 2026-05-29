import React from "react";
import { g } from "./blockUtils";

// Roll-family items table. Honors props.columns when provided (Phase 2/3),
// else falls back to the legacy thermal columns gated by show_item_code.
export default function ItemsTableBlock({ invoice = {}, settings: s, props = {} }) {
  const lines = invoice.lines || [];
  const accent = g(s, "accent_color");
  const solid = `1px solid ${accent}`;
  const showCode = props.columns
    ? props.columns.some((c) => c.key === "code" && c.visible !== false)
    : g(s, "show_item_code") !== false;
  const fontSize = `${g(s, "item_font_size")}px`;

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
        {lines.map((line, i) => {
          const lineTotal = ((Number(line.unit_price) || Number(line.unit_cost) || 0) * Number(line.quantity)) - (Number(line.discount_amount) || 0);
          return (
            <tr key={i}>
              {showCode && (
                <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px", opacity: 0.6, fontFamily: "monospace" }}>
                  {line.sku || line.barcode || line.product_code || ""}
                </td>
              )}
              <td style={{ textAlign: "right", padding: "2px 0" }}>{line.product_name || line.item_name || line.name || ""}</td>
              <td style={{ textAlign: "center" }}>{line.quantity}</td>
              <td style={{ textAlign: "left" }}>{lineTotal.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
