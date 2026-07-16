import React from "react";
import ElHegaziMark from "./ElHegaziMark";

const PHONE = "01032440775";

/**
 * The mark is never shown alone — the support number always rides directly
 * under it as one fused unit, so "call us" stays legible wherever the brand
 * appears (dashboard header, login card footer, etc).
 */
export default function BrandLockup({ size = 40, tone = "dark", showWordmark = true, className = "" }) {
  const isDark = tone === "dark";
  const wordColor = isDark ? "#fff" : "#16241D";
  const phoneStyle = isDark
    ? { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }
    : { background: "var(--accent-soft)", border: "1px solid var(--primary)", color: "var(--primary-600)" };
  const wordSize = Math.max(10, Math.round(size * 0.24));
  const phoneSize = Math.max(9, Math.round(size * 0.22));

  const nameSize = Math.max(8, Math.round(size * 0.20));
  const nameColor = isDark ? "rgba(255,255,255,0.65)" : "var(--text-secondary, #475569)";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <ElHegaziMark size={size} glow={isDark} />
      <div className="flex flex-col gap-0.5 leading-none">
        {showWordmark && (
          <>
            <span className="font-black" style={{ fontSize: `${wordSize}px`, color: wordColor, fontFamily: "'El Messiri', var(--font-body)" }}>
              الحجازي
            </span>
            <span style={{ fontSize: `${nameSize}px`, fontWeight: 700, color: nameColor, whiteSpace: "nowrap" }}>
              م/ محمود حجازي
            </span>
          </>
        )}
        <span dir="ltr" style={{ ...phoneStyle, display: "inline-block", width: "fit-content", fontWeight: 800, fontSize: `${phoneSize}px`, padding: "1px 7px", borderRadius: 999, fontVariantNumeric: "tabular-nums", letterSpacing: "0.3px" }}>
          {PHONE}
        </span>
      </div>
    </div>
  );
}
