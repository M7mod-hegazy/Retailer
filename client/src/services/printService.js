/**
 * printService.js — centralized print path for the whole app.
 *
 * Two ways a document reaches a printer:
 *  1. Silent (no dialog): when the user has chosen a printer for this document
 *     type in settings AND we're running inside Electron. The HTML is sent to the
 *     main process, rendered in a hidden window, and printed straight to the
 *     configured device.
 *  2. Dialog fallback: a hidden iframe + window.print(). Used when no printer is
 *     configured, when not running in Electron (browser dev), or when the silent
 *     path fails for any reason. This preserves the original behavior exactly.
 *
 * All callers should funnel through printContent() or printFullHtml() so silent
 * printing works consistently across POS receipts, invoices, statements, etc.
 */

export function isElectronPrint() {
  return !!(typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.invoke === "function");
}

const PRINTER_SIZE_KEY = "retailer_printer_size_map";

/** Read the size→printer map from localStorage. */
export function getPrinterSizeMap() {
  try { return JSON.parse(localStorage.getItem(PRINTER_SIZE_KEY) || "{}"); }
  catch { return {}; }
}

/** Persist the size→printer map to localStorage. */
export function setPrinterSizeMap(map) {
  localStorage.setItem(PRINTER_SIZE_KEY, JSON.stringify(map || {}));
}

/**
 * Given a CSS page-size string (e.g. "80mm auto", "210mm 297mm"),
 * return the printer name assigned to that size, or "" if none.
 */
export function getPrinterForPageSize(pageSizeStr) {
  const map = getPrinterSizeMap();
  if (!pageSizeStr) return map["A4"] || "";
  if (pageSizeStr.startsWith("58mm"))  return map["58mm"] || "";
  if (pageSizeStr.startsWith("80mm"))  return map["80mm"] || "";
  if (pageSizeStr.startsWith("148mm")) return map["A5"]   || "";
  return map["A4"] || "";
}

/** Return the list of installed printers (Electron only); [] in the browser. */
export async function listPrinters() {
  if (!isElectronPrint()) return [];
  try {
    const res = await window.electronAPI.invoke("print:list-printers");
    return res && res.printers ? res.printers : [];
  } catch {
    return [];
  }
}

/**
 * Wrap inner document HTML in the standard print-frame document (RTL, zero
 * margins, table-friendly). Mirrors the markup PrintPreviewModal used inline.
 */
export function buildPrintDocument(contentHtml, pageSizeStr, title = "طباعة") {
  const cleaned = String(contentHtml || "").replace(/@page\s*\{[^}]*\}/g, "");
  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title || "طباعة"}</title>
  <style>
    @page { size: ${pageSizeStr}; margin: 0; }
    html { margin: 0; padding: 0; display: flex; justify-content: center; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      /* Tahoma/Segoe UI/Arial are always present on Windows and render Arabic
         crisply on thermal printers; the web fonts are a best-effort upgrade
         that the silent-print window usually can't load. */
      font-family: "Tajawal", "Noto Sans Arabic", "Tahoma", "Segoe UI", Arial, sans-serif;
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
  </style>
</head>
<body>${cleaned}</body>
</html>`;
}

/** Print a fully-built HTML document via the hidden iframe (always shows dialog). */
function printViaIframe(fullHtml, afterPrint) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print-frame");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const idoc = iframe.contentWindow.document;
  idoc.open();
  idoc.write(fullHtml);
  idoc.close();
  iframe.contentWindow.focus();
  requestAnimationFrame(() => {
    iframe.contentWindow.print();
    if (afterPrint) afterPrint();
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
  });
}

/** Attempt silent print to a configured device. Resolves true only on success. */
async function printSilently(fullHtml, deviceName, copies, pageSizeStr) {
  if (!isElectronPrint() || !deviceName) return false;
  try {
    const res = await window.electronAPI.invoke("print:silent", {
      html: fullHtml,
      deviceName,
      copies: Math.max(1, Number(copies) || 1),
      // The main process needs the paper size to pass an explicit pageSize to
      // webContents.print — CSS @page is ignored there and thermal jobs print blank.
      pageSizeStr: pageSizeStr || "",
    });
    return !!(res && res.success);
  } catch {
    return false;
  }
}

/**
 * Print an already-complete HTML document. Tries silent first (if a deviceName is
 * given and we're in Electron), otherwise falls back to the dialog.
 */
export async function printFullHtml(fullHtml, { deviceName = "", copies = 1, afterPrint, pageSizeStr = "" } = {}) {
  const ok = await printSilently(fullHtml, deviceName, copies, pageSizeStr);
  if (ok) {
    if (afterPrint) afterPrint();
    return true;
  }
  printViaIframe(fullHtml, afterPrint);
  return false;
}

/**
 * Print inner document HTML using the standard print-frame wrapper. Preferred
 * entry point for receipt/invoice/report printing.
 */
export async function printContent({ contentHtml, pageSizeStr, deviceName = "", copies = 1, afterPrint, title } = {}) {
  const fullHtml = buildPrintDocument(contentHtml, pageSizeStr, title);
  return printFullHtml(fullHtml, { deviceName, copies, afterPrint, pageSizeStr });
}
