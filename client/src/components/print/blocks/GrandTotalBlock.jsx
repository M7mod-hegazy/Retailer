import React from "react";
import { g, computeTotals, smartFormat } from "./blockUtils";

/**
 * Grand total — fully parametric so any look can be built (props):
 *  variant     "band" filled | "boxed" double-border | "plain" ruled row | "huge" ticket style
 *  label       line caption (default "الإجمالي")
 *  decor       decoration text around the label on band (default "✦", empty = none —
 *              free text, e.g. "★", "—", "»") — not a hardcoded star anymore
 *  labelSize   caption font size in px
 *  amountSize  number font size in px
 *  background / textColor   band colors on PAGE (roll band stays black/white —
 *              thermal heads are 1-bit; anything else prints as mud)
 * Generic box overrides (border/padding/margins/width) also apply via the wrapper.
 */
export default function GrandTotalBlock({ invoice = {}, settings: s, props = {}, family }) {
  const { grandTotal } = computeTotals(invoice, s);
  const currency = g(s, "currency_symbol");
  const accent = g(s, "accent_color");
  const variant = props.variant || "band";
  const label = props.label !== undefined && props.label !== "" ? props.label : "الإجمالي";
  const decor = props.decor !== undefined ? props.decor : "✦";
  const decorPos = props.decorPos || "both"; // both | before | after
  const amount = `${currency} ${smartFormat(grandTotal, s)}`;
  const labelFs = props.labelSize != null ? `${props.labelSize}px` : null;
  const amountFs = props.amountSize != null ? `${props.amountSize}px` : null;

  const leadDecor = decor && (decorPos === "both" || decorPos === "before");
  const trailDecor = decor && (decorPos === "both" || decorPos === "after");
  const labelNode = decor
    ? (
      <span style={labelFs ? { fontSize: labelFs } : undefined}>
        {leadDecor && <span style={{ marginLeft: "5px", fontSize: "11px" }}>{decor}</span>}
        {label}
        {trailDecor && <span style={{ marginRight: "5px", fontSize: "11px" }}>{decor}</span>}
      </span>
    )
    : <span style={labelFs ? { fontSize: labelFs } : undefined}>{label}</span>;
  const decorTextLabel = decor
    ? `${leadDecor ? decor + " " : ""}${label}${trailDecor ? " " + decor : ""}`
    : label;

  if (family === "page") {
    const bandBg = props.background || accent;
    const bandColor = props.textColor || "#fff";
    if (variant === "boxed") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", border: `2px solid ${props.background || accent}`, color: props.textColor || accent, borderRadius: "4px", marginTop: "3px", fontWeight: 900 }}>
          {labelNode}<span style={amountFs ? { fontSize: amountFs } : undefined}>{amount}</span>
        </div>
      );
    }
    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 2px", borderTop: `2px solid ${props.background || accent}`, marginTop: "3px", fontWeight: 900, color: props.textColor || "#0f172a" }}>
          {labelNode}<span style={amountFs ? { fontSize: amountFs } : undefined}>{amount}</span>
        </div>
      );
    }
    if (variant === "huge") {
      return (
        <div style={{ textAlign: "center", marginTop: "4px" }}>
          <div style={{ fontSize: labelFs || "10px", fontWeight: 700, color: "#475569" }}>{decorTextLabel}</div>
          <div style={{ fontSize: amountFs || "24px", fontWeight: 900, color: props.textColor || accent, lineHeight: 1.2 }}>{amount}</div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 6px", background: bandBg, color: bandColor, borderRadius: "2px", marginTop: "3px", fontWeight: 900 }}>
        {labelNode}
        <span style={{ fontWeight: 900, ...(amountFs ? { fontSize: amountFs } : {}) }}>{amount}</span>
      </div>
    );
  }

  // ── roll (thermal: pure black/white only) ──
  const size = amountFs || `${Math.max(13, Number(g(s, "body_font_size")) + 1)}px`;
  if (variant === "boxed") {
    return (
      <div style={{ border: "3px double #000", padding: "5px 6px", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "plain") {
    return (
      <div style={{ borderTop: "2px solid #000", padding: "4px 2px 0", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "huge") {
    return (
      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <div style={{ fontSize: labelFs || "10px", fontWeight: 700 }}>{decorTextLabel}</div>
        <div style={{ fontSize: amountFs || "22px", fontWeight: 900, lineHeight: 1.15, fontFamily: "monospace" }}>{amount}</div>
      </div>
    );
  }
  return (
    <div style={{
      background: "#000", color: "#fff",
      padding: "7px 5px",
      marginTop: "6px",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: size, fontWeight: 900,
      }}>
        {labelNode}
        <span style={{ fontFamily: "monospace" }}>{amount}</span>
      </div>
    </div>
  );
}
