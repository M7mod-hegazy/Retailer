import React, { useEffect, useState } from "react";
import { g } from "./blockUtils";
import { resolveDocNo } from "./DocNumberBlock";
import { code128Bars } from "../../../utils/code128";

// Renders the document/invoice number as a scannable barcode/QR plus
// the human-readable number underneath.
export default function BarcodeBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showBarcode = g(s, "show_barcode_line") === true;
  if (!showBarcode) return null;
  const number = resolveDocNo(invoice) || (editing ? "1234567890" : "");
  if (!number) return null;

  const type = props.type || "CODE128";
  const align = props.align || "center";
  const heightMm = props.height || (family === "page" ? 12 : 10);

  const [qrUrl, setQrUrl] = useState(null);

  useEffect(() => {
    if (type !== "QR") return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import("qrcode");
        if (cancelled) return;
        const url = await QRCode.default.toDataURL(number, {
          width: heightMm * 4,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setQrUrl(url);
      } catch {
        if (!cancelled) setQrUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [number, type, heightMm]);

  let bars = null;
  let totalModules = 0;
  if (type === "CODE128" || type === "EAN13") {
    try {
      // Fallback for EAN13 or invalid inputs to CODE128
      ({ bars, totalModules } = code128Bars(number));
    } catch {
      bars = null;
    }
  }

  const alignSelf = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const textAlign = align;
  const showText = props.showText !== false;
  const textFontSize = props.textFontSize || 10;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: alignSelf, width: "100%", margin: family === "page" ? "3mm 0" : "2mm 0" }}>
      {type === "QR" ? (
        qrUrl ? (
          <img src={qrUrl} alt="QR Barcode" style={{ width: `${heightMm * 3}px`, height: `${heightMm * 3}px`, display: "block" }} />
        ) : (
          <div style={{ width: `${heightMm * 3}px`, height: `${heightMm * 3}px`, background: "#eee" }} />
        )
      ) : bars ? (
        <svg
          role="img"
          aria-label={`barcode ${number}`}
          viewBox={`0 0 ${totalModules} 40`}
          preserveAspectRatio="none"
          style={{
            width: family === "page" ? "60mm" : "90%",
            height: `${heightMm}mm`,
            display: "block",
            background: "#fff",
          }}
        >
          <rect x={0} y={0} width={totalModules} height={40} fill="#fff" />
          {bars.map((b, i) => (
            <rect key={i} x={b.x} y={0} width={b.width} height={40} fill="#000" />
          ))}
        </svg>
      ) : null}
      {showText && (
        <div
          dir="ltr"
          style={{
            fontSize: `${textFontSize}px`,
            fontFamily: "monospace",
            fontWeight: 700,
            color: "#000",
            letterSpacing: "1px",
            marginTop: "1mm",
            width: "100%",
            textAlign: textAlign,
          }}
        >
          {number}
        </div>
      )}
    </div>
  );
}
