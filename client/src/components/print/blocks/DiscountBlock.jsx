import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function DiscountBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_discount_line") === false) return null;
  const { totalDiscount } = computeTotals(invoice, s);
  if (totalDiscount <= 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>الخصم:</span><span>- {g(s, "currency_symbol")} {totalDiscount.toFixed(2)}</span>
    </div>
  );
}
