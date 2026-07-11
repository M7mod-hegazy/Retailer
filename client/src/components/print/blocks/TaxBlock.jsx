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

    if (variant === "ruled") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: "1px solid #94a3b8" }}>
          <span style={{ color: "#334155", fontWeight: 700 }}>{label}{rate}</span>
          <span style={{ fontWeight: 800 }}>{currency} {smartFormat(displayAmount, s)}</span>
        </div>
      );
    }

    if (variant === "boxed") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: `${accent}08`, border: `1px solid ${accent}20`, borderRadius: "4px", margin: "2px 0" }}>
          <span style={{ color: accent, fontWeight: 700 }}>{label}{rate}</span>
          <span style={{ fontWeight: 800, color: accent }}>{currency} {smartFormat(displayAmount, s)}</span>
        </div>
      );
    }

    if (variant === "badge") {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: accent, color: "#fff", borderRadius: "20px", padding: "3px 12px", fontSize: "10px", fontWeight: 800 }}>
            {label}{rate}: {currency} {smartFormat(displayAmount, s)}
          </span>
        </div>
      );
    }

    if (variant === "compact") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", borderTop: "1px dashed #e2e8f0", paddingTop: "2px" }}>
          <span style={{ color: "#64748b" }}>{label}{rate}</span>
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

  if (variant === "ruled") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "2px 0" }}>
        <span style={{ fontWeight: 700 }}>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span style={HEAVY_VAL}>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #000", padding: "3px 4px", margin: "2px 0" }}>
        <span style={{ fontWeight: 900 }}>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span style={{ fontWeight: 900 }}>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "2px 0" }}>
        <span style={{ border: "1px solid #000", borderRadius: "10px", padding: "1px 10px", fontWeight: 900, fontSize: "0.95em" }}>
          {(rollLabel || rate) ? `${rollLabel}${rate}: ` : ""}{currency} {smartFormat(displayAmount, s)}
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", borderTop: "1px dashed #000", paddingTop: "1px" }}>
        <span>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", opacity: 0.8 }}>
        <span>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span>{currency} {smartFormat(displayAmount, s)}</span>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0", fontWeight: 900 }}>
        {(rollLabel || rate) ? `${rollLabel}${rate}: ` : ""}{currency} {smartFormat(displayAmount, s)}
      </div>
    );
  }

  if (variant === "dotted") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dotted #000", fontSize: "9px" }}>
        <span>{(rollLabel || rate) ? `${rollLabel}${rate}:` : ""}</span>
        <span style={{ fontWeight: 700 }}>{currency} {smartFormat(displayAmount, s)}</span>
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
