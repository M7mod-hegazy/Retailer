import React, { useEffect, useState } from "react";
import { g } from "./blockUtils";

function buildQrContent(invoice = {}, settings = {}) {
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

const alignMap = {
  right: "flex-end",
  center: "center",
  left: "flex-start",
};

export default function QrBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_qr") === false) return null;

  const size = g(s, "qr_size");
  const alignment = g(s, "qr_alignment") || "right";
  const customContent = g(s, "qr_content");
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import("qrcode");
        if (cancelled) return;
        const content = buildQrContent(invoice, s);
        const url = await QRCode.default.toDataURL(content, {
          width: size,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [size, customContent, invoice?.total, invoice?.created_at, invoice?.tax_amount, invoice?.invoice_no]);

  const justifyContent = alignMap[alignment] || "flex-end";

  if (dataUrl) {
    return (
      <div style={{ display: "flex", justifyContent, marginTop: "8px" }}>
        <img src={dataUrl} alt="QR" style={{ width: `${size}px`, height: `${size}px` }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent, marginTop: "8px" }}>
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
    </div>
  );
}
