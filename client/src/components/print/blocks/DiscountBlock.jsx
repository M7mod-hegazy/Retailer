import React from "react";
import { g, computeTotals, HEAVY_VAL } from "./blockUtils";

export default function DiscountBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_discount_line") === false) return null;
  const { totalDiscount } = computeTotals(invoice, s);
  if (totalDiscount <= 0) return null;
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>الخصم</span>
        <span style={{ fontWeight: 700, color: "#dc2626" }}>- {currency} {totalDiscount.toFixed(2)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الخصم:</span><span style={HEAVY_VAL}>- {currency} {totalDiscount.toFixed(2)}</span>
    </div>
  );
}
