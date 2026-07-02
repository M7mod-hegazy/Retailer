import React from "react";
import { g } from "./blockUtils";

const PATTERNS = {
  dots: { text: "· · · · · · · · · · · ·" },
  dash: { text: "— — — — — — — — — — —" },
  wave: { text: "∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼ ∼" },
  solid: null,
};

// Thermal printers are 1-bit: slate-400 dividers dither to nothing on paper,
// so the roll family always rules in pure black. Page (A4/A5) keeps the softer
// decorative tones — laser/inkjet render them fine.
const PAGE_PATTERN_COLOR = "#94a3b8";

export default function DividerBlock({ settings: s, props = {}, family }) {
  const isRoll = family === "roll";
  const accent = g(s, "accent_color");
  const lineColor = isRoll ? "#000" : accent;
  const defaultStyle = "solid";
  const style = props.style || defaultStyle;
  if (style === "solid") {
    return <div style={{ borderTop: `1px solid ${lineColor}`, margin: "5px 0" }} />;
  }
  const p = PATTERNS[style];
  if (p) {
    return (
      <div style={{ textAlign: "center", color: isRoll ? "#000" : PAGE_PATTERN_COLOR, fontSize: "9px", letterSpacing: "4px", lineHeight: 1.2, margin: "5px 0" }}>
        {p.text}
      </div>
    );
  }
  return <div style={{ borderTop: `1px solid ${lineColor}`, margin: "5px 0" }} />;
}
