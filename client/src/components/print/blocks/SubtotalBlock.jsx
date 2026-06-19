import React from "react";
import { g, computeTotals, HEAVY_VAL } from "./blockUtils";

export default function SubtotalBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_subtotal") === false) return null;
  const { subtotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>الإجمالي الفرعي</span>
        <span style={{ fontWeight: 700 }}>{currency} {subtotal.toFixed(2)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الإجمالي:</span><span style={HEAVY_VAL}>{currency} {subtotal.toFixed(2)}</span>
    </div>
  );
}
