import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function GrandTotalBlock({ invoice = {}, settings: s, family }) {
  const { grandTotal } = computeTotals(invoice, s);
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
  // Roll: always the most prominent element — full-width black bar, white text.
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      background: "#000", color: "#fff",
      padding: "5px 6px",
      marginTop: "4px",
      fontWeight: 900,
      fontSize: `${Math.max(13, Number(g(s, "body_font_size")) + 1)}px`,
    }}>
      <span>الإجمالي</span>
      <span>{currency} {grandTotal.toFixed(2)}</span>
    </div>
  );
}
