import React from "react";
import { g } from "./blockUtils";

// Page-only overlay: a large, faint, rotated text stamp across the whole
// document ("DRAFT", "COPY", branch name, …). Absolutely positioned so it
// doesn't participate in document flow — pure decoration behind the content.
export default function WatermarkBlock({ settings: s, props = {}, family }) {
  if (family !== "page") return null;
  if (g(s, "show_watermark") !== true) return null;
  const text = props.text != null ? props.text : g(s, "watermark_text");
  if (!text || !String(text).trim()) return null;
  const angle = props.angle != null ? props.angle : -30;
  const opacity = props.opacity != null ? props.opacity : 0.08;
  const fontSize = props.fontSize != null ? props.fontSize : 64;

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
          color: "#0f172a",
          opacity,
          transform: `rotate(${angle}deg)`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}
