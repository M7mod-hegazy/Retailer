import React from "react";
import { g, DEFAULTS } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

const DEFAULT_TEXT = "شكراً لتعاملكم معنا — نرحب بزيارتكم دائماً";

export default function FooterTextBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showFooter = g(s, "show_footer") !== false;
  if (!showFooter) return null;
  const rawText = props.text != null && props.text !== ""
    ? props.text
    : (editing ? DEFAULT_TEXT : (g(s, "receipt_footer") || DEFAULTS.receipt_footer));
  const text = resolvePlaceholders(rawText, invoice, s)
    || (editing ? DEFAULT_TEXT : "");
  if (!text) return null;
  const fontSize = `${g(s, "footer_font_size") || 10}px`;
  const align = props.align || "center";
  
  const bg = props.background || "transparent";
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : 0;
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || "#e2e8f0";
  const padding = props.padding != null ? `${props.padding}px` : "0px";

  const blockStyle = {
    textAlign: align,
    fontSize,
    color: "#475569",
    fontWeight: 600,
    fontStyle: "italic",
    background: bg,
    padding,
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
  };

  if (family === "page") {
    return (
      <div style={blockStyle}>
        {text}
      </div>
    );
  }
  return (
    <div style={{ ...blockStyle, marginTop: "10px" }}>
      <div>{text}</div>
    </div>
  );
}
