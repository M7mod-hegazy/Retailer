import React from "react";
import { g } from "./blockUtils";

export default function DividerBlock({ settings: s, props = {}, family }) {
  const accent = g(s, "accent_color");
  const defaultSolid = family === "roll";
  const isSolid = props.solid != null ? props.solid : defaultSolid;
  const border = isSolid ? `1px solid ${accent}` : `1px dashed ${accent}66`;
  return <div style={{ borderTop: border, margin: "5px 0" }} />;
}
