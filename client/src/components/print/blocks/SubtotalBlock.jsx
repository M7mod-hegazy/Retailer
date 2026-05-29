import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function SubtotalBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_subtotal") === false) return null;
  const { subtotal } = computeTotals(invoice, s);
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الإجمالي:</span><span>{g(s, "currency_symbol")} {subtotal.toFixed(2)}</span>
    </div>
  );
}
