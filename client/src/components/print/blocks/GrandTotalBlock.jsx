import React from "react";
import { g, computeTotals, HEAVY_NUM } from "./blockUtils";

export default function GrandTotalBlock({ invoice = {}, settings: s, family }) {
  const { subtotal, grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: accent, color: "#fff", borderRadius: "2px", marginTop: "3px" }}>
        <span style={{ fontWeight: 900 }}>الإجمالي</span>
        <span style={{ fontWeight: 900 }}>{currency} {grandTotal.toFixed(2)}</span>
      </div>
    );
  }
  // Roll: the net amount due. Only meaningful when a discount, surcharge or tax
  // makes it differ from the items subtotal ("الإجمالي"); otherwise it would just
  // duplicate that line, so we hide it.
  if (Math.abs(subtotal - grandTotal) < 0.01) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderTop: `1px solid ${accent}`, paddingTop: "3px", marginTop: "4px" }}>
      <span style={HEAVY_NUM}>المستحق:</span><span style={HEAVY_NUM}>{currency} {grandTotal.toFixed(2)}</span>
    </div>
  );
}
