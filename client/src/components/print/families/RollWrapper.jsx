import React from "react";
import { g } from "../blocks/blockUtils";

export default function RollWrapper({ settings: s, children }) {
  const w = (s.receipt_width || g(s, "receipt_width")) === "58mm" ? "58mm" : "80mm";
  return (
    <div dir="rtl" style={{
      fontFamily: g(s, "print_font"),
      fontSize: `${g(s, "body_font_size")}px`,
      width: w, margin: "0 auto",
      padding: `${g(s, "margin_top")}mm ${g(s, "margin_side")}mm`,
      color: g(s, "accent_color"), background: "#fff",
    }}>{children}</div>
  );
}
