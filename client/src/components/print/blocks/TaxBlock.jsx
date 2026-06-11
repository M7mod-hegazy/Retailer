import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function TaxBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_tax") === false) return null;
  // Prefer invoice snapshot over recomputed value.
  const snapshotAmount = Number(invoice.tax_amount || 0);
  const snapshotRate = Number(invoice.tax_rate || 0);
  const { taxAmount: computedAmount, taxRate: computedRate } = computeTotals(invoice, s);
  const taxAmount = snapshotAmount > 0 ? snapshotAmount : computedAmount;
  const taxRate = snapshotAmount > 0 ? snapshotRate : computedRate;
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
