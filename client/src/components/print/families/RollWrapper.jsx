import React from "react";
import { g, rollPrintWidthMm } from "../blocks/blockUtils";

export default function RollWrapper({ settings: s, children }) {
  // Width the content is actually printed at — the calibrated printable band
  // (print_area_width) when set, otherwise the full paper width.
  const widthMm = rollPrintWidthMm(s);
  // Horizontal nudge (mm, ±) to slide content into the head's printable window.
  // transform is physical (works the same in RTL) and does NOT change layout
  // height, so the silent-print height measurement stays accurate.
  const shiftX = Number(g(s, "print_shift_x")) || 0;
  return (
    <div dir="rtl" style={{
      // Always fall back to a Windows-installed Arabic font so the packaged
      // app's silent-print window (which can't load bundled web fonts) still
      // renders names/codes crisply instead of a thin serif fallback.
      fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
      fontSize: `${g(s, "body_font_size")}px`,
      fontWeight: 700,
      // `box-sizing: border-box` keeps the box exactly `widthMm` (padding inside)
      // instead of width+padding overflowing the paper. `widthMm` defaults to the
      // full paper width but can be narrowed to the print head's printable band so
      // a real thermal printer no longer clips the content at the paper edge.
      width: `${widthMm}mm`, margin: "0 auto",
      boxSizing: "border-box",
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      color: g(s, "accent_color"), background: "#fff",
      ...(shiftX ? { transform: `translateX(${shiftX}mm)` } : {}),
    }}>{children}</div>
  );
}
