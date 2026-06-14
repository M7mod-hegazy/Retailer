import React, { useEffect, useRef, useState, useCallback } from "react";
import Modal from "../ui/Modal";
import { PrintThermalDoc, PrintA4Doc } from "./PrintDoc";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet,
  Printer, Wand2, SkipBack, SkipForward, Image, Receipt, FileText, FileBarChart2, Maximize2,
} from "lucide-react";
import api from "../../services/api";
import { printContent, getPrinterForPageSize } from "../../services/printService";
import { DOC_PAPER_CONFIG, resolveDocPaperSize } from "../../pages/settings/PrintingSettingsPanel";
import PrintDesigner from "./designer/PrintDesigner";
import { familyForSize } from "./layout/layoutModel";

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
  children,
}) {
  const [template, setTemplate] = useState(null);
  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docSettings, setDocSettings] = useState({});
  const [fetchedGlobalSettings, setFetchedGlobalSettings] = useState({});
  const [reportPrintKeys, setReportPrintKeys] = useState([]);
  const [printPage, setPrintPage] = useState(1);
  const [totalPrintPages, setTotalPrintPages] = useState(1);
  const [columnWeights, setColumnWeights] = useState({});
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

  const combinedSettings = {
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
  };

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

  function buildIframeAndPrint(contentHtml, pageSizeStr, afterPrint) {
    printContent({
      contentHtml,
      pageSizeStr,
      deviceName: getPrinterForPageSize(pageSizeStr),
      title: operationLabel || "طباعة",
      afterPrint,
    });
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

      <Modal open={open} onClose={onClose} title="إعدادات ومعاينة الطباعة" maxWidth="max-w-6xl">
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
                  {printPage.toLocaleString("en-US")} / {totalPrintPages.toLocaleString("en-US")}
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
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handlePrint}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-[12px] text-sm font-black transition-all shadow-[0_4px_12px_rgba(5,150,105,0.25)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={16} /> حفظ وطباعة
                  </button>
                  <button
                    onClick={() => { onSaveOnly(); onClose(); }}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 rounded-[12px] text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full flex justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-[10px] text-2sm font-bold transition-all active:scale-95">
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
                    className="w-10 h-8 text-center rounded-lg border border-slate-200 text-2sm font-bold"
                    min={1}
                    max={totalPrintPages}
                  />
                  <span className="text-[11px] font-bold text-slate-500">/ {totalPrintPages.toLocaleString("en-US")}</span>
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
