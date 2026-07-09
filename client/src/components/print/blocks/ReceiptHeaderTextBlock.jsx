import React from "react";
import { g, DEFAULTS } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

const DEFAULT_TEXT = "أهلاً وسهلاً — نرحب بكم في متجرنا";

export default function ReceiptHeaderTextBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const rawText = props.text != null && props.text !== ""
    ? props.text
    : (editing ? DEFAULT_TEXT : (g(s, "receipt_header") || DEFAULTS.receipt_header));
  const text = resolvePlaceholders(rawText, invoice, s) || (editing ? DEFAULT_TEXT : "");
  const align = props.align || "center";
  const bg = props.background || "transparent";
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : 0;
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || "#e2e8f0";
  const padding = props.padding != null ? `${props.padding}px` : "0px";

  const blockStyle = {
    textAlign: align,
    fontStyle: "italic",
    color: "#64748b",
    background: bg,
    padding,
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
  };

  if (family === "page") {
    return (
      <div style={{ ...blockStyle, fontSize: "10px", marginBottom: "8px", color: "#64748b" }}>
        {text}
      </div>
    );
  }
  return (
    <div style={{ ...blockStyle, fontSize: "10px", marginBottom: "4px" }}>
      {text}
    </div>
  );
}
