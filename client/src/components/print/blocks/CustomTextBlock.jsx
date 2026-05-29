import React from "react";

export default function CustomTextBlock({ props = {} }) {
  if (!props.text) return null;
  const style = { textAlign: props.align || "center", fontSize: `${props.fontSize || 11}px` };
  if (props.color) style.color = props.color;
  if (props.bold) style.fontWeight = 700;
  if (props.italic) style.fontStyle = "italic";
  return <div style={style}>{props.text}</div>;
}
