import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the name).
export default function CashierBlock({ invoice = {}, settings: s, props = {}, family }) {
  const name = invoice.cashier_name || invoice.cashier;
  if (g(s, "show_cashier_name") === false || !name) return null;
  const label = props.label !== undefined ? props.label : "الكاشير";
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b" }}>{label ? `${label}: ` : ""}{name}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span><span>{name}</span>
    </div>
  );
}
