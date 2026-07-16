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
    : { background: "rgba(5,150,105,0.08)", border: "1px solid #059669", color: "#047857" };
  const wordSize = Math.max(10, Math.round(size * 0.24));
  const phoneSize = Math.max(9, Math.round(size * 0.22));

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <ElHegaziMark size={size} glow={isDark} />
      <div className="flex flex-col gap-1 leading-none">
        {showWordmark && (
          <span className="font-black" style={{ fontSize: `${wordSize}px`, color: wordColor, fontFamily: "'El Messiri', var(--font-body)" }}>
            الحجازي
          </span>
        )}
        <span dir="ltr" style={{ ...phoneStyle, display: "inline-block", width: "fit-content", fontWeight: 800, fontSize: `${phoneSize}px`, padding: "1px 7px", borderRadius: 999, fontVariantNumeric: "tabular-nums", letterSpacing: "0.3px" }}>
          {PHONE}
        </span>
      </div>
    </div>
  );
}
