import React from "react";
import { g } from "../blocks/blockUtils";
import { pageWidthStr, pageDimensions, PX_PER_MM } from "../studio/studioData";
import { ensurePrintParityCss } from "../../../services/printDocument";

// Preview/measurement must use the print frame's table geometry (see
// getPrintContentCss). Installed once, before any wrapper renders.
ensurePrintParityCss();

// Page inner margin (mm). Reads the same `page_padding` setting the report
// row estimator uses — the two disagreeing made measured pagination drift.
export function pagePaddingMm(s) {
  const raw = Number(s && s.page_padding);
  if (Number.isFinite(raw) && raw >= 0) return Math.min(raw, 25);
  return 2;
}

export default function PageWrapper({ settings: s, size = "A4", orientation = "portrait", children, studioPage, pageCount, onHeightMeasured }) {
  const w = pageWidthStr(size, orientation);
  const dims = pageDimensions(size, orientation);
  const minH = dims.hMm > 0 ? `${dims.hMm}mm` : undefined;
  const padMm = pagePaddingMm(s);

  const contentRef = React.useRef(null);
  React.useLayoutEffect(() => {
    if (contentRef.current && onHeightMeasured) {
      const h = contentRef.current.scrollHeight / PX_PER_MM;
      onHeightMeasured(h);
    }
  });

  return (
    <div ref={contentRef} dir="rtl" data-print-root="" style={{
      width: w,
      minHeight: minH,
      padding: `${padMm}mm`,
      position: "relative",
      fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
      fontSize: `${g(s, "body_font_size")}px`,
      fontWeight: 600,
      color: "#0f172a",
      background: "#fff",
      ...(studioPage != null && pageCount > 1 ? { borderBottom: "2px dashed #cbd5e1", marginBottom: "4mm", paddingBottom: "2mm" } : {}),
    }}>
      {studioPage != null && pageCount > 1 && (
        <div style={{ textAlign: "center", fontSize: "8px", color: "#94a3b8", fontWeight: 700, marginBottom: "2mm", paddingTop: 0 }}>
          — {studioPage + 1} / {pageCount} —
        </div>
      )}
      {children}
    </div>
  );
}
