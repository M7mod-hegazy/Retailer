import React from "react";
import { g, computeTotals, resolvePayments, smartFormat, HEAVY_VAL } from "./blockUtils";

const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return day && m && y ? `${day}/${m}/${y}` : s;
};

export default function PaymentsBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showPayment = g(s, "show_payment_details") !== false;
  if (!showPayment) return null;

  let payments = resolvePayments(invoice);
  let plan = Array.isArray(invoice.installment_plan) ? invoice.installment_plan
    : (typeof invoice.installment_plan === "string" ? (() => { try { return JSON.parse(invoice.installment_plan); } catch { return []; } })() : []);
  
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

  if (isRoll && props.variant === "table-row") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "2px 0" }}>
            <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
            <span style={HEAVY_VAL}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #000", padding: "2px 0" }}>
            <span style={{ fontWeight: 700 }}>المتبقي</span>
            <span style={HEAVY_VAL}>{currency} {smartFormat(grandTotal - paid, s)}</span>
          </div>
        )}
        {plan.length > 0 && (
          <div style={{ marginTop: "5px" }}>
            <div style={{ fontWeight: 700, marginBottom: "2px" }}>جدول الأقساط ({plan.length}):</div>
            {plan.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "2px 0" }}>
                <span style={{ fontWeight: 700 }}>قسط {r.installment_no ?? i + 1} <span dir="ltr">{fmtDate(r.due_date)}</span></span>
                <span dir="ltr" style={HEAVY_VAL}>{currency} {smartFormat(r.amount, s)}</span>
              </div>
            ))}
          </div>
        )}
        {renderStamp()}
      </div>
    );
  }

  if (isRoll && props.variant === "badge-pill") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {payments.map((p, i) => (
          <span key={i} style={{ border: "1px solid #000", borderRadius: "10px", padding: "1px 8px", fontSize: "0.9em", fontWeight: 800 }}>
            {getMethodName(p.method_name)}: {currency} {smartFormat(p.amount, s)}
          </span>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <span style={{ border: "1px dashed #000", borderRadius: "10px", padding: "1px 8px", fontSize: "0.9em", fontWeight: 800 }}>
            متبقي: {currency} {smartFormat(grandTotal - paid, s)}
          </span>
        )}
        {renderStamp()}
      </div>
    );
  }

  /* ── compact: ultra-dense, amounts only ── */
  if (props.variant === "compact") {
    if (isRoll) {
      return (
        <div style={{ fontSize: "8px", marginTop: "2px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 700 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>المتبقي</span><span>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
          {paid > grandTotal && props.showChange !== false && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>الباقي</span><span>{currency} {smartFormat(change, s)}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={{ fontSize: "9px", marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#475569", padding: "1px 0" }}>
            <span>{getMethodName(p.method_name)}</span>
            <span style={{ fontWeight: 700 }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626", fontWeight: 700, padding: "1px 0" }}>
            <span>المتبقي</span><span>{currency} {smartFormat(grandTotal - paid, s)}</span>
          </div>
        )}
      </div>
    );
  }

  /* ── summary: single-line total with method ── */
  if (props.variant === "summary") {
    if (isRoll) {
      const summaryParts = payments.map((p) => `${getMethodName(p.method_name)} ${smartFormat(p.amount, s)}`).join(" + ");
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", marginTop: "2px" }}>
          <span style={{ fontWeight: 700 }}>الدفع:</span>
          <span>{summaryParts}</span>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "4px", color: "#475569" }}>
        <span style={{ fontWeight: 700, color: accent }}>الدفع:</span>
        <span>{payments.map((p) => `${getMethodName(p.method_name)} ${currency} ${smartFormat(p.amount, s)}`).join(" + ")}</span>
      </div>
    );
  }

  /* ── inline: compact single-line summary ── */
  if (props.variant === "inline") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", fontSize: "8px", marginTop: "3px" }}>
          {payments.map((p, i) => (
            <span key={i} style={{ fontWeight: 700 }}>
              {i > 0 && <span style={{ color: "#94a3b8" }}> | </span>}
              {getMethodName(p.method_name)} {currency} {smartFormat(p.amount, s)}
            </span>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <span style={{ fontWeight: 700, color: "#000" }}> | متبقي {currency} {smartFormat(grandTotal - paid, s)}</span>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "10px", marginTop: "4px" }}>
        {payments.map((p, i) => (
          <span key={i} style={{ color: accent, fontWeight: 700 }}>
            {i > 0 && <span style={{ color: "#cbd5e1" }}> | </span>}
            {getMethodName(p.method_name)}: {currency} {smartFormat(p.amount, s)}
          </span>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <span style={{ color: "#dc2626", fontWeight: 700 }}> | متبقي: {currency} {smartFormat(grandTotal - paid, s)}</span>
        )}
      </div>
    );
  }

  /* ── minimal: ultra-clean, no borders ── */
  if (props.variant === "minimal") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", fontSize: "9px", marginTop: "2px" }}>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 700 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>المتبقي</span>
              <span style={{ fontWeight: 700 }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px", marginTop: "4px" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>{getMethodName(p.method_name)}</span>
            <span style={{ fontWeight: 700, color: accent }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
        {paid < grandTotal && plan.length === 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
            <span>المتبقي</span>
            <span style={{ fontWeight: 700 }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
          </div>
        )}
      </div>
    );
  }

  /* ── dashed-box: each payment in a dashed box (roll only) ── */
  if (props.variant === "dashed-box") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "9px", marginTop: "3px" }}>
          {payments.map((p, i) => (
            <div key={i} style={{ border: "1px dashed #000", padding: "2px 4px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 900 }}>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ border: "1px dashed #000", padding: "2px 4px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 900 }}>المتبقي</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", marginTop: "4px" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ border: `1px dashed ${accent}40`, padding: "4px 8px", borderRadius: "4px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, color: accent }}>{getMethodName(p.method_name)}</span>
            <span style={{ fontWeight: 800, color: accent }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── columns: two-column layout (roll) ── */
  if (props.variant === "columns") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexDirection: "column", fontSize: "9px", marginTop: "3px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, borderBottom: "2px solid #000", paddingBottom: "2px", marginBottom: "2px" }}>
            <span>الطريقة</span>
            <span>المبلغ</span>
          </div>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", borderBottom: "1px dotted #000" }}>
              <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", borderTop: "1px solid #000", marginTop: "2px", paddingTop: "2px" }}>
              <span style={{ fontWeight: 900 }}>المتبقي</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", fontSize: "10px", marginTop: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderBottom: `2px solid ${accent}`, paddingBottom: "3px", marginBottom: "3px", color: accent }}>
          <span>طريقة الدفع</span>
          <span>المبلغ</span>
        </div>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontWeight: 700, color: "#334155" }}>{getMethodName(p.method_name)}</span>
            <span style={{ fontWeight: 800, color: accent, fontFamily: "monospace" }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── labeled-stamp: "مدفوع" / "آجل" stamp with payment details ── */
  if (props.variant === "labeled-stamp") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "9px", marginTop: "3px" }}>
          <div style={{ display: "inline-block", alignSelf: "center", border: "3px double #000", padding: "3px 12px", fontWeight: 900, fontSize: "12px", transform: "rotate(-5deg)", textAlign: "center", marginBottom: "4px" }}>
            *** {isPaid ? "مدفوع / PAID" : "آجل / DUE"} ***
          </div>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px", marginTop: "6px" }}>
        <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start" }}>
          <div style={{ border: `3px solid ${isPaid ? "#059669" : "#dc2626"}`, borderRadius: "6px", padding: "4px 10px", transform: "rotate(-8deg)", fontWeight: 900, fontSize: "12px", color: isPaid ? "#059669" : "#dc2626", background: isPaid ? "#f0fdf4" : "#fef2f2" }}>
            {isPaid ? "مدفوع / PAID" : "آجل / DUE"}
          </div>
        </div>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>{getMethodName(p.method_name)}</span>
            <span style={{ fontWeight: 700 }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── arrow: → arrow between method and amount ── */
  if (props.variant === "arrow") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", fontSize: "9px", marginTop: "3px" }}>
          {payments.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
              <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
              <span style={{ color: "#94a3b8" }}>←</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(p.amount, s)}</span>
            </div>
          ))}
          {paid < grandTotal && plan.length === 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", borderTop: "1px dashed #000", marginTop: "1px" }}>
              <span style={{ fontWeight: 900 }}>المتبقي</span>
              <span style={{ color: "#94a3b8" }}>←</span>
              <span style={{ fontWeight: 900 }}>{currency} {smartFormat(grandTotal - paid, s)}</span>
            </div>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px", marginTop: "4px" }}>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span style={{ fontWeight: 700 }}>{getMethodName(p.method_name)}</span>
            <span style={{ color: "#cbd5e1" }}>→</span>
            <span style={{ fontWeight: 800, color: accent }}>{currency} {smartFormat(p.amount, s)}</span>
          </div>
        ))}
      </div>
    );
  }

  // roll (thermal) — default
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
