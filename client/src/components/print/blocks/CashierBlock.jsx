import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the name).
export default function CashierBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showCashier = g(s, "show_cashier_name") !== false;
  if (!showCashier && !editing) return null;
  // Realistic mock: a typical cashier name for a retail POS
  const name = invoice.cashier_name || invoice.cashier || "";
  if (!name && props.hideIfEmpty === true && !editing) return null;
  const displayName = name || (editing ? "سارة الحربي" : "");
  if (!displayName) return null;

  const label = props.label !== undefined ? props.label : "الكاشير";
  if (family === "page") {
    return (
      <div style={{ fontSize: "10px", color: "#64748b" }}>
        {label ? `${label}: ` : ""}{displayName}
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
