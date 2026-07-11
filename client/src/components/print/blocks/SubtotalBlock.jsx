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

    if (variant === "badge") {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: accent, color: "#fff", borderRadius: "20px", padding: "3px 12px", fontSize: "10px", fontWeight: 800 }}>
            {label}: {currency} {smartFormat(displaySubtotal, s)}
          </span>
        </div>
      );
    }

    if (variant === "ruled") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: `2px solid ${accent}`, borderBottom: `2px solid ${accent}`, margin: "2px 0" }}>
          <span style={{ color: "#334155", fontWeight: 800 }}>{label}</span>
          <span style={{ fontWeight: 800, color: accent }}>{currency} {smartFormat(displaySubtotal, s)}</span>
        </div>
      );
    }

    if (variant === "inline") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#94a3b8", padding: "1px 0" }}>
          <span>{label}</span>
          <span style={{ fontWeight: 600 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
        </div>
      );
    }

    if (variant === "compact") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", borderTop: "1px dashed #e2e8f0", paddingTop: "2px" }}>
          <span style={{ color: "#64748b" }}>{label}</span>
          <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
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

  if (variant === "ruled") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #000", borderBottom: "2px solid #000", padding: "3px 0", margin: "2px 0" }}>
        <span style={{ fontWeight: 900 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={{ fontWeight: 900 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", opacity: 0.7 }}>
        <span>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", borderTop: "1px dashed #000", paddingTop: "1px" }}>
        <span>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
      </div>
    );
  }

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

  if (variant === "badge") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
        <span style={{ border: "1px solid #000", borderRadius: "10px", padding: "1px 10px", fontWeight: 900, fontSize: "0.95em" }}>
          {rollLabel ? `${rollLabel}: ` : ""}{currency} {smartFormat(displaySubtotal, s)}
        </span>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0", fontWeight: 900 }}>
        {rollLabel ? `${rollLabel}: ` : ""}{currency} {smartFormat(displaySubtotal, s)}
      </div>
    );
  }

  if (variant === "dotted") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dotted #000", fontSize: "9px" }}>
        <span>{rollLabel ? `${rollLabel}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displaySubtotal, s)}</span>
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
