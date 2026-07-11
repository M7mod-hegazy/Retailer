import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption; props.showTime=false prints the date only.
export default function DocDateBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_invoice_date") === false) return null;
  // Always falls back to current date/time — perfect for editing preview
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  
  let date = "";
  const format = props.format;
  if (format === "yyyy-MM-dd") {
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } else if (format === "MM/yyyy") {
    date = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } else if (format === "dd/MM/yyyy") {
    date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } else {
    // Force Gregorian calendar — bare "ar-SA" defaults to Umm al-Qura (Hijri)
    date = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn");
  }

  const time = d.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const dateTime = props.showTime === false ? date : `${date} ${time}`;
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    const label = props.label !== undefined ? props.label : "";

    if (variant === "inline") {
      return (
        <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 500, opacity: 0.85 }}>
          {label ? `${label}: ` : ""}{dateTime}
        </div>
      );
    }

    if (variant === "badge") {
      return (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: `${accent}0d`,
          borderRight: `3px solid ${accent}`,
          padding: "4px 8px",
          fontSize: "10px",
          fontWeight: 700,
          color: accent,
          margin: "2px 0"
        }}>
          {label && <span style={{ opacity: 0.8 }}>{label}</span>}
          <span>{dateTime}</span>
        </div>
      );
    }

    if (variant === "ruled") {
      return (
        <div style={{ fontSize: "10px", color: "#334155", fontWeight: 700, textAlign: "center", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", padding: "3px 0", margin: "2px 0" }}>
          {label ? `${label}: ` : ""}{dateTime}
        </div>
      );
    }

    return (
      <div style={{ fontSize: "10px", color: "#334155", fontWeight: 600 }}>
        {label ? `${label}: ` : ""}{dateTime}
      </div>
    );
  }

  const rollLabel = props.label !== undefined ? props.label : "التاريخ";

  if (variant === "minimal") {
    return (
      <div style={{ fontSize: "9px", color: "#64748b", textAlign: "center" }}>
        {rollLabel ? `${rollLabel}: ` : ""}{dateTime}
      </div>
    );
  }

  if (variant === "ruled") {
    return (
      <div style={{ textAlign: "center", fontSize: "9px", fontWeight: 700, borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0", margin: "2px 0" }}>
        {rollLabel ? `${rollLabel}: ` : ""}{dateTime}
      </div>
    );
  }

  if (variant === "badge" || variant === "inline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: "2px", margin: "2px 0" }}>
        <span style={{ fontWeight: 700, fontSize: "9px", color: "#475569" }}>{rollLabel}:</span>
        <span style={{ fontSize: "9px" }}>{dateTime}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
      <span>{dateTime}</span>
    </div>
  );
}
