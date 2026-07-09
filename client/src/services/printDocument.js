/**
 * printDocument.js — the ONE place print-document HTML/CSS is defined.
 *
 * The real print path (silent hidden window / dialog iframe), the preview
 * modal, and the Studio canvas must all consume this module so what the user
 * sees is byte-for-byte the stylesheet that prints. Historic drift between
 * hand-copied style strings is exactly what made previews lie.
 *
 * Fonts: the silent-print window loads a bare temp file with no network and no
 * app stylesheets, so the selected print font (all weights) is EMBEDDED as
 * base64 @font-face rules. `font-synthesis: none` forbids the engine from
 * faking bold — synthesized bold is what printed dashed/broken on 203dpi
 * thermal heads.
 */

import { resolvePrintFont } from "./printFonts";

/**
 * Base stylesheet shared by every print document.
 * `fontStack` must come from resolvePrintFont so the embedded family leads it.
 */
export function getPrintBaseCss({ pageSizeStr = "80mm auto", fontStack } = {}) {
  const stack = fontStack || `'Tahoma', 'Segoe UI', Arial, sans-serif`;
  return `
    @page { size: ${pageSizeStr}; margin: 0; }
    html { margin: 0; padding: 0; display: flex; justify-content: center; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${stack};
      font-synthesis: none;
      display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      color: #000; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 4px 6px; text-align: center; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    img { max-width: 100%; height: auto; }
    .rpt-page-outer { page-break-inside: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }`;
}

/**
 * Wrap inner document HTML in the standard print-frame document (RTL, zero
 * margins, embedded fonts). `printFont` selects the embedded family (bundled
 * families embed woff2 data; system fonts like Tahoma embed nothing).
 */
export function buildPrintDocument(contentHtml, pageSizeStr, title = "طباعة", { printFont = "" } = {}) {
  const cleaned = String(contentHtml || "").replace(/@page\s*\{[^}]*\}/g, "");
  const font = resolvePrintFont(printFont);
  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title || "طباعة"}</title>
  <style>${font.fontFaceCss}</style>
  <style>${getPrintBaseCss({ pageSizeStr, fontStack: font.stack })}
  </style>
</head>
<body>${cleaned}</body>
</html>`;
}
