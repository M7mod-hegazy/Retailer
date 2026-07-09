import React from "react";
import { g, computeTotals, smartFormat, HEAVY_VAL } from "./blockUtils";

// props.label renames the line; props.showRate=false hides "(15%)".
export default function TaxBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (String(g(s, "tax_enabled") ?? "0") !== "1") return null;
  if (g(s, "show_tax") === false) return null;
  // computeTotals is snapshot-aware: stored tax_amount is authoritative (0 = no tax line),
  // settings-derived tax only applies to ad-hoc preview objects without a stored total.
  const { taxAmount, taxRate } = computeTotals(invoice, s);
  // In editing mode with no real tax, show a realistic mock tax line (15% of 500 = 75)
  const displayAmount = taxAmount > 0 ? taxAmount : (editing ? 75 : 0);
  const displayRate = taxRate > 0 ? taxRate : (editing ? 15 : 0);
  if (displayAmount <= 0) return null;
  const inclusive = invoice.tax_type === "inclusive";
  const currency = g(s, "currency_symbol");
  const variant = props.variant || "standard";
  const rate = props.showRate === false ? "" : ` (${displayRate}%${inclusive ? " شاملة" : ""})`;

  if (family === "page") {
    const label = props.label !== undefined ? props.label : "الضريبة";

    if (variant === "inline") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontSize: "9.5px", color: "#94a3b8" }}>
          <span>{label}{rate}</span>
          <span style={{ fontWeight: 600 }}>{currency} {smartFormat(displayAmount, s)}</span>
        </div>
      );
    }

    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderTop: "1px dashed #cbd5e1", borderBottom: "1px dashed #cbd5e1", margin: "2px 0" }}>
          <span style={{ color: "#475569", fontWeight: 700 }}>{label}{rate}</span>
          <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displayAmount, s)}</span>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
        <span style={{ color: "#64748b" }}>{label}{rate}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  const rollLabel = props.label !== undefined ? props.label : "ضريبة";

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", opacity: 0.8 }}>
        <span>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  if (variant === "plain") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0" }}>
        <span style={{ fontWeight: 700 }}>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span style={HEAVY_VAL}>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
      <span style={HEAVY_VAL}>{currency} {smartFormat(displayAmount, s)}</span>
    </div>
  );
}
