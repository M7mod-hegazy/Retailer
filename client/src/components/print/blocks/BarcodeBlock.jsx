import React from "react";
import { g } from "./blockUtils";
import { resolveDocNo } from "./DocNumberBlock";
import { code128Bars } from "../../../utils/code128";

// Renders the document/invoice number as a scannable Code 128-B barcode plus
// the human-readable number underneath. No barcode library exists in this
// project and the old BarcodeLabel.jsx never actually drew bars (text only),
// so bars come from the small dependency-free encoder in utils/code128.js.
export default function BarcodeBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_barcode_line") !== true) return null;
  const number = resolveDocNo(invoice);
  if (!number) return null;

  let bars = null;
  let totalModules = 0;
  try {
    ({ bars, totalModules } = code128Bars(number));
  } catch {
    // Unsupported character (outside ASCII 32-127) — fail gracefully: show the
    // number as text without a corrupt/unscannable barcode rather than crash.
    bars = null;
  }

  const heightMm = family === "page" ? 12 : 10;

  return (
    <div style={{ textAlign: "center", margin: family === "page" ? "3mm 0" : "2mm 0" }}>
      {bars && (
        <svg
          role="img"
          aria-label={`barcode ${number}`}
          viewBox={`0 0 ${totalModules} 40`}
          preserveAspectRatio="none"
          style={{
            width: family === "page" ? "60mm" : "90%",
            height: `${heightMm}mm`,
            display: "block",
            margin: "0 auto",
            background: "#fff",
          }}
        >
          <rect x={0} y={0} width={totalModules} height={40} fill="#fff" />
          {bars.map((b, i) => (
            <rect key={i} x={b.x} y={0} width={b.width} height={40} fill="#000" />
          ))}
        </svg>
      )}
      <div
        dir="ltr"
        style={{
          fontSize: "10px",
          fontFamily: "monospace",
          fontWeight: 700,
          color: "#000",
          letterSpacing: "1px",
          marginTop: "1mm",
        }}
      >
        {number}
      </div>
    </div>
  );
}
