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
  const variant = props.variant || "standard";
  const fontSize = `${g(s, "footer_font_size") || 10}px`;
  const align = props.align || "center";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const bg = props.background || (variant === "boxed" ? `${accent}05` : "transparent");
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : (variant === "boxed" ? 1 : 0);
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || accent;
  const padding = props.padding != null ? `${props.padding}px` : (variant === "boxed" ? "6px 12px" : "0px");

  const blockStyle = {
    textAlign: align,
    fontSize: variant === "centered" ? `${(g(s, "footer_font_size") || 10) + 2}px` : fontSize,
    color: variant === "boxed" ? accent : "#475569",
    fontWeight: variant === "centered" ? 800 : 600,
    fontStyle: "italic",
    background: bg,
    padding,
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}`, borderRadius: "6px" } : {}),
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
