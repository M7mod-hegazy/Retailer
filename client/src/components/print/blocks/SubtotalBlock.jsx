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
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    const label = props.label !== undefined ? props.label : "الإجمالي الفرعي";

    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed #e2e8f0", borderBottom: "1px dashed #e2e8f0", margin: "2px 0" }}>
          <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
        </div>
      );
    }

    if (variant === "boxed") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: "4px", margin: "2px 0" }}>
          <span style={{ color: accent, fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 800, color: accent }}>{currency} {smartFormat(displaySubtotal, s)}</span>
        </div>
      );
    }

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

  if (variant === "plain") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0" }}>
        <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={HEAVY_VAL}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #000", padding: "4px", margin: "2px 0" }}>
        <span style={{ fontWeight: 900 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={{ fontWeight: 900 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
      <span style={HEAVY_VAL}>{currency} {smartFormat(displaySubtotal, s)}</span>
    </div>
  );
}
