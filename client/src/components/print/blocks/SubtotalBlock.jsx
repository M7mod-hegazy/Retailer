import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// props.label renames the line (empty string hides the caption).
export default function SubtotalBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_subtotal") === false) return null;
  const { subtotal, grandTotal } = computeTotals(invoice, s);
  // In editing, show mock subtotal of 500 when there are no real lines
  const displaySubtotal = subtotal > 0 ? subtotal : (editing ? 500 : 0);
  const displayGrandTotal = grandTotal > 0 ? grandTotal : (editing ? 575 : 0);
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    const label = props.label !== undefined ? props.label : "الإجمالي الفرعي";
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }
  // Roll: only show when it differs from grand total (discount/tax/surcharge present).
  if (Math.abs(displaySubtotal - displayGrandTotal) < 0.01 && !editing) return null;
  const rollLabel = props.label !== undefined ? props.label : "الإجمالي";
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
      <span style={HEAVY_VAL}>{currency} {smartFormat(displaySubtotal, s)}</span>
    </div>
  );
}
