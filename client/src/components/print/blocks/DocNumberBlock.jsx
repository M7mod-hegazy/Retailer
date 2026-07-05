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

// props.label renames the caption (empty string hides it).
export default function DocNumberBlock({ invoice = {}, props = {}, family }) {
  const no = resolveDocNo(invoice);
  if (family === "page") {
    const label = props.label !== undefined ? props.label : "";
    return <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>{label ? `${label}: ` : ""}{no}</div>;
  }
  const rollLabel = props.label !== undefined ? props.label : "رقم الفاتورة";
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700, fontSize: "10px", color: "#475569" }}>{rollLabel ? `${rollLabel}:` : ""}</span>
      <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{no}</span>
    </div>
  );
}
