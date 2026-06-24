import React from "react";
import { g } from "./blockUtils";

export default function CompanyNameBlock({ settings: s, family }) {
  const name = s.company_name || "";
  if (!name) return null;
  const size = `${Math.max(15, Number(g(s, "header_font_size")))}px`;
  if (family === "roll") {
    return (
      <div style={{ textAlign: "center", marginBottom: "8px", paddingBottom: "6px", borderBottom: "1px solid #000" }}>
        <div style={{ fontSize: size, fontWeight: 900, letterSpacing: "1px", color: "#000" }}>{name}</div>
      </div>
    );
  }
  const style = { fontSize: size, fontWeight: 900 };
  if (family !== "roll") style.color = g(s, "accent_color");
  return <div style={style}>{name}</div>;
}
