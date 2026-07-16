import React from "react";

// Static vendor credit — never reads invoice/settings data, so it renders
// identically in the Studio canvas and the real Print Preview (no `editing`-only
// placeholder branch to fall out of sync, unlike data-driven blocks).
const WORDMARK = "الحجازي";
const TAGLINE = "نظام نقاط البيع الذكي";
const PHONE = "01032440775";
const ACCENT = "#059669";
const DOT = "#f59e0b";
const MUTED = "#64748b";

function BrandMark({ size = 15, mono = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill={mono ? "#000" : ACCENT} />
      <path d="M7 9.3h10M7 12.5h7M7 15.7h10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      {!mono && <circle cx="17.3" cy="6.7" r="1.7" fill={DOT} />}
    </svg>
  );
}

export default function VendorBrandingBlock({ props = {} , family }) {
  const variant = props.variant || "minimal";
  const align = props.align || "center";
  const showIcon = props.showIcon !== false;
  const showPhone = props.showPhone !== false;
  const showTagline = !!props.showTagline;
  const isRoll = family === "roll";

  const justify = { right: "flex-end", center: "center", left: "flex-start" }[align] || "center";
  const inkColor = props.color || (isRoll ? "#000" : MUTED);
  const fs = Number(props.fontSize) || (isRoll ? 8 : 9);
  const weight = props.bold ? 800 : 700;
  const fontStyle = props.italic ? "italic" : "normal";
  const lineHeight = props.lineHeight || 1.3;

  function Cluster({ wordColor = inkColor, metaColor = inkColor, size = fs, stacked = false, iconSize }) {
    return (
      <div style={{ display: "flex", alignItems: stacked ? "flex-start" : "center", gap: isRoll ? "4px" : "6px" }}>
        {showIcon && <BrandMark size={iconSize || (isRoll ? 11 : 14)} mono={isRoll} />}
        <div style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "flex-start" : "baseline", gap: stacked ? "1px" : "6px", flexWrap: "wrap" }}>
          <span style={{ fontWeight: weight, fontStyle, fontSize: `${size + 1}px`, color: wordColor, lineHeight }}>{WORDMARK}</span>
          {showTagline && <span style={{ fontWeight: 500, fontSize: `${Math.max(6, size - 1)}px`, color: metaColor, opacity: 0.8, lineHeight }}>{TAGLINE}</span>}
          {showPhone && (
            <span dir="ltr" style={{ fontWeight: 600, fontSize: `${size}px`, color: metaColor, lineHeight, fontVariantNumeric: "tabular-nums" }}>
              {!stacked && <span style={{ opacity: 0.45, fontWeight: 400 }}>· </span>}{PHONE}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <div style={{ display: "flex", justifyContent: justify, width: "100%" }}>
        <div style={{
          display: "inline-flex", alignItems: "center",
          padding: isRoll ? "3px 8px" : "4px 12px",
          border: isRoll ? "1px solid #000" : `1px solid ${ACCENT}33`,
          borderRadius: isRoll ? "0" : "9999px",
          background: isRoll ? "transparent" : `${ACCENT}0d`,
        }}>
          <Cluster wordColor={isRoll ? "#000" : ACCENT} />
        </div>
      </div>
    );
  }

  if (variant === "ribbon") {
    if (isRoll) {
      return (
        <div style={{ width: "100%", padding: "4px 0", borderTop: "1px solid #000", borderBottom: "1px solid #000", display: "flex", justifyContent: "center" }}>
          <Cluster />
        </div>
      );
    }
    return (
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", background: ACCENT, borderRadius: "8px" }}>
        <Cluster wordColor="#fff" metaColor="rgba(255,255,255,0.85)" iconSize={14} />
      </div>
    );
  }

  if (variant === "stamp") {
    return (
      <div style={{ display: "flex", justifyContent: justify, width: "100%" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: isRoll ? "3px 6px" : "5px 10px",
          border: isRoll ? "1px solid #000" : `1px dashed ${ACCENT}55`,
          borderRadius: isRoll ? "0" : "10px",
        }}>
          <Cluster stacked iconSize={isRoll ? 14 : 20} />
        </div>
      </div>
    );
  }

  // minimal (default) — a quiet single line above a hairline footer rule
  return (
    <div style={{
      display: "flex", justifyContent: justify, width: "100%",
      paddingTop: isRoll ? "4px" : "6px", marginTop: "2px",
      borderTop: `1px ${isRoll ? "dashed #000" : "solid #e2e8f0"}`,
    }}>
      <Cluster />
    </div>
  );
}
