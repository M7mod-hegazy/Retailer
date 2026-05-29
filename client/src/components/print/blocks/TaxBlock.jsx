import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function TaxBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_tax") === false) return null;
  const { taxAmount, taxRate } = computeTotals(invoice, s);
  if (taxAmount <= 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>ضريبة ({taxRate}%):</span><span>{g(s, "currency_symbol")} {taxAmount.toFixed(2)}</span>
    </div>
  );
}
