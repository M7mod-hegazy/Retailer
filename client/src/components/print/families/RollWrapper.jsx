import React from "react";
import { g, rollPaperWidthMm, rollPrintWidthMm, rollBandLeftMm, rollClampFontPx } from "../blocks/blockUtils";

/**
 * Thermal roll container. The outer div is the physical PAPER width so the
 * printed sheet maps 1:1 onto the roll; the inner div is the printable BAND
 * (calibrated per printer, narrower than the paper) placed at its physical
 * left offset. Positioning is left-based on purpose — it describes where the
 * print head sits on the paper, which does not depend on text direction.
 */
export default function RollWrapper({ settings: s, children, overlay }) {
  const paperMm = rollPaperWidthMm(s);
  const bandMm = rollPrintWidthMm(s);
  const bandLeftMm = rollBandLeftMm(s);
  return (
    // dir="ltr" is load-bearing: the paper div sits inside the app's RTL tree,
    // and in RTL over-constrained block layout the browser IGNORES margin-left
    // and honors margin-right — which slammed the band flush right (preview
    // AND paper). Physical band geometry must resolve left-based.
    <div dir="ltr" style={{
      width: `${paperMm}mm`,
      boxSizing: "border-box",
      background: "#fff",
      // Positioned ancestor for freely-placed (abs) blocks: their mm
      // coordinates are relative to the PAPER edge, not the printable band.
      position: "relative",
    }}>
      <div dir="rtl" style={{
        fontFamily: `${g(s, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
        fontSize: `${rollClampFontPx(g(s, "body_font_size"))}px`,
        lineHeight: 1.6,
        width: `${bandMm}mm`,
        marginLeft: `${bandLeftMm}mm`,
        marginRight: 0,
        boxSizing: "border-box",
        padding: "2mm 1mm",
        // Receipt body is always thermal-black; accent_color styles headings on
        // the page family only — a light accent used to fade the whole receipt.
        color: "#000", background: "#fff",
      }}>{children}</div>
      {overlay}
    </div>
  );
}
