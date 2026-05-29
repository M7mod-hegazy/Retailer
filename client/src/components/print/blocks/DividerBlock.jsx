import React from "react";
import { g } from "./blockUtils";

export default function DividerBlock({ settings: s, props = {} }) {
  const accent = g(s, "accent_color");
  const border = props.solid ? `1px solid ${accent}` : `1px dashed ${accent}66`;
  return <div style={{ borderTop: border, margin: "5px 0" }} />;
}
