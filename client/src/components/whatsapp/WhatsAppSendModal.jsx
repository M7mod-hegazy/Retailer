import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Send, AlertCircle, RefreshCw, Check, Wifi, WifiOff, Smartphone, Image as ImageIcon, Download, ZoomIn, ZoomOut, Maximize, XCircle, MessageSquare, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { buildWhatsAppReceiptMessage } from "../../utils/whatsappReceiptMessage";
import { rawE164ToLocal, localPhoneToE164, COUNTRIES, COUNTRY_MAP, DEFAULT_COUNTRY } from "../../utils/countryCodes";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import { usePrintSettingsForDoc } from "../../hooks/usePrintSettingsForDoc";
import { PrintThermalDoc, PrintA4Doc } from "../print/PrintDoc";
import { SHEET_W, familyOfSize, PAGE_W_MM, PAGE_H_MM, findNaturalBreaks, PX_PER_MM } from "../print/studio/studioData";
import { withCalibration } from "../../services/printCalibration";
import { getPrinterSizeMap } from "../../services/printService";
import html2canvas from "html2canvas";

function PhoneValidationIndicator({ checking, exists }) {
  const { t } = useTranslation();
  if (checking) {
    return (
      <p className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-text-muted">
        <RefreshCw className="h-3 w-3 animate-spin" /> {t("whatsapp.checking") || "جاري التحقق..."}
      </p>
    );
  }
  if (exists === true) {
    return (
      <p className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-success-text">
        <Check className="h-3 w-3" /> {t("whatsapp.existsOnWhatsApp") || "موجود على واتساب"}
      </p>
    );
  }
  if (exists === false) {
    return (
      <p className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-danger">
        <XCircle className="h-3 w-3" /> {t("whatsapp.notOnWhatsApp") || "غير موجود على واتساب"}
      </p>
    );
  }
  return null;
}

