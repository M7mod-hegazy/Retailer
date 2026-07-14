/**
 * printService.js — centralized print path for the whole app.
 *
 * Two ways a document reaches a printer:
 *  1. Silent (no dialog): when we're running inside Electron and a printer is
 *     available (either explicitly mapped per-size OR the system default). The
 *     HTML is sent to the main process, rendered in a hidden window, and printed
 *     straight to the configured device with correct roll/page dimensions.
 *  2. Dialog fallback: a hidden iframe + window.print(). Used only when not
 *     running in Electron (browser dev) or when the silent path fails.
 *
 * Roll-paper safety: when no printer is explicitly mapped for a page size, the
 * system automatically falls back to the default printer via the silent path.
 * This prevents the browser dialog from misinterpreting roll paper dimensions
 * and cutting off content.
 *
 * All callers should funnel through printContent() or printFullHtml() so silent
 * printing works consistently across POS receipts, invoices, statements, etc.
 * Both resolve to a structured result: { mode: "silent"|"dialog", reason }.
 */

import { resolveCalibration } from "./printCalibration";

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
 * Normalize a CSS page-size string to the size key used by the printer map and
 * calibration store: "58mm" / "80mm" / custom "NNmm" / "A5" / "A4".
 */
export function sizeKeyForPageSize(pageSizeStr) {
  if (!pageSizeStr) return "A4";
  // Exact match so landscape A5 ("210mm 148mm") doesn't collide with A4 portrait
  if (/^148mm\s+210mm$/.test(pageSizeStr)) return "A5";
  if (/^210mm\s+148mm$/.test(pageSizeStr)) return "A5";
  if (/^210mm\s+297mm$/.test(pageSizeStr)) return "A4";
  if (/^297mm\s+210mm$/.test(pageSizeStr)) return "A4";
  const roll = /^(\d+(?:\.\d+)?)mm\s+auto$/.exec(pageSizeStr);
  if (roll) return `${roll[1]}mm`;
  return "A4";
}

/**
 * Given a CSS page-size string (e.g. "80mm auto", "210mm 297mm"),
 * return the printer name assigned to that size, or "" if none.
 * This is the SYNC version — use getPrinterForPageSizeAsync for the
 * auto-fallback-to-default path.
 */
export function getPrinterForPageSize(pageSizeStr) {
  const map = getPrinterSizeMap();
  return map[sizeKeyForPageSize(pageSizeStr)] || "";
}

/**
 * Async version that falls back to the system default printer when no explicit
 * mapping exists. This is critical for roll paper: without a mapped printer the
 * old code fell back to the browser dialog which misinterprets roll dimensions
 * and clips content. By routing through the silent path with the default
 * printer, Electron handles page sizing correctly.
 */
let _printerCache = null;
let _printerCacheTs = 0;
const PRINTER_CACHE_TTL = 15000;

export async function getPrinterForPageSizeAsync(pageSizeStr) {
  const explicit = getPrinterForPageSize(pageSizeStr);
  if (explicit) return explicit;
  const def = await getDefaultPrinter();
  return def ? def.name : "";
}

/** Return the list of installed printers (Electron only); [] in the browser. */
export async function listPrinters() {
  if (!isElectronPrint()) return [];
  try {
    const res = await window.electronAPI.invoke("print:list-printers");
    const list = res && res.printers ? res.printers : [];
    _printerCache = list;
    _printerCacheTs = Date.now();
    return list;
  } catch {
    return [];
  }
}

/**
 * Get the system default printer. Uses a short-lived cache to avoid hammering
 * the IPC bridge on every print call. Returns null in the browser.
 */
export async function getDefaultPrinter() {
  if (!isElectronPrint()) return null;
  let printers = _printerCache;
  if (!printers || (Date.now() - _printerCacheTs) > PRINTER_CACHE_TTL) {
    printers = await listPrinters();
  }
  return printers.find((p) => p.isDefault) || printers[0] || null;
}

/* ------------------------------------------------------------------ */
/* Print job log — capped local history so failures are diagnosable    */
/* and recent documents can be re-printed from settings.               */
/* ------------------------------------------------------------------ */

const JOB_LOG_KEY = "retailer_print_job_log";
const JOB_LOG_MAX = 100;

export function getPrintJobLog() {
  try { return JSON.parse(localStorage.getItem(JOB_LOG_KEY) || "[]"); }
  catch { return []; }
}

