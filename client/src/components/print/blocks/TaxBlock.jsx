import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function TaxBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_tax") === false) return null;
  const { taxAmount, taxRate } = computeTotals(invoice, s);
  if (taxAmount <= 0) return null;
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>الضريبة ({taxRate}%)</span>
        <span style={{ fontWeight: 700 }}>{currency} {taxAmount.toFixed(2)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>ضريبة ({taxRate}%):</span><span>{currency} {taxAmount.toFixed(2)}</span>
    </div>
  );
}
