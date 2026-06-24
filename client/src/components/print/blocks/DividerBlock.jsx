import React from "react";
import { g } from "./blockUtils";

const PATTERNS = {
  dots: { text: "· · · · · · · · · · · ·", color: "#94a3b8" },
  dash: { text: "— — — — — — — — — — —", color: "#94a3b8" },
  wave: { text: "∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼", color: "#94a3b8" },
  solid: null,
};

export default function DividerBlock({ settings: s, props = {}, family }) {
  const accent = g(s, "accent_color");
  const defaultStyle = "solid";
  const style = props.style || defaultStyle;
  if (style === "solid") {
    return <div style={{ borderTop: `1px solid ${accent}`, margin: "5px 0" }} />;
  }
  const p = PATTERNS[style];
  if (p) {
    return (
      <div style={{ textAlign: "center", color: p.color, fontSize: "9px", letterSpacing: "4px", lineHeight: 1.2, margin: "5px 0" }}>
        {p.text}
      </div>
    );
  }
  return <div style={{ borderTop: `1px solid ${accent}`, margin: "5px 0" }} />;
}
