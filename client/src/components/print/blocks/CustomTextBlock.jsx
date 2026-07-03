import React from "react";
import { resolvePlaceholders } from "./placeholders";

export default function CustomTextBlock({ invoice = {}, settings: s = {}, props = {} }) {
  if (!props.text) return null;
  const style = { textAlign: props.align || "center", fontSize: `${props.fontSize || 11}px` };
  if (props.color) style.color = props.color;
  if (props.bold) style.fontWeight = 700;
  if (props.italic) style.fontStyle = "italic";
  return <div style={style}>{resolvePlaceholders(props.text, invoice, s)}</div>;
}
