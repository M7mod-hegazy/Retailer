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
/**
 * Table/image rules shared by the print document AND the on-screen preview.
 * `scope` prefixes every selector (used with `[data-print-root]` in the app so
 * the preview and the hidden measurement container render with EXACTLY the
 * same cell padding/alignment as the print frame — unscoped drift here made
 * measured page breaks land differently on paper than in the preview).
 */
export function getPrintContentCss(scope = "") {
  const p = scope ? `${scope} ` : "";
  return `
    ${p}table { width: 100%; border-collapse: collapse; }
    ${p}th, ${p}td { padding: 4px 6px; text-align: center; }
    ${p}thead { display: table-header-group; }
    ${p}tfoot { display: table-footer-group; }
    ${p}img { max-width: 100%; height: auto; }`;
}

/**
 * Install the scoped content rules into the APP document (once). Preview and
 * hidden-measurement DOM then use identical table geometry to the print frame
 * without embedding <style> tags inside the captured content.
 */
export function ensurePrintParityCss() {
  if (typeof document === "undefined") return;
  if (document.getElementById("print-parity-css")) return;
  const el = document.createElement("style");
  el.id = "print-parity-css";
  el.textContent = getPrintContentCss('[data-print-root]');
  document.head.appendChild(el);
}

export function getPrintBaseCss({ pageSizeStr = "80mm auto", fontStack } = {}) {
  const stack = fontStack || `'Tahoma', 'Segoe UI', Arial, sans-serif`;
  return `
    @page { size: ${pageSizeStr}; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${stack};
      font-synthesis: none;
      color: #000; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    /* Center the fixed-width page/roll containers WITHOUT flex: a flex/grid
       formatting context on body makes Chromium ignore page-break-after
       between children (merged or blank pages). */
    body > * { margin-left: auto; margin-right: auto; }
    .print-dark-bg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${getPrintContentCss()}
    .rpt-page-outer { page-break-inside: avoid; }
    [data-block-key], [data-zone="totals"], [data-zone="footer"], [data-zone="payments"] { page-break-inside: avoid; break-inside: avoid; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }`;
}

/**
 * Wrap inner document HTML in the standard print-frame document (RTL, zero
 * margins, embedded fonts). `printFont` selects the embedded family (bundled
 * families embed woff2 data; system fonts like Tahoma embed nothing).
 */
export function buildPrintDocument(contentHtml, pageSizeStr, title = "طباعة", { printFont = "" } = {}) {
  const cleaned = String(contentHtml || "").replace(/@page\s*\{[^}]*\}/g, "");
  const font = resolvePrintFont(printFont);

  let appStyles = "";
  if (typeof window !== "undefined" && window.document && window.document.head) {
    const elements = Array.from(window.document.head.querySelectorAll("style, link[rel='stylesheet']"));
    appStyles = elements.map((el) => el.outerHTML).join("\n");
  }

  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title || "طباعة"}</title>
  ${appStyles}
  <style>${font.fontFaceCss}</style>
  <style>${getPrintBaseCss({ pageSizeStr, fontStack: font.stack })}
  </style>
  <style>
    @media print {
      body, body * {
        visibility: visible !important;
      }
    }
  </style>
</head>
<body>${cleaned}</body>
</html>`;
}
