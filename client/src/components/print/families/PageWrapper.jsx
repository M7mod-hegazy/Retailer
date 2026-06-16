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
      fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
      fontSize: `${g(s, "body_font_size")}px`,
      // Bolder, near-black base for the whole A4/A5 sheet so text and numbers
      // read strongly instead of the thin slate-gray default.
      fontWeight: 600,
      color: "#0f172a", background: "#fff",
    }}>{children}</div>
  );
}
