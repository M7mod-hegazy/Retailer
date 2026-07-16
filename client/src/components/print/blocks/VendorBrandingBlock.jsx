import React from "react";

// Static vendor credit — never reads invoice/settings data, so it renders
// identically in the Studio canvas and the real Print Preview (no `editing`-only
// placeholder branch to fall out of sync, unlike data-driven blocks).
const WORDMARK = "الحجازي";
const TAGLINE = "نظام نقاط البيع الذكي";
const PHONE = "01032440775";
const INK = "#0f172a";
const SUB = "#475569";
const ACCENT = "#059669";
const ACCENT_DEEP = "#047857";
const GOLD = "#f59e0b";

function Mark({ size = 16, mono = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill={mono ? "#000" : ACCENT} />
      <path d="M7 9.3h10M7 12.5h7M7 15.7h10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      {!mono && <circle cx="17.3" cy="6.7" r="1.7" fill={GOLD} />}
    </svg>
  );
}

// The phone always sits in its own bordered chip — never a low-emphasis suffix —
// so it stays legible next to the mark no matter which variant is active.
function PhoneChip({ size, square = false, tone = "outline" }) {
  const toneStyle = {
    outline: { background: `${ACCENT}12`, border: `1.25px solid ${ACCENT}`, color: ACCENT_DEEP },
    solid: { background: ACCENT_DEEP, border: `1.25px solid ${ACCENT_DEEP}`, color: "#fff" },
    onDark: { background: "#fff", border: "1.25px solid #fff", color: ACCENT_DEEP },
    mono: { background: "#fff", border: "1.25px solid #000", color: "#000" },
    monoInverse: { background: "#000", border: "1.25px solid #000", color: "#fff" },
  }[tone];
  return (
    <span dir="ltr" style={{
      ...toneStyle,
      display: "inline-block",
      fontWeight: 800,
      fontSize: `${size}px`,
      lineHeight: 1.6,
      padding: square ? "0 5px" : "1px 7px",
      borderRadius: square ? 0 : 999,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.2px",
    }}>{PHONE}</span>
  );
}

export default function VendorBrandingBlock({ props = {}, family }) {
  const variant = props.variant || "minimal";
  const align = props.align || "center";
  const showIcon = props.showIcon !== false;
  const showPhone = props.showPhone !== false;
  const showTagline = !!props.showTagline;
  const isRoll = family === "roll";

  const justify = { right: "flex-end", center: "center", left: "flex-start" }[align] || "center";
  const wordColor = props.color || (isRoll ? "#000" : INK);
  const fs = Number(props.fontSize) || (isRoll ? 9 : 10);
  const weight = props.bold ? 900 : 800;
  const fontStyle = props.italic ? "italic" : "normal";
  const lineHeight = props.lineHeight || 1.25;

  const WordMark = ({ color = wordColor, size = fs }) => (
    <span style={{ fontWeight: weight, fontStyle, fontSize: `${size + 1}px`, color, lineHeight, whiteSpace: "nowrap" }}>{WORDMARK}</span>
  );
  const Tagline = ({ color = SUB, size = fs }) => (
    showTagline ? <span style={{ fontWeight: 600, fontSize: `${Math.max(6, size - 2)}px`, color, opacity: isRoll ? 1 : 0.75, lineHeight, whiteSpace: "nowrap" }}>{TAGLINE}</span> : null
  );

  /* ── badge — a two-tone pill fused from a filled brand half + an outlined number half ── */
  if (variant === "badge") {
    const radius = isRoll ? 0 : 999;
    return (
      <div style={{ display: "flex", justifyContent: justify, width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "stretch" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: isRoll ? "#000" : ACCENT,
            padding: isRoll ? "3px 8px" : "4px 12px",
            borderRadius: `${radius}px 0 0 ${radius}px`,
          }}>
            {showIcon && (
              <span style={{ width: isRoll ? "16px" : "18px", height: isRoll ? "16px" : "18px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mark size={isRoll ? 11 : 12} mono={isRoll} />
              </span>
            )}
            <WordMark color="#fff" />
          </div>
          {showPhone && (
            <div style={{
              display: "flex", alignItems: "center",
              background: isRoll ? "#fff" : "#fff",
              border: `1.5px solid ${isRoll ? "#000" : ACCENT}`,
              borderInlineStart: "none",
              padding: isRoll ? "3px 8px" : "4px 12px",
              borderRadius: `0 ${radius}px ${radius}px 0`,
            }}>
              <span dir="ltr" style={{ fontWeight: 900, fontSize: `${fs}px`, color: isRoll ? "#000" : ACCENT_DEEP, fontVariantNumeric: "tabular-nums" }}>{PHONE}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── ribbon — full-bleed footer bar; textured emerald on page, inverted black on roll ── */
  if (variant === "ribbon") {
    if (isRoll) {
      return (
        <div style={{ width: "100%", background: "#000", padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {showIcon && (
              <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mark size={11} mono />
              </span>
            )}
            <WordMark color="#fff" />
            <Tagline color="rgba(255,255,255,0.75)" />
          </div>
          {showPhone && <PhoneChip size={fs} square tone="mono" />}
        </div>
      );
    }
    return (
      <div style={{
        width: "100%", position: "relative", overflow: "hidden", borderRadius: "10px",
        background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 10px)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {showIcon && <Mark size={15} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <WordMark color="#fff" size={fs + 1} />
              <Tagline color="rgba(255,255,255,0.8)" />
            </div>
          </div>
          {showPhone && <PhoneChip size={fs} tone="onDark" />}
        </div>
      </div>
    );
  }

  /* ── stamp — a self-contained sealed mark: double-ring on page, double-frame box on roll ── */
  if (variant === "stamp") {
    if (isRoll) {
      return (
        <div style={{ display: "flex", justifyContent: justify, width: "100%" }}>
          <div style={{ border: "1px solid #000", padding: "2px" }}>
            <div style={{ border: "1px solid #000", padding: "5px 9px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {showIcon && <Mark size={13} mono />}
                <WordMark />
              </div>
              <Tagline />
              {showPhone && <PhoneChip size={fs - 1} square tone="mono" />}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", justifyContent: justify, width: "100%" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
          padding: "10px 16px",
          border: `1.5px solid ${ACCENT}`,
          borderRadius: "14px",
          position: "relative",
          transform: "rotate(-2.5deg)",
        }}>
          <div style={{ position: "absolute", inset: "3px", border: `1px solid ${ACCENT}55`, borderRadius: "10px", pointerEvents: "none" }} />
          {showIcon && <Mark size={18} />}
          <WordMark size={fs + 1} />
          <Tagline />
          {showPhone && <div style={{ marginTop: "1px" }}><PhoneChip size={Math.max(7, fs - 1)} tone="outline" /></div>}
        </div>
      </div>
    );
  }

  /* ── minimal (default) — a quiet footer line where the mark, wordmark and phone
     chip read as one continuous lockup, above a hairline rule ── */
  return (
    <div style={{
      display: "flex", justifyContent: justify, width: "100%",
      paddingTop: isRoll ? "5px" : "7px", marginTop: "2px",
      borderTop: `1px ${isRoll ? "dashed #000" : "solid #e2e8f0"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: isRoll ? "6px" : "8px", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isRoll ? "4px" : "5px" }}>
          {showIcon && <Mark size={isRoll ? 12 : 14} mono={isRoll} />}
          <WordMark />
        </div>
        <Tagline />
        {showPhone && <PhoneChip size={Math.max(7, fs - 1)} square={isRoll} tone={isRoll ? "mono" : "outline"} />}
      </div>
    </div>
  );
}
