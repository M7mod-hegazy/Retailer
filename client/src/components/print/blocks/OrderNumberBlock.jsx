import React from "react";
import { resolveDocNo } from "./DocNumberBlock";
import { resolveDailyNo } from "./dailySequence";

// Order-ticket style: a huge, unmissable number for kitchen/counter tickets.
// props.source: "doc" (full document number, default) | "daily" (the daily
// sequence that starts at 1 and resets each day — great for order tickets).
export default function OrderNumberBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const isDailySource = props.source === "daily";
  const rawNumber = isDailySource ? resolveDailyNo(invoice) : resolveDocNo(invoice);
  // Realistic mock: daily order ticket number vs full document reference
  const number = (rawNumber != null && rawNumber !== "") ? rawNumber
    : (editing ? (isDailySource ? "42" : "INV-2025-00847") : "");
  if (!number && number !== 0) return null;

  const variant = props.variant || "standard";
  const sizeMultiplier = variant === "huge" ? 1.5 : 1.0;
  const fontSize = (props.fontSize != null ? props.fontSize : 34) * sizeMultiplier;
  const label = props.label !== undefined ? props.label : (isDailySource ? "رقم الطلب" : "رقم المستند");
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const daily = isDailySource ? { "data-daily-no": "1" } : {};

  if (variant === "badge") {
    return (
      <div {...daily} style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: family === "page" ? "4mm 0" : "3mm 0" }}>
        <div style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          border: `2px solid ${accent}`,
          background: `${accent}08`,
          borderRadius: "12px",
          padding: "10px 24px",
          color: accent,
          minWidth: "120px"
        }}>
          {label ? (
            <div style={{ fontSize: "10px", fontWeight: 800, color: accent, opacity: 0.8, marginBottom: "2px" }}>{label}</div>
          ) : null}
          <div
            dir="ltr"
            style={{ fontSize: "28px", fontWeight: 900, color: accent, lineHeight: 1.1, fontFamily: "monospace" }}
          >
            {number}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "huge") {
    return (
      <div {...daily} style={{ textAlign: "center", margin: family === "page" ? "6mm 0" : "4mm 0" }}>
        {label ? (
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#000", marginBottom: "4px" }}>{label}</div>
        ) : null}
        <div
          dir="ltr"
          style={{ fontSize: `${fontSize * 1.5}px`, fontWeight: 900, color: "#000", lineHeight: 1, fontFamily: "monospace" }}
        >
          {number}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div {...daily} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", margin: "2px 0" }}>
        {label ? <span style={{ fontWeight: 700 }}>{label}:</span> : <span />}
        <span dir="ltr" style={{ fontFamily: "monospace", fontWeight: 900 }}>{number}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div {...daily} style={{ textAlign: "center", margin: "2px 0" }}>
        {label ? <span style={{ fontSize: "9px", fontWeight: 700 }}>{label} </span> : null}
        <span dir="ltr" style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: 900 }}>{number}</span>
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div {...daily} style={{ textAlign: "center", margin: family === "page" ? "4mm 0" : "3mm 0" }}>
        <div style={{ display: "inline-block", border: "2px solid #000", padding: "8px 20px" }}>
          {label ? (
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#000", marginBottom: "2px" }}>{label}</div>
          ) : null}
          <div
            dir="ltr"
            style={{ fontSize: `${fontSize}px`, fontWeight: 900, color: "#000", lineHeight: 1.1, fontFamily: "monospace" }}
          >
            {number}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...daily} style={{ textAlign: "center", margin: family === "page" ? "4mm 0" : "3mm 0" }}>
      {label ? (
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#000", marginBottom: "2px" }}>{label}</div>
      ) : null}
      <div
        dir="ltr"
        style={{ fontSize: `${fontSize}px`, fontWeight: 900, color: "#000", lineHeight: 1.1, fontFamily: "monospace" }}
      >
        {number}
      </div>
    </div>
  );
}