function appendJobLog(entry) {
  try {
    const log = getPrintJobLog();
    log.unshift(entry);
    localStorage.setItem(JOB_LOG_KEY, JSON.stringify(log.slice(0, JOB_LOG_MAX)));
  } catch { /* logging must never break printing */ }
}

export function clearPrintJobLog() {
  localStorage.removeItem(JOB_LOG_KEY);
}

/**
 * Was this document already printed successfully on this terminal?
 * Drives the "نسخة" reprint stamp. Log-based, so it survives page reloads but
 * is intentionally machine-local (a reprint on another terminal won't know).
 */
export function hasPrintedBefore(docType, docId) {
  if (!docType || !docId) return false;
  return getPrintJobLog().some((e) => e.ok && e.doc_type === docType && e.doc_id === String(docId));
}

// Document shell + shared print CSS live in printDocument.js so the preview,
// the Studio canvas, and the real print path can never drift apart.
export { buildPrintDocument, getPrintBaseCss } from "./printDocument";
import { buildPrintDocument as buildDoc } from "./printDocument";

/** Print a fully-built HTML document via the hidden iframe (always shows dialog). */
function printViaIframe(fullHtml, afterPrint) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print-frame");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const idoc = win.document;
  idoc.open();
  idoc.write(fullHtml);
  idoc.close();
  // Print only after the embedded @font-face fonts and images are ready —
  // printing immediately rendered the fallback font (fuzzy/different output
  // on paper vs preview) and dropped late-loading logos. Timeout-capped so a
  // broken resource can never block printing.
  const fontsReady = idoc.fonts && idoc.fonts.ready
    ? idoc.fonts.ready.catch(() => {})
    : Promise.resolve();
  const imagesReady = Promise.all(
    Array.from(idoc.images || []).map((img) =>
      img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; })
    )
  );
  const timeout = new Promise((res) => setTimeout(res, 2500));
  Promise.race([Promise.all([fontsReady, imagesReady]), timeout]).then(() => {
    requestAnimationFrame(() => {
      win.focus();
      win.print();
      if (afterPrint) afterPrint();
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
    });
  });
}

/**
 * Attempt silent print to a configured device.
 * When no deviceName is given but we're in Electron, automatically falls back
 * to the system default printer so roll paper content is never clipped by the
 * browser dialog's incorrect page size interpretation.
 * Resolves { ok, reason } — reason explains a false `ok`.
 */
async function printSilently(fullHtml, deviceName, copies, pageSizeStr) {
  if (!isElectronPrint()) return { ok: false, reason: "not_electron" };
  // Auto-detect: use explicitly mapped printer, or fall back to system default.
  let printer = deviceName;
  if (!printer) {
    const def = await getDefaultPrinter();
    if (def) printer = def.name;
  }
  if (!printer) return { ok: false, reason: "no_printer_mapped" };
  try {
    const sizeKey = sizeKeyForPageSize(pageSizeStr);
    const cal = resolveCalibration(printer, sizeKey);
    const res = await window.electronAPI.invoke("print:silent", {
      html: fullHtml,
      deviceName: printer,
      copies: Math.max(1, Number(copies) || 1),
      // The main process needs the paper size to pass an explicit pageSize to
      // webContents.print — CSS @page is ignored there and thermal jobs print blank.
      pageSizeStr: pageSizeStr || "",
      // Per-printer geometry decisions made in the calibration wizard.
      paperMode: cal.paperMode || "custom",
      escposCut: !!cal.escposCut,
      escposDrawer: !!cal.escposDrawer,
    });
    if (res && res.success) return { ok: true, reason: null };
    return { ok: false, reason: (res && res.error) || "print_failed" };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : "print_failed" };
  }
}

/**
 * Print an already-complete HTML document. Tries silent first (if a deviceName is
 * given and we're in Electron), otherwise falls back to the dialog.
 * Resolves { mode: "silent"|"dialog", reason } — reason is why silent was skipped
 * or failed (null when silent succeeded).
 */
