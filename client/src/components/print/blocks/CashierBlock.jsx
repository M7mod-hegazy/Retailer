import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the name).
export default function CashierBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showCashier = g(s, "show_cashier_name") !== false;
  if (!showCashier) return null;
  // Realistic mock: a typical cashier name for a retail POS
  const name = invoice.cashier_name || invoice.cashier || "";
  if (!name && props.hideIfEmpty === true && !editing) return null;
  const displayName = name || (editing ? "سارة الحربي" : "");
  if (!displayName) return null;

  const label = props.label !== undefined ? props.label : "الكاشير";
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    if (variant === "inline") {
      return (
        <span style={{ fontSize: "9px", color: "#64748b", opacity: 0.85 }}>
          {label ? `${label}: ` : ""}{displayName}
        </span>
      );
    }

    if (variant === "badge") {
      return (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          background: `${accent}10`,
          border: `1px solid ${accent}40`,
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "10px",
          color: accent,
          fontWeight: 700
        }}>
          {label && <span style={{ opacity: 0.8 }}>{label}:</span>}
          <span>{displayName}</span>
        </div>
      );
    }

    if (variant === "boxed") {
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: `1px solid ${accent}40`, padding: "3px 8px", borderRadius: "4px", fontSize: "10px", color: "#334155" }}>
          {label && <span style={{ fontWeight: 700 }}>{label}:</span>}
          <span>{displayName}</span>
        </div>
      );
    }

    return (
      <div style={{ fontSize: "10px", color: "#64748b" }}>
        {label ? `${label}: ` : ""}{displayName}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ border: "1px solid #000", padding: "2px 6px", display: "flex", justifyContent: "space-between", fontSize: "9px", margin: "2px 0" }}>
        <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
        <span>{displayName}</span>
      </div>
    );
  }

  if (variant === "badge" || variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", borderBottom: "1px dashed #cbd5e1", paddingBottom: "2px" }}>
        <span style={{ fontWeight: 700, color: "#475569" }}>{label ? `${label}:` : ""}</span>
        <span>{displayName}</span>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#64748b" }}>
        <span>{label ? `${label}:` : ""}</span>
        <span>{displayName}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
        <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
        <span dir="ltr" style={{ fontFamily: "monospace", fontWeight: 700 }}>{displayName}</span>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", fontWeight: 700, borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0" }}>
        {label ? `${label}: ` : ""}{displayName}
      </div>
    );
  }

  if (variant === "name-only") {
    return (
      <div style={{ textAlign: "center", fontSize: "10px", fontWeight: 900 }}>
        {displayName}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
      <span>{displayName}</span>
    </div>
  );
}
