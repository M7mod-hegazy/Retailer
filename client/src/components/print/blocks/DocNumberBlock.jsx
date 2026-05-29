import React from "react";

export default function DocNumberBlock({ invoice = {}, family }) {
  const no = invoice.invoice_no || invoice.invoice_number || "";
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>{no}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>رقم الفاتورة:</span>
      <span style={{ fontWeight: "bold" }}>{no}</span>
    </div>
  );
}
