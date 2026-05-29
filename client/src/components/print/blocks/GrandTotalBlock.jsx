import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function GrandTotalBlock({ invoice, settings: s }) {
  const { grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderTop: `1px solid ${accent}`, paddingTop: "3px", marginTop: "4px" }}>
      <span>المستحق:</span><span>{currency} {grandTotal.toFixed(2)}</span>
    </div>
  );
}
