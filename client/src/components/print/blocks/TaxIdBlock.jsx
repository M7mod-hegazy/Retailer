import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the number).
export default function TaxIdBlock({ settings: s, props = {}, family, editing }) {
  const showTaxId = g(s, "show_tax_id") !== false;
  if (!showTaxId) return null;
  // Realistic Saudi 15-digit VAT registration number format
  const taxId = s.tax_id || (editing ? "310012345600003" : "");
  if (!taxId) return null;
  
  const label = props.label !== undefined ? props.label : "الرقم الضريبي";
  const variant = props.variant || "standard";
  const align = g(s, "tax_id_alignment") || props.align || "right";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";
  const fontSize = `${g(s, "tax_id_font_size") || 10}px`;

  const alignFlexMap = { right: "flex-start", center: "center", left: "flex-end" };
  const justifyContent = alignFlexMap[align] || "flex-start";

  if (variant === "boxed") {
    return (
      <div style={{
        display: "flex",
        justifyContent,
        marginTop: "4px"
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          border: family === "page" ? `1px solid ${accent}40` : "1px solid #000",
          background: family === "page" ? `${accent}0d` : "transparent",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize,
          fontWeight: 700,
          color: family === "page" ? accent : "#000"
        }}>
          {label && <span style={{ opacity: 0.85 }}>{label}:</span>}
          <span dir="ltr" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {taxId}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div style={{
        fontSize,
        marginTop: "4px",
        textAlign: align,
        color: "#64748b",
        fontWeight: 600
      }}>
        {label ? `${label}: ` : ""}
        <span dir="ltr" style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
          {taxId}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      fontSize,
      marginTop: "4px",
      textAlign: align,
    }}>
      {label ? `${label}: ` : ""}
      <span dir="ltr" style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.5px" }}>
        {taxId}
      </span>
    </div>
  );
}
