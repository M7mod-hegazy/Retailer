import React from "react";

// Static vendor credit — never reads invoice/settings data, so it renders
// identically in the Studio canvas and the real Print Preview (no `editing`-only
// placeholder branch to fall out of sync, unlike data-driven blocks).
const WORDMARK = "الحجازي";
const TAGLINE = "نظام نقاط البيع الذكي";
const PHONE = "01032440775";
const INK = "#0f172a";
const SUB = "#475569";
const GOLD = "#f59e0b";

function Mark({ size = 16, mono = false, accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill={mono ? "#000" : accent} />
      <path d="M7 9.3h10M7 12.5h7M7 15.7h10" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      {!mono && <circle cx="17.3" cy="6.7" r="1.7" fill={GOLD} />}
    </svg>
  );
}

// The phone always sits in its own bordered chip — never a low-emphasis suffix —
// so it stays legible next to the mark no matter which variant is active.
function PhoneChip({ size, square = false, tone = "outline", isRoll, accent, accentDeep }) {
  const toneStyle = {
    outline: { background: `color-mix(in srgb, ${accent} 8%, transparent)`, border: `1.25px solid ${accent}`, color: accentDeep },
    solid: { background: accentDeep, border: `1.25px solid ${accentDeep}`, color: "#fff" },
    onDark: { background: "#fff", border: "1.25px solid #fff", color: accentDeep },
    mono: { background: "#fff", border: "1.25px solid #000", color: "#000" },
    monoInverse: { background: "#000", border: "1.25px solid #000", color: "#fff" },
  }[tone];
  const prefix = "لبرامج المبيعات: ";
  return (
    <span dir="rtl" style={{
      ...toneStyle,
      display: "inline-flex",
      alignItems: "center",
      fontWeight: 800,
      fontSize: `${size}px`,
      lineHeight: 1.6,
      padding: square ? "0 5px" : "1px 8px",
      borderRadius: square ? 0 : 999,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.2px",
      gap: "4px",
    }}>
      <span>{prefix}</span>
      <span dir="ltr">{PHONE}</span>
    </span>
  );
}

