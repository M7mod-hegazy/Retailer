import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import { PrintThermalDoc, PrintA4Doc } from "./PrintDoc";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet,
  Printer, Wand2, SkipBack, SkipForward, Image, Receipt, FileText, FileBarChart2, Maximize2,
} from "lucide-react";
import WhatsAppIcon from "../ui/WhatsAppIcon";
import api from "../../services/api";
import toast from "react-hot-toast";
import { printContent, getPrinterForPageSize, getPrinterForPageSizeAsync, getPrinterSizeMap, isElectronPrint, hasPrintedBefore } from "../../services/printService";
import { withCalibration } from "../../services/printCalibration";
import { DOC_PAPER_CONFIG, resolveDocPaperSize, SCOPE_PRESETS, pageDimensions, pageWidthStr, pageHeightStr, pageSizeStrFor as printPageSizeStr, findNaturalBreaks, getPagedDocumentHtml, PX_PER_MM, familyOfSize, BLOCK_DOC_SCOPES } from "./studio/studioData";
import PrintStudio from "./studio/PrintStudio";
import { resolveEffectiveLayout } from "./layout/layoutModel";
import { applyPreset } from "./presets/presetEngine";
import { formatNumber } from "../../utils/currency";
import { useDetach } from "../../hooks/useDetach";

const ALL_TEMPLATES = [
  { id: "58mm", label: "58mm", sub: "رول صغير",   icon: Receipt       },
  { id: "80mm", label: "80mm", sub: "رول قياسي",  icon: Receipt       },
  { id: "A5",   label: "A5",   sub: "نصف صفحة",   icon: FileText      },
  { id: "A4",   label: "A4",   sub: "ورقة كاملة", icon: FileBarChart2 },
];

