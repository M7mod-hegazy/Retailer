import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the number).
export default function TaxIdBlock({ settings: s, props = {} }) {
  if (g(s, "show_tax_id") === false || !s.tax_id) return null;
  const label = props.label !== undefined ? props.label : "الرقم الضريبي";
  return (
    <div style={{ fontSize: `${g(s, "tax_id_font_size")}px`, marginTop: "4px", textAlign: g(s, "tax_id_alignment") || "right" }}>
      {label ? `${label}: ` : ""}{s.tax_id}
    </div>
  );
}
