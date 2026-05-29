import React from "react";
import { g } from "./blockUtils";

export default function CashierBlock({ invoice = {}, settings: s }) {
  const name = invoice.cashier_name || invoice.cashier;
  if (g(s, "show_cashier_name") === false || !name) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الكاشير:</span><span>{name}</span>
    </div>
  );
}
