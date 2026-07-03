import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

export default function TaxBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_tax") === false) return null;
  // computeTotals is snapshot-aware: stored tax_amount is authoritative (0 = no tax line),
  // settings-derived tax only applies to ad-hoc preview objects without a stored total.
  const { taxAmount, taxRate } = computeTotals(invoice, s);
  if (taxAmount <= 0) return null;
  const inclusive = invoice.tax_type === "inclusive";
  const currency = g(s, "currency_symbol");
  if (family === "page") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>الضريبة ({taxRate}%{inclusive ? " شاملة" : ""})</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(taxAmount, s)}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>ضريبة ({taxRate}%{inclusive ? " شاملة" : ""}):</span><span style={HEAVY_VAL}>{currency} {smartFormat(taxAmount, s)}</span>
    </div>
  );
}
