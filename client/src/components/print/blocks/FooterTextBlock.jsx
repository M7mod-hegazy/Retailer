import React from "react";
import { g, DEFAULTS } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

const DEFAULT_TEXT = "شكراً لتعاملكم معنا — نرحب بزيارتكم دائماً";

export default function FooterTextBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showFooter = g(s, "show_footer") !== false;
  if (!showFooter) return null;
  // Real configured text always wins — the editing sample is only for the
  // empty state, otherwise the Studio canvas shows text that never prints.
  const rawText = props.text != null && props.text !== ""
    ? props.text
    : (g(s, "receipt_footer") || (editing ? DEFAULT_TEXT : DEFAULTS.receipt_footer));
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
    color: variant === "boxed" || variant === "underline-accent" ? accent : "#475569",
    fontWeight: variant === "centered" ? 800 : 600,
    fontStyle: "italic",
    background: bg,
    padding,
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}`, borderRadius: "6px" } : {}),
    ...(variant === "underline-accent" ? { borderTop: `2px solid ${accent}`, paddingTop: "4px" } : {}),
  };

  if (family === "page") {
    return (
      <div style={blockStyle}>
        {text}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ marginTop: "6px", fontSize: "9px", color: "#64748b", textAlign: align, fontStyle: "italic" }}>
        {text}
      </div>
    );
  }

  if (variant === "bordered") {
    return (
      <div style={{ marginTop: "6px", fontSize, color: "#475569", textAlign: align, fontStyle: "italic", borderTop: "1px solid #000", paddingTop: "4px" }}>
        {text}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ marginTop: "4px", fontSize: "9px", color: "#64748b", textAlign: align }}>
        {text}
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ marginTop: "6px", fontSize: "10px", fontWeight: 800, color: "#000", textAlign: "center", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "3px 0" }}>
        {text}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{ marginTop: "6px", fontSize: "10px", color: "#000", textAlign: align, border: "1px solid #000", padding: "3px 4px", fontStyle: "italic" }}>
        {text}
      </div>
    );
  }

  if (variant === "framed") {
    return (
      <div style={{ marginTop: "6px", fontSize: "9px", color: "#475569", textAlign: "center", borderTop: "1px solid #000", borderBottom: "1px solid #000", padding: "3px 0", fontWeight: 700 }}>
        ★ {text} ★
      </div>
    );
  }

  return (
    <div style={{ ...blockStyle, marginTop: "10px" }}>
      <div>{text}</div>
    </div>
  );
}
