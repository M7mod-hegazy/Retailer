import React from "react";
import { g } from "./blockUtils";

/**
 * ReceiverSignatureBlock — 80mm thermal-optimized, all variants work on roll + page.
 *
 * Variants:
 *   standard — clean stacked: label → name → date → signature (best default for 80mm)
 *   compact  — ultra-dense: label on one line, name+sig inline (58mm / tight 80mm)
 *   boxed    — bordered card: works on both roll (simple border) and page (accent border)
 *   split    — two-column on page, inline on roll
 *
 * props:
 *   label        — section heading (default: "استلمت البضاعة / الخدمة")
 *   showName     — show receiver name blank line (default: true)
 *   showDate     — show date blank line (default: true)
 *   showId       — show national/civil ID blank line (default: false)
 *   compact      — if true, tighten all gaps (default: false)
 */
export default function ReceiverSignatureBlock({ settings: s, props = {}, family, editing }) {
  const show = g(s, "show_receiver_signature");
  if (!show) return null;

  const isRoll = family !== "page";

  const label    = props.label    !== undefined ? props.label    : "استلمت البضاعة / الخدمة";
  const showName = props.showName !== undefined ? props.showName : true;
  const showDate = props.showDate !== undefined ? props.showDate : true;
  const showId   = props.showId   !== undefined ? props.showId   : false;

  const variant = props.variant || "standard";
  const tight   = props.compact === true;
  const borderColor = "#000";
  const lightBorder = isRoll ? "#888" : "#94a3b8";

  /* ── helpers ── */
  const BlankLine = ({ text }) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: isRoll ? "4px" : "6px",
      fontSize: isRoll ? "9px" : "10px",
      color: borderColor,
      marginTop: tight ? "1px" : "3px",
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700 }}>{text}:</span>
      <span style={{
        flex: 1,
        borderBottom: `1px solid ${lightBorder}`,
      }} />
    </div>
  );

  const Heading = ({ style: extra }) => (
    <div style={{
      fontSize: isRoll ? (tight ? "8px" : "9px") : "10px",
      fontWeight: 900,
      color: borderColor,
      textAlign: "center",
      letterSpacing: "0.3px",
      ...extra,
    }}>
      {label}
    </div>
  );

  /* ── compact: ultra-dense for 58mm / tight 80mm ── */
  if (variant === "compact") {
    return (
      <div style={{
        marginTop: tight ? "2px" : "4px",
        paddingTop: tight ? "2px" : "3px",
        borderTop: `1px dashed ${borderColor}`,
        direction: "rtl",
      }}>
        {label && (
          <div style={{
            fontSize: isRoll ? "8px" : "9px",
            fontWeight: 900,
            color: borderColor,
            textAlign: "center",
            marginBottom: "2px",
            paddingBottom: "2px",
            borderBottom: `1px solid ${lightBorder}`,
          }}>
            {label}
          </div>
        )}
        {showName && (
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: isRoll ? "8px" : "9px", color: borderColor, marginTop: "2px" }}>
            <span style={{ flexShrink: 0, fontWeight: 700 }}>الاسم</span>
            <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
          </div>
        )}
        <div style={{ display: "flex", gap: isRoll ? "4px" : "8px", marginTop: "2px" }}>
          {showDate && (
            <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: isRoll ? "8px" : "9px", color: borderColor, flex: "1 1 auto" }}>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>التاريخ</span>
              <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
            </div>
          )}
          {showId && (
            <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: isRoll ? "8px" : "9px", color: borderColor, flex: "1 1 auto" }}>
              <span style={{ flexShrink: 0, fontWeight: 700 }}>الهوية</span>
              <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: isRoll ? "8px" : "9px", color: borderColor, flex: "1 1 auto" }}>
            <span style={{ flexShrink: 0, fontWeight: 700 }}>التوقيع</span>
            <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── boxed: bordered card — works on roll (simple border) and page (accent border) ── */
  if (variant === "boxed") {
    const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
    if (isRoll) {
      return (
        <div style={{
          marginTop: tight ? "2px" : "4px",
          border: `1px solid ${borderColor}`,
          padding: tight ? "3px 4px" : "4px 6px",
          direction: "rtl",
        }}>
          {label && (
            <div style={{
              fontSize: tight ? "8px" : "9px",
              fontWeight: 900,
              color: borderColor,
              textAlign: "center",
              marginBottom: "2px",
              paddingBottom: "2px",
              borderBottom: `1px dashed ${borderColor}`,
            }}>
              {label}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {showName && <BlankLine text="الاسم" />}
            {showId   && <BlankLine text="رقم الهوية" />}
            {showDate && <BlankLine text="التاريخ" />}
            <BlankLine text="التوقيع" />
          </div>
        </div>
      );
    }
    return (
      <div style={{
        marginTop: "8px",
        border: `1px solid ${accent}40`,
        background: `${accent}03`,
        borderRadius: "8px",
        padding: "10px 12px",
        direction: "rtl",
      }}>
        {label && (
          <Heading style={{
            marginBottom: "6px",
            borderBottom: `1px dashed ${accent}30`,
            paddingBottom: "4px",
          }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {showName && <BlankLine text="الاسم" />}
          {showId   && <BlankLine text="رقم الهوية" />}
          {showDate && <BlankLine text="التاريخ" />}
          <BlankLine text="التوقيع" />
        </div>
      </div>
    );
  }

  /* ── split: two-column on page, inline on roll ── */
  if (variant === "split") {
    if (isRoll) {
      return (
        <div style={{ marginTop: tight ? "2px" : "4px", paddingTop: tight ? "2px" : "3px", borderTop: `1px dashed ${borderColor}`, direction: "rtl" }}>
          {label && <Heading style={{ marginBottom: "2px" }} />}
          {showName && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "9px", color: borderColor, marginTop: "2px" }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>الاسم:</span>
              <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
            </div>
          )}
          <div style={{ display: "flex", gap: "4px", alignItems: "center", marginTop: "2px" }}>
            {showDate && (
              <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "9px", color: borderColor, flex: "1 1 auto" }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>التاريخ:</span>
                <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
              </div>
            )}
            {showId && (
              <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "9px", color: borderColor, flex: "1 1 auto" }}>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>الهوية:</span>
                <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "9px", color: borderColor, marginTop: "2px" }}>
            <span style={{ fontWeight: 700, flexShrink: 0 }}>التوقيع:</span>
            <span style={{ flex: 1, borderBottom: `1px solid ${lightBorder}` }} />
          </div>
        </div>
      );
    }
    const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
    return (
      <div style={{ marginTop: "8px", direction: "rtl" }}>
        {label && <Heading style={{ marginBottom: "8px" }} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {showName && <BlankLine text="الاسم" />}
            {showId   && <BlankLine text="رقم الهوية" />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {showDate && <BlankLine text="التاريخ" />}
            <BlankLine text="التوقيع" />
          </div>
        </div>
      </div>
    );
  }

  /* ── standard: clean stacked with dashed separator (default) ── */
  return (
    <div style={{
      marginTop: tight ? "2px" : "4px",
      paddingTop: tight ? "2px" : "3px",
      borderTop: `1px dashed ${borderColor}`,
      direction: "rtl",
    }}>
      {label && <Heading style={{ marginBottom: tight ? "1px" : "3px" }} />}
      {showName && <BlankLine text="الاسم" />}
      {showId   && <BlankLine text="رقم الهوية" />}
      {showDate && <BlankLine text="التاريخ" />}
      <BlankLine text="التوقيع" />
    </div>
  );
}
