import React, { useEffect, useState } from "react";
import { g, computeTotals } from "./blockUtils";
import { buildZatcaTlv } from "@shared/zatcaQr";

function buildFreeTextContent(invoice = {}, settings = {}) {
  const custom = g(settings, "qr_content");
  if (custom) return custom;
  const data = {
    seller: g(settings, "company_name") || "",
    vat: g(settings, "tax_id") || "",
    date: invoice.created_at || "",
    total: invoice.total || 0,
    tax: invoice.tax_amount || 0,
    inv: invoice.invoice_no || invoice.invoice_number || "",
  };
  return JSON.stringify(data);
}

// ETA e-Receipt QR: URL pointing to the receipt on the Egyptian Tax Authority portal.
// Format: https://invoicing.eta.gov.eg/receipts/search/{UUID}/share/{ReceiptDateTime}
function buildEtaContent(invoice = {}, settings = {}) {
  const uuid = invoice.eta_uuid || invoice.uuid || "";
  const ts = invoice.created_at || "";
  if (!uuid) return null;
  const encodedTs = encodeURIComponent(ts);
  return `https://invoicing.eta.gov.eg/receipts/search/${uuid}/share/${encodedTs}`;
}

// ZATCA simplified-invoice QR: TLV-encoded seller/VAT/timestamp/total/vat.
// Returns null (never throws) when required settings are missing, so the
// caller can fall back to the free-text QR instead of crashing the receipt.
function buildZatcaContent(invoice = {}, settings = {}) {
  const sellerName = g(settings, "company_name");
  const vatNumber = g(settings, "tax_id");
  if (!sellerName || !vatNumber) return null;
  const { grandTotal, taxAmount } = computeTotals(invoice, settings);
  const timestamp = invoice.created_at || new Date().toISOString();
  return buildZatcaTlv({ sellerName, vatNumber, timestamp, total: grandTotal, vat: taxAmount });
}

// `qr_mode`: "free_text" (default, legacy JSON/custom content) or "zatca"
// (Saudi e-invoice TLV QR). Any failure building the ZATCA payload — missing
// settings, a thrown error — silently falls back to free-text so a
// misconfigured ZATCA mode never breaks receipt printing.
function buildQrContent(invoice = {}, settings = {}) {
  const mode = g(settings, "qr_mode");
  if (mode === "eta") {
    try {
      const eta = buildEtaContent(invoice, settings);
      if (eta) return eta;
    } catch {
      // fall through to free-text
    }
  }
  if (mode === "zatca") {
    try {
      const zatca = buildZatcaContent(invoice, settings);
      if (zatca) return zatca;
    } catch {
      // fall through to free-text
    }
  }
  return buildFreeTextContent(invoice, settings);
}

const alignMap = {
  right: "flex-end",
  center: "center",
  left: "flex-start",
};

export default function QrBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showQr = g(s, "show_qr") === true;
  if (!showQr) return null;

  const size = g(s, "qr_size") || 80;
  const variant = props.variant || "standard";
  const alignment = variant === "centered" ? "center" : (g(s, "qr_alignment") || props.align || "right");
  const customContent = g(s, "qr_content");
  const qrMode = g(s, "qr_mode") || "free_text";
  const companyName = g(s, "company_name");
  const taxId = g(s, "tax_id");
  const [dataUrl, setDataUrl] = useState(null);

  const fgColor = props.fgColor || "#000000";
  const bgColor = props.bgColor || "#ffffff";
  const margin = props.margin !== undefined ? Number(props.margin) : (variant === "boxed" ? 2 : 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import("qrcode");
        if (cancelled) return;
        const content = buildQrContent(invoice, s);
        const url = await QRCode.default.toDataURL(content, {
          width: size,
          margin: margin,
          color: { dark: fgColor, light: bgColor },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [size, customContent, qrMode, companyName, taxId, invoice?.total, invoice?.created_at, invoice?.tax_amount, invoice?.invoice_no, fgColor, bgColor, margin]);

  const justifyContent = alignMap[alignment] || "flex-end";
  const borderStyle = (variant === "with-border" || variant === "boxed") ? "1px solid #cbd5e1" : "none";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const renderQrImg = () => {
    if (dataUrl) {
      return <img src={dataUrl} alt="QR" style={{ width: `${size}px`, height: `${size}px`, border: borderStyle, padding: variant === "with-border" ? "2px" : "0", background: "#fff", display: "block" }} />;
    }
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: "#f0f0f0",
          border: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "8px",
          color: "#888",
        }}
      >
        QR
      </div>
    );
  };

  if (variant === "boxed") {
    return (
      <div style={{ display: "flex", justifyContent, marginTop: "8px" }}>
        <div style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          border: family === "page" ? `1px solid ${accent}30` : "1px solid #000",
          background: family === "page" ? `${accent}03` : "transparent",
          padding: "6px",
          borderRadius: "8px"
        }}>
          {renderQrImg()}
          <span style={{ fontSize: "8px", color: family === "page" ? accent : "#475569", fontWeight: 800 }}>رمز التحقق الضريبي</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent, marginTop: "8px" }}>
      {renderQrImg()}
    </div>
  );
}
