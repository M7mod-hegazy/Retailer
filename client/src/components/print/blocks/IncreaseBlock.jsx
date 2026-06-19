import React from "react";
import { g, computeTotals, HEAVY_VAL } from "./blockUtils";

// Invoice-level surcharge / extra fees (رسوم / إضافة). Mirrors DiscountBlock but
// adds to the total. Hidden when zero so it only prints when fees were charged.
export default function IncreaseBlock({ invoice = {}, settings: s, family }) {
  const { totalIncrease } = computeTotals(invoice, s);
  if (totalIncrease <= 0) return null;
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>رسوم إضافية</span>
        <span style={{ fontWeight: 700, color: "#059669" }}>+ {currency} {totalIncrease.toFixed(2)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>رسوم إضافية:</span><span style={HEAVY_VAL}>+ {currency} {totalIncrease.toFixed(2)}</span>
    </div>
  );
}
