import React from "react";
import { g, computeTotals } from "./blockUtils";

export default function PaymentsBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_payment_details") === false) return null;
  const payments = invoice.payments || [];
  if (!payments.length) return null;
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  const { grandTotal, paid, change } = computeTotals(invoice, s);

  if (family === "page") {
    return (
      <div style={{ marginTop: "8px" }}>
        <div style={{ fontWeight: 700, marginBottom: "3px", color: accent }}>طريقة الدفع</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {payments.map((p, i) => (
            <span key={i}>{p.method_name || "نقداً"}: {currency} {Number(p.amount).toFixed(2)}</span>
          ))}
          {paid < grandTotal && (
            <span style={{ color: "#dc2626" }}>المتبقي: {currency} {(grandTotal - paid).toFixed(2)}</span>
          )}
        </div>
      </div>
    );
  }

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
