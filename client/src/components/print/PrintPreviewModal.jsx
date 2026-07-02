import React, { useEffect, useRef, useState, useCallback } from "react";
import Modal from "../ui/Modal";
import { PrintThermalDoc, PrintA4Doc } from "./PrintDoc";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet,
  Printer, Wand2, SkipBack, SkipForward, Image, Receipt, FileText, FileBarChart2, Maximize2,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { printContent, getPrinterForPageSize, getPrinterSizeMap, isElectronPrint } from "../../services/printService";
import { withCalibration } from "../../services/printCalibration";
import { DOC_PAPER_CONFIG, resolveDocPaperSize } from "../../pages/settings/PrintingSettingsPanel";
import PrintDesigner from "./designer/PrintDesigner";
import { familyForSize } from "./layout/layoutModel";
import { formatNumber } from "../../utils/currency";
import { useDetach } from "../../hooks/useDetach";

const ALL_TEMPLATES = [
  { id: "58mm", label: "58mm", sub: "رول صغير",   icon: Receipt       },
  { id: "80mm", label: "80mm", sub: "رول قياسي",  icon: Receipt       },
  { id: "A5",   label: "A5",   sub: "نصف صفحة",   icon: FileText      },
  { id: "A4",   label: "A4",   sub: "ورقة كاملة", icon: FileBarChart2 },
];

const INVOICE_COLUMNS = [
  { key: "code",  label: "الكود",       type: "code",  printPriority: "useful"   },
  { key: "name",  label: "المنتج",      type: "text",  printPriority: "essential"},
  { key: "unit",  label: "الوحدة",      type: "text",  printPriority: "optional" },
  { key: "qty",   label: "الكمية",      type: "qty",   printPriority: "essential"},
  { key: "price", label: "السعر",       type: "money", printPriority: "essential"},
  { key: "discount", label: "الخصم",    type: "money", printPriority: "optional" },
  { key: "total", label: "الإجمالي",    type: "money", printPriority: "essential"},
];

