import React from "react";
import { g } from "./blockUtils";

export default function PatternDividerBlock({ settings: s, props = {}, family }) {
  const isRoll = family === "roll";
  const accent = g(s, "accent_color") || "#1e3a8a";
  const lineColor = isRoll ? "#000" : accent;

  const style = props.style || "double"; // double | dots | dash-dot | geometric | star
  const height = props.height || (isRoll ? 6 : 10);

  const containerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: `${height}px`,
    marginBottom: `${height}px`,
    overflow: "hidden",
  };

  const lineStyle = {
    flex: 1,
    height: "1px",
    borderTop: `1px solid ${lineColor}`,
  };

  if (style === "double") {
    return (
      <div style={{ ...containerStyle, flexDirection: "column", gap: "2px" }}>
        <div style={{ width: "100%", borderTop: `1.5px solid ${lineColor}` }} />
        <div style={{ width: "100%", borderTop: `1.5px solid ${lineColor}` }} />
      </div>
    );
  }

  if (style === "dots") {
    return (
      <div style={containerStyle}>
        <div style={{ width: "100%", borderTop: `3px dotted ${lineColor}`, letterSpacing: "4px" }} />
      </div>
    );
  }

  if (style === "dash-dot") {
    return (
      <div style={containerStyle}>
        <div style={{ width: "100%", height: "2px", background: `repeating-linear-gradient(90deg, ${lineColor}, ${lineColor} 8px, transparent 8px, transparent 12px, ${lineColor} 12px, ${lineColor} 14px, transparent 14px, transparent 18px)` }} />
      </div>
    );
  }

  if (style === "geometric") {
    return (
      <div style={{ ...containerStyle, gap: "10px" }}>
        <div style={lineStyle} />
        <span style={{ fontSize: "10px", color: lineColor, display: "flex", gap: "4px" }}>
          <span>◆</span><span>◇</span><span>◆</span>
        </span>
        <div style={lineStyle} />
      </div>
    );
  }

  if (style === "star") {
    return (
      <div style={{ ...containerStyle, gap: "10px" }}>
        <div style={lineStyle} />
        <span style={{ fontSize: "11px", color: lineColor }}>✦ ✦ ✦</span>
        <div style={lineStyle} />
      </div>
    );
  }

  // Fallback default solid line
  return (
    <div style={containerStyle}>
      <div style={{ width: "100%", borderTop: `1px solid ${lineColor}` }} />
    </div>
  );
}
