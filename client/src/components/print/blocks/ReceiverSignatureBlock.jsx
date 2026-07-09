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
    borderTop: `1px dashed ${borderColor}`,
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
