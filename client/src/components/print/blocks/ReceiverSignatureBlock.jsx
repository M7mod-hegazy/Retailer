import React from "react";
import { g } from "./blockUtils";

/**
 * ReceiverSignatureBlock
 *
 * Renders a compact "Receiver Signature" zone suitable for thermal roll receipts
 * (and full-page layouts). Optimised for the narrow thermal band:
 *
 *   ─────────────────────────────────
 *   استلمت البضاعة / الخدمة
 *
 *   الاسم: ________________________
 *   التاريخ: ______________________
 *   التوقيع: ______________________
 *   ─────────────────────────────────
 *
 * props:
 *   label        — section heading (default: "استلمت البضاعة / الخدمة")
 *   showName     — show receiver name blank line (default: true)
 *   showDate     — show date blank line (default: true)
 *   showStamp    — show a "stamp" dotted square at the bottom (default: false)
 *   showId       — show national/civil ID blank line (default: false)
 *   lineWidth    — width of underlines in mm (default: "48mm" roll / "60mm" page)
 *   compact      — if true, tighten all gaps (default: false)
 */
export default function ReceiverSignatureBlock({ settings: s, props = {}, family, editing }) {
  const show = g(s, "show_receiver_signature");
  if (!show) return null;

  const isRoll = family !== "page";

  const label    = props.label    !== undefined ? props.label    : "استلمت البضاعة / الخدمة";
  const showName = props.showName !== undefined ? props.showName : true;
  const showDate = props.showDate !== undefined ? props.showDate : true;
  const showStamp = props.showStamp !== undefined ? props.showStamp : false;
  const showId   = props.showId   !== undefined ? props.showId   : false;
  const compact  = props.compact  !== undefined ? props.compact  : false;

  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const defaultLineWidth = isRoll ? "48mm" : "60mm";
  const lineWidth = props.lineWidth || defaultLineWidth;

  const mt = compact ? "8px" : "14px";
  const rowGap = compact ? "8px" : "10px";
  const headingSize = isRoll ? "10px" : "11px";
  const rowSize = isRoll ? "9px" : "10px";
  const borderColor = "#334155";

  const wrapStyle = {
    marginTop: mt,
    paddingTop: compact ? "6px" : "8px",
    borderTop: variant === "boxed" ? "none" : `1px dashed ${borderColor}`,
    direction: "rtl",
    ...(editing && !show ? { opacity: 0.4, border: "1px dashed #7c3aed" } : {}),
  };

  // A single labelled blank underline row
  const BlankLine = ({ text }) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: rowSize,
      color: borderColor,
      marginTop: rowGap,
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700 }}>{text}:</span>
      <span style={{
        flex: 1,
        borderBottom: `1px solid ${borderColor}`,
        display: "block",
        minWidth: lineWidth,
        maxWidth: lineWidth,
      }} />
    </div>
  );

  if (variant === "boxed") {
    return (
      <div style={{
        ...wrapStyle,
        border: family === "page" ? `1px solid ${accent}30` : "1px solid #000",
        background: family === "page" ? `${accent}03` : "transparent",
        borderRadius: "8px",
        padding: "12px 14px",
      }}>
        {label && (
          <div style={{
            fontSize: headingSize,
            fontWeight: 900,
            color: family === "page" ? accent : borderColor,
            textAlign: "center",
            letterSpacing: "0.3px",
            marginBottom: "8px",
            borderBottom: family === "page" ? `1px dashed ${accent}30` : "1px dashed #000",
            paddingBottom: "4px"
          }}>
            {label}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {showName && <BlankLine text="الاسم" />}
          {showId   && <BlankLine text="رقم الهوية" />}
          {showDate && <BlankLine text="التاريخ" />}
          <BlankLine text="التوقيع" />
        </div>
      </div>
    );
  }

  if (variant === "split" && family === "page") {
    return (
      <div style={wrapStyle}>
        {label && (
          <div style={{
            fontSize: headingSize,
            fontWeight: 900,
            color: borderColor,
            textAlign: "center",
            letterSpacing: "0.3px",
            marginBottom: "8px",
          }}>
            {label}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            {showName && <BlankLine text="الاسم" />}
            {showId   && <BlankLine text="رقم الهوية" />}
          </div>
          <div>
            {showDate && <BlankLine text="التاريخ" />}
            <BlankLine text="التوقيع" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      {label && (
        <div style={{
          fontSize: headingSize,
          fontWeight: 900,
          color: borderColor,
          textAlign: "center",
          letterSpacing: "0.3px",
          marginBottom: compact ? "4px" : "6px",
        }}>
          {label}
        </div>
      )}

      {showName && <BlankLine text="الاسم" />}
      {showId   && <BlankLine text="رقم الهوية" />}
      {showDate && <BlankLine text="التاريخ" />}
      <BlankLine text="التوقيع" />

      {showStamp && (
        <div style={{
          marginTop: compact ? "8px" : "12px",
          display: "flex",
          justifyContent: "flex-start",
          gap: "6px",
          alignItems: "flex-end",
        }}>
          <div style={{
            width: "22mm",
            height: "22mm",
            border: `1px dashed ${borderColor}`,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: "8px", color: "#94a3b8", textAlign: "center" }}>الختم الرسمي</span>
          </div>
        </div>
      )}
    </div>
  );
}
