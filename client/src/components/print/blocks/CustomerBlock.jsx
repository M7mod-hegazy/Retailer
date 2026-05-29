import React from "react";
import { g } from "./blockUtils";

export default function CustomerBlock({ invoice = {}, settings: s }) {
  if (g(s, "show_customer_name") === false || !invoice.customer_name) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>العميل:</span><span>{invoice.customer_name}</span>
    </div>
  );
}
