import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Send, AlertCircle, RefreshCw, Check, Wifi, WifiOff, Smartphone, Image as ImageIcon, Download, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { buildWhatsAppReceiptMessage, normalizeEgyptPhone } from "../../utils/whatsappReceiptMessage";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import { usePrintSettingsForDoc } from "../../hooks/usePrintSettingsForDoc";
import { PrintThermalDoc, PrintA4Doc } from "../print/PrintDoc";
import { SHEET_W, familyOfSize, PAGE_W_MM, PAGE_H_MM, findNaturalBreaks, PX_PER_MM } from "../print/studio/studioData";
import html2canvas from "html2canvas";

function ConnectionBadge({ wa }) {
  const { t } = useTranslation();
  if (wa.status === "loading") return null;
  const map = {
    connected: { icon: Wifi, cls: "bg-success-bg border-success-border text-success-text", label: t("whatsapp.connected") || "متصل" },
    qr: { icon: Smartphone, cls: "bg-warning-bg border-warning-border text-warning-text animate-pulse", label: t("whatsapp.waitingScan") || "انتظار المسح" },
    connecting: { icon: RefreshCw, cls: "bg-bg-surface border-border-normal text-text-muted", label: t("whatsapp.connecting") || "جاري الاتصال..." },
    error: { icon: WifiOff, cls: "bg-danger-bg border-danger-border text-danger", label: t("whatsapp.connectFailed") || "خطأ" },
  };
  const fallback = { icon: WifiOff, cls: "bg-bg-surface border-border-normal text-text-muted", label: t("whatsapp.disconnected") || "غير متصل" };
  const { icon: Icon, cls, label } = map[wa.status] || fallback;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${cls}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${wa.status === "connecting" ? "animate-spin" : ""}`} />
      <span>{label}</span>
      {wa.status === "connected" && wa.phone && <span dir="ltr" className="text-[11px] font-mono opacity-70">{wa.phone}</span>}
      {wa.error && <span className="text-[11px] font-bold opacity-70 truncate max-w-[180px]">{wa.error}</span>}
    </div>
  );
}

const ZOOM_STEP = 0.08;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;
const ZOOM_FIT = 0;

function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

const KIND_DOC_TYPE = { receipt: "pos_receipt", return_receipt: "sales_return" };

function normalizePayments(payments) {
  if (typeof payments === 'string') {
    try { payments = JSON.parse(payments); } catch { return []; }
  }
  if (Array.isArray(payments)) return payments;
  if (payments && typeof payments === 'object') return [payments];
  return [];
}

function normalizeInvoice(invoice, kind) {
  const lines = invoice?.lines || invoice?.items || [];
  const invoice_no = invoice?.invoice_no || invoice?.doc_no || invoice?.id;
  const payments = normalizePayments(invoice?.payments);
  if (kind === "return_receipt") {
    return {
      ...invoice,
      invoice_no,
      payments,
      lines: lines.map((l) => ({
        ...l,
        item_name: l.item_name_ar || l.item_name || l.name,
        code: l.item_code || l.code || "",
        discount_amount: 0,
      })),
    };
  }
  return {
    ...invoice,
    invoice_no,
    payments,
    lines: lines.map((l) => ({
      ...l,
      item_name: l.item_name || l.name,
      code: l.item_code || l.code || "",
      discount_amount: l.discount_amount ?? l.discount ?? 0,
    })),
  };
}

function getPaperDimsMm(size) {
  if (size === "58mm" || size === "80mm") return { w: parseFloat(size), h: 0 };
  return { w: PAGE_W_MM[size] || 210, h: PAGE_H_MM[size] || 297 };
}

export default function WhatsAppSendModal({ open, onClose, invoice, kind = "receipt", title, onBeforeSend }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const wa = useWhatsAppStatus(8000);
  const [template, setTemplate] = useState("");
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingFirst, setSavingFirst] = useState(false);
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");
  const [sendMode, setSendMode] = useState("text");
  const captureRef = useRef(null);

  const docType = KIND_DOC_TYPE[kind] || null;
  const showImageOption = Boolean(docType);
  const { loading: printSettingsLoading, template: printTemplate, settings: printSettings } = usePrintSettingsForDoc(docType);
  const [activePaperSize, setActivePaperSize] = useState(printTemplate || "80mm");
  const [viewZoom, setViewZoom] = useState(ZOOM_FIT);
  const viewportRef = useRef(null);
  const isDragging = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [smartBreaksMm, setSmartBreaksMm] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const fullContentRef = useRef(null);
  const isPageDoc = activePaperSize === "A4" || activePaperSize === "A5";
  const totalPages = isPageDoc ? smartBreaksMm.length + 1 : 1;
  const [viewportDims, setViewportDims] = useState({ w: 0, h: 0 });

  const customerName = invoice?.customer_name || invoice?.walk_in_name || "";
  const rawPhone = invoice?.customer_phone || invoice?.walk_in_phone || "";
  const invoiceItems = invoice?.lines || invoice?.items || [];

  useEffect(() => {
    if (open) {
      setPhone(normalizeEgyptPhone(rawPhone));
      setSendMode("text");
      setActivePaperSize(printTemplate || "80mm");
    }
  }, [open, rawPhone, printTemplate]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get("/api/whatsapp/templates").catch(() => ({ data: { data: [] } })),
      api.get("/api/whatsapp/crm/template-variants").catch(() => ({ data: { data: [] } })),
      api.get("/api/settings").catch(() => ({ data: { data: {} } })),
    ]).then(([templatesRes, variantsRes, settingsRes]) => {
      const rows = templatesRes.data?.data || [];
      const matched = rows.find((x) => x.kind === kind) || rows.find((x) => x.kind === "receipt");
      setTemplate(matched?.body || "");

      const allVariants = variantsRes.data?.data || [];
      setVariants(allVariants.filter(v => v.category === kind));

      setShopName(settingsRes.data?.data?.company_name || "");
    }).catch(() => {
      setTemplate("");
      setVariants([]);
      setShopName("");
    }).finally(() => setLoading(false));
  }, [open, kind]);

  const message = useMemo(() => {
    return buildWhatsAppReceiptMessage({
      template,
      customerName,
      walkInName: invoice?.walk_in_name,
      invoiceNo: invoice?.invoice_no || invoice?.doc_no || invoice?.id,
      total: invoice?.total,
      shopName,
      createdAt: invoice?.created_at,
      paymentType: invoice?.payment_type || invoice?.paymentType,
      discount: invoice?.discount,
      itemsCount: invoiceItems.length || invoice?.items_count,
      cashierName: invoice?.created_by_username || invoice?.cashierName || invoice?.cashier,
      items: invoiceItems,
      payments: typeof invoice?.payments === 'string' ? JSON.parse(invoice.payments) : Array.isArray(invoice?.payments) ? invoice.payments : typeof invoice?.payments === 'object' && invoice?.payments !== null ? [invoice.payments] : [],
    });
  }, [template, customerName, invoice, shopName, invoiceItems]);

  const imageCaption = useMemo(() => {
    const no = invoice?.invoice_no || invoice?.doc_no || invoice?.id || "";
    const total = invoice?.total ?? "";
    return kind === "return_receipt"
      ? t("whatsapp.imageCaptionReturn", { no, total })
      : t("whatsapp.imageCaptionReceipt", { no, total });
  }, [invoice, kind, t]);

  const printInvoice = useMemo(() => normalizeInvoice(invoice, kind), [invoice, kind]);

  const waMeUrl = useMemo(() => {
    if (!phone || !message) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [phone, message]);

  const paperDims = useMemo(() => getPaperDimsMm(activePaperSize), [activePaperSize]);

  const resetView = useCallback(() => {
    setViewZoom(ZOOM_FIT);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitScale = useMemo(() => {
    const { w: vw, h: vh } = viewportDims;
    if (!vw || !paperDims.w) return 0.5;
    const wPad = 32;
    const hPad = 48;
    const paperWpx = paperDims.w * PX_PER_MM;
    const ws = (vw - wPad) / paperWpx;
    if (ws <= 0) return 0.5;
    if (!paperDims.h) {
      const fitH = Math.max(vh - hPad, 200);
      const targetHmm = Math.min(200, fitH / PX_PER_MM / ws);
      const hs = fitH / (targetHmm * PX_PER_MM);
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(ws, hs)));
    }
    const paperHpx = paperDims.h * PX_PER_MM;
    const hs = (vh - hPad) / paperHpx;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(ws, hs)));
  }, [viewportDims, paperDims]);

  const effectiveZoom = viewZoom === ZOOM_FIT ? fitScale : viewZoom;

  // Resize observer
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewportDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset pan when zoom/paper/page changes
  useEffect(() => { setPan({ x: 0, y: 0 }); }, [activePaperSize, viewZoom, currentPage]);

  // Measure page breaks
  useEffect(() => {
    if (!open || !isPageDoc || !fullContentRef.current) {
      setSmartBreaksMm([]);
      setCurrentPage(1);
      return;
    }
    const el = fullContentRef.current;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !el) return;
      const breaks = findNaturalBreaks(el, paperDims.h, PX_PER_MM);
      if (!cancelled) {
        setSmartBreaksMm(prev =>
          prev.length === breaks.length && prev.every((v, i) => v === breaks[i]) ? prev : breaks
        );
      }
    };
    const raf = requestAnimationFrame(() => { if (!cancelled) measure(); });
    const timeout = setTimeout(() => { if (!cancelled) measure(); }, 300);
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(timeout); };
  }, [open, isPageDoc, paperDims.h, activePaperSize, printInvoice]);

  // Panning
  const handleMouseDown = useCallback((e) => {
    isDragging.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  }, []);

  // Wheel = zoom in/out, no ctrl needed
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setViewZoom(prev => {
      const cur = prev === ZOOM_FIT ? fitScale : prev;
      return clampZoom(cur + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
    });
  }, [fitScale]);

  async function handleSend() {
    if (!phone) { toast.error(t("whatsapp.noPhone")); return; }
    if (!wa.isConnected) { toast.error(t("whatsapp.notConnected") || "واتساب غير متصل — تأكد من الاتصال أولاً"); return; }
    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    setSending(true);
    try {
      let payload;
      if (sendMode === "image") {
        const canvas = await html2canvas(captureRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        payload = { image: canvas.toDataURL("image/png").split(",")[1], caption: imageCaption };
      } else {
        payload = { text: message };
      }
      await api.post("/api/whatsapp/enqueue", { recipient_phone: phone, customer_id: invoice?.customer_id || null, kind, payload });
      toast.success(t("whatsapp.queued"));
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.message || t("whatsapp.sendFailed"));
    } finally { setSending(false); }
  }

  function handleDownloadImage() {
    if (!captureRef.current) return;
    html2canvas(captureRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" }).then((canvas) => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${invoice?.invoice_no || invoice?.doc_no || invoice?.id || "invoice"}.png`;
      a.click();
    });
  }

  async function handleOpenWhatsApp() {
    if (!waMeUrl) return;
    if (onBeforeSend) { setSavingFirst(true); try { await onBeforeSend(); } catch { setSavingFirst(false); return; } setSavingFirst(false); }
    window.open(waMeUrl, "_blank", "noopener,noreferrer");
    onClose?.();
  }

  async function handleCopy() {
    if (!message) return;
    if (onBeforeSend) { setSavingFirst(true); try { await onBeforeSend(); } catch { setSavingFirst(false); return; } setSavingFirst(false); }
    navigator.clipboard?.writeText(message).then(() => toast.success(t("whatsapp.copied")));
  }

  const hasPermission = !user || user.role === "dev" || user.role === "admin" ||
    (Array.isArray(user.permissions?.whatsapp_receipt) && user.permissions.whatsapp_receipt.includes("send"));

  if (!hasPermission) {
    return (
      <Modal open={open} onClose={onClose} title={title || t("whatsapp.sendReceipt")} showDetach={false}>
        <div className="flex flex-col items-center justify-center py-8 text-center" dir="rtl">
          <AlertCircle className="h-10 w-10 text-danger mb-3" />
          <p className="text-sm font-black text-text-primary">{t("permissions.denied")}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title || t("whatsapp.sendReceipt")} showDetach={false} maxWidth="max-w-lg">
      <div className="space-y-4" dir="rtl" style={{ overscrollBehavior: "contain" }}>
        <ConnectionBadge wa={wa} />

        {!wa.isConnected && wa.status !== "loading" && wa.status !== "qr" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-warning-text shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-warning-text">{t("whatsapp.waNotConnected") || "واتساب غير متصل حالياً"}</p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">{t("whatsapp.waNotConnectedHint") || "يمكنك نسخ الرسالة أو فتحها في واتساب يدوياً. للإرسال التلقائي، اربط واتساب أولاً من مركز الرسائل."}</p>
            </div>
          </div>
        )}

        {wa.status === "qr" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <Smartphone className="h-4 w-4 text-warning-text shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-black text-warning-text">{t("whatsapp.waWaitingScan") || "واتساب في انتظار مسح QR"}</p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">{t("whatsapp.waWaitingScanHint") || "امسح رمز QR من هاتفك لتفعيل الإرسال التلقائي."}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            {showImageOption && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setSendMode("text")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black border transition-all active:scale-95 ${sendMode === "text" ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"}`}>
                  {t("whatsapp.sendModeText")}
                </button>
                <button type="button" onClick={() => setSendMode("image")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black border transition-all active:scale-95 ${sendMode === "image" ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"}`}>
                  <ImageIcon className="h-3.5 w-3.5" /> {t("whatsapp.sendModeImage")}
                </button>
              </div>
            )}

            {sendMode === "image" && showImageOption && (
              printSettingsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs font-bold text-text-muted">
                  <RefreshCw className="h-4 w-4 animate-spin" /> {t("whatsapp.imagePreparing")}
                </div>
              ) : (
                <>
                  {/* Paper size selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.paperSize")}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {["58mm", "80mm", "A5", "A4"].map((size) => (
                        <button key={size} type="button" onClick={() => { setActivePaperSize(size); resetView(); }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${activePaperSize === size ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"}`}>
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone input — above preview so always visible */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
                    <input dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(normalizeEgyptPhone(e.target.value))}
                      placeholder="2010xxxxxxxx"
                      className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold font-mono outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                  </div>

                  {/* Zoom + page controls row */}
                  <div className="flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setViewZoom(prev => { const c = prev === ZOOM_FIT ? fitScale : prev; return clampZoom(c - ZOOM_STEP); })}
                        className="flex items-center justify-center w-7 h-7 rounded-lg border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base transition-all active:scale-90">
                        <ZoomOut className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={resetView}
                        className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-all active:scale-90 ${viewZoom === ZOOM_FIT ? "bg-primary text-white border-primary" : "border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"}`}>
                        <Maximize className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => setViewZoom(prev => { const c = prev === ZOOM_FIT ? fitScale : prev; return clampZoom(c + ZOOM_STEP); })}
                        className="flex items-center justify-center w-7 h-7 rounded-lg border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base transition-all active:scale-90">
                        <ZoomIn className="h-3 w-3" />
                      </button>
                      <span className="text-[11px] font-bold text-text-muted min-w-[36px]">
                        {viewZoom === ZOOM_FIT ? t("whatsapp.fit") || "ملاءمة" : `${Math.round(effectiveZoom * 100)}%`}
                      </span>
                    </div>
                    {isPageDoc && totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="px-2 py-0.5 rounded text-[11px] font-black border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base disabled:opacity-30 transition-all active:scale-90">◀</button>
                        <span className="text-[11px] font-bold text-text-muted whitespace-nowrap">{currentPage} / {totalPages}</span>
                        <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="px-2 py-0.5 rounded text-[11px] font-black border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base disabled:opacity-30 transition-all active:scale-90">▶</button>
                      </div>
                    )}
                  </div>

                  {/* Viewport — no scroll, centered, pannable */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.imagePreview")}</label>
                    <div
                      ref={viewportRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onWheel={handleWheel}
                      className="rounded-lg border border-border-normal bg-[#ececec] overflow-hidden select-none touch-none"
                      style={{ height: "420px", cursor: "grab", position: "relative" }}
                    >
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${effectiveZoom})`,
                        transformOrigin: "center center",
                        userSelect: "none",
                      }}>
                        <div style={{ width: SHEET_W[activePaperSize], background: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
                          {isPageDoc ? (
                            <PageView
                              invoice={printInvoice}
                              settings={printSettings}
                              size={activePaperSize}
                              scope={docType}
                              page={currentPage}
                              breaks={smartBreaksMm}
                              totalPages={totalPages}
                            />
                          ) : (
                            familyOfSize(activePaperSize) === "roll" ? (
                              <PrintThermalDoc invoice={printInvoice} settings={{ ...printSettings, receipt_width: activePaperSize }} scope={docType} />
                            ) : (
                              <PrintA4Doc invoice={printInvoice} settings={printSettings} size={activePaperSize} scope={docType} />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">{t("whatsapp.zoomHint") || "اسحب للتحريك | العجلة للتكبير"}</p>
                  </div>

                  {/* Hidden full-content for page-break measurement */}
                  <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, width: SHEET_W[activePaperSize], background: "#ffffff" }}>
                    <div ref={fullContentRef}>
                      <PrintA4Doc invoice={printInvoice} settings={printSettings} size={activePaperSize} scope={docType} />
                    </div>
                  </div>

                  {/* Hidden capture target */}
                  <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -2, width: SHEET_W[activePaperSize], background: "#ffffff" }}>
                    <div ref={captureRef}>
                      {isPageDoc ? (
                        <PrintA4Doc invoice={printInvoice} settings={printSettings} size={activePaperSize} scope={docType} />
                      ) : (
                        <PrintThermalDoc invoice={printInvoice} settings={{ ...printSettings, receipt_width: activePaperSize }} scope={docType} />
                      )}
                    </div>
                  </div>
                </>
              )
            )}

            {sendMode !== "image" && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
                <input dir="ltr" type="tel" value={phone} onChange={(e) => setPhone(normalizeEgyptPhone(e.target.value))}
                  placeholder="2010xxxxxxxx"
                  className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold font-mono outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
              </div>
            )}
            {sendMode === "text" && variants.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">اختيار القالب</label>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map(v => (
                    <button key={v.id} onClick={() => setTemplate(v.body)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${template === v.body ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"}`}>
                      {template === v.body && <Check className="inline h-3 w-3 ml-1" />}
                      {v.label || "بدون اسم"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sendMode === "text" && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.preview")}</label>
                <textarea value={message} readOnly rows={7}
                  className="w-full resize-none rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-medium leading-relaxed text-text-primary outline-none" />
              </div>
            )}

            <div className={`grid gap-2 pt-1 ${sendMode === "image" ? "grid-cols-2" : "grid-cols-3"}`}>
              <button onClick={handleSend}
                disabled={savingFirst || sending || !phone || (sendMode === "text" ? !message : printSettingsLoading) || !wa.isConnected}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                title={!wa.isConnected ? (t("whatsapp.notConnected") || "واتساب غير متصل") : undefined}>
                {(sending || savingFirst) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {savingFirst ? "جاري الحفظ..." : sending ? t("whatsapp.sending") : t("whatsapp.send")}
              </button>
              {sendMode === "image" ? (
                <button onClick={handleDownloadImage} disabled={printSettingsLoading}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95">
                  <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("whatsapp.downloadImage")}</span>
                </button>
              ) : (
                <>
                  <button onClick={handleOpenWhatsApp} disabled={savingFirst || !waMeUrl}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                    title={t("whatsapp.openInWhatsApp")}>
                    {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                  <button onClick={handleCopy} disabled={savingFirst || !message}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                    title={t("whatsapp.copyMessage")}>
                    {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{t("whatsapp.copy")}</span>
                  </button>
                </>
              )}
            </div>

            {!phone && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-warning-text">
                <AlertCircle className="h-3.5 w-3.5" /> {t("whatsapp.noPhone")}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function PageView({ invoice, settings, size, scope, page, breaks, totalPages }) {
  const pageHmm = PAGE_H_MM[size] || 297;

  if (totalPages <= 1) {
    return <PrintA4Doc invoice={invoice} settings={settings} size={size} scope={scope} />;
  }

  const prevBreak = page <= 1 ? 0 : breaks[page - 2];
  const nextBreak = breaks[page - 1] || pageHmm * 1.5;
  const clipHmm = nextBreak - prevBreak;

  return (
    <div style={{ height: `${clipHmm}mm`, overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: `${-prevBreak}mm`, left: 0, width: "100%" }}>
        <PrintA4Doc invoice={invoice} settings={settings} size={size} scope={scope} />
      </div>
    </div>
  );
}
