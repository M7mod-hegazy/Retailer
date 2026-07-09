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
export default function DocNumberBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  // Realistic mock: a typical invoice number pattern used in Arabic POS systems
  const rawNo = resolveDocNo(invoice) || (editing ? "INV-2025-00847" : "");
  if (!rawNo) return null;
  const no = `${props.prefix || ""}${rawNo}`;
  const showLabel = props.showLabel !== false;
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    const label = props.label !== undefined ? props.label : "";
    const labelText = showLabel && label ? `${label}: ` : "";

    if (variant === "boxed") {
      return (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          border: `1px solid ${accent}`,
          background: `${accent}0d`,
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          fontWeight: 700,
          color: accent
        }}>
          {showLabel && label && <span style={{ opacity: 0.8 }}>{label}:</span>}
          <span style={{ fontFamily: "monospace" }}>{no}</span>
        </div>
      );
    }

    if (variant === "giant") {
      return (
        <div style={{
          textAlign: "center",
          margin: "10px 0",
          borderBottom: "1px dashed #cbd5e1",
          paddingBottom: "8px"
        }}>
          {showLabel && label && <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>{label}</div>}
          <div style={{ fontSize: "20px", fontWeight: 900, fontFamily: "monospace", color: "#0f172a" }}>{no}</div>
        </div>
      );
    }

    if (variant === "inline") {
      return (
        <span style={{ fontSize: "10px", color: "#475569", fontFamily: "monospace", fontWeight: 700 }}>
          {labelText}{no}
        </span>
      );
    }

    return (
      <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace", fontWeight: 700 }}>
        {labelText}{no}
      </div>
    );
  }

  const rollLabel = props.label !== undefined ? props.label : "رقم الفاتورة";
  const rollLabelText = showLabel && rollLabel ? `${rollLabel}:` : "";

  if (variant === "boxed" || variant === "giant") {
    return (
      <div style={{ border: "1px solid #000000", padding: "4px", margin: "4px 0", textAlign: "center" }}>
        {showLabel && rollLabel && <div style={{ fontSize: "9px", fontWeight: 700 }}>{rollLabel}</div>}
        <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "12px" }}>{no}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      {showLabel && rollLabel ? (
        <span style={{ fontWeight: 700, fontSize: "10px", color: "#475569" }}>{rollLabelText}</span>
      ) : <span />}
      <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{no}</span>
    </div>
  );
}
