import React from "react";
import { g } from "../blocks/blockUtils";

export default function RollWrapper({ settings: s, children }) {
  const w = (s.receipt_width || g(s, "receipt_width")) === "58mm" ? "58mm" : "80mm";
  return (
    <div dir="rtl" style={{
      // Always fall back to a Windows-installed Arabic font so the packaged
      // app's silent-print window (which can't load bundled web fonts) still
      // renders names/codes crisply instead of a thin serif fallback.
      fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
      fontSize: `${g(s, "body_font_size")}px`,
      fontWeight: 600,
      // Full paper width, edge to edge — `box-sizing: border-box` is the actual
      // fix for the "cut from both sides" bug: without it, width(80mm)+padding(8mm)
      // rendered an 88mm box that overflowed the paper. With it the box is exactly
      // 80mm and the padding keeps content inside the head's printable area.
      width: w, margin: "0 auto",
      boxSizing: "border-box",
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      color: g(s, "accent_color"), background: "#fff",
    }}>{children}</div>
  );
}