export async function printFullHtml(fullHtml, { deviceName = "", copies = 1, afterPrint, pageSizeStr = "", docType = "", docLabel = "", docId = "" } = {}) {
  const silent = await printSilently(fullHtml, deviceName, copies, pageSizeStr);
  // Resolve the actual printer used (may be auto-detected default) for logging.
  let resolvedPrinter = deviceName;
  if (!resolvedPrinter && silent.ok && isElectronPrint()) {
    const def = await getDefaultPrinter();
    if (def) resolvedPrinter = def.name;
  }
  appendJobLog({
    at: new Date().toISOString(),
    doc_type: docType || "",
    doc_label: docLabel || "",
    doc_id: docId ? String(docId) : "",
    printer: resolvedPrinter || "",
    size: sizeKeyForPageSize(pageSizeStr),
    copies: Math.max(1, Number(copies) || 1),
    mode: silent.ok ? "silent" : "dialog",
    ok: silent.ok,
    reason: silent.reason,
  });
  if (silent.ok) {
    if (afterPrint) afterPrint();
    return { mode: "silent", reason: null };
  }
  printViaIframe(fullHtml, afterPrint);
  return { mode: "dialog", reason: silent.reason };
}

/**
 * Print inner document HTML using the standard print-frame wrapper. Preferred
 * entry point for receipt/invoice/report printing.
 */
export async function printContent({ contentHtml, pageSizeStr, deviceName = "", copies = 1, afterPrint, title, docType = "", docLabel = "", docId = "", printFont = "" } = {}) {
  // Advance the daily counter once per real print when the document actually
  // uses a daily number — the printed HTML captured peek(), which equals the
  // value next() now commits, so numbers stay in lockstep and reset each day.
  if (typeof contentHtml === "string" && contentHtml.includes("data-daily-no")) {
    try { const { nextDailySeq } = await import("../components/print/blocks/dailySequence"); nextDailySeq(); } catch { /* non-fatal */ }
  }
  const fullHtml = buildDoc(contentHtml, pageSizeStr, title, { printFont });
  return printFullHtml(fullHtml, { deviceName, copies, afterPrint, pageSizeStr, docType, docLabel, docId });
}

/**
 * Print a multi-part document (e.g. customer receipt + kitchen stub).
 * Silent path: each part is its own print job, so the printer's cut — driver
 * auto-cut or the calibrated ESC/POS cut sent after every job — lands between
 * the parts. Dialog fallback: parts join into one document with page breaks
 * (the dialog can't drive per-part cuts).
 * parts: [{ contentHtml, copies? }]. Resolves { mode, reason }.
 */
export async function printMultipart({ parts = [], pageSizeStr, deviceName = "", afterPrint, title, docType = "", docLabel = "", printFont = "" } = {}) {
  const usable = parts.filter((p) => p && p.contentHtml);
  if (!usable.length) return { mode: "dialog", reason: "no_parts" };
  if (usable.length === 1) {
    return printContent({ contentHtml: usable[0].contentHtml, pageSizeStr, deviceName, copies: usable[0].copies || 1, afterPrint, title, docType, docLabel, printFont });
  }

  const joinedFallback = () => printContent({
    contentHtml: usable.map((p) => `<div style="page-break-after: always;">${p.contentHtml}</div>`).join(""),
    pageSizeStr, deviceName: "", afterPrint, title, docType, docLabel, printFont,
  });

  // Resolve printer: explicit mapping → auto-detect default → dialog fallback.
  let printer = deviceName;
  if (!printer && isElectronPrint()) {
    const def = await getDefaultPrinter();
    if (def) printer = def.name;
  }
  if (!isElectronPrint() || !printer) {
    const res = await joinedFallback();
    return { mode: "dialog", reason: res.reason || "no_printer_mapped" };
  }

  for (let i = 0; i < usable.length; i++) {
    const fullHtml = buildDoc(usable[i].contentHtml, pageSizeStr, title, { printFont });
    const silent = await printSilently(fullHtml, printer, usable[i].copies || 1, pageSizeStr);
    appendJobLog({
      at: new Date().toISOString(),
      doc_type: docType || "",
      doc_label: docLabel ? `${docLabel} (${i + 1}/${usable.length})` : `part ${i + 1}/${usable.length}`,
      printer,
      size: sizeKeyForPageSize(pageSizeStr),
      copies: usable[i].copies || 1,
      mode: silent.ok ? "silent" : "dialog",
      ok: silent.ok,
      reason: silent.reason,
    });
    if (!silent.ok) {
      // A part failed mid-run: surface the whole document in the dialog so
      // nothing silently goes unprinted (the user can reprint what's missing).
      await joinedFallback();
      return { mode: "dialog", reason: silent.reason };
    }
  }
  if (afterPrint) afterPrint();
  return { mode: "silent", reason: null };
}
