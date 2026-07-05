import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// props.label renames the line (empty string hides the caption).
export default function DiscountBlock({ invoice = {}, settings: s, props = {}, family }) {
  if (g(s, "show_discount_line") === false) return null;
  const { totalDiscount } = computeTotals(invoice, s);
  if (totalDiscount <= 0) return null;
  const currency = g(s, "currency_symbol");
  const label = props.label !== undefined ? props.label : "الخصم";
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "#dc2626" }}>- {currency} {smartFormat(totalDiscount, s)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span><span style={HEAVY_VAL}>- {currency} {smartFormat(totalDiscount, s)}</span>
    </div>
  );
}
