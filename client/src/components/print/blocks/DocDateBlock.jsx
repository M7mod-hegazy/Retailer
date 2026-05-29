import React from "react";
import { g } from "./blockUtils";

export default function DocDateBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_invoice_date") === false) return null;
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const date = d.toLocaleDateString("ar-SA-u-nu-latn");
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#94a3b8" }}>{date}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>التاريخ:</span><span>{date}</span>
    </div>
  );
}