export default function PrintPreviewModal({
  open,
  onClose,
  invoice = {},
  settings: globalSettings = {},
  operationLabel = "",
  renderContent,
  docType,
  onConfirmPrint,
  confirmLabel = "تأكيد وطباعة",
  onSaveOnly,
  saveOnlyLabel = "حفظ فقط",
  isSaving = false,
  reportColumns = [],
  totalRows = 0,
  onExportAllColumns,
  onSendWhatsApp,
  children,
}) {
  const { t } = useTranslation();
  const { handleDetach } = useDetach("print-preview", {
    onClose, getState: () => ({ invoice, settings: globalSettings, operationLabel, docType, reportColumns, totalRows }), actions: { confirmPrint: () => onConfirmPrint?.(), saveOnly: () => onSaveOnly?.(), exportAllColumns: () => onExportAllColumns?.() },
  });
  const [template, setTemplate] = useState(null);
  const [orientation, setOrientation] = useState("portrait");
  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docSettings, setDocSettings] = useState({});
  const [fetchedGlobalSettings, setFetchedGlobalSettings] = useState({});
  const [globalScopeSettings, setGlobalScopeSettings] = useState({});
  const [reportPrintKeys, setReportPrintKeys] = useState([]);
  const [printPage, setPrintPage] = useState(1);
  const printPageRef = useRef(1);
  const [totalPrintPages, setTotalPrintPages] = useState(1);
  const [columnWeights, setColumnWeights] = useState({});
  const [docSettingsLoaded, setDocSettingsLoaded] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [smartBreaksMm, setSmartBreaksMm] = useState([]);
  
  const instantFired = useRef(false);
  // True once the pagination measurement has run for the current doc/template —
  // instant mode must not fire before it (it used to race the 60/200ms
  // measurement debounce and print with fixed-height cuts through blocks).
  const [measuredOnce, setMeasuredOnce] = useState(false);
  // Shared rows-per-page ceiling for self-paginating report docs. When a
  // rendered page overflows the paper, this shrinks (never grows) until every
  // page fits — one shared value so all pages slice the SAME row ranges.
  const [reportRowsCap, setReportRowsCap] = useState(null);
  const reportRowsUsedRef = useRef(0);

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);
  const printContentRef = useRef(null);
  const printAllRef = useRef(null);
  const printBtnRef = useRef(null);
  const saveOnlyBtnRef = useRef(null);

  // When the modal opens in creation mode (two-choice), focus the primary "save & print"
  // button so the user can confirm with Enter or move to "save without print" with arrows.
  useEffect(() => {
    if (open && onSaveOnly) {
      const t = setTimeout(() => printBtnRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, onSaveOnly]);

  // Up/Down (and Left/Right) move focus between the two action buttons.
  const handleActionKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault(); saveOnlyBtnRef.current?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault(); printBtnRef.current?.focus();
    }
  };

  const cfg = docType ? (DOC_PAPER_CONFIG[docType] || null) : null;
  const validTemplates = cfg ? ALL_TEMPLATES.filter(t => cfg.sizes.includes(t.id)) : ALL_TEMPLATES;
  const isReportDoc = docType === "reports_generic" || !!renderContent;

  useEffect(() => {
    if (!docType || !open) {
      setDocSettings({});
      setDocSettingsLoaded(false);
      instantFired.current = false;
      setMeasuredOnce(false);
      setReportRowsCap(null);
      return;
    }
    let cancelled = false;
    instantFired.current = false;
    setDocSettingsLoaded(false);
    api.get(`/api/print-settings-per-doc/${docType}`)
      .then((r) => {
        if (!cancelled) {
          let saved = r.data.data || {};
          const isReport = docType !== "_global" && !BLOCK_DOC_SCOPES.has(docType);
          if (isReport && (!saved || !saved.layout) && SCOPE_PRESETS[docType] && SCOPE_PRESETS[docType].length) {
            saved = applyPreset(saved, SCOPE_PRESETS[docType][0], docType);
          }
          setDocSettings(saved);
          const resolved = resolveDocPaperSize(docType, saved);
          setTemplate(resolved);
          setViewZoom(resolved === "A4" ? 0.55 : resolved === "A5" ? 0.72 : 1);
          setDocSettingsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocSettings({});
          setTemplate(cfg ? cfg.defaultSize : "A4");
          setDocSettingsLoaded(true);
        }
      });
    api.get("/api/settings").then((r) => {
      if (!cancelled && r.data?.data) setFetchedGlobalSettings(r.data.data);
    }).catch(() => {});
    // The "_global" scope row: the shared default layout every doc type
    // inherits unless its own layout overrides it (resolveEffectiveLayout).
    api.get("/api/print-settings-per-doc/_global").then((r) => {
      if (!cancelled && r.data?.data) setGlobalScopeSettings(r.data.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [docType, open]);

  // Re-read saved designs after the Studio closes (it saves rows itself).
  const reloadAfterStudio = () => {
    setStudioOpen(false);
    if (!docType) return;
    api.get(`/api/print-settings-per-doc/${docType}`)
      .then((r) => {
        let saved = r.data.data || {};
        const isReport = docType !== "_global" && !BLOCK_DOC_SCOPES.has(docType);
        if (isReport && (!saved || !saved.layout) && SCOPE_PRESETS[docType] && SCOPE_PRESETS[docType].length) {
          saved = applyPreset(saved, SCOPE_PRESETS[docType][0], docType);
        }
        setDocSettings(saved);
      }).catch(() => {});
    api.get("/api/print-settings-per-doc/_global")
      .then((r) => { if (r.data?.data) setGlobalScopeSettings(r.data.data); }).catch(() => {});
  };

  useEffect(() => {
    if (!docType && open && template === null) {
      setTemplate("A4");
    }
  }, [docType, open]);

  const activeTemplate = template || (cfg ? cfg.defaultSize : "A4");
  const isThermal = activeTemplate === "58mm" || activeTemplate === "80mm";
  const isPageDoc = !isThermal && activeTemplate !== "58mm" && activeTemplate !== "80mm";

  // Measure hidden content for smart page breaks (page docs only).
  // Uses ResizeObserver to catch ALL layout changes (async fonts, images,
  // conditional blocks, settings reloads) plus an initial rAF measurement.
  useLayoutEffect(() => {
    // Report docs that split themselves into multiple pages don't need flow
    // breaks; but a SINGLE-flow renderContent doc (statements, one-page
    // reports that actually overflow) paginates here like any invoice.
    if (!open || isThermal || (renderContent && totalPrintPages > 1) || !printAllRef.current) {
      // Use functional updater: return the SAME reference when already empty
      // to prevent re-renders. Without this, setSmartBreaksMm([]) always
      // creates a new [] reference, React's Object.is sees it as changed,
      // triggers a re-render, the effect re-runs (invoice is a new {} on
      // every render as a default param), and we get an infinite loop.
      setSmartBreaksMm((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const dims = pageDimensions(activeTemplate, orientation);
    const pageHmm = dims.hMm;
    if (!pageHmm || pageHmm <= 0) { setSmartBreaksMm((prev) => (prev.length === 0 ? prev : [])); return; }

    let cancelled = false;
    let pendingRaf = 0;
    let debounceTimer = null;

    const doMeasure = () => {
      if (cancelled || !printAllRef.current) return;
      const breaks = findNaturalBreaks(printAllRef.current, pageHmm, PX_PER_MM);
      if (!cancelled) {
        setSmartBreaksMm((prev) =>
          prev.length === breaks.length && prev.every((v, i) => v === breaks[i]) ? prev : breaks
        );
        setMeasuredOnce((p) => p || true);
      }
    };

    // Debounced observer callback — wait 60ms for layout to stabilise
    const onResize = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doMeasure, 60);
    };

    // Initial measurement after rAF (DOM committed) + delayed re-measure
    // to catch late-arriving content (web fonts, conditional blocks).
    pendingRaf = requestAnimationFrame(() => {
      if (cancelled) return;
      doMeasure();
      debounceTimer = setTimeout(doMeasure, 200);
    });

    // Observe the container for size changes (content loading, blocks appearing)
    const container = printAllRef.current;
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      cancelled = true;
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      if (debounceTimer) clearTimeout(debounceTimer);
      ro.disconnect();
    };
  // NOTE: renderContent is intentionally excluded from deps. It is an inline
  // function from parent components — a new reference every render. Including
  // it would re-run this effect (and call setSmartBreaksMm([])) on every
  // parent re-render, causing unnecessary state churn. The effect already
  // early-returns when renderContent is truthy, so its presence is sufficient.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTemplate, orientation, isThermal, docSettings, docSettingsLoaded, invoice, totalPrintPages, reportRowsCap]);

  const smartPages = smartBreaksMm.length + 1;
  const hasSmartBreaks = isPageDoc && smartBreaksMm.length > 0;
  const displayTotalPages = hasSmartBreaks ? smartPages : totalPrintPages;



  // Column fitting logic
  const scoreColumn = (col) => {
    if (col?.type === "money" || col?.type === "text") return 1.2;
    if (col?.type === "code") return 1.05;
    return 0.9;
  };

  const getCapacity = (paper = activeTemplate, isLandscape = false) => {
    if (isLandscape) return paper === "A5" ? 7.5 : 10.5;
    return paper === "A5" ? 5.2 : 7.2;
  };

  const smartKeys = useCallback((mode = "essential") => {
    const allowed = mode === "useful"
      ? new Set(["essential", "useful"])
      : new Set(["essential"]);
    let used = 0;
    const keys = [];
    const capacity = getCapacity(activeTemplate, false);
    reportColumns.forEach((col) => {
      if (!allowed.has(col.printPriority || "optional")) return;
      const weight = scoreColumn(col);
      if (keys.length === 0 || used + weight <= capacity) {
        keys.push(col.key || col.id);
        used += weight;
      }
    });
    return keys.length ? keys : reportColumns.slice(0, Math.max(1, Math.floor(capacity))).map((c) => c.key || c.id);
  }, [reportColumns, activeTemplate]);

  useEffect(() => {
    if (!open || !isReportDoc || !reportColumns.length) return;
    setReportPrintKeys((current) => {
      const valid = new Set(reportColumns.map((c) => c.key || c.id));
      const next = current.filter((key) => valid.has(key));
      return next.length ? next : smartKeys("useful");
    });
  }, [open, isReportDoc, reportColumns, smartKeys]);

  const hiddenReportColumns = isReportDoc
    ? reportColumns.filter((c) => !reportPrintKeys.includes(c.key || c.id))
    : [];
  const reportFitScore = isReportDoc
    ? reportColumns.filter((c) => reportPrintKeys.includes(c.key || c.id)).reduce((sum, col) => sum + scoreColumn(col), 0)
    : 0;
  const reportCapacity = getCapacity(activeTemplate, false);
  const reportFitTone = reportFitScore <= reportCapacity ? "green"
    : reportFitScore <= reportCapacity + 1.5 ? "amber" : "red";

  // ── Per-family inherit check ──
  // resolveEffectiveLayout already handles per-family inherit for layout.
  // For flat settings, check inherit_global_roll / inherit_global_page.
  const activeFam = familyOfSize(activeTemplate);
  const isReportDocForInherit = docType !== "_global" && !BLOCK_DOC_SCOPES.has(docType);
  const inheritFamilyKey = `inherit_global_${activeFam}`;
  const docInheritVal = docSettings[inheritFamilyKey] ?? docSettings.inherit_global;
  const docInheritsGlobal = docInheritVal !== undefined ? docInheritVal : !isReportDocForInherit;

  // Merge order (low → high): settings table → props → _global scope flat
  // fields → per-doc flat fields; layout is merged structurally per family so
  // a doc inherits the _global design until it overrides specific pieces.
  const effectiveLayout = {
    roll: resolveEffectiveLayout(globalScopeSettings, docSettings, "roll", docType),
    page: resolveEffectiveLayout(globalScopeSettings, docSettings, "page", docType),
  };
  const { layout: _gsLayout, ...globalScopeFlat } = globalScopeSettings || {};
  // When inheriting, skip spreading docSettings for flat settings — use global only
  const localFlatFields = docInheritsGlobal ? {} : docSettings;
  const combinedSettingsBase = {
    ...(fetchedGlobalSettings || {}),
    ...(globalSettings || {}),
    // operationLabel is only a FALLBACK footer: a footer designed in the
    // Studio (per-doc or _global scope, spread below) must win, or every
    // reprint replaces the designed footer with the operation name.
    ...(operationLabel ? { receipt_footer: operationLabel } : {}),
    ...globalScopeFlat,
    ...localFlatFields,
    layout: effectiveLayout,
    ...(isReportDoc ? {
      report_print_column_keys: reportPrintKeys,
      report_print_hidden_columns: hiddenReportColumns,
      report_print_landscape: false,
      orientation: "portrait",
      report_total_rows: totalRows,
      template: activeTemplate,
      columnWeights: Object.keys(columnWeights).length > 0 ? columnWeights : undefined,
      // Fit-to-page ceiling + feedback channel (see reportRowsCap above).
      report_rows_per_page: reportRowsCap || undefined,
      onReportRowsPerPage: (n) => { reportRowsUsedRef.current = n; },
    } : {}),
  };

  // Inject the mapped printer's calibration (printable band + shift) so the
  // preview shows exactly the geometry that will hit the paper.
  const mappedPrinter = getPrinterSizeMap()[activeTemplate] || "";
  const combinedSettings = isThermal
    ? withCalibration(combinedSettingsBase, mappedPrinter, activeTemplate)
    : combinedSettingsBase;

  // Reset the fit ceiling whenever anything that changes row/column geometry
  // changes — it can then re-converge downward for the new layout.
  useEffect(() => {
    setReportRowsCap(null);
  }, [open, docType, activeTemplate, orientation, reportPrintKeys, columnWeights]);

  // Fit-to-page guard for multi-page report docs: measure the hidden per-page
  // renders; if the tallest page overflows the paper, shrink the shared
  // rows-per-page cap proportionally. Monotonic (only shrinks, floor 1) so it
  // cannot oscillate; overflowing rows used to be silently clipped on paper.
  useLayoutEffect(() => {
    if (!open || !isReportDoc || isThermal || totalPrintPages <= 1) return undefined;
    const el = printAllRef.current;
    if (!el) return undefined;
    const dims = pageDimensions(activeTemplate, orientation);
    if (!dims.hMm) return undefined;
    const pageHpx = dims.hMm * PX_PER_MM;
    const raf = requestAnimationFrame(() => {
      const pages = el.querySelectorAll(":scope > [data-print-page]");
      if (!pages.length) return;
      let worst = 0;
      pages.forEach((p) => { worst = Math.max(worst, p.scrollHeight); });
      const used = reportRowsUsedRef.current;
      if (worst > pageHpx * 1.02 && used > 1) {
        const fit = Math.max(1, Math.min(used - 1, Math.floor(used * (pageHpx / worst))));
        setReportRowsCap((cur) => (cur == null || fit < cur ? fit : cur));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, isReportDoc, isThermal, totalPrintPages, reportRowsCap, activeTemplate, orientation, reportPrintKeys, columnWeights, docSettings]);

  // Page navigation — use ref for printPage to keep handlePageCount stable.
  // ReportViaLayout's useLayoutEffect depends on onPageCount identity; if we
  // recreate it on every printPage change the effect re-fires and can cascade
  // into an infinite setTotalPrintPages ↔ re-render loop.
  useEffect(() => { printPageRef.current = printPage; }, [printPage]);

  const handlePageCount = useCallback((count) => {
    setTotalPrintPages((prev) => {
      if (prev === count) return prev;           // same value → React bails
      return count;
    });
    if (printPageRef.current > count) setPrintPage(Math.max(1, count));
  }, []);

  const goToPage = (p) => {
    setPrintPage(Math.max(1, Math.min(p, displayTotalPages)));
    setPan({ x: 0, y: 0 });
  };

  const switchTemplate = (t) => {
    setTemplate(t);
    if (t !== "A5") setOrientation("portrait");
    setViewZoom(t === "A4" ? 0.55 : t === "A5" ? 0.72 : 1);
    setPan({ x: 0, y: 0 });
    setPrintPage(1);
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setViewZoom((prev) => Math.min(2, Math.max(0.2, prev + (e.deltaY > 0 ? -0.07 : 0.07))));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  };

  const resetView = () => {
    setViewZoom(template === "A4" ? 0.55 : template === "A5" ? 0.72 : 1);
    setPan({ x: 0, y: 0 });
  };

  const renderDoc = (pageOverride) => {
    if (renderContent) {
      return renderContent({ ...combinedSettings, currentPage: pageOverride ?? printPage, onPageCount: handlePageCount });
    }
    if (activeTemplate === "58mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "58mm" }} scope={docType} />;
    if (activeTemplate === "80mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "80mm" }} scope={docType} />;
    if (activeTemplate === "A5")   return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A5" orientation={orientation} scope={docType} />;
    return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A4" scope={docType} />;
  };

  // Page-clipped preview: render the document ONCE, clip to current page
  // (same approach as WhatsAppSendModal's PageView).
  const smartPreviewContent = useMemo(() => {
    if (!hasSmartBreaks || smartPages <= 1) return null;
    const dims = pageDimensions(activeTemplate, orientation);
    const pageHFull = dims.hMm;
    const i = Math.min(printPage - 1, smartPages - 1);
    const prevBreak = i <= 0 ? 0 : smartBreaksMm[i - 1];
    const nextBreak = smartBreaksMm[i] || pageHFull * 1.5;
    const clipHmm = nextBreak - prevBreak;
    return (
      <div style={{ height: `${clipHmm}mm`, overflow: "hidden", position: "relative", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid #cbd5e1", borderRadius: "1mm" }}>
        <div style={{ position: "absolute", top: `${-prevBreak}mm`, left: 0, width: "100%" }}>
          {renderDoc()}
        </div>
      </div>
    );
  }, [hasSmartBreaks, smartPages, smartBreaksMm, printPage, activeTemplate, orientation, renderDoc]);

  const handlePrint = () => {
    const pageSizeStr = printPageSizeStr(activeTemplate, orientation);

    // After printing, run save callback if provided (creation mode)
    const afterPrint = onConfirmPrint
      ? () => { onConfirmPrint(template); onClose(); }
      : undefined;

    // Give React TWO frames to flush layout effects + DOM commit before capturing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sourceNode = printAllRef.current;
        if (!sourceNode) {
          const singleNode = printContentRef.current;
          const html = singleNode ? singleNode.innerHTML : "";
          buildIframeAndPrint(html, pageSizeStr, afterPrint);
          return;
        }

        const isPage = activeTemplate === "A4" || activeTemplate === "A5";
        if (!isPage) {
          // Thermal: continuous roll, no pagination.
          buildIframeAndPrint(sourceNode.innerHTML, pageSizeStr, afterPrint);
          return;
        }

        const pageW = pageWidthStr(activeTemplate, orientation);
        const pageHmm = pageDimensions(activeTemplate, orientation).hMm;
        const pageHpx = pageHmm * PX_PER_MM;
        // Fixed-size page container. clip-path AND overflow:hidden — print
        // engines are inconsistent about honoring either alone. When `inner`
        // is offset content, position:relative+top keeps it in flow so the
        // container has height while the clip shows exactly one page.
        const wrapPage = (inner, isLast, offsetMm = 0, sliceHMm = pageHmm) =>
          `<div style="width:${pageW};height:${pageHmm}mm;position:relative;overflow:hidden;clip-path:inset(0 0 0 0);${isLast ? "" : "page-break-after:always;break-after:page;"}">`
          + `<div style="width:${pageW};height:${sliceHMm}mm;overflow:hidden;position:relative;clip-path:inset(0 0 0 0);">`
          + (offsetMm ? `<div style="position:relative;top:-${offsetMm}mm;width:${pageW};">${inner}</div>` : inner)
          + `</div>`
          + `</div>`;

        // Self-paginating report docs render one node per page in the hidden
        // container. When every page fits the paper, print them as INDEPENDENT
        // fixed-height sheets — offset-slicing the concatenated blob (the old
        // path) accumulated drift and cut rows at every sheet boundary.
        const pageNodes = sourceNode.querySelectorAll(":scope > [data-print-page]");
        if (pageNodes.length > 1) {
          const allFit = Array.from(pageNodes).every((p) => p.scrollHeight <= pageHpx * 1.05);
          if (allFit) {
            let pagedHtml = "";
            pageNodes.forEach((p, i) => { pagedHtml += wrapPage(p.innerHTML, i === pageNodes.length - 1); });
            buildIframeAndPrint(pagedHtml, pageSizeStr, afterPrint);
            return;
          }
        }

        // Flow documents (invoices, statements, single-page reports): slice at
        // block/row boundaries measured FRESH from the exact DOM being
        // captured — never at blind fixed-height intervals, which cut blocks
        // and tables mid-way and printed phantom empty pages.
        const pageHtmls = getPagedDocumentHtml(sourceNode, pageHmm, PX_PER_MM);
        if (!pageHtmls.length) {
          const wrapSingle = `<div style="width:${pageW};height:${pageHmm}mm;position:relative;overflow:hidden;">${sourceNode.firstElementChild?.outerHTML || sourceNode.innerHTML}</div>`;
          buildIframeAndPrint(wrapSingle, pageSizeStr, afterPrint);
          return;
        }
        let pagedHtml = "";
        pageHtmls.forEach((html, idx) => {
          const isLast = idx === pageHtmls.length - 1;
          pagedHtml += `<div style="width:${pageW};height:${pageHmm}mm;position:relative;overflow:hidden;${isLast ? "" : "page-break-after:always;break-after:page;"}">${html}</div>`;
        });
        buildIframeAndPrint(pagedHtml, pageSizeStr, afterPrint);
      });
    });
  };

  const FALLBACK_REASON_LABELS = {
    no_printer_mapped: "لم يتم تعيين طابعة لهذا المقاس — سيُفتح مربع حوار الطباعة",
    measure_failed: "تعذّر قياس ارتفاع الإيصال — سيُفتح مربع حوار الطباعة",
    print_failed: "فشلت الطباعة الصامتة — سيُفتح مربع حوار الطباعة",
  };

  // "نسخة" reprint stamp (per-doc opt-in): injected into the print HTML only,
  // so originals and the on-screen preview stay clean. Roll gets a bordered
  // line up top; page gets a corner badge (WatermarkBlock covers full-page
  // watermarking separately).
  const stampEnabled = (() => {
    const v = combinedSettings.reprint_stamp;
    return !(v === undefined || v === null || v === false || v === 0 || v === "0" || v === "false" || v === "");
  })();
  const docId = invoice?.invoice_number || invoice?.doc_number || invoice?.number || invoice?.id || "";

  function withReprintStamp(contentHtml) {
    if (!stampEnabled || !hasPrintedBefore(docType, docId)) return contentHtml;
    const stamp = isThermal
      ? `<div style="text-align:center;font-weight:900;font-size:13px;border:1px solid #000;margin:1mm auto 2mm;padding:0.5mm 4mm;width:fit-content;">نسخة — إعادة طباعة</div>`
      : `<div style="position:absolute;top:4mm;left:6mm;transform:rotate(-8deg);border:2px solid #b91c1c;color:#b91c1c;font-weight:900;font-size:16px;padding:1mm 4mm;opacity:0.85;">نسخة</div>`;
    return stamp + contentHtml;
  }

  async function buildIframeAndPrint(contentHtml, pageSizeStr, afterPrint) {
    const result = await printContent({
      contentHtml: withReprintStamp(contentHtml),
      pageSizeStr,
      deviceName: await getPrinterForPageSizeAsync(pageSizeStr),
      copies: Math.max(1, Number(combinedSettings.print_copies) || 1),
      title: operationLabel || "طباعة",
      afterPrint,
      docType: docType || "",
      docLabel: operationLabel || "",
      docId,
      printFont: combinedSettings.print_font || "",
    });
    // Tell the user WHY the dialog opened instead of the fast silent path —
    // silent-silent fallbacks made real print problems undiagnosable.
    if (result.mode === "dialog" && isElectronPrint() && result.reason && result.reason !== "not_electron") {
      const isRoll = activeTemplate === "58mm" || activeTemplate === "80mm";
      const base = FALLBACK_REASON_LABELS[result.reason] || FALLBACK_REASON_LABELS.print_failed;
      const rollHint = isRoll ? " — تأكد إن مقاس الورق مضبوط على " + activeTemplate : "";
      toast(base + rollHint, { icon: "🖨️", duration: isRoll ? 6000 : 4000 });
    }
  }

  // "طباعة فورية" per-doc mode (settings hub): skip the preview step entirely —
  // once the doc design is loaded and rendered, fire the same print action the
  // user would click, exactly once per open. Report docs keep the preview
  // (their column choices are print-time decisions).
  const instantMode = (docSettings.print_mode || "preview") === "instant";
  useEffect(() => {
    if (!open || !docType || isReportDoc || !instantMode || !docSettingsLoaded) return;
    if (studioOpen || instantFired.current) return;
    // Page docs must wait for the pagination measurement — firing on a blind
    // timer raced the measurement debounce and printed fixed-height cuts.
    if (!isThermal && !measuredOnce) return;
    instantFired.current = true;
    // Creation mode closes via afterPrint (save callback); view mode closes on
    // a delay so the print capture (rAF + async job) finishes first.
    const t = setTimeout(() => { handlePrint(); }, 450);
    const closeT = !onConfirmPrint ? setTimeout(() => onClose(), 2000) : null;
    return () => { clearTimeout(t); if (closeT) clearTimeout(closeT); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docType, isReportDoc, instantMode, docSettingsLoaded, studioOpen, isThermal, measuredOnce]);

  return (
    <>
      {/* Hidden container — rendered at true paper width so block heights match print */}
      <div ref={printAllRef} style={{
        position: "fixed", left: "-9999px", top: 0,
        visibility: "hidden", pointerEvents: "none",
        width: isThermal ? activeTemplate : pageWidthStr(activeTemplate, orientation),
      }}>
        {renderContent && totalPrintPages > 0
          ? Array.from({ length: totalPrintPages }).map((_, i) => (
              <div key={i} data-print-page={i + 1} style={{ pageBreakAfter: i < totalPrintPages - 1 ? "always" : undefined }}>
                {renderContent({ ...combinedSettings, currentPage: i + 1, onPageCount: handlePageCount })}
              </div>
            ))
          : renderDoc()}
      </div>

      <div className="hidden print:flex w-full justify-center">
        <div className="w-full">{renderDoc()}</div>
      </div>

      <Modal open={open} onClose={onClose} onDetach={handleDetach} title="إعدادات ومعاينة الطباعة" maxWidth="max-w-6xl">
        <div
          className="flex flex-col gap-4 mt-2"
          style={{ height: "calc(100vh - 140px)", minHeight: "450px" }}
        >
          {/* Main area: preview + sidebar with all controls */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Preview viewport */}
            <div
              ref={viewportRef}
              className="flex-1 bg-[var(--bg-overlay)] rounded-[12px] border border-[var(--border-normal)] shadow-inner relative overflow-hidden"
              style={{ cursor: "grab" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${viewZoom})`,
                  transformOrigin: "center center",
                  transition: isDragging.current ? "none" : "transform 0.05s",
                  userSelect: "none",
                  pointerEvents: isDragging.current ? "none" : "auto",
                  background: isPageDoc ? "transparent" : "white",
                  boxShadow: isPageDoc ? "none" : "0 10px 30px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  ref={printContentRef}
                  style={{
                    width: activeTemplate === "58mm" ? "58mm"
                         : activeTemplate === "80mm" ? "80mm"
                         : pageWidthStr(activeTemplate, orientation),
                  }}
                >
                  {smartPreviewContent ? smartPreviewContent : (
                    isPageDoc ? (
                      <div style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid #cbd5e1", borderRadius: "1mm" }}>
                        {renderDoc()}
                      </div>
                    ) : renderDoc()
                  )}
                </div>
              </div>

              {/* Zoom controls */}
              <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-[10px] bg-[var(--bg-surface)]/90 border border-[var(--border-normal)] shadow-md backdrop-blur-sm overflow-hidden z-50">
                <button type="button" onClick={() => setViewZoom((v) => Math.min(2, v + 0.1))}
                  className="px-2.5 py-1.5 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] transition-colors border-l border-[var(--border-normal)]">+</button>
                <button type="button" onClick={resetView}
                  className="px-2.5 py-1.5 text-[9px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] min-w-[40px] text-center">{Math.round(viewZoom * 100)}%</button>
                <button type="button" onClick={() => setViewZoom((v) => Math.max(0.2, v - 0.1))}
                  className="px-2.5 py-1.5 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] transition-colors border-r border-[var(--border-normal)]">−</button>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none z-50">
                عجلة الفأرة للتكبير • اسحب للتنقل
              </div>

              {/* Page indicator overlay — always visible */}
              <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-[10px] bg-[var(--bg-surface)]/90 border border-[var(--border-normal)] shadow-md backdrop-blur-sm px-2 py-1 z-50" dir="ltr">
                <button onClick={() => goToPage(1)} disabled={printPage <= 1 || displayTotalPages <= 1}
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors">
                  <SkipBack size={12} />
                </button>
                <button onClick={() => goToPage(printPage - 1)} disabled={printPage <= 1}
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors">
                  <ChevronRight size={14} />
                </button>
                <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums min-w-[44px] text-center mx-1">
                  {formatNumber(printPage, { decimals: 0 })} / {formatNumber(displayTotalPages, { decimals: 0 })}
                </span>
                <button onClick={() => goToPage(printPage + 1)} disabled={printPage >= displayTotalPages}
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => goToPage(displayTotalPages)} disabled={printPage >= displayTotalPages}
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 transition-colors">
                  <SkipForward size={12} />
                </button>
              </div>
            </div>

            {/* Right sidebar: all controls under print button */}
            <div className="w-[240px] flex flex-col gap-3 shrink-0">
              {/* Action buttons: 2-choice in creation mode, single in view-only mode */}
              {onSaveOnly ? (
                <div className="flex flex-col gap-2" onKeyDown={handleActionKeyDown}>
                  <button
                    ref={printBtnRef}
                    onClick={handlePrint}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-[12px] text-sm font-black transition-all shadow-[0_4px_12px_rgba(5,150,105,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-4 focus:ring-emerald-400/50 focus:ring-offset-2"
                  >
                    <Printer size={16} /> حفظ وطباعة
                  </button>
                  <button
                    ref={saveOnlyBtnRef}
                    onClick={() => { onSaveOnly(); onClose(); }}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] text-[var(--text-secondary)] py-3 rounded-[12px] text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-4 focus:ring-[var(--border-strong)]/50 focus:ring-offset-2"
                  >
                    {isSaving ? "جاري الحفظ..." : "حفظ بدون طباعة"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-[12px] text-sm font-black transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)] active:scale-95"
                >
                  <Printer size={16} /> طباعة
                </button>
              )}

              {onSendWhatsApp && (
                <button
                  onClick={() => { onClose(); onSendWhatsApp(); }}
                  className="w-full flex items-center justify-center gap-2 rounded-[12px] border border-success-border bg-success-bg px-3 py-3 text-sm font-black text-success-text transition-all hover:bg-success-bg/80 active:scale-95"
                >
                  <WhatsAppIcon size={16} /> {t("print.sendWhatsApp")}
                </button>
              )}

              {/* Template selector */}
              <div className="bg-[var(--bg-surface)] rounded-[12px] border border-[var(--border-normal)] p-3 space-y-2">
                <h4 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-widest">قالب الطباعة</h4>
                <div className="grid grid-cols-2 gap-2">
                  {validTemplates.map((t) => {
                    const isDefault = cfg ? (resolveDocPaperSize(docType, docSettings) === t.id) : false;
                    const active = template === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => switchTemplate(t.id)}
                        className={`relative flex flex-col items-center gap-1 rounded-sm border py-3 transition-all ${
                          active
                            ? "border-primary bg-primary shadow-lg scale-[1.02]"
                            : "border-[var(--border-normal)] bg-[var(--bg-input)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)]"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-white" : "text-[var(--text-muted)]"}`} />
                        <div className="text-center">
                          <div className={`text-2sm font-black tracking-widest leading-none ${active ? "text-white" : "text-[var(--text-primary)]"}`}>{t.label}</div>
                          <div className={`text-[9px] font-bold mt-0.5 ${active ? "text-white/70" : "text-[var(--text-muted)]"}`}>{t.sub}</div>
                        </div>
                        {isDefault && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--success-text)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orientation toggle — A5 only */}
              {activeTemplate === "A5" && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => setOrientation("portrait")}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-all ${orientation === "portrait" ? "border-primary bg-primary text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                    طولي
                  </button>
                  <button type="button" onClick={() => setOrientation("landscape")}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-all ${orientation === "landscape" ? "border-primary bg-primary text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
                    عرضي
                  </button>
                </div>
              )}

              {hasSmartBreaks && smartPages > 1 && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                  <span>عدد الصفحات: {smartPages}</span>
                </div>
              )}

              {/* Design lives in ONE place — the Studio. The modal only prints. */}
              {docType && (
                <button type="button" onClick={() => setStudioOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-2.5 text-[11px] font-black text-primary hover:opacity-80 transition-all">
                  <Maximize2 size={13} /> تحرير التصميم في الاستوديو
                </button>
              )}

              {/* Column controls for report docs */}
              {isReportDoc && reportColumns.length > 0 && (
                <div className="bg-[var(--bg-surface)] rounded-[12px] border border-[var(--border-normal)] p-3 space-y-2 flex-1 overflow-y-auto min-h-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-widest">الأعمدة</h4>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setReportPrintKeys(smartKeys("essential"))}
                        className="px-2 py-1 rounded-[6px] bg-slate-900 text-[9px] font-bold text-white flex items-center gap-1">
                        <Wand2 size={10} /> أساسي
                      </button>
                      <button type="button" onClick={() => setReportPrintKeys(smartKeys("useful"))}
                        className="px-2 py-1 rounded-[6px] border border-[var(--border-normal)] bg-[var(--bg-input)] text-[9px] font-bold text-[var(--text-secondary)]">
                        مهم
                      </button>
                    </div>
                  </div>

                  {/* Fit indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          reportFitTone === "green" ? "bg-success-text" :
                          reportFitTone === "amber" ? "bg-[var(--warning-text)]" : "bg-danger"
                        }`}
                        style={{ width: `${Math.min(100, Math.round((reportFitScore / (reportCapacity || 1)) * 100))}%` }}
                      />
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                        reportFitTone === "green" ? "bg-success-bg text-success-text" :
                        reportFitTone === "amber" ? "bg-[var(--warning-bg)] text-[var(--warning-text)]" :
                        "bg-danger-bg text-danger-text"
                      }`}
                    >
                      {reportFitTone === "green" ? "مناسب" : reportFitTone === "amber" ? "مزدحم" : "ضيق"}
                    </span>
                  </div>

                  {/* Column toggles + width cycling */}
                  <div className="space-y-0.5 max-h-[240px] overflow-y-auto scrollbar-thin">
                    {reportColumns.map((col) => {
                      const key = col.key || col.id;
                      const active = reportPrintKeys.includes(key);
                      const weight = columnWeights[key];
                      const weightPresets = [undefined, 0.5, 1, 2, 3];
                      const nextWeight = () => {
                        const idx = weightPresets.indexOf(weight);
                        const next = weightPresets[(idx + 1) % weightPresets.length];
                        setColumnWeights((prev) => {
                          const updated = { ...prev };
                          if (next === undefined) delete updated[key];
                          else updated[key] = next;
                          return updated;
                        });
                      };
                      const weightLabel = weight == null ? "تلقائي" : weight.toFixed(1);
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                            active
                              ? "bg-success-bg text-success-text border border-success-border"
                              : "text-[var(--text-secondary)] border border-transparent"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setReportPrintKeys((keys) =>
                              active ? keys.filter((k) => k !== key) : [...keys, key]
                            )}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-right"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-success-text" : "bg-[var(--border-strong)]"}`} />
                            <span className="truncate">{col.label || col.header}</span>
                          </button>
                          {active && (
                            <button
                              type="button"
                              onClick={nextWeight}
                              className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold border transition-all hover:bg-[var(--bg-input-hover)] ${
                                weight != null
                                  ? "bg-info-bg border-info-border text-info-text"
                                  : "bg-[var(--bg-input)] border-[var(--border-normal)] text-[var(--text-muted)]"
                              }`}
                              title="اضغط لتغيير العرض"
                            >
                              {weightLabel}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Reset widths */}
                  {Object.keys(columnWeights).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setColumnWeights({})}
                      className="w-full text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1"
                    >
                      إعادة ضبط العرض التلقائي
                    </button>
                  )}
                </div>
              )}

              {/* Excel + Close */}
              {onExportAllColumns && (
                <button type="button" onClick={onExportAllColumns}
                  className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-success-border bg-success-bg px-3 py-2.5 text-[11px] font-bold text-success-text hover:bg-success-light transition-all">
                  <FileSpreadsheet size={13} /> إكسيل للكل
                </button>
              )}
              <button onClick={onClose}
                className="btn-danger w-full flex justify-center gap-2 py-2.5 rounded-[10px] text-2sm font-bold transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>

          {/* Bottom bar: page navigation + thumbnails */}
          {displayTotalPages > 1 && (
            <div className="flex items-center gap-3 shrink-0 bg-[var(--bg-surface)] rounded-[12px] border border-[var(--border-normal)] p-2">
              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={printPage <= 1}
                  className="p-1.5 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input-hover)] disabled:opacity-30">
                  <SkipBack size={14} />
                </button>
                <button onClick={() => goToPage(printPage - 1)} disabled={printPage <= 1}
                  className="p-1.5 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input-hover)] disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
                <div className="flex items-center gap-1 mx-2">
                  <input
                    type="number"
                    value={printPage}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= displayTotalPages) goToPage(v);
                    }}
                    className="w-10 h-8 text-center rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] text-2sm font-bold"
                    min={1}
                    max={displayTotalPages}
                  />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">/ {formatNumber(displayTotalPages, { decimals: 0 })}</span>
                </div>
                <button onClick={() => goToPage(printPage + 1)} disabled={printPage >= displayTotalPages}
                  className="p-1.5 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input-hover)] disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => goToPage(displayTotalPages)} disabled={printPage >= displayTotalPages}
                  className="p-1.5 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] hover:bg-[var(--bg-input-hover)] disabled:opacity-30">
                  <SkipForward size={14} />
                </button>
              </div>

              {/* Thumbnails strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto flex-1 px-2" style={{ scrollbarWidth: "thin" }}>
                {Array.from({ length: displayTotalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === printPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`relative shrink-0 flex items-center justify-center rounded-md border transition-all ${
                        isActive
                          ? "bg-info-bg border-info-border text-info-text shadow-sm"
                          : "bg-[var(--bg-surface)] border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)]"
                      }`}
                      style={{ width: 36, height: 48 }}
                      title={`صفحة ${pageNum}`}
                    >
                      <div className="flex flex-col items-center">
                        <Image size={14} />
                        <span className="text-[8px] font-bold mt-0.5">{pageNum}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {studioOpen && docType && (
        <PrintStudio
          open={studioOpen}
          onClose={reloadAfterStudio}
          initialScope={isReportDoc ? "reports_generic" : docType}
          initialSize={activeTemplate}
          initialOrientation={orientation}
        />
      )}
    </>
  );
}
