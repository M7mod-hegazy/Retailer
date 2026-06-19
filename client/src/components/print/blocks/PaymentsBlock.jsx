import React from "react";
import { g, computeTotals, HEAVY_VAL } from "./blockUtils";

const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return day && m && y ? `${day}/${m}/${y}` : s;
};

export default function PaymentsBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_payment_details") === false) return null;
  const payments = invoice.payments || [];
  const plan = Array.isArray(invoice.installment_plan) ? invoice.installment_plan : [];
  if (!payments.length && !plan.length) return null;
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  const { grandTotal, paid, change } = computeTotals(invoice, s);
  const planTotal = plan.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  if (family === "page") {
    return (
      <div style={{ marginTop: "8px" }}>
        {payments.length > 0 && (
          <>
            <div style={{ fontWeight: 700, marginBottom: "3px", color: accent }}>طريقة الدفع</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {payments.map((p, i) => (
                <span key={i}>{p.method_name || "نقداً"}: {currency} {Number(p.amount).toFixed(2)}</span>
              ))}
              {paid < grandTotal && plan.length === 0 && (
                <span style={{ color: "#dc2626" }}>المتبقي: {currency} {(grandTotal - paid).toFixed(2)}</span>
              )}
            </div>
          </>
        )}
        {plan.length > 0 && (
          <div style={{ marginTop: "6px" }}>
            <div style={{ fontWeight: 700, marginBottom: "3px", color: accent }}>جدول الأقساط ({plan.length})</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92em" }}>
              <thead>
                <tr style={{ color: "#64748b" }}>
                  <th style={{ textAlign: "right", padding: "2px 4px" }}>#</th>
                  <th style={{ textAlign: "right", padding: "2px 4px" }}>تاريخ الاستحقاق</th>
                  <th style={{ textAlign: "left", padding: "2px 4px" }}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "2px 4px", fontWeight: 700 }}>{r.installment_no ?? i + 1}</td>
                    <td style={{ padding: "2px 4px" }} dir="ltr">{fmtDate(r.due_date)}</td>
                    <td style={{ padding: "2px 4px", textAlign: "left", fontWeight: 700 }}>{currency} {Number(r.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: "3px", borderTop: `1px solid ${accent}`, paddingTop: "2px" }}>
              <span>إجمالي الأقساط:</span><span dir="ltr">{currency} {planTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // roll (thermal)
  return (
    <div>
      {payments.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{p.method_name || "نقداً"}:</span>
          <span style={HEAVY_VAL}>{currency} {Number(p.amount).toFixed(2)}</span>
        </div>
      ))}
      {paid > grandTotal && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الباقي:</span><span style={HEAVY_VAL}>{currency} {change.toFixed(2)}</span>
        </div>
      )}
      {plan.length > 0 && (
        <div style={{ marginTop: "3px", borderTop: "1px dashed #000", paddingTop: "3px" }}>
          <div style={{ fontWeight: "bold", marginBottom: "2px" }}>جدول الأقساط ({plan.length}):</div>
          {plan.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>قسط {r.installment_no ?? i + 1} <span dir="ltr">{fmtDate(r.due_date)}</span>:</span>
              <span dir="ltr" style={HEAVY_VAL}>{currency} {Number(r.amount).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "1px solid #000", marginTop: "2px", paddingTop: "2px" }}>
            <span>إجمالي الأقساط:</span><span dir="ltr">{currency} {planTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
