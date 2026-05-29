import React from "react";
import { g } from "./blockUtils";

export default function CashierBlock({ invoice = {}, settings: s, family }) {
  const name = invoice.cashier_name || invoice.cashier;
  if (g(s, "show_cashier_name") === false || !name) return null;
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b" }}>الكاشير: {name}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الكاشير:</span><span>{name}</span>
    </div>
  );
}
