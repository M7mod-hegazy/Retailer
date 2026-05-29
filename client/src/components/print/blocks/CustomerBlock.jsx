import React from "react";
import { g } from "./blockUtils";

export default function CustomerBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_customer_name") === false || !invoice.customer_name) return null;
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b" }}>العميل: {invoice.customer_name}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>العميل:</span><span>{invoice.customer_name}</span>
    </div>
  );
}