export default function VendorBrandingBlock({ props = {}, family, settings = {} }) {
  const isRoll = family === "roll";

  // Dynamic fallback for variant based on the print layout theme/style
  let defaultVariant = "minimal";
  if (isRoll) {
    const roll = (settings.layout && settings.layout.roll) || {};
    const rb = roll.perBlock || {};
    const compName = rb.company_name || {};
    const payments = rb.payments || {};
    const subtotal = rb.subtotal || {};
    const itemsTable = rb.items_table || {};

    if (compName.variant === "retro-brutalist" || compName.variant === "brutalist") {
      defaultVariant = "ribbon";
    } else if (compName.borderWidth || compName.borderColor || itemsTable.tableBorder === "grid") {
      defaultVariant = "stamp";
    } else if (payments.variant === "badge-pill" || payments.variant === "badge" || subtotal.variant === "badge") {
      defaultVariant = "badge";
    } else {
      defaultVariant = "minimal";
    }
  } else {
    const page = (settings.layout && settings.layout.page) || {};
    const hStyle = settings.header_style || page.headerStyle || page.header_style || "";
    const pLayout = settings.page_layout_type || page.pageLayoutType || page.page_layout_type || "";

    if (hStyle === "band" || hStyle === "brutalist" || pLayout === "split-header") {
      defaultVariant = "ribbon";
    } else if (hStyle === "badge" || hStyle === "centered") {
      defaultVariant = "badge";
    } else if (hStyle === "boxed" || pLayout === "executive" || pLayout === "letterhead") {
      defaultVariant = "stamp";
    } else {
      defaultVariant = "minimal";
    }
  }

  const variant = props.variant || defaultVariant;
  const align = props.align || "center";
  const showIcon = props.showIcon !== false;
  const showPhone = props.showPhone !== false;
  const showTagline = !!props.showTagline;

  // Resolve dynamic colors based on print settings
  const dynamicAccent = settings.accent_color || "#059669";
  const dynamicAccentDeep = dynamicAccent === "#059669"
    ? "#047857"
    : `color-mix(in srgb, ${dynamicAccent} 80%, #000 20%)`;

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
            background: isRoll ? "#000" : dynamicAccent,
            padding: isRoll ? "3px 8px" : "4px 12px",
            borderRadius: `${radius}px 0 0 ${radius}px`,
          }}>
            {showIcon && (
              <span style={{ width: isRoll ? "16px" : "18px", height: isRoll ? "16px" : "18px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mark size={isRoll ? 11 : 12} mono={isRoll} accent={dynamicAccent} />
              </span>
            )}
            <WordMark color="#fff" />
          </div>
          {showPhone && (
            <div style={{
              display: "flex", alignItems: "center",
              background: isRoll ? "#fff" : "#fff",
              border: `1.5px solid ${isRoll ? "#000" : dynamicAccent}`,
              borderInlineStart: "none",
              padding: isRoll ? "3px 8px" : "4px 12px",
              borderRadius: `0 ${radius}px ${radius}px 0`,
            }}>
              <span dir="rtl" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 900, fontSize: `${fs}px`, color: isRoll ? "#000" : dynamicAccentDeep, fontVariantNumeric: "tabular-nums" }}>
                <span>{"لبرامج المبيعات: "}</span>
                <span dir="ltr">{PHONE}</span>
              </span>
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
                <Mark size={11} mono accent={dynamicAccent} />
              </span>
            )}
            <WordMark color="#fff" />
            <Tagline color="rgba(255,255,255,0.75)" />
          </div>
          {showPhone && <PhoneChip size={fs} square tone="mono" isRoll={isRoll} accent={dynamicAccent} accentDeep={dynamicAccentDeep} />}
        </div>
      );
    }
    return (
      <div style={{
        width: "100%", position: "relative", overflow: "hidden", borderRadius: "10px",
        background: `linear-gradient(135deg, ${dynamicAccent} 0%, ${dynamicAccentDeep} 100%)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 10px)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {showIcon && <Mark size={15} accent={dynamicAccent} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <WordMark color="#fff" size={fs + 1} />
              <Tagline color="rgba(255,255,255,0.8)" />
            </div>
          </div>
          {showPhone && <PhoneChip size={fs} tone="onDark" isRoll={isRoll} accent={dynamicAccent} accentDeep={dynamicAccentDeep} />}
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
                {showIcon && <Mark size={13} mono accent={dynamicAccent} />}
                <WordMark />
              </div>
              <Tagline />
              {showPhone && <PhoneChip size={fs - 1} square tone="mono" isRoll={isRoll} accent={dynamicAccent} accentDeep={dynamicAccentDeep} />}
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
          border: `1.5px solid ${dynamicAccent}`,
          borderRadius: "14px",
          position: "relative",
          transform: "rotate(-2.5deg)",
        }}>
          <div style={{ position: "absolute", inset: "3px", border: `1px solid color-mix(in srgb, ${dynamicAccent} 33%, transparent)`, borderRadius: "10px", pointerEvents: "none" }} />
          {showIcon && <Mark size={18} accent={dynamicAccent} />}
          <WordMark size={fs + 1} />
          <Tagline />
          {showPhone && <div style={{ marginTop: "1px" }}><PhoneChip size={Math.max(7, fs - 1)} tone="outline" isRoll={isRoll} accent={dynamicAccent} accentDeep={dynamicAccentDeep} /></div>}
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
          {showIcon && <Mark size={isRoll ? 12 : 14} mono={isRoll} accent={dynamicAccent} />}
          <WordMark />
        </div>
        <Tagline />
        {showPhone && <PhoneChip size={Math.max(7, fs - 1)} square={isRoll} tone={isRoll ? "mono" : "outline"} isRoll={isRoll} accent={dynamicAccent} accentDeep={dynamicAccentDeep} />}
      </div>
    </div>
  );
}
