import React from "react";

// Each document type stores its number under a different field (POS/sales use
// invoice_no, purchases/returns use doc_no, branch transfers use reference_no,
// quotations use quotation_no, …). Resolve against all of them so the printed
// number is correct no matter which page built the invoice object.
export function resolveDocNo(invoice = {}) {
  return (
    invoice.invoice_no ||
    invoice.invoice_number ||
    invoice.doc_no ||
    invoice.reference_no ||
    invoice.quotation_no ||
    invoice.po_number ||
    invoice.order_no ||
    ""
  );
}

export default function DocNumberBlock({ invoice = {}, family }) {
  const no = resolveDocNo(invoice);
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>{no}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700, fontSize: "10px", color: "#475569" }}>رقم الفاتورة:</span>
      <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{no}</span>
    </div>
  );
}
