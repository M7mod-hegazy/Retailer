import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// Invoice-level surcharge / extra fees (رسوم / إضافة). Mirrors DiscountBlock but
// adds to the total. Hidden when zero so it only prints when fees were charged.
export default function IncreaseBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const { totalIncrease } = computeTotals(invoice, s);
  // Realistic mock: 15 SAR delivery / service fee
  const displayIncrease = totalIncrease > 0 ? totalIncrease : (editing ? 15 : 0);
  if (displayIncrease <= 0) return null;
  const currency = g(s, "currency_symbol");
  const label = props.label !== undefined ? props.label : "رسوم إضافية";
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed #e2e8f0", borderBottom: "1px dashed #e2e8f0", margin: "2px 0" }}>
          <span style={{ color: "#059669", fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 700, color: "#059669" }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
        </div>
      );
    }

    if (variant === "boxed") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "4px", margin: "2px 0" }}>
          <span style={{ color: "#166534", fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 800, color: "#166534" }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "#059669" }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
      </div>
    );
  }

  if (variant === "plain" || variant === "boxed") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", border: "1px dashed #000", padding: "3px", margin: "2px 0" }}>
        <span style={{ fontWeight: 900 }}>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 900 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
      <span style={HEAVY_VAL}>+ {currency} {smartFormat(displayIncrease, s)}</span>
    </div>
  );
}
