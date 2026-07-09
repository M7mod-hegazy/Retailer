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
  const defaultColor = isRoll ? "#000" : accent;
  const lineColor = props.color || defaultColor;
  const style = props.style || "solid";
  const thickness = props.thickness != null ? Number(props.thickness) : 1;
  const mt = props.marginTop != null ? `${props.marginTop}px` : "5px";
  const mb = props.marginBottom != null ? `${props.marginBottom}px` : "5px";

  if (["solid", "dashed", "dotted", "double"].includes(style)) {
    const borderTopVal = style === "double" ? `${thickness + 2}px double ${lineColor}` : `${thickness}px ${style} ${lineColor}`;
    return <div style={{ borderTop: borderTopVal, marginTop: mt, marginBottom: mb }} />;
  }

  const p = PATTERNS[style];
  if (p) {
    const color = props.color || (isRoll ? "#000" : PAGE_PATTERN_COLOR);
    return (
      <div style={{ textAlign: "center", color, fontSize: "9px", letterSpacing: "4px", lineHeight: 1.2, marginTop: mt, marginBottom: mb }}>
        {p.text}
      </div>
    );
  }
  return <div style={{ borderTop: `${thickness}px solid ${lineColor}`, marginTop: mt, marginBottom: mb }} />;
}
