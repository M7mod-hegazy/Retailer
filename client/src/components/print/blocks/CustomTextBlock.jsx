import React from "react";
import { resolvePlaceholders } from "./placeholders";

export default function CustomTextBlock({ invoice = {}, settings: s = {}, props = {}, family, editing }) {
  // In editing mode, show a descriptive placeholder when no text is configured
  const rawText = props.text || (editing ? "[ نص مخصص — انقر مرتين لتحرير المحتوى ]" : "");
  if (!rawText) return null;
  const text = resolvePlaceholders(rawText, invoice, s);
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
  const isRoll = family === "roll";

  const baseStyle = {
    textAlign: props.align || "center",
    fontSize: `${props.fontSize || (isRoll ? 10 : 11)}px`,
    ...(editing && !props.text ? {
      border: "1px dashed #7c3aed",
      borderRadius: "3px",
      padding: "4px 8px",
      color: "#7c3aed",
      background: "#f5f3ff",
    } : {}),
  };
  if (props.color && props.text) baseStyle.color = props.color;
  if (props.bold) baseStyle.fontWeight = 700;
  if (props.italic) baseStyle.fontStyle = "italic";

  /* ── Roll variants ── */

  if (variant === "alert") {
    if (isRoll) {
      return (
        <div style={{
          ...baseStyle,
          border: "1px solid #000",
          borderRadius: "0",
          padding: "3px 6px",
          fontWeight: 700,
          fontSize: "9px",
        }}>{text}</div>
      );
    }
    return (
      <div style={{
        ...baseStyle,
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "6px",
        padding: "8px 12px",
        color: "#b45309",
        fontWeight: 700
      }}>{text}</div>
    );
  }

  if (variant === "badge") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", justifyContent: props.align === "left" ? "flex-end" : props.align === "right" ? "flex-start" : "center" }}>
          <div style={{
            ...baseStyle,
            display: "inline-block",
            border: "1px solid #000",
            borderRadius: "0",
            padding: "2px 8px",
            fontWeight: 700,
            fontSize: "9px",
          }}>{text}</div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: props.align === "left" ? "flex-end" : props.align === "right" ? "flex-start" : "center" }}>
        <div style={{
          ...baseStyle,
          display: "inline-block",
          background: `${accent}10`,
          border: `1px solid ${accent}30`,
          borderRadius: "9999px",
          padding: "4px 14px",
          color: accent,
          fontWeight: 700
        }}>{text}</div>
      </div>
    );
  }

  if (variant === "banner") {
    if (isRoll) {
      return (
        <div style={{
          ...baseStyle,
          background: "#000",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: "0",
          fontWeight: 700,
          fontSize: "9px",
        }}>{text}</div>
      );
    }
    return (
      <div style={{
        ...baseStyle,
        background: accent,
        color: "#ffffff",
        padding: "6px 10px",
        borderRadius: "4px",
        fontWeight: 700
      }}>{text}</div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{
        ...baseStyle,
        fontSize: isRoll ? "9px" : "10px",
        fontWeight: 500,
        color: "#64748b",
      }}>{text}</div>
    );
  }

  return <div style={baseStyle}>{text}</div>;
}
