import React from "react";
import { g } from "../blocks/blockUtils";

// Minimal page wrapper. The zone-aware layout (two-column header,
// right-aligned totals) is introduced in Phase 1b.
export default function PageWrapper({ settings: s, size = "A4", children }) {
  const w = size === "A5" ? "148mm" : "210mm";
  return (
    <div dir="rtl" style={{
      width: w,
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      fontFamily: g(s, "print_font"),
      fontSize: `${g(s, "body_font_size")}px`,
      color: "#1e293b", background: "#fff",
    }}>{children}</div>
  );
}
