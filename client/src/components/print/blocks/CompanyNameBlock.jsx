import React from "react";
import { g } from "./blockUtils";

export default function CompanyNameBlock({ settings: s, family }) {
  const name = s.company_name || "";
  if (!name) return null;
  const style = { fontSize: `${g(s, "header_font_size")}px`, fontWeight: 900 };
  if (family !== "roll") style.color = g(s, "accent_color");
  return <div style={style}>{name}</div>;
}
