import React from "react";
import { g } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";

export default function FooterTextBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_footer") === false) return null;
  const text = resolvePlaceholders(g(s, "receipt_footer"), invoice, s);
  if (family === "page") {
    return <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, color: "#475569", fontWeight: 600, fontStyle: "italic" }}>{text}</div>;
  }
  return (
    <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, color: "#475569", marginTop: "10px" }}>
      <div>{text}</div>
    </div>
  );
}