const MAX_COLUMNS = { "58mm": 3, "80mm": 4, "A5": 5, "A4": 7 };

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
  children,
}) {
  const { handleDetach } = useDetach("print-preview", {
    onClose, getState: () => ({ invoice, settings: globalSettings, operationLabel, docType, reportColumns, totalRows }), actions: { confirmPrint: () => onConfirmPrint?.(), saveOnly: () => onSaveOnly?.(), exportAllColumns: () => onExportAllColumns?.() },
  });
  const [template, setTemplate] = useState(null);
  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docSettings, setDocSettings] = useState({});
  const [fetchedGlobalSettings, setFetchedGlobalSettings] = useState({});
  const [reportPrintKeys, setReportPrintKeys] = useState([]);
  const [printPage, setPrintPage] = useState(1);
  const [totalPrintPages, setTotalPrintPages] = useState(1);
  const [columnWeights, setColumnWeights] = useState({});
  const [invoicePrintKeys, setInvoicePrintKeys] = useState([]);
  const [editingColIdx, setEditingColIdx] = useState(null);
  const [designerOpen, setDesignerOpen] = useState(false);

  const saveDesigner = async (next) => {
    setDocSettings(next);
    try { await api.put(`/api/print-settings-per-doc/${docType}`, next); } catch { /* keep local edits */ }
  };

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
      return;
    }
    let cancelled = false;
    api.get(`/api/print-settings-per-doc/${docType}`)
      .then((r) => {
        if (!cancelled) {
          const saved = r.data.data || {};
          setDocSettings(saved);
          const resolved = resolveDocPaperSize(docType, saved);
          setTemplate(resolved);
          setViewZoom(resolved === "A4" ? 0.55 : resolved === "A5" ? 0.72 : 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocSettings({});
          setTemplate(cfg ? cfg.defaultSize : "A4");
        }
      });
    api.get("/api/settings").then((r) => {
      if (!cancelled && r.data?.data) setFetchedGlobalSettings(r.data.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [docType, open]);

  useEffect(() => {
    if (!docType && open && template === null) {
      setTemplate("A4");
    }
  }, [docType, open]);

  const activeTemplate = template || (cfg ? cfg.defaultSize : "A4");
  const isThermal = activeTemplate === "58mm" || activeTemplate === "80mm";

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

  const invoiceMax = MAX_COLUMNS[activeTemplate] || 5;
  const smartInvoiceKeys = useCallback(() => {
    const priority = ["essential", "useful", "optional"];
    const selected = [];
    for (const p of priority) {
      for (const col of INVOICE_COLUMNS) {
        if (col.printPriority === p && !selected.includes(col.key)) {
          if (selected.length < invoiceMax) selected.push(col.key);
        }
      }
    }
    return selected.length ? selected : INVOICE_COLUMNS.slice(0, invoiceMax).map(c => c.key);
  }, [invoiceMax]);

  useEffect(() => {
    if (!open || isReportDoc || !docType) return;
    setInvoicePrintKeys((current) => {
      const valid = new Set(INVOICE_COLUMNS.map(c => c.key));
      const next = current.filter(k => valid.has(k));
      return next.length ? next : smartInvoiceKeys();
    });
  }, [open, isReportDoc, docType, smartInvoiceKeys]);

  const moveToIdx = useCallback((key, target, keys, setter) => {
    const currentIdx = keys.indexOf(key);
    if (currentIdx === -1 || target < 0 || target >= keys.length || target === currentIdx) return;
    const next = [...keys];
    next.splice(currentIdx, 1);
    next.splice(target, 0, key);
    setter(next);
  }, []);

  const hiddenReportColumns = isReportDoc
    ? reportColumns.filter((c) => !reportPrintKeys.includes(c.key || c.id))
    : [];
  const reportFitScore = isReportDoc
    ? reportColumns.filter((c) => reportPrintKeys.includes(c.key || c.id)).reduce((sum, col) => sum + scoreColumn(col), 0)
    : 0;
  const reportCapacity = getCapacity(activeTemplate, false);
  const reportFitTone = reportFitScore <= reportCapacity ? "green"
    : reportFitScore <= reportCapacity + 1.5 ? "amber" : "red";

  const combinedSettingsBase = {
    ...(fetchedGlobalSettings || {}),
    ...(globalSettings || {}),
    ...docSettings,
    ...(operationLabel ? { receipt_footer: operationLabel } : {}),
    ...(isReportDoc ? {
      report_print_column_keys: reportPrintKeys,
      report_print_hidden_columns: hiddenReportColumns,
      report_print_landscape: false,
      orientation: "portrait",
      report_total_rows: totalRows,
      template: activeTemplate,
      columnWeights: Object.keys(columnWeights).length > 0 ? columnWeights : undefined,
    } : {}),
    ...(!isReportDoc && !isThermal && invoicePrintKeys.length > 0 ? {
      invoice_print_column_keys: invoicePrintKeys,
    } : {}),
  };

  // Inject the mapped printer's calibration (printable band + shift) so the
  // preview shows exactly the geometry that will hit the paper.
  const mappedPrinter = getPrinterSizeMap()[activeTemplate] || "";
  const combinedSettings = isThermal
    ? withCalibration(combinedSettingsBase, mappedPrinter, activeTemplate)
    : combinedSettingsBase;

  // Page navigation
  const handlePageCount = useCallback((count) => {
    setTotalPrintPages(count);
    if (printPage > count) setPrintPage(Math.max(1, count));
  }, [printPage]);

  const goToPage = (p) => {
    setPrintPage(Math.max(1, Math.min(p, totalPrintPages)));
    setPan({ x: 0, y: 0 });
  };

  const switchTemplate = (t) => {
    setTemplate(t);
    setViewZoom(t === "A4" ? 0.55 : t === "A5" ? 0.72 : 1);
    setPan({ x: 0, y: 0 });
    setPrintPage(1);
    if (t === "58mm" || t === "80mm") setInvoicePrintKeys([]);
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

  const renderDoc = () => {
    if (renderContent) {
      return renderContent({ ...combinedSettings, currentPage: printPage, onPageCount: handlePageCount });
    }
    if (activeTemplate === "58mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "58mm" }} />;
    if (activeTemplate === "80mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "80mm" }} />;
    if (activeTemplate === "A5")   return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A5" />;
    return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A4" />;
  };

  const handlePrint = () => {
    const pageSizeStr =
      activeTemplate === "58mm" ? "58mm auto"
        : activeTemplate === "80mm" ? "80mm auto"
        : activeTemplate === "A5" ? "148mm 210mm"
        : "210mm 297mm";

    // After printing, run save callback if provided (creation mode)
    const afterPrint = onConfirmPrint
      ? () => { onConfirmPrint(template); onClose(); }
      : undefined;

    // Give React one frame to flush layout effects before capturing
    requestAnimationFrame(() => {
      const sourceNode = printAllRef.current;
      if (!sourceNode) {
        const singleNode = printContentRef.current;
        const html = singleNode ? singleNode.innerHTML : "";
        buildIframeAndPrint(html, pageSizeStr, afterPrint);
        return;
      }
      const rawHtml = sourceNode.innerHTML;
      buildIframeAndPrint(rawHtml, pageSizeStr, afterPrint);
    });
  };

  const FALLBACK_REASON_LABELS = {
    no_printer_mapped: "لم يتم تعيين طابعة لهذا المقاس — سيُفتح مربع حوار الطباعة",
    measure_failed: "تعذّر قياس ارتفاع الإيصال — سيُفتح مربع حوار الطباعة",
    print_failed: "فشلت الطباعة الصامتة — سيُفتح مربع حوار الطباعة",
  };

  async function buildIframeAndPrint(contentHtml, pageSizeStr, afterPrint) {
    const result = await printContent({
      contentHtml,
      pageSizeStr,
      deviceName: getPrinterForPageSize(pageSizeStr),
      title: operationLabel || "طباعة",
      afterPrint,
      docType: docType || "",
      docLabel: operationLabel || "",
    });
    // Tell the user WHY the dialog opened instead of the fast silent path —
    // silent-silent fallbacks made real print problems undiagnosable.
    if (result.mode === "dialog" && isElectronPrint() && result.reason && result.reason !== "not_electron") {
      toast(FALLBACK_REASON_LABELS[result.reason] || FALLBACK_REASON_LABELS.print_failed, { icon: "🖨️" });
    }
  }

  return (
    <>
      {/* Hidden container — all pages rendered via React for measurement only */}
      <div ref={printAllRef} style={{ position: "fixed", left: "-9999px", top: 0, visibility: "hidden", pointerEvents: "none" }}>
        {renderContent && totalPrintPages > 0
          ? Array.from({ length: totalPrintPages }).map((_, i) => (
              <div key={i} style={{ pageBreakAfter: i < totalPrintPages - 1 ? "always" : undefined }}>
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
              className="flex-1 bg-[var(--bg-overlay)] rounded-[12px] border border-slate-200/60 shadow-inner relative overflow-hidden"
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
                  background: "white",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  ref={printContentRef}
                  style={{
                    width: activeTemplate === "58mm" ? "58mm"
                         : activeTemplate === "80mm" ? "80mm"
                         : activeTemplate === "A5"   ? "148mm"
                         : "210mm",
                  }}
                >
                  {renderDoc()}
                </div>
              </div>

              {/* Zoom controls */}
              <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-[10px] bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm overflow-hidden z-50">
                <button type="button" onClick={() => setViewZoom((v) => Math.min(2, v + 0.1))}
                  className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors border-l border-slate-200">+</button>
                <button type="button" onClick={resetView}
                  className="px-2.5 py-1.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 min-w-[40px] text-center">{Math.round(viewZoom * 100)}%</button>
                <button type="button" onClick={() => setViewZoom((v) => Math.max(0.2, v - 0.1))}
                  className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors border-r border-slate-200">−</button>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none z-50">
                عجلة الفأرة للتكبير • اسحب للتنقل
              </div>

              {/* Page indicator overlay — always visible */}
              <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-[10px] bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm px-2 py-1 z-50" dir="ltr">
                <button onClick={() => goToPage(1)} disabled={printPage <= 1}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-25 transition-colors">
                  <SkipBack size={12} />
                </button>
                <button onClick={() => goToPage(printPage - 1)} disabled={printPage <= 1}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-25 transition-colors">
                  <ChevronRight size={14} />
                </button>
                <span className="text-[11px] font-bold text-slate-700 tabular-nums min-w-[44px] text-center mx-1">
                  {formatNumber(printPage, { decimals: 0 })} / {formatNumber(totalPrintPages, { decimals: 0 })}
                </span>
                <button onClick={() => goToPage(printPage + 1)} disabled={printPage >= totalPrintPages}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-25 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => goToPage(totalPrintPages)} disabled={printPage >= totalPrintPages}
                  className="p-1 rounded text-slate-500 hover:text-slate-900 disabled:opacity-25 transition-colors">
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
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-[12px] text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-4 focus:ring-slate-400/50 focus:ring-offset-2"
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

              {/* Template selector */}
              <div className="bg-white rounded-[12px] border border-slate-200 p-3 space-y-2">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">قالب الطباعة</h4>
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
                            : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                        <div className="text-center">
                          <div className={`text-2sm font-black tracking-widest leading-none ${active ? "text-white" : "text-slate-800"}`}>{t.label}</div>
                          <div className={`text-[9px] font-bold mt-0.5 ${active ? "text-slate-300" : "text-slate-400"}`}>{t.sub}</div>
                        </div>
                        {isDefault && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column controls for invoice docs (A4/A5 only — thermal has no meaningful columns) */}
              {!isReportDoc && docType && !isThermal && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-3 space-y-2 flex-1 overflow-y-auto min-h-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الأعمدة</h4>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold text-slate-400">{invoicePrintKeys.length}/{invoiceMax}</span>
                      <button type="button" onClick={() => setInvoicePrintKeys(smartInvoiceKeys())}
                        className="px-2 py-1 rounded-[6px] bg-slate-900 text-[9px] font-bold text-white flex items-center gap-1">
                        <Wand2 size={10} /> تلقائي
                      </button>
                    </div>
                  </div>
                  <div className="space-y-0.5 max-h-[180px] overflow-y-auto scrollbar-thin">
                    {/* Active columns in order */}
                    {invoicePrintKeys.map((key, idx) => {
                      const col = INVOICE_COLUMNS.find(c => c.key === key);
                      if (!col) return null;
                      return (
                        <div key={key}
                          className="flex items-center gap-0.5 px-2 py-1 rounded-[6px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-all"
                        >
                          <button type="button" onClick={() => {
                            const next = [...invoicePrintKeys];
                            if (idx > 0) { [next[idx-1], next[idx]] = [next[idx], next[idx-1]]; setInvoicePrintKeys(next); }
                          }} disabled={idx === 0}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-default"
                          ><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7"/></svg></button>
                          <button type="button" onClick={() => {
                            const next = [...invoicePrintKeys];
                            if (idx < next.length - 1) { [next[idx], next[idx+1]] = [next[idx+1], next[idx]]; setInvoicePrintKeys(next); }
                          }} disabled={idx >= invoicePrintKeys.length - 1}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-default"
                          ><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg></button>
                          {editingColIdx === idx ? (
                            <input type="number" min={1} max={invoicePrintKeys.length} autoFocus
                              defaultValue={idx + 1}
                              onBlur={(e) => { setEditingColIdx(null); moveToIdx(key, Number(e.target.value) - 1, invoicePrintKeys, setInvoicePrintKeys); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.target.blur(); }
                                if (e.key === "Escape") { setEditingColIdx(null); }
                              }}
                              className="w-9 h-5 rounded border border-emerald-400 bg-white text-[10px] font-black text-emerald-800 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          ) : (
                            <button type="button" onClick={() => setEditingColIdx(idx)}
                              className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-200 text-[10px] font-black text-emerald-800 shrink-0 hover:bg-emerald-300 hover:ring-2 hover:ring-emerald-400/40 cursor-pointer"
                              title="اضغط لتغيير الترتيب"
                            >{idx + 1}</button>
                          )}
                          <button type="button" onClick={() => setInvoicePrintKeys(keys => keys.filter(k => k !== key))}
                            className="flex items-center gap-1 flex-1 min-w-0 text-right"
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                            <span className="truncate">{col.label}</span>
                          </button>
                          <span className="text-[8px] font-bold text-indigo-400">
                            {col.printPriority === "essential" ? "أساسي" : col.printPriority === "useful" ? "مفيد" : "اختياري"}
                          </span>
                        </div>
                      );
                    })}
                    {/* Inactive columns */}
                    {INVOICE_COLUMNS.filter(c => !invoicePrintKeys.includes(c.key)).map(col => {
                      const atMax = invoicePrintKeys.length >= invoiceMax;
                      return (
                        <div key={col.key}
                          className={`flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                            atMax ? "text-slate-300 border border-transparent" : "text-slate-500 border border-transparent hover:border-slate-200"
                          }`}
                        >
                          <button type="button" onClick={() => { if (!atMax) setInvoicePrintKeys(keys => [...keys, col.key]); }}
                            disabled={atMax}
                            className={`flex items-center gap-1.5 flex-1 min-w-0 text-right ${atMax ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300" />
                            <span className="truncate">{col.label}</span>
                          </button>
                          <span className={`text-[8px] font-bold px-1 ${
                            col.printPriority === "essential" ? "text-indigo-300" : col.printPriority === "useful" ? "text-slate-300" : "text-slate-200"
                          }`}>
                            {col.printPriority === "essential" ? "أساسي" : col.printPriority === "useful" ? "مفيد" : "اختياري"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Advanced designer launcher (invoice-style docs only) */}
              {docType && !isReportDoc && (
                <button type="button" onClick={() => setDesignerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3 py-2.5 text-[11px] font-black text-slate-700 hover:border-slate-500 hover:bg-slate-50 transition-all">
                  <Maximize2 size={13} /> المحرر المتقدم
                </button>
              )}

              {/* Column controls for report docs */}
              {isReportDoc && reportColumns.length > 0 && (
                <div className="bg-white rounded-[12px] border border-slate-200 p-3 space-y-2 flex-1 overflow-y-auto min-h-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الأعمدة</h4>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setReportPrintKeys(smartKeys("essential"))}
                        className="px-2 py-1 rounded-[6px] bg-slate-900 text-[9px] font-bold text-white flex items-center gap-1">
                        <Wand2 size={10} /> أساسي
                      </button>
                      <button type="button" onClick={() => setReportPrintKeys(smartKeys("useful"))}
                        className="px-2 py-1 rounded-[6px] border border-slate-200 bg-slate-50 text-[9px] font-bold text-slate-600">
                        مهم
                      </button>
                    </div>
                  </div>

                  {/* Fit indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          reportFitTone === "green" ? "bg-emerald-500" :
                          reportFitTone === "amber" ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.round((reportFitScore / (reportCapacity || 1)) * 100))}%` }}
                      />
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                        reportFitTone === "green" ? "bg-emerald-50 text-emerald-700" :
                        reportFitTone === "amber" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
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
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "text-slate-500 border border-transparent"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setReportPrintKeys((keys) =>
                              active ? keys.filter((k) => k !== key) : [...keys, key]
                            )}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-right"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className="truncate">{col.label || col.header}</span>
                          </button>
                          {active && (
                            <button
                              type="button"
                              onClick={nextWeight}
                              className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold border transition-all hover:bg-slate-100 ${
                                weight != null
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                  : "bg-slate-50 border-slate-200 text-slate-400"
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
                      className="w-full text-[9px] font-bold text-slate-400 hover:text-slate-700 transition-colors py-1"
                    >
                      إعادة ضبط العرض التلقائي
                    </button>
                  )}
                </div>
              )}

              {/* Excel + Close */}
              {onExportAllColumns && (
                <button type="button" onClick={onExportAllColumns}
                  className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition-all">
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
          {totalPrintPages > 1 && (
            <div className="flex items-center gap-3 shrink-0 bg-white rounded-[12px] border border-slate-200 p-2">
              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={printPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                  <SkipBack size={14} />
                </button>
                <button onClick={() => goToPage(printPage - 1)} disabled={printPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
                <div className="flex items-center gap-1 mx-2">
                  <input
                    type="number"
                    value={printPage}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= totalPrintPages) goToPage(v);
                    }}
                    className="w-10 h-8 text-center rounded-lg border border-slate-200 bg-white text-2sm font-bold"
                    min={1}
                    max={totalPrintPages}
                  />
                  <span className="text-[11px] font-bold text-slate-500">/ {formatNumber(totalPrintPages, { decimals: 0 })}</span>
                </div>
                <button onClick={() => goToPage(printPage + 1)} disabled={printPage >= totalPrintPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => goToPage(totalPrintPages)} disabled={printPage >= totalPrintPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                  <SkipForward size={14} />
                </button>
              </div>

              {/* Thumbnails strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto flex-1 px-2" style={{ scrollbarWidth: "thin" }}>
                {Array.from({ length: totalPrintPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === printPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`relative shrink-0 flex items-center justify-center rounded-md border transition-all ${
                        isActive
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
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

      {designerOpen && docType && !isReportDoc && (
        <PrintDesigner
          open={designerOpen}
          docType={docType}
          label={operationLabel || docType}
          initialFamily={familyForSize(activeTemplate)}
          globalSettings={{ ...(fetchedGlobalSettings || {}), ...(globalSettings || {}) }}
          value={docSettings}
          onChange={setDocSettings}
          onSave={saveDesigner}
          onClose={() => setDesignerOpen(false)}
        />
      )}
    </>
  );
}
