import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// props.label renames the line (empty string hides the caption).
export default function SubtotalBlock({ invoice = {}, settings: s, props = {}, family }) {
  if (g(s, "show_subtotal") === false) return null;
  const { subtotal, grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    const label = props.label !== undefined ? props.label : "الإجمالي الفرعي";
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(subtotal, s)}</span>
      </div>
    );
  }
  // Roll: GrandTotalBlock always shows the final total with prominent styling.
  // Only show subtotal here when it differs (i.e. there is a discount/surcharge/tax).
  if (Math.abs(subtotal - grandTotal) < 0.01) return null;
  const rollLabel = props.label !== undefined ? props.label : "الإجمالي";
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span><span style={HEAVY_VAL}>{currency} {smartFormat(subtotal, s)}</span>
    </div>
  );
}
