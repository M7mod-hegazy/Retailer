import React from "react";
import { resolvePlaceholders } from "./placeholders";

export default function CustomTextBlock({ invoice = {}, settings: s = {}, props = {}, editing }) {
  // In editing mode, show a descriptive placeholder when no text is configured
  const rawText = props.text || (editing ? "[ نص مخصص — انقر مرتين لتحرير المحتوى ]" : "");
  if (!rawText) return null;
  const text = resolvePlaceholders(rawText, invoice, s);
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
  return <div style={style}>{text}</div>;
}
