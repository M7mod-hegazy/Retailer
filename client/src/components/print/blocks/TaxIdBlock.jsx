import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the number).
export default function TaxIdBlock({ settings: s, props = {}, editing }) {
  const showTaxId = g(s, "show_tax_id") !== false;
  if (!showTaxId) return null;
  // Realistic Saudi 15-digit VAT registration number format
  const taxId = s.tax_id || (editing ? "310012345600003" : "");
  if (!taxId) return null;
  const label = props.label !== undefined ? props.label : "الرقم الضريبي";
  return (
    <div style={{
      fontSize: `${g(s, "tax_id_font_size") || 10}px`,
      marginTop: "4px",
      textAlign: g(s, "tax_id_alignment") || "right",
    }}>
      {label ? `${label}: ` : ""}
      <span dir="ltr" style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.5px" }}>
        {taxId}
      </span>
    </div>
  );
}
