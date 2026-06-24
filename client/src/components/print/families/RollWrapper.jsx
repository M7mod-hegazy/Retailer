import React from "react";
import { g, rollPrintWidthMm } from "../blocks/blockUtils";

export default function RollWrapper({ settings: s, children }) {
  const widthMm = rollPrintWidthMm(s);
  return (
    <div dir="rtl" style={{
      fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
      fontSize: `${g(s, "body_font_size")}px`,
      lineHeight: 1.6,
      width: `${widthMm}mm`, margin: "0 auto",
      boxSizing: "border-box",
      padding: "2mm 1mm",
      color: g(s, "accent_color"), background: "#fff",
    }}>{children}</div>
  );
}
