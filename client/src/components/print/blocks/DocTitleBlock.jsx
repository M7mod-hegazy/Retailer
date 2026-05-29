import React from "react";
import { g } from "./blockUtils";

export default function DocTitleBlock({ settings: s, props = {}, family }) {
  if (family === "roll" || !props.title) return null;
  return <div style={{ fontSize: "18px", fontWeight: 900, color: g(s, "accent_color") }}>{props.title}</div>;
}
