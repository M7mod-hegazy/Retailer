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

    if (variant === "badge") {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#059669", color: "#fff", borderRadius: "20px", padding: "3px 12px", fontSize: "10px", fontWeight: 800 }}>
            {label}: + {currency} {smartFormat(displayIncrease, s)}
          </span>
        </div>
      );
    }

    if (variant === "inline") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#94a3b8", padding: "1px 0" }}>
          <span>{label}</span>
          <span style={{ fontWeight: 600, color: "#059669" }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
        </div>
      );
    }

    if (variant === "minimal") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#059669" }}>
          <span style={{ fontWeight: 700 }}>{label}</span>
          <span style={{ fontWeight: 700 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
        </div>
      );
    }

    if (variant === "compact") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", borderTop: "1px dashed #e2e8f0", paddingTop: "2px" }}>
          <span style={{ color: "#64748b" }}>{label}</span>
          <span style={{ fontWeight: 700, color: "#059669" }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
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

  if (variant === "badge") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
        <span style={{ border: "1px solid #000", borderRadius: "10px", padding: "1px 10px", fontWeight: 900, fontSize: "0.95em" }}>
          {label ? `${label}: ` : ""}+ {currency} {smartFormat(displayIncrease, s)}
        </span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", opacity: 0.7 }}>
        <span>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", borderTop: "1px dashed #000", paddingTop: "1px" }}>
        <span>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0", fontWeight: 900 }}>
        {label ? `${label}: ` : ""}+ {currency} {smartFormat(displayIncrease, s)}
      </div>
    );
  }

  if (variant === "dotted") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dotted #000", fontSize: "9px" }}>
        <span>{label ? `${label}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>+ {currency} {smartFormat(displayIncrease, s)}</span>
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
