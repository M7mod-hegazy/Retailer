import React from "react";
import { g } from "../blocks/blockUtils";
import { pageWidthStr, pageHeightStr, pageDimensions, PX_PER_MM } from "../studio/studioData";

export default function PageWrapper({ settings: s, size = "A4", orientation = "portrait", children, studioPage, pageCount, onHeightMeasured }) {
  const w = pageWidthStr(size, orientation);
  const dims = pageDimensions(size, orientation);
  const minH = dims.hMm > 0 ? `${dims.hMm}mm` : undefined;

  const contentRef = React.useRef(null);
  React.useLayoutEffect(() => {
    if (contentRef.current && onHeightMeasured) {
      const h = contentRef.current.scrollHeight / PX_PER_MM;
      onHeightMeasured(h);
    }
  });

  return (
    <div ref={contentRef} dir="rtl" style={{
      width: w,
      minHeight: minH,
      padding: "2mm 2mm",
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
