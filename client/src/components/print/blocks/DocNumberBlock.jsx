import React from "react";

export default function DocNumberBlock({ invoice = {} }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>رقم الفاتورة:</span>
      <span style={{ fontWeight: "bold" }}>{invoice.invoice_no || invoice.invoice_number || ""}</span>
    </div>
  );
}
