import React from "react";
import { g, DEFAULTS } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

const DEFAULT_TEXT = "أهلاً وسهلاً — نرحب بكم في متجرنا";

export default function ReceiptHeaderTextBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  // Real configured text always wins — the editing sample is only for the
  // empty state, otherwise the Studio canvas shows text that never prints.
  const rawText = props.text != null && props.text !== ""
    ? props.text
    : (g(s, "receipt_header") || (editing ? DEFAULT_TEXT : DEFAULTS.receipt_header));
  const text = resolvePlaceholders(rawText, invoice, s) || (editing ? DEFAULT_TEXT : "");
  const variant = props.variant || "standard";
  const align = props.align || (variant === "centered" ? "center" : "center");
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
  const bg = props.background || (variant === "boxed" ? `${accent}05` : "transparent");
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : (variant === "boxed" ? 1 : 0);
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || accent;
  const padding = props.padding != null ? `${props.padding}px` : (variant === "boxed" ? "6px 12px" : "0px");

  if (family === "page") {
    const blockStyle = {
      textAlign: align,
      fontStyle: "italic",
      color: variant === "boxed" || variant === "underline-accent" ? accent : "#64748b",
      background: bg,
      padding,
      ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}`, borderRadius: "6px" } : {}),
      ...(variant === "underline-accent" ? { borderBottom: `2px solid ${accent}`, paddingBottom: "4px", fontWeight: 700 } : {}),
    };
    return (
      <div style={{ ...blockStyle, fontSize: variant === "centered" ? "12px" : "10px", marginBottom: "8px", fontWeight: variant === "centered" ? 800 : 500 }}>
        {text}
      </div>
    );
  }

  /* ── Roll variants ── */

  if (variant === "centered") {
    return (
      <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 800, color: "#000", marginBottom: "4px", paddingBottom: "4px", borderBottom: "1px dashed #000" }}>
        {text}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ textAlign: align, fontSize: "10px", fontWeight: 500, color: "#000", border: "1px solid #000", padding: "3px 6px", marginBottom: "4px", fontStyle: "italic" }}>
        {text}
      </div>
    );
  }

  if (variant === "underline-accent") {
    return (
      <div style={{ textAlign: align, fontSize: "10px", fontWeight: 700, color: "#000", borderBottom: "2px solid #000", paddingBottom: "3px", marginBottom: "4px" }}>
        {text}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", fontWeight: 500, color: "#64748b", marginBottom: "3px", fontStyle: "italic" }}>
        {text}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", fontSize: "10px", fontWeight: 500, fontStyle: "italic", color: "#000", marginBottom: "4px" }}>
      {text}
    </div>
  );
}
