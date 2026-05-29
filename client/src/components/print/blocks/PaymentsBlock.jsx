import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function PaymentsBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_payment_details") === false) return null;
  const payments = invoice.payments || [];
  if (!payments.length) return null;
  const currency = g(s, "currency_symbol");
  const { grandTotal, paid, change } = computeTotals(invoice, s);
  return (
    <div>
      {payments.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{p.method_name || "نقداً"}:</span>
          <span>{currency} {Number(p.amount).toFixed(2)}</span>
        </div>
      ))}
      {paid > grandTotal && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الباقي:</span><span>{currency} {change.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