/** Compact searchable country-dial-code picker */
function CountryPicker({ value, onChange, compactMode = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className="flex items-center gap-1 rounded-lg rounded-e-none border border-e-0 border-border-normal bg-bg-input px-2.5 py-2.5 text-xs font-bold transition-colors hover:bg-bg-surface focus:border-primary outline-none h-full"
        dir="ltr"
        title={`${value.flag} +${value.dial}`}
      >
        <span className="text-base leading-none">{value.flag}</span>
        {!compactMode && <span className="text-text-secondary">+{value.dial}</span>}
        <ChevronDown className={`h-3 w-3 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>


      {open && (
        <div className="absolute top-full start-0 z-50 mt-1 w-64 rounded-xl border border-border-normal bg-bg-surface shadow-modal overflow-hidden" dir="rtl">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن دولة..."
              className="flex-1 bg-transparent text-xs font-bold text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          {/* List */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[11px] font-bold text-text-muted text-center">لا توجد نتائج</li>
            )}
            {filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors hover:bg-bg-overlay ${
                    c.code === value.code ? "bg-primary/10 text-primary" : "text-text-primary"
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 text-right">{c.name}</span>
                  <span className="font-mono text-text-muted">+{c.dial}</span>
                  {c.code === value.code && <Check className="h-3 w-3 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Phone input: CountryPicker | +dial static badge | local number input
 * The user types only the local number (e.g. 01032440775 for Egypt).
 * Country picker changes the country without touching the number.
 */
function PhoneInputField({ country, value, onChange, onCountryChange }) {
  // Build placeholder: hasLeadingZero → "01XXXXXXXXX", else → "XXXXXXXXX"
  const placeholder = country.hasLeadingZero
    ? "0" + "X".repeat(country.localLen)
    : "X".repeat(country.localLen);

  return (
    <div className="flex" dir="ltr">
      {/* Country picker — flag + chevron only, no dial code shown here */}
      <CountryPicker value={country} onChange={onCountryChange} compactMode />
      {/* Static +dial badge */}
      <span className="flex items-center px-2 border border-x-0 border-border-normal bg-bg-input text-xs font-bold font-mono text-text-muted select-none whitespace-nowrap">
        +{country.dial}
      </span>
      {/* Local number input */}
      <input
        dir="ltr"
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          // Only allow digits and leading zeros — strip non-digits except we preserve what's typed
          const raw = e.target.value.replace(/[^\d]/g, "");
          onChange(raw);
        }}
        placeholder={placeholder}
        maxLength={country.localLen + (country.hasLeadingZero ? 1 : 0) + 1} // +1 tolerance
        className="flex-1 min-w-0 rounded-lg rounded-s-none border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold font-mono outline-none focus:border-primary focus:bg-bg-surface transition-colors placeholder:text-text-muted"
      />
    </div>
  );
}

/**
 * Shows digit-count progress (e.g. "8 / 10 أرقام") and WhatsApp existence status.
 * Replaces PhoneValidationIndicator with richer context.
 */
function PhoneProgressRow({ localPhone, country, checking, exists, showExists }) {
  const { t } = useTranslation();
  // Count actual local digits typed (strip leading zero for counting if hasLeadingZero)
  const digits = localPhone ? localPhone.replace(/\D/g, "") : "";
  const localDigits = (country.hasLeadingZero && digits.startsWith("0")) ? digits.slice(1).length : digits.length;
  const expected = country.localLen; // without leading zero
  const isComplete = localDigits >= expected;

  if (!localPhone) return null;

  return (
    <div className="flex items-center gap-2 mt-1">
      {/* Digit progress pill */}
      {!isComplete && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-text-muted">
          <span className="inline-flex items-center justify-center rounded-full bg-bg-overlay px-1.5 py-0.5 font-mono text-[10px] font-black text-text-secondary">
            {localDigits}/{expected}
          </span>
          {`${expected - localDigits} رقم متبقي`}
        </span>
      )}
      {/* WhatsApp existence check */}
      {isComplete && showExists && <PhoneValidationIndicator checking={checking} exists={exists} />}
      {/* Complete + no WA check */}
      {isComplete && !showExists && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-success-text">
          <Check className="h-3 w-3" /> {t("whatsapp.validNumber") || "رقم صحيح"}
        </span>
      )}
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

const KIND_DOC_TYPE = {
  receipt: "pos_receipt",
  return_receipt: "sales_return",
  purchase_receipt: "purchase_order",
  purchase_return_receipt: "purchase_return",
  transfer_send: "branch_transfer",
  transfer_receive: "branch_transfer",
};

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
  const invoice_no = invoice?.invoice_no || invoice?.doc_no || invoice?.reference_no || invoice?.id;
  const payments = normalizePayments(invoice?.payments);
  if (kind === "return_receipt" || kind === "purchase_return_receipt") {
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
  const [localPhone, setLocalPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  // fullPhone: E.164 digits derived from localPhone + selectedCountry (used for all API calls / sending)
  const fullPhone = useMemo(() => localPhoneToE164(localPhone, selectedCountry), [localPhone, selectedCountry]);
  const [shopName, setShopName] = useState("");
  const [sendMode, setSendMode] = useState("text");
  const [waExists, setWaExists] = useState(null); // null = unknown, true = exists, false = not found
  const [waChecking, setWaChecking] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [sendChannel, setSendChannel] = useState("whatsapp"); // "whatsapp" | "sms"
  const existsCacheRef = useRef(new Map());
  const existsTimerRef = useRef(null);
  const captureRef = useRef(null);

  const docType = KIND_DOC_TYPE[kind] || null;
  const showImageOption = Boolean(docType);
  const { loading: printSettingsLoading, template: printTemplate, settings: printSettings } = usePrintSettingsForDoc(docType);
  const [activePaperSize, setActivePaperSize] = useState(printTemplate || "80mm");
  const isThermalSize = activePaperSize === "58mm" || activePaperSize === "80mm";
  const effectiveSettings = useMemo(() => {
    if (!isThermalSize) return printSettings;
    const mappedPrinter = getPrinterSizeMap()[activePaperSize] || "";
    return withCalibration(printSettings, mappedPrinter, activePaperSize);
  }, [printSettings, activePaperSize, isThermalSize]);
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

  const customerName = invoice?.customer_name || invoice?.supplier_name || invoice?.partner_branch || invoice?.walk_in_name || "";
  const rawPhone = invoice?.customer_phone || invoice?.supplier_phone || invoice?.walk_in_phone || "";
  const invoiceItems = invoice?.lines || invoice?.items || [];

  useEffect(() => {
    if (open) {
      // Show local display format (e.g. "01032440775" for Egypt) in the input
      setLocalPhone(rawE164ToLocal(rawPhone, selectedCountry));
      setSendMode("text");
      setActivePaperSize(printTemplate || "80mm");
      setWaExists(null);
      setWaChecking(false);
      setSendChannel("whatsapp");
      if (existsTimerRef.current) clearTimeout(existsTimerRef.current);
    }
  }, [open, rawPhone, printTemplate]); // intentionally exclude selectedCountry

  // Force text mode when SMS channel is selected (SMS does not support images)
  useEffect(() => {
    if (sendChannel === "sms" && sendMode === "image") setSendMode("text");
  }, [sendChannel, sendMode]);

  // Debounced WhatsApp existence check (skip for SMS channel)
  useEffect(() => {
    if (!open || sendChannel === "sms" || !wa.isConnected) { setWaExists(null); setWaChecking(false); return; }
    const digits = fullPhone;
    // Need full E.164 length to check
    const expectedLen = selectedCountry.dial.length + selectedCountry.localLen;
    if (digits.length < expectedLen) { setWaExists(null); return; }
    if (existsCacheRef.current.has(digits)) {
      setWaExists(existsCacheRef.current.get(digits));
      setWaChecking(false);
      return;
    }
    setWaChecking(true);
    setWaExists(null);
    if (existsTimerRef.current) clearTimeout(existsTimerRef.current);
    existsTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post("/api/whatsapp/check-exists", { phone: digits });
        const exists = res.data?.data?.exists ?? false;
        existsCacheRef.current.set(digits, exists);
        setWaExists(exists);
      } catch {
        setWaExists(null);
      } finally { setWaChecking(false); }
    }, 800);
    return () => { if (existsTimerRef.current) clearTimeout(existsTimerRef.current); };
  }, [fullPhone, open, wa.isConnected, sendChannel, selectedCountry]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get("/api/whatsapp/templates").catch(() => ({ data: { data: [] } })),
      api.get("/api/whatsapp/crm/template-variants").catch(() => ({ data: { data: [] } })),
      api.get("/api/settings").catch(() => ({ data: { data: {} } })),
      api.get("/api/whatsapp/sms-status").catch(() => ({ data: { data: { enabled: false } } })),
    ]).then(([templatesRes, variantsRes, settingsRes, smsStatusRes]) => {
      const rows = templatesRes.data?.data || [];
      const matched = rows.find((x) => x.kind === kind) || rows.find((x) => x.kind === "receipt");
      setTemplate(matched?.body || "");

      const allVariants = variantsRes.data?.data || [];
      setVariants(allVariants.filter(v => v.category === kind));

      setShopName(settingsRes.data?.data?.company_name || "");
      // Load default country from settings, then re-normalize rawPhone with the correct local format
      const defaultCountryCode = settingsRes.data?.data?.whatsapp_default_country;
      const resolvedCountry = (defaultCountryCode && COUNTRY_MAP[defaultCountryCode])
        ? COUNTRY_MAP[defaultCountryCode]
        : DEFAULT_COUNTRY;
      setSelectedCountry(resolvedCountry);
      // Re-derive local display now that we have the true default country
      if (rawPhone) {
        setLocalPhone(rawE164ToLocal(rawPhone, resolvedCountry));
      }
      setSmsEnabled(Boolean(smsStatusRes.data?.data?.enabled));
    }).catch(() => {
      setTemplate("");
      setVariants([]);
      setShopName("");
      setSmsEnabled(false);
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
    const no = invoice?.invoice_no || invoice?.doc_no || invoice?.reference_no || invoice?.id || "";
    const total = invoice?.total ?? "";
    if (kind === "return_receipt" || kind === "purchase_return_receipt")
      return t("whatsapp.imageCaptionReturn", { no, total });
    if (kind === "purchase_receipt")
      return t("whatsapp.imageCaptionPurchase", { no, total });
    if (kind === "transfer_send" || kind === "transfer_receive")
      return t("whatsapp.imageCaptionTransfer", { no, total });
    return t("whatsapp.imageCaptionReceipt", { no, total });
  }, [invoice, kind, t]);

  const printInvoice = useMemo(() => normalizeInvoice(invoice, kind), [invoice, kind]);

  const waMeUrl = useMemo(() => {
    if (!fullPhone || !message) return "";
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  }, [fullPhone, message]);

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

  // Wheel = zoom in/out — attached via ref with { passive: false } so preventDefault works
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setViewZoom(prev => {
        const cur = prev === ZOOM_FIT ? fitScale : prev;
        return clampZoom(cur + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitScale]);

  async function handleSend() {
    if (!localPhone) { toast.error(t("whatsapp.noPhone")); return; }
    const digits = fullPhone;
    const minLen = selectedCountry.dial.length + selectedCountry.localLen - 1; // -1 for tolerance
    if (digits.length < minLen) { toast.error(t("whatsapp.invalidPhone") || "رقم الهاتف غير صالح"); return; }

    if (sendChannel === "whatsapp") {
      if (!wa.isConnected) { toast.error(t("whatsapp.notConnected") || "واتساب غير متصل — تأكد من الاتصال أولاً"); return; }
      if (waExists === false) { toast.error(t("whatsapp.notOnWhatsApp") || "الرقم غير موجود على واتساب"); return; }
    }

    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    setSending(true);
    try {
      if (sendChannel === "sms") {
        if (sendMode === "image") { toast.error(t("whatsapp.smsNoImage") || "لا يمكن إرسال صورة عبر SMS"); return; }
        await api.post("/api/whatsapp/send-sms-direct", { recipient_phone: fullPhone, text: message });
        toast.success(t("whatsapp.sentSuccessfully") || "تم الإرسال بنجاح");
        onClose?.();
        return;
      }

      let payload;
      if (sendMode === "image") {
        const el = captureRef.current;
        const canvas = await html2canvas(el, {
          useCORS: true,
          scale: 2,
          backgroundColor: "#ffffff",
          // Prevent scroll-position clipping when the capture element is
          // positioned off-screen at left: -9999px
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          width: el.scrollWidth,
          height: el.scrollHeight,
        });
        payload = { image: canvas.toDataURL("image/png").split(",")[1], caption: imageCaption };
      } else {
        payload = { text: message };
      }

      // Try direct send first (returns only after message is actually delivered)
      try {
        await api.post("/api/whatsapp/send-direct", { recipient_phone: fullPhone, customer_id: invoice?.customer_id || null, kind, payload });
        toast.success(t("whatsapp.sentSuccessfully") || "تم الإرسال بنجاح");
        onClose?.();
        return;
      } catch (directErr) {
        // Fallback: enqueue if direct send fails (e.g. engine busy, timeout)
        if (directErr?.response?.status === 503 || directErr?.code === "ECONNABORTED" || directErr?.message?.includes("timeout")) {
          await api.post("/api/whatsapp/enqueue", { recipient_phone: fullPhone, customer_id: invoice?.customer_id || null, kind, payload });
          toast.success(t("whatsapp.sentQueued") || "تمت الإضافة للقائمة — سيتم الإرسال تلقائياً");
          onClose?.();
          return;
        }
        throw directErr;
      }
    } catch (e) {
      toast.error(e.response?.data?.message || t("whatsapp.sendFailed"));
    } finally { setSending(false); }
  }

  function handleDownloadImage() {
    if (!captureRef.current) return;
    const el = captureRef.current;
    html2canvas(el, {
      useCORS: true,
      scale: 2,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
    }).then((canvas) => {
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
          <p className="text-sm font-black text-text-primary">غير مصرح</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title || t("whatsapp.sendReceipt")} showDetach={false} maxWidth="max-w-lg">
      <div className="space-y-4" dir="rtl" style={{ overscrollBehavior: "contain" }}>
        {/* Channel selector — always visible, clear status per channel */}
        <div className="rounded-xl border border-border-normal bg-bg-surface p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-text-secondary">{t("whatsapp.sendChannel") || "قناة الإرسال"}</p>
            {sendChannel === "whatsapp" ? (
              wa.isConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-success-text">
                  <Wifi className="h-3 w-3" /> {t("whatsapp.connected") || "متصل"}
                </span>
              ) : wa.status === "loading" ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-text-muted">
                  <RefreshCw className="h-3 w-3 animate-spin" /> {t("whatsapp.checking") || "جاري التحقق..."}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-danger">
                  <WifiOff className="h-3 w-3" /> {t("whatsapp.disconnected") || "غير متصل"}
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-success-text">
                <Check className="h-3 w-3" /> {t("whatsapp.smsReady") || "SMS جاهز"}
              </span>
            )}
          </div>

          {smsEnabled ? (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-bg-base border border-border-subtle">
              <button type="button" onClick={() => setSendChannel("whatsapp")}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-black transition-all active:scale-95 ${sendChannel === "whatsapp" ? "bg-bg-surface text-primary shadow-sm border border-border-normal" : "text-text-secondary hover:text-text-primary"}`}>
                <Smartphone className="h-3.5 w-3.5" /> WhatsApp
              </button>
              <button type="button" onClick={() => setSendChannel("sms")}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-black transition-all active:scale-95 ${sendChannel === "sms" ? "bg-bg-surface text-primary shadow-sm border border-border-normal" : "text-text-secondary hover:text-text-primary"}`}>
                <MessageSquare className="h-3.5 w-3.5" /> SMS
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-bg-base border border-border-subtle px-3 py-2.5">
              <Smartphone className="h-4 w-4 text-text-muted" />
              <span className="text-xs font-bold text-text-secondary">WhatsApp</span>
              <span className="mr-auto text-[11px] font-bold text-text-muted">{t("whatsapp.smsDisabledHint") || "تفعيل SMS متاح من الإعدادات"}</span>
            </div>
          )}

          <p className="text-[11px] font-bold text-text-muted leading-relaxed">
            {sendChannel === "whatsapp"
              ? (t("whatsapp.whatsappChannelHint") || "سيتم إرسال الرسالة عبر واتساب — يجب أن يكون لدى العميل حساب واتساب على نفس الرقم.")
              : (t("whatsapp.smsChannelHint") || "سيتم إرسال الرسالة كـ SMS نصي — تصل لأي رقم حتى لو لم يكن لديه واتساب.")}
          </p>
        </div>

        {sendChannel === "whatsapp" && !wa.isConnected && wa.status !== "loading" && wa.status !== "qr" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-warning-text shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-warning-text">{t("whatsapp.waNotConnected") || "واتساب غير متصل حالياً"}</p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">{t("whatsapp.waNotConnectedHint") || "يمكنك نسخ الرسالة أو فتحها في واتساب يدوياً. للإرسال التلقائي، اربط واتساب أولاً من مركز الرسائل."}</p>
            </div>
          </div>
        )}

        {sendChannel === "whatsapp" && wa.status === "qr" && (
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
            {showImageOption && sendChannel !== "sms" && (
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
                    <PhoneInputField
                      country={selectedCountry}
                      value={localPhone}
                      onChange={setLocalPhone}
                      onCountryChange={(c) => { setSelectedCountry(c); setLocalPhone(""); setWaExists(null); }}
                    />
                    <PhoneProgressRow
                      localPhone={localPhone}
                      country={selectedCountry}
                      checking={waChecking}
                      exists={waExists}
                      showExists={sendChannel === "whatsapp"}
                    />
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
                      className="rounded-lg border border-border-normal bg-[#ececec] overflow-hidden select-none touch-none"
                      style={{ height: "420px", cursor: "grab", position: "relative" }}
                    >
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        // Correct order: center first, then pan, then scale.
                        // Combining translate(-50%,-50%) with pan in one calc() causes
                        // the centering offset to scale with zoom — keeping them separate
                        // prevents content drifting off-center when zoomed.
                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom})`,
                        transformOrigin: "center center",
                        userSelect: "none",
                      }}>
                        <div style={{ width: SHEET_W[activePaperSize] || `${parseFloat(activePaperSize) || 80}mm`, background: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.15)", boxSizing: "border-box" }}>
                          {isPageDoc ? (
                            <PageView
                              invoice={printInvoice}
                              settings={effectiveSettings}
                              size={activePaperSize}
                              scope={docType}
                              page={currentPage}
                              breaks={smartBreaksMm}
                              totalPages={totalPages}
                            />
                          ) : (
                            familyOfSize(activePaperSize) === "roll" ? (
                              <PrintThermalDoc invoice={printInvoice} settings={{ ...effectiveSettings, receipt_width: activePaperSize }} scope={docType} />
                            ) : (
                              <PrintA4Doc invoice={printInvoice} settings={effectiveSettings} size={activePaperSize} scope={docType} />
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
                      <PrintA4Doc invoice={printInvoice} settings={effectiveSettings} size={activePaperSize} scope={docType} />
                    </div>
                  </div>

                  {/* Hidden capture target — must be `absolute` not `fixed` so
                      html2canvas doesn't capture other fixed-position UI elements
                      (modal backdrop, sticky header, etc.) in the same layer */}
                  <div style={{ position: "absolute", left: "-9999px", top: 0, zIndex: -2, width: SHEET_W[activePaperSize] || `${parseFloat(activePaperSize) || 80}mm`, background: "#ffffff", overflow: "visible", boxSizing: "border-box" }}>
                    <div ref={captureRef}>
                      {isPageDoc ? (
                        <PrintA4Doc invoice={printInvoice} settings={effectiveSettings} size={activePaperSize} scope={docType} />
                      ) : (
                        <PrintThermalDoc invoice={printInvoice} settings={{ ...effectiveSettings, receipt_width: activePaperSize }} scope={docType} />
                      )}
                    </div>
                  </div>
                </>
              )
            )}

            {sendMode !== "image" && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
                <PhoneInputField
                  country={selectedCountry}
                  value={localPhone}
                  onChange={setLocalPhone}
                  onCountryChange={(c) => { setSelectedCountry(c); setLocalPhone(""); setWaExists(null); }}
                />
                <PhoneProgressRow
                  localPhone={localPhone}
                  country={selectedCountry}
                  checking={waChecking}
                  exists={waExists}
                  showExists={sendChannel === "whatsapp"}
                />
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
                disabled={(() => {
                  if (savingFirst || sending || !localPhone) return true;
                  if (sendMode === "text" ? !message : printSettingsLoading) return true;
                  if (sendChannel === "sms") return sendMode === "image";
                  return !wa.isConnected || waExists === false || waChecking;
                })()}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                title={sendChannel === "whatsapp" ? (!wa.isConnected ? (t("whatsapp.notConnected") || "واتساب غير متصل") : waExists === false ? (t("whatsapp.notOnWhatsApp") || "الرقم غير موجود على واتساب") : undefined) : undefined}>
                {(sending || savingFirst) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {savingFirst ? "جاري الحفظ..." : sending ? t("whatsapp.sending") : sendChannel === "sms" ? (t("whatsapp.sendSms") || "إرسال SMS") : t("whatsapp.send")}
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

            {!localPhone && (
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
