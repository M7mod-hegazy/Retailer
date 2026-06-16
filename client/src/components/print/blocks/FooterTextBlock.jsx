import React from "react";
import { g } from "./blockUtils";

export default function FooterTextBlock({ settings: s, family }) {
  if (g(s, "show_footer") === false) return null;
  const text = g(s, "receipt_footer");
  if (family === "page") {
    return <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, color: "#475569", fontWeight: 600, fontStyle: "italic" }}>{text}</div>;
  }
  return <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, fontStyle: "italic" }}>{text}</div>;
}
