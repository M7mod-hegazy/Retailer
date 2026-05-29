import React from "react";
import { g } from "./blockUtils";

export default function FooterTextBlock({ settings: s }) {
  if (g(s, "show_footer") === false) return null;
  return (
    <div style={{ textAlign: "center", fontSize: `${g(s, "footer_font_size")}px`, fontStyle: "italic" }}>
      {g(s, "receipt_footer")}
    </div>
  );
}
