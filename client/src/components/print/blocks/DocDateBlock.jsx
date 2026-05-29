import React from "react";
import { g } from "./blockUtils";

export default function DocDateBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_invoice_date") === false) return null;
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>التاريخ:</span>
      <span>{d.toLocaleDateString("ar-SA-u-nu-latn")}</span>
    </div>
  );
}
