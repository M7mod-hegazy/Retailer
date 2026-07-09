import React from "react";
import { g, DEFAULTS } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

const DEFAULT_TEXT = "أهلاً وسهلاً — نرحب بكم في متجرنا";

export default function ReceiptHeaderTextBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const rawText = props.text != null && props.text !== ""
    ? props.text
    : (editing ? DEFAULT_TEXT : (g(s, "receipt_header") || DEFAULTS.receipt_header));
  const text = resolvePlaceholders(rawText, invoice, s) || (editing ? DEFAULT_TEXT : "");
  const variant = props.variant || "standard";
  const align = props.align || (variant === "centered" ? "center" : "center");
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
  const bg = props.background || (variant === "boxed" ? `${accent}05` : "transparent");
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : (variant === "boxed" ? 1 : 0);
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || accent;
  const padding = props.padding != null ? `${props.padding}px` : (variant === "boxed" ? "6px 12px" : "0px");

  const blockStyle = {
    textAlign: align,
    fontStyle: "italic",
    color: variant === "boxed" ? accent : "#64748b",
    background: bg,
    padding,
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}`, borderRadius: "6px" } : {}),
  };

  if (family === "page") {
    return (
      <div style={{ ...blockStyle, fontSize: variant === "centered" ? "12px" : "10px", marginBottom: "8px", fontWeight: variant === "centered" ? 800 : 500 }}>
        {text}
      </div>
    );
  }
  return (
    <div style={{ ...blockStyle, fontSize: variant === "centered" ? "11px" : "10px", marginBottom: "4px", fontWeight: variant === "centered" ? 800 : 500 }}>
      {text}
    </div>
  );
}
