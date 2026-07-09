import React from "react";
import { g } from "./blockUtils";

// Page-only overlay: a large, faint, rotated text stamp across the whole
// document ("DRAFT", "COPY", branch name, …). Absolutely positioned so it
// doesn't participate in document flow — pure decoration behind the content.
export default function WatermarkBlock({ settings: s, props = {}, family, editing }) {
  if (family !== "page") return null;
  const showWatermark = g(s, "show_watermark") === true;
  if (!showWatermark) return null;
  const text = props.text != null ? props.text : (g(s, "watermark_text") || (editing ? "نسخة" : ""));
  if (!text || !String(text).trim()) return null;
  const angle = props.angle != null ? props.angle : -30;
  const opacity = props.opacity != null ? props.opacity : (showWatermark ? 0.08 : 0.12);
  const fontSize = props.fontSize != null ? props.fontSize : 64;
  const color = props.color != null ? props.color : "#0f172a";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <div
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 900,
          color,
          opacity,
          transform: `rotate(${angle}deg)`,
          whiteSpace: "nowrap",
          border: editing && !showWatermark ? "2px dashed #7c3aed" : "none",
          padding: editing && !showWatermark ? "8px 16px" : 0,
          borderRadius: 4,
        }}
      >
        {text}
      </div>
    </div>
  );
}
