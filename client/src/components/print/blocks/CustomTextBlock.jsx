import React from "react";
import { resolvePlaceholders } from "./placeholders";

export default function CustomTextBlock({ invoice = {}, settings: s = {}, props = {}, editing }) {
  // In editing mode, show a descriptive placeholder when no text is configured
  const rawText = props.text || (editing ? "[ نص مخصص — انقر مرتين لتحرير المحتوى ]" : "");
  if (!rawText) return null;
  const text = resolvePlaceholders(rawText, invoice, s);
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const style = {
    textAlign: props.align || "center",
    fontSize: `${props.fontSize || 11}px`,
    ...(editing && !props.text ? {
      border: "1px dashed #7c3aed",
      borderRadius: "3px",
      padding: "4px 8px",
      color: "#7c3aed",
      background: "#f5f3ff",
    } : {}),
  };
  if (props.color && props.text) style.color = props.color;
  if (props.bold) style.fontWeight = 700;
  if (props.italic) style.fontStyle = "italic";

  if (variant === "alert") {
    return (
      <div style={{
        ...style,
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
    return (
      <div style={{ display: "flex", justifyContent: props.align === "left" ? "flex-end" : props.align === "right" ? "flex-start" : "center" }}>
        <div style={{
          ...style,
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
    return (
      <div style={{
        ...style,
        background: accent,
        color: "#ffffff",
        padding: "6px 10px",
        borderRadius: "4px",
        fontWeight: 700
      }}>{text}</div>
    );
  }

  return <div style={style}>{text}</div>;
}
