import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the name).
export default function CustomerBlock({ invoice = {}, settings: s, props = {}, family }) {
  if (g(s, "show_customer_name") === false || !invoice.customer_name) return null;
  const label = props.label !== undefined ? props.label : "العميل";
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b" }}>{label ? `${label}: ` : ""}{invoice.customer_name}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span><span>{invoice.customer_name}</span>
    </div>
  );
}
