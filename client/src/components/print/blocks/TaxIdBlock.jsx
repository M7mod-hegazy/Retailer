import React from "react";
import { g } from "./blockUtils";

export default function TaxIdBlock({ settings: s }) {
  if (g(s, "show_tax_id") === false || !s.tax_id) return null;
  return (
    <div style={{ fontSize: `${g(s, "tax_id_font_size")}px`, marginTop: "4px", textAlign: g(s, "tax_id_alignment") || "right" }}>
      الرقم الضريبي: {s.tax_id}
    </div>
  );
}
