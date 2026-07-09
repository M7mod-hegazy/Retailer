import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// props.label renames the line (empty string hides the caption).
export default function DiscountBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_discount_line") === false) return null;
  const { totalDiscount } = computeTotals(invoice, s);
  // In editing mode with no real discount, show a realistic mock: 25 SAR off
  const displayDiscount = totalDiscount > 0 ? totalDiscount : (editing ? 25 : 0);
  if (displayDiscount <= 0) return null;
  const currency = g(s, "currency_symbol");
  const label = props.label !== undefined ? props.label : "الخصم";
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    if (variant === "badge") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "4px", margin: "2px 0" }}>
          <span style={{ color: "#b91c1c", fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 800, color: "#b91c1c" }}>- {currency} {smartFormat(displayDiscount, s)}</span>
        </div>
      );
    }

    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
          <span style={{ color: "#b91c1c", fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 700, color: "#b91c1c" }}>- {currency} {smartFormat(displayDiscount, s)}</span>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "#dc2626" }}>- {currency} {smartFormat(displayDiscount, s)}</span>
      </div>
    );
  }

  if (variant === "badge" || variant === "plain") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", border: "1px dashed #000", padding: "3px", margin: "2px 0" }}>
        <span style={{ fontWeight: 900 }}>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 900 }}>- {currency} {smartFormat(displayDiscount, s)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
      <span style={HEAVY_VAL}>- {currency} {smartFormat(displayDiscount, s)}</span>
    </div>
  );
}
