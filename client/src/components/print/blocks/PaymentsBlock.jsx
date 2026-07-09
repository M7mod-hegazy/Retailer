import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return day && m && y ? `${day}/${m}/${y}` : s;
};

export default function PaymentsBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showPayment = g(s, "show_payment_details") !== false;
  if (!showPayment) return null;

  let payments = invoice.payments || [];
  let plan = Array.isArray(invoice.installment_plan) ? invoice.installment_plan : [];
  
  // Set up realistic mocks for editor mode
  const isMock = editing && !payments.length && !plan.length;
  if (isMock) {
    payments = [{ method_name: "مدفوع نقداً (مثال)", amount: 565 }];
  }
  if (!payments.length && !plan.length) return null;

  const currency = g(s, "currency_symbol") || "ر.س";
  const accent = g(s, "accent_color") || "#1e3a8a";
  
  // In mock mode, force total matches mock grand total
  const rawTotals = computeTotals(invoice, s);
  const grandTotal = isMock ? 565 : rawTotals.grandTotal;
  const paid = isMock ? 565 : rawTotals.paid;
  const change = isMock ? 0 : rawTotals.change;
  const planTotal = plan.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const isPaid = paid >= grandTotal;
  const stampVariant = props.variant === "status-stamp";
  const isRoll = family === "roll";

  const getMethodName = (methodName) => {
    const defaultName = methodName || "نقداً";
    if (!props.renameMap) return defaultName;
    const clean = String(defaultName).trim().toLowerCase();
    if (clean.includes("نقدي") || clean.includes("نقدا") || clean.includes("cash")) {
      if (props.renameMap.cash) return props.renameMap.cash;
    }
    if (clean.includes("شبكة") || clean.includes("مدى") || clean.includes("card") || clean.includes("network")) {
      if (props.renameMap.card) return props.renameMap.card;
    }
    if (clean.includes("تحويل") || clean.includes("بنك") || clean.includes("bank") || clean.includes("transfer")) {
      if (props.renameMap.bank) return props.renameMap.bank;
    }
    return defaultName;
  };

  // Stamp styling configurations
  const stampText = isPaid ? "مدفوع / PAID" : "آجل / DUE";
  const stampColor = isPaid ? "#059669" : "#dc2626"; // green vs red
  const stampBg = isPaid ? "#f0fdf4" : "#fef2f2";

  const renderStamp = () => {
    if (!stampVariant) return null;
    if (isRoll) {
      // Thermal-friendly stamp style (black & white border stamp)
      return (
        <div style={{
          display: "inline-block",
          border: "3px double #000",
          padding: "4px 10px",
          transform: "rotate(-8deg)",
          fontWeight: 900,
          fontSize: "11px",
          color: "#000",
          margin: "8px auto 4px",
          textAlign: "center",
          textTransform: "uppercase",
        }}>
          *** {stampText} ***
        </div>
      );
    }
    return (
      <div style={{
        position: "absolute",
        left: "24px",
        top: "4px",
        border: `3px solid ${stampColor}`,
        borderRadius: "6px",
        padding: "6px 12px",
        transform: "rotate(-10deg)",
        fontWeight: 900,
        fontSize: "12px",
        color: stampColor,
        background: stampBg,
        textTransform: "uppercase",
        letterSpacing: "1px",
        boxShadow: `0 0 0 2px ${stampBg}`,
        zIndex: 5,
        opacity: 0.85,
        pointerEvents: "none",
      }}>
        {stampText}
      </div>
    );
  };

  if (family === "page") {
    const variant = props.variant;

    /* ── table-row: clean horizontal rows per payment method ── */
    if (variant === "table-row") {
      return (
        <div style={{ marginTop: "8px" }}>
          {payments.map((p, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 8px",
              borderBottom: "1px solid #e2e8f0",
              background: i % 2 === 0 ? "#f8fafc" : "#fff",
            }}>
              <span style={{ fontWeight: 700, color: "#334155" }}>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 800, color: accent, fontFamily: "monospace" }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#fef2f2" }}>
              <span style={{ fontWeight: 700, color: "#dc2626" }}>المتبقي</span>
              <span style={{ fontWeight: 800, color: "#dc2626", fontFamily: "monospace" }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
        </div>
      );
    }

    /* ── badge-pill: each method in a colored pill ── */
    if (variant === "badge-pill") {
      return (
        <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {isPaid && (
            <span style={{ background: "#059669", color: "#fff", borderRadius: "20px", padding: "3px 10px", fontSize: "10px", fontWeight: 800 }}>مدفوع</span>
          )}
          {payments.map((p, i) => (
            <span key={i} style={{
              background: `${accent}15`,
              color: accent,
              border: `1px solid ${accent}40`,
              borderRadius: "20px",
              padding: "3px 12px",
              fontSize: "10px",
              fontWeight: 800,
            }}>
              {getMethodName(p.method_name)}: {currency} {smartFormat(p.amount, s)}
            </span>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #dc262640", borderRadius: "20px", padding: "3px 12px", fontSize: "10px", fontWeight: 800 }}>
              متبقي: {currency} {smartFormat(grandTotal - paid, s)}
            </span>
          )}
        </div>
      );
    }

    /* ── default / status-stamp ── */
    return (
      <div style={{ marginTop: "8px", position: "relative" }}>
        {renderStamp()}
        {payments.length > 0 && (
          <>
            {props.label !== "" && <div style={{ fontWeight: 700, marginBottom: "3px", color: accent }}>{props.label !== undefined ? props.label : "طريقة الدفع"}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {payments.map((p, i) => (
                <span key={i}>{getMethodName(p.method_name)}: {currency} {smartFormat(p.amount, s)}</span>
              ))}
              {paid < grandTotal && plan.length === 0 && (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>المتبقي: {currency} {smartFormat(grandTotal - paid, s)}</span>
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
                    <td style={{ padding: "2px 4px", textAlign: "left", fontWeight: 700 }}>{currency} {smartFormat(r.amount, s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: "3px", borderTop: `1px solid ${accent}`, paddingTop: "2px" }}>
              <span>إجمالي الأقساط:</span><span dir="ltr">{currency} {smartFormat(planTotal, s)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // roll (thermal)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {payments.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}:</span>
          <span style={HEAVY_VAL}>{currency} {smartFormat(p.amount, s)}</span>
        </div>
      ))}
      {paid > grandTotal && props.showChange !== false && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>الباقي:</span><span style={HEAVY_VAL}>{currency} {smartFormat(change, s)}</span>
        </div>
      )}
      {plan.length > 0 && (
        <div style={{ marginTop: "5px" }}>
          <div style={{ fontWeight: 700, marginBottom: "2px" }}>جدول الأقساط ({plan.length}):</div>
          {plan.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>قسط {r.installment_no ?? i + 1} <span dir="ltr">{fmtDate(r.due_date)}</span>:</span>
              <span dir="ltr" style={HEAVY_VAL}>{currency} {smartFormat(r.amount, s)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #000", marginTop: "3px", paddingTop: "3px" }}>
            <span>إجمالي الأقساط:</span><span dir="ltr">{currency} {smartFormat(planTotal, s)}</span>
          </div>
        </div>
      )}
      {renderStamp()}
    </div>
  );
}
