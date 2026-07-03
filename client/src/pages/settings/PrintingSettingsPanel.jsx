import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Ruler, Hash, AlignLeft, Baseline, ListChecks, Eye, Receipt,
  FileBarChart2, ToggleLeft, ToggleRight, Info, Zap, MousePointerClick,
  RefreshCw, FileText
, QrCode, Wrench, Download, Upload, Trash2, CheckCircle2, XCircle, History, ChevronDown, ChevronUp } from "lucide-react";
import { BlockRenderer, CustomTextBlocksSection, getCustomBlocks, saveCustomBlocks } from "./CustomTextBlocks";
import api from "../../services/api";
import toast from "react-hot-toast";
import BankStatementTemplate from "../../components/print/templates/BankStatementTemplate";
import AjalStatementTemplate from "../../components/print/templates/AjalStatementTemplate";
import AjalScheduleTemplate from "../../components/print/templates/AjalScheduleTemplate";
import ChequeRegisterTemplate from "../../components/print/templates/ChequeRegisterTemplate";
import PaymentMethodsReportTemplate from "../../components/print/templates/PaymentMethodsReportTemplate";
import PrintDesigner from "../../components/print/designer/PrintDesigner";
import CalibrationWizard from "../../components/print/calibration/CalibrationWizard";
import { familyForSize } from "../../components/print/layout/layoutModel";
import { PrintThermalDoc, PrintA4Doc } from "../../components/print/PrintDoc";
import { Maximize2, Printer as PrinterIcon } from "lucide-react";
import { listPrinters, isElectronPrint, getPrinterSizeMap, setPrinterSizeMap, getPrintJobLog, clearPrintJobLog } from "../../services/printService";
import { resolveCalibration, exportDeviceProfile, importDeviceProfile } from "../../services/printCalibration";
import { getHint as fmHint } from "../../utils/fieldMeta";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { smartFormat, resolveThermalColumns } from "../../components/print/blocks/blockUtils";

// Mock invoice for the live preview of invoice-style docs — rendered through the
// shared block library so the preview matches print AND the Designer layout.
const PREVIEW_INVOICE = {
  invoice_no: "INV-2025-0001",
  created_at: new Date().toISOString(),
  customer_name: "عميل تجريبي",
  cashier_name: "الكاشير",
  lines: [
    { code: "K-100", item_name: "منتج تجريبي ١", quantity: 2, unit_price: 45 },
    { code: "K-200", item_name: "منتج تجريبي ٢", quantity: 1, unit_price: 120, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقدًا", amount: 200 }],
};

// Renders an invoice-style doc preview via the real print pipeline (LayoutRenderer).
function BlockDocPreview({ merged, previewSize }) {
  if (previewSize === "58mm" || previewSize === "80mm") {
    return <PrintThermalDoc invoice={PREVIEW_INVOICE} settings={{ ...merged, receipt_width: previewSize }} />;
  }
  return <PrintA4Doc invoice={PREVIEW_INVOICE} settings={merged} size={previewSize === "A5" ? "A5" : "A4"} />;
}

// Doc types that print through the shared block library / Designer.
const BLOCK_DOCS = new Set(["pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"]);

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAPER_OPTIONS = [
  { value: "58mm", label: "58mm", sub: "رول حراري صغير",   dims: "58 × ∞ mm",  icon: Receipt       },
  { value: "80mm", label: "80mm", sub: "رول حراري قياسي",  dims: "80 × ∞ mm",  icon: Receipt       },
  { value: "A5",   label: "A5",   sub: "نصف صفحة A4",      dims: "148 × 210mm", icon: FileText      },
  { value: "A4",   label: "A4",   sub: "ورقة كاملة",       dims: "210 × 297mm", icon: FileBarChart2 },
];

// Bundled families ship inside the app and are EMBEDDED into every print job
// (real bold weights — no synthesized bold breaking apart on thermal heads).
// System families rely on Windows fonts and embed nothing.
const FONT_FAMILIES = [
  { value: "Tajawal", label: "Tajawal — موصى به (مضمّن، عربي واضح)" },
  { value: "Cairo", label: "Cairo — مضمّن، عريض للإيصالات" },
  { value: "Noto Sans Arabic", label: "Noto Sans Arabic — مضمّن، تغطية كاملة" },
  { value: "Tahoma", label: "Tahoma — خط النظام" },
  { value: "sans-serif", label: "Arial — حديث"    },
  { value: "serif",      label: "Times — رسمي"    },
  { value: "monospace",  label: "Courier — حرارية" },
];

const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV", purchase_prefix: "PO",
  return_prefix: "RET", work_order_prefix: "WO", receipt_prefix: "REC",
  receipt_header: "أهلاً وسهلاً بكم",
  receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 13, footer_font_size: 11,
  item_font_size: 13, print_font: "Tajawal", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44, qr_alignment: "right", qr_content: "",
  print_area_width: 0, print_shift_x: 0,
  show_cashier_name: true, show_customer_name: true, show_tax: true,
  show_footer: true, show_qr: false, show_logo: true,
  show_discount_line: true, show_payment_details: true, show_subtotal: true,
  show_notes: true,
  show_phone: true, show_address: true, show_tax_id: true,
  address_position: "top",
  show_branch: true, show_invoice_date: true, show_barcode_line: false,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
  address_font_size: 9, address_alignment: "right",
  tax_id_font_size: 9, tax_id_alignment: "right",
};

const DOC_TYPES = [
  { key: "global",                label: "الإعدادات العامة",      icon: "⚙"   },
  { key: "pos_receipt",           label: "إيصال نقطة البيع",      icon: "REC" },
  { key: "sales_invoice",         label: "فاتورة مبيعات",         icon: "INV" },
  { key: "purchase_order",        label: "أمر شراء",              icon: "PO"  },
  { key: "sales_return",          label: "مرتجع مبيعات",         icon: "RET" },
  { key: "purchase_return",       label: "مرتجع مشتريات",        icon: "PRT" },
  { key: "quotation",             label: "عرض سعر",               icon: "Q"   },
  { key: "branch_transfer",       label: "تحويل فرع",             icon: "TR"  },
  { key: "bank_statement",        label: "كشف بنكي",              icon: "BNK" },
  { key: "ajal_statement",        label: "كشف آجل",               icon: "AJL" },
  { key: "ajal_schedule",         label: "جدول أقساط",            icon: "SCH" },
  { key: "ajal_full_statement",   label: "كشف حساب كامل",         icon: "AFL" },
  { key: "cheque_register",       label: "سجل شيكات",             icon: "CHK" },
  { key: "payment_receipt",       label: "إيصال دفع",             icon: "PAY" },
  { key: "daily_treasury",        label: "تقرير الخزينة",         icon: "DT"  },
  { key: "payment_methods_report",label: "تقرير وسائل الدفع",    icon: "PM"  },
  { key: "reports_generic",       label: "قوالب تقارير (عام)",    icon: "REP" },
];

// Valid paper sizes per doc type + system default (user can override)
export const DOC_PAPER_CONFIG = {
  pos_receipt:            { sizes: ["58mm","80mm","A5"],          defaultSize: "80mm" },
  sales_invoice:          { sizes: ["58mm","80mm","A5","A4"],     defaultSize: "A4"   },
  purchase_order:         { sizes: ["80mm","A5","A4"],            defaultSize: "80mm" },
  sales_return:           { sizes: ["58mm","80mm","A5","A4"],     defaultSize: "80mm" },
  purchase_return:        { sizes: ["58mm","80mm","A5","A4"],     defaultSize: "80mm" },
  quotation:              { sizes: ["80mm","A5","A4"],            defaultSize: "A4"   },
  branch_transfer:        { sizes: ["80mm","A5","A4"],            defaultSize: "80mm" },
  bank_statement:         { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  ajal_statement:         { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  ajal_schedule:          { sizes: ["80mm","A5","A4"],            defaultSize: "A4"   },
  ajal_full_statement:    { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  cheque_register:        { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  payment_receipt:        { sizes: ["58mm","80mm","A5"],          defaultSize: "80mm" },
  daily_treasury:         { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  payment_methods_report: { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  reports_generic:        { sizes: ["A5","A4"],                   defaultSize: "A4"   },
};

// Resolve the effective paper size for a docType given saved per-doc settings
export function resolveDocPaperSize(docType, docTypeSettings = {}) {
  const cfg = DOC_PAPER_CONFIG[docType];
  if (!cfg) return "A4";
  if (docTypeSettings.paper_size && docTypeSettings.paper_size !== "inherit") {
    return docTypeSettings.paper_size;
  }
  return cfg.defaultSize;
}

// Fields that have a direct, VISIBLE representation in the preview
const VISUAL_FIELDS = new Set([
  "receipt_header", "receipt_footer", "invoice_prefix", "accent_color",
  "show_logo", "show_branch", "show_address", "show_phone", "show_tax_id",
  "show_invoice_date", "show_customer_name", "show_cashier_name",
  "show_subtotal", "show_discount_line", "show_tax", "show_payment_details",
  "show_notes", "show_footer", "show_qr", "show_barcode_line", "header_section", "show_item_code",
  "address_font_size", "address_alignment", "tax_id_font_size", "tax_id_alignment",
]);

const get = (s, k) => s[k] ?? DEFAULTS[k];

// ─── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, title, hint }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-2.5 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-white">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-800">{title}</div>
        {hint && <div className="text-[11px] font-bold text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

function ControlField({ label, hint, fieldKey, hovered, onHover, onLeave, children, onChange }) {
  const visual = VISUAL_FIELDS.has(fieldKey);
  const isActive = visual && hovered === fieldKey;

  return (
    <div
      data-field-key={fieldKey}
      className={`relative rounded-sm transition-all duration-150 ${isActive ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/60" : ""}`}
      onMouseEnter={() => visual && onHover(fieldKey)}
      onMouseLeave={() => visual && onLeave()}
    >
      {isActive && (
        <div className="absolute -top-2 left-0 z-10 flex items-center gap-1 rounded-sm bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
          <MousePointerClick className="h-2.5 w-2.5" /> يُظهَر في المعاينة
        </div>
      )}
      <label className="block space-y-1.5 text-slate-500 focus-within:text-slate-900 transition-colors px-0.5 pb-0.5 pt-1">
        <span className="flex items-center justify-between gap-1 text-[11px] font-black uppercase tracking-widest">
          <span>{label}</span>
          {hint && (
            <span className="group relative cursor-help">
              <Info className="h-3 w-3 text-slate-300 group-hover:text-slate-600" />
              <div className="absolute left-0 top-5 z-20 hidden w-44 rounded-sm bg-slate-800 p-2 text-[11px] font-bold text-white shadow-xl group-hover:block">{hint}</div>
            </span>
          )}
        </span>
        {children}
      </label>
    </div>
  );
}

function StyledInput({ ...props }) {
  return <input {...props} className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all placeholder:text-slate-300 placeholder:font-normal" />;
}

function StyledSelect({ value, onChange, options }) {
  return (
    <select value={value ?? ""} onChange={onChange} className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all appearance-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Stepper({ value, onChange, min = 0, max = 100, step = 1, unit }) {
  const v = Number(value ?? 0);
  return (
    <div className="flex items-center rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => onChange(Math.max(min, v - step))} className="px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 border-l border-slate-200">−</button>
      <div className="flex-1 text-center text-sm font-black text-slate-800 py-2">{v}{unit && <span className="text-[11px] font-bold text-slate-400 ml-1">{unit}</span>}</div>
      <button type="button" onClick={() => onChange(Math.min(max, v + step))} className="px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100 border-r border-slate-200">+</button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, hint, fieldKey, hovered, onHover, onLeave }) {
  const visual = VISUAL_FIELDS.has(fieldKey);
  const isActive = visual && hovered === fieldKey;
  return (
    <div
      data-field-key={fieldKey}
      onMouseEnter={() => visual && onHover(fieldKey)}
      onMouseLeave={() => visual && onLeave()}
      onClick={() => onChange(!checked)}
      className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-sm border p-3 transition-all ${isActive ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${checked ? "border-primary bg-primary" : "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      <div className="min-w-0">
        <div className={`text-[11px] font-black uppercase tracking-widest truncate ${checked ? "text-white" : "text-slate-800"}`}>{label}</div>
        {hint && <div className={`mt-0.5 text-[11px] font-bold truncate ${checked ? "text-slate-300" : "text-slate-400"}`}>{hint}</div>}
      </div>
      {checked ? <ToggleRight className="h-5 w-5 shrink-0 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 shrink-0 text-slate-300" />}
    </div>
  );
}

function QrPreview({ settings: s, onClick }) {
  const size = get(s, "qr_size");
  const alignment = get(s, "qr_alignment") || "right";
  const customContent = get(s, "qr_content");
  const alignMap = { right: "flex-end", center: "center", left: "flex-start" };
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import("qrcode");
        if (cancelled) return;
        const content = customContent || JSON.stringify({
          seller: get(s, "company_name") || "",
          vat: get(s, "tax_id") || "",
          date: new Date().toISOString(),
          total: 0,
          tax: 0,
        });
        const url = await QRCode.default.toDataURL(content, {
          width: size,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [size, customContent]);

  return (
    <div style={{ display: "flex", justifyContent: alignMap[alignment], marginTop: "8px" }}>
      {dataUrl ? (
        <img src={dataUrl} alt="QR" onClick={onClick} style={{ width: `${size}px`, height: `${size}px`, cursor: "pointer" }} />
      ) : (
        <div onClick={onClick} style={{ width: `${size}px`, height: `${size}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888", cursor: "pointer" }}>QR</div>
      )}
    </div>
  );
}

function PaperPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {PAPER_OPTIONS.map(({ value: v, label, sub, dims, icon: Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1.5 rounded-sm border py-4 transition-all ${value === v ? "border-primary bg-primary shadow-lg scale-[1.02]" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}>
          <Icon className={`h-5 w-5 ${value === v ? "text-white" : "text-slate-400"}`} />
          <div className="text-center">
            <div className={`text-sm font-black tracking-widest leading-none ${value === v ? "text-white" : "text-slate-800"}`}>{label}</div>
            <div className={`text-[9px] font-bold mt-1 ${value === v ? "text-slate-300" : "text-slate-400"}`}>{sub}</div>
            <div className={`text-[9px] font-bold ${value === v ? "text-slate-400" : "text-slate-300"}`}>{dims}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Thermal Columns Section ────────────────────────────────────────────────────

const THERMAL_COLUMNS = [
  { key: "name", label: "المنتج", priority: 0 },
  { key: "unit", label: "الوحدة", priority: 4 },
  { key: "qty", label: "الكمية", priority: 1 },
  { key: "price", label: "السعر", priority: 3 },
  { key: "discount", label: "الخصم", priority: 5 },
  { key: "total", label: "الإجمالي", priority: 2 },
];

const THERMAL_COL_LIMITS = { "58mm": 3, "80mm": 4 };

function ThermalColumnsSection({ settings: s, onChange }) {
  const paperWidth = get(s, "receipt_width");
  const maxCols = THERMAL_COL_LIMITS[paperWidth] || 4;
  const raw = s.thermal_print_column_keys;
  const activeKeys = Array.isArray(raw) && raw.length > 0 ? raw : null;

  const currentKeys = activeKeys || ["name", "qty", "price", "total"];

  const setKeys = (keys) => {
    const trimmed = keys.filter(k => k !== "code");
    onChange("thermal_print_column_keys", trimmed.length > 0 ? trimmed : null);
  };

  const isActive = (key) => currentKeys.includes(key);
  const toggleColumn = (key) => {
    if (isActive(key)) {
      setKeys(currentKeys.filter(k => k !== key));
    } else {
      if (currentKeys.length >= maxCols) {
        const sorted = [...currentKeys, key].sort((a, b) => {
          const pa = THERMAL_COLUMNS.find(c => c.key === a)?.priority ?? 99;
          const pb = THERMAL_COLUMNS.find(c => c.key === b)?.priority ?? 99;
          return pa - pb;
        });
        setKeys(sorted.slice(0, maxCols));
        toast("تم استبدال العميل الأقل أولوية تلقائياً", { icon: "📐", duration: 2000 });
      } else {
        setKeys([...currentKeys, key]);
      }
    }
  };

  const moveUp = (key) => {
    const idx = currentKeys.indexOf(key);
    if (idx <= 0) return;
    const next = [...currentKeys];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setKeys(next);
  };
  const moveDown = (key) => {
    const idx = currentKeys.indexOf(key);
    if (idx === -1 || idx >= currentKeys.length - 1) return;
    const next = [...currentKeys];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setKeys(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[11px] font-bold text-slate-500">
          <span className="text-slate-800 font-black ml-1">{currentKeys.length}</span>
          من <span className="font-black mx-0.5">{maxCols}</span> عمود متاح لـ {paperWidth}
        </span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${currentKeys.length > maxCols ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, (currentKeys.length / maxCols) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {THERMAL_COLUMNS.map((col) => {
          const active = isActive(col.key);
          const atMax = currentKeys.length >= maxCols && !active;
          return (
            <div
              key={col.key}
              className={`flex items-center gap-1.5 rounded-sm border px-3 py-2 transition-all ${
                active
                  ? "border-primary bg-primary/5 border-primary/30"
                  : "border-slate-200 bg-white"
              } ${atMax ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                onClick={() => toggleColumn(col.key)}
                className={`flex items-center gap-2 flex-1 min-w-0 text-right ${
                  active ? "cursor-pointer" : "cursor-pointer"
                }`}
              >
                <div
                  className={`h-4 w-4 shrink-0 rounded-sm border-2 flex items-center justify-center transition-all ${
                    active
                      ? "border-primary bg-primary"
                      : "border-slate-300"
                  }`}
                >
                  {active && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-[11px] font-black ${active ? "text-slate-800" : "text-slate-500"}`}>
                  {col.label}
                </span>
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(col.key)}
                  disabled={!active || currentKeys.indexOf(col.key) === 0}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-all"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(col.key)}
                  disabled={!active || currentKeys.indexOf(col.key) >= currentKeys.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-default transition-all"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Thermal Preview ────────────────────────────────────────────────────────────

const THERMAL_MOCK_LINES = [
  { code: "SKU-001", item_name: "قميص قطني L", quantity: 2, unit_price: 60 },
  { code: "SKU-002", item_name: "بنطلون جينز", quantity: 1, unit_price: 110 },
];

function ThermalPreviewItemsTable({ settings: s, itemFontSize, accent }) {
  const keys = resolveThermalColumns(s);
  const columns = keys.map(k => {
    const headerMap = { name: "الصنف", unit: "الوحدة", qty: "كمية", price: "سعر", discount: "الخصم", total: "إجمالي" };
    return { key: k, label: headerMap[k] || k };
  });
  const displayCols = columns.filter(c => c.key !== "code");

  const mergedName = (line) => {
    const code = line.code || line.sku || "";
    const name = line.item_name || "";
    return code ? `${code} - ${name}` : name;
  };
  const lineTotal = (line) => ((Number(line.unit_price) || 0) * Number(line.quantity));

  if (displayCols.length === 0) return null;

  const cellBorder = "1px solid #d1d5db";

  return (
    <table style={{ width: "100%", fontSize: itemFontSize, borderCollapse: "collapse", fontWeight: 700, border: cellBorder }}>
      <thead>
        <tr style={{ background: "#000" }}>
          {displayCols.map((c, ci) => (
            <th key={c.key} style={{
              textAlign: c.key === "name" ? "right" : "center",
              padding: "3px 5px", fontWeight: 700, color: "#fff",
              fontSize: "10px",
              ...(c.key === "name" ? { width: "60%" } : {}),
              borderBottom: "2px solid #555",
              borderLeft: ci > 0 ? cellBorder : "none",
            }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {THERMAL_MOCK_LINES.map((line, i) => (
          <tr key={i}>
            {displayCols.map((c, ci) => {
              let val;
              switch (c.key) {
                case "name": val = mergedName(line); break;
                case "qty": val = line.quantity; break;
                case "price": val = smartFormat(line.unit_price); break;
                case "total": val = smartFormat(lineTotal(line)); break;
                case "unit": val = "قطعة"; break;
                case "discount": val = "0.00"; break;
                default: val = "";
              }
              return (
                <td key={c.key} style={{
                  textAlign: c.key === "qty" ? "center" : c.key === "total" ? "center" : "right",
                  padding: "3px 5px", fontWeight: 700,
                  ...(c.key === "name" ? { width: "60%", wordBreak: "break-word" } : { whiteSpace: "nowrap" }),
                  borderBottom: cellBorder,
                  borderLeft: ci > 0 ? cellBorder : "none",
                }}>
                  {val}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThermalPreview({ settings: s, hovered, onElementClick, customBlocks = [] }) {
  const currency = get(s, "currency_symbol");
  const taxRate = parseFloat(get(s, "tax_rate") || 0);
  const mockSub = 230, mockDisc = 10;
  const mockTax = get(s, "show_tax") !== false ? (mockSub - mockDisc) * (taxRate / 100) : 0;
  const mockTotal = mockSub - mockDisc + mockTax;
  const accent = get(s, "accent_color");
  const dashed = `1px dashed ${accent}66`;
  const solid = `1px solid ${accent}`;
  const fontFamily = get(s, "print_font");

  const hl = (key) => ({
    outline: VISUAL_FIELDS.has(key) && hovered === key ? "2px solid #f59e0b" : "none",
    outlineOffset: "2px", borderRadius: "1px", cursor: "pointer", transition: "outline 0.1s",
  });

  const paperW = get(s, "receipt_width") === "58mm" ? 58 : 80;
  const w = `${paperW - 2}mm`;
  const addressAtBottom = get(s, "address_position") === "bottom";

  const extraAddresses = (() => { try { return JSON.parse(s.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(s.additional_phones || '[]'); } catch { return []; } })();

  const addrAlignMap = { right: "flex-start", center: "center", left: "flex-end" };

  const AddressBlock = () => {
    const addrs = [s.address, ...extraAddresses];
    const phones = [s.phone, ...extraPhones];
    const addrFlex = addrAlignMap[get(s, "address_alignment")] || "flex-start";
    const taxAlign = get(s, "tax_id_alignment") || "right";
    return (
      <>
        {addrs.map((addr, i) => {
          const phone = phones[i];
          const hasAddr = get(s,"show_address") !== false && addr;
          const hasPhone = get(s,"show_phone") !== false && phone;
          if (!hasAddr && !hasPhone && i > 0) return null;
          if (!hasAddr && !hasPhone) return null;
          return (
            <div key={i} style={{ display: "flex", gap: "8px", justifyContent: addrFlex, ...(i > 0 ? { marginTop: "4px", borderTop: "1px dotted rgba(0,0,0,0.1)", paddingTop: "4px" } : {}) }}>
              {hasAddr && <span style={{ fontSize: `${get(s,"address_font_size")}px`, opacity: 0.6 }}>{addr}</span>}
              {hasPhone && <span style={{ fontSize: `${get(s,"address_font_size")}px` }}>{phone}</span>}
            </div>
        )})}
        {get(s,"show_tax_id")  !== false && <div style={{ fontSize: `${get(s,"tax_id_font_size")}px`, marginTop: "4px", textAlign: taxAlign }}>الرقم الضريبي: {s.tax_id || "310122393500003"}</div>}
      </>
    );
  };

  return (
    <div dir="rtl" style={{ fontFamily, fontSize: `${get(s,"body_font_size")}px`, width: w, margin: "0 auto", padding: "2mm 2mm", color: accent, background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* Header */}
      <div onClick={() => onElementClick("header_section")} style={{ textAlign: get(s,"logo_alignment"), marginBottom: "8px", ...hl("header_section") }}>
        {get(s,"show_logo") !== false && s.logo_url && <img src={resolveImageUrl(s.logo_url)} alt="" style={{ maxHeight: `${get(s,"logo_max_height")}px`, objectFit: "contain", margin: "0 auto 4px" }} />}
        <div style={{ fontSize: `${get(s,"header_font_size")}px`, fontWeight: "900" }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
        {get(s,"show_branch")   !== false && <div style={hl("show_branch")}   onClick={e => { e.stopPropagation(); onElementClick("show_branch"); }}>{s.branch_name || "الفرع الرئيسي"}</div>}
        {!addressAtBottom && <AddressBlock />}
      </div>

      {get(s,"receipt_header") && <div onClick={() => onElementClick("receipt_header")} style={{ textAlign: "center", fontSize: "10px", marginBottom: "4px", fontStyle: "italic", ...hl("receipt_header") }}>{get(s,"receipt_header")}</div>}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <div style={{ borderTop: solid, margin: "5px 0" }} />

      <div style={{ fontSize: `${get(s,"item_font_size")}px`, marginBottom: "5px" }}>
        <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>رقم الفاتورة:</span><span style={{ fontWeight: "bold" }} onClick={() => onElementClick("invoice_prefix")}>{get(s,"invoice_prefix")}-2025-0042</span></div>
        {get(s,"show_invoice_date")   !== false && <div style={{ display: "flex", justifyContent: "space-between" }}><span>التاريخ:</span><span>{new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}</span></div>}
        {get(s,"show_customer_name")  !== false && <div onClick={() => onElementClick("show_customer_name")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_customer_name") }}><span>العميل:</span><span>محمد الهيجازي</span></div>}
        {get(s,"show_cashier_name")   !== false && <div onClick={() => onElementClick("show_cashier_name")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_cashier_name") }}><span>الكاشير:</span><span>أحمد صالح</span></div>}
      </div>
      <BlockRenderer blocks={customBlocks} position="after_meta" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <div style={{ borderTop: solid, margin: "5px 0" }} />
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <ThermalPreviewItemsTable settings={s} itemFontSize={`${get(s,"item_font_size")}px`} accent={accent} />

      <div style={{ borderTop: solid, margin: "5px 0" }} />

      <div style={{ fontSize: `${get(s,"item_font_size")}px` }}>
        {get(s,"show_subtotal")      !== false && <div onClick={() => onElementClick("show_subtotal")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_subtotal") }}><span>الإجمالي الفرعي:</span><span>{currency} {smartFormat(mockSub)}</span></div>}
        {get(s,"show_discount_line") !== false && <div onClick={() => onElementClick("show_discount_line")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_discount_line") }}><span>الخصم:</span><span>- {currency} {smartFormat(mockDisc)}</span></div>}
        {get(s,"show_tax")           !== false && <div onClick={() => onElementClick("show_tax")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_tax") }}><span>ضريبة ({taxRate}%):</span><span>{currency} {smartFormat(mockTax)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: `${Math.max(13, Number(get(s,"body_font_size")) + 1)}px`, background: "#000", color: "#fff", padding: "5px 6px", marginTop: "4px" }}><span>الإجمالي</span><span>{currency} {smartFormat(mockTotal)}</span></div>
        <BlockRenderer blocks={customBlocks} position="after_totals" accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      </div>

      {get(s,"show_payment_details") !== false && (
        <><div style={{ borderTop: solid, margin: "5px 0" }} /><div onClick={() => onElementClick("show_payment_details")} style={{ fontSize: `${get(s,"item_font_size")}px`, ...hl("show_payment_details") }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>نقداً:</span><span>{currency} 250.00</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>الباقي:</span><span>{currency} {smartFormat(250 - mockTotal)}</span></div></div></>
      )}

      {get(s,"show_footer") !== false && (
        <><div style={{ borderTop: solid, margin: "6px 0" }} />
        <BlockRenderer blocks={customBlocks} position="before_footer" accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div onClick={() => onElementClick("receipt_footer")} style={{ textAlign: "center", fontSize: `${get(s,"footer_font_size")}px`, fontStyle: "italic", ...hl("receipt_footer") }}>{get(s,"receipt_footer")}</div></>
      )}

      {get(s,"show_qr") !== false && (
        <QrPreview settings={s} onClick={() => onElementClick("show_qr")} />
      )}

      {addressAtBottom && (
        <div style={{ marginTop: "8px", borderTop: `1px dashed ${accent}66`, paddingTop: "6px", fontSize: "10px", textAlign: "center" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
}

// ─── A4/A5 Page Preview ─────────────────────────────────────────────────────────

function PagePreview({ settings: s, hovered, onElementClick, size, customBlocks = [] }) {
  const currency = get(s, "currency_symbol");
  const taxRate = parseFloat(get(s, "tax_rate") || 0);
  const accent = get(s, "accent_color");
  const mockSub = 1250;
  const mockTax = get(s, "show_tax") !== false ? mockSub * (taxRate / 100) : 0;
  const mockTotal = mockSub + mockTax;
  const w = size === "A5" ? "148mm" : "210mm";

  const extraAddresses = (() => { try { return JSON.parse(s.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(s.additional_phones || '[]'); } catch { return []; } })();
  const addressAtBottom = get(s, "address_position") === "bottom";

  const addrAlignMap = { right: "flex-start", center: "center", left: "flex-end" };

  const AddressBlock = () => {
    const addrs = [s.address, ...extraAddresses];
    const phones = [s.phone, ...extraPhones];
    const addrFlex = addrAlignMap[get(s, "address_alignment")] || "flex-start";
    const taxAlign = get(s, "tax_id_alignment") || "right";
    return (
      <>
        {addrs.map((addr, i) => {
          const phone = phones[i];
          const hasAddr = get(s,"show_address") !== false && addr;
          const hasPhone = get(s,"show_phone") !== false && phone;
          if (!hasAddr && !hasPhone) return null;
          return (
            <div key={i} style={{ display: "flex", gap: "8px", justifyContent: addrFlex, ...(i > 0 ? { marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" } : {}) }}>
              {hasAddr && <span style={{ fontSize: `${get(s,"address_font_size")}px`, color: "#94a3b8" }}>{addr}</span>}
              {hasPhone && <span style={{ fontSize: `${get(s,"address_font_size")}px`, color: "#94a3b8" }}>{phone}</span>}
            </div>
        )})}
        {get(s,"show_tax_id")  !== false && <div style={{ fontSize: `${get(s,"tax_id_font_size")}px`, color: "#94a3b8", marginTop: "4px", textAlign: taxAlign }}>الرقم الضريبي: {s.tax_id || "310122393500003"}</div>}
      </>
    );
  };

  const hl = (key) => ({
    outline: VISUAL_FIELDS.has(key) && hovered === key ? "2px solid #f59e0b" : "none",
    outlineOffset: "2px", borderRadius: "1px", cursor: "pointer", transition: "outline 0.1s",
  });

  const items = [
    { name: "قميص قطني L", code: "SKU-001", qty: 5, price: 120 },
    { name: "بنطلون جينز", code: "SKU-002", qty: 3, price: 150 },
    { name: "حزام جلد", code: "SKU-003", qty: 4, price: 80 },
    { name: "حذاء رياضي", code: "SKU-004", qty: 2, price: 200 },
  ];
  const showCode = get(s, "show_item_code") === true;

  return (
    <div dir="rtl" style={{ width: w, padding: "2mm 2mm", fontFamily: get(s,"print_font"), fontSize: `${get(s,"body_font_size")}px`, color: "#1e293b", background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* Header */}
      <div onClick={() => onElementClick("header_section")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px", ...hl("header_section") }}>
        <div>
          {get(s,"show_logo") !== false && s.logo_url && <img src={resolveImageUrl(s.logo_url)} alt="" style={{ maxHeight: `${get(s,"logo_max_height")}px`, objectFit: "contain" }} />}
        </div>
        <div>
          <div style={{ fontSize: `${get(s,"header_font_size")}px`, fontWeight: "900", color: accent }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
          {get(s,"show_branch")  !== false && <div style={{ fontSize: "11px", color: "#64748b" }}>{s.branch_name || "الفرع الرئيسي"}</div>}
          {!addressAtBottom && <AddressBlock />}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: accent }}>فاتورة مبيعات</div>
          <div onClick={() => onElementClick("invoice_prefix")} style={{ fontSize: "10px", color: "#64748b", ...hl("invoice_prefix") }}>{get(s,"invoice_prefix")}-2025-0042</div>
        </div>
        <div style={{ textAlign: "left", fontSize: "10px", color: "#64748b" }}>
          {get(s,"show_invoice_date")  !== false && <div>التاريخ: {new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}</div>}
          {get(s,"show_customer_name") !== false && <div onClick={() => onElementClick("show_customer_name")} style={hl("show_customer_name")}>العميل: محمد الهيجازي</div>}
          {get(s,"show_cashier_name")  !== false && <div onClick={() => onElementClick("show_cashier_name")} style={hl("show_cashier_name")}>الكاشير: أحمد صالح</div>}
        </div>
      </div>
      <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {/* Table */}
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${get(s,"item_font_size")}px`, marginBottom: "8px" }}>
        <thead><tr style={{ background: accent, color: "#fff" }}>
          <th style={{ textAlign: "right", padding: "4px 6px" }}>#</th>
          {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "9px", opacity: 0.85 }}>كود</th>}
          <th style={{ textAlign: "right", padding: "4px 6px" }}>المنتج</th>
          <th style={{ textAlign: "center", padding: "4px 6px" }}>كمية</th>
          <th style={{ textAlign: "center", padding: "4px 6px" }}>سعر</th>
          <th style={{ textAlign: "left", padding: "4px 6px" }}>إجمالي</th>
        </tr></thead>
        <tbody>{items.map((item, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
            <td style={{ padding: "3px 6px", color: "#94a3b8" }}>{i + 1}</td>
            {showCode && <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "9px", color: "#94a3b8", fontFamily: "monospace" }}>{item.code}</td>}
            <td style={{ padding: "3px 6px", fontWeight: "600" }}>{item.name}</td>
            <td style={{ textAlign: "center", padding: "3px 6px" }}>{item.qty}</td>
            <td style={{ textAlign: "center", padding: "3px 6px" }}>{smartFormat(item.price)}</td>
            <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: "700" }}>{smartFormat(item.qty * item.price)}</td>
          </tr>
        ))}</tbody>
      </table>
      <BlockRenderer blocks={customBlocks} position="after_items" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {/* Totals */}
      <BlockRenderer blocks={customBlocks} position="before_totals" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%", fontSize: `${get(s,"item_font_size")}px` }}>
          {get(s,"show_subtotal")      !== false && <div onClick={() => onElementClick("show_subtotal")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_subtotal") }}><span style={{ color: "#64748b" }}>الإجمالي الفرعي</span><span style={{ fontWeight: "700" }}>{currency} {smartFormat(mockSub)}</span></div>}
          {get(s,"show_discount_line") !== false && <div onClick={() => onElementClick("show_discount_line")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_discount_line") }}><span style={{ color: "#64748b" }}>الخصم</span><span style={{ fontWeight: "700", color: "#dc2626" }}>- 0.00</span></div>}
          {get(s,"show_tax")           !== false && <div onClick={() => onElementClick("show_tax")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_tax") }}><span style={{ color: "#64748b" }}>الضريبة ({taxRate}%)</span><span style={{ fontWeight: "700" }}>{currency} {smartFormat(mockTax)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: accent, color: "#fff", borderRadius: "2px", marginTop: "3px" }}><span style={{ fontWeight: "900" }}>الإجمالي</span><span style={{ fontWeight: "900" }}>{currency} {smartFormat(mockTotal)}</span></div>
        </div>
      </div>
      <BlockRenderer blocks={customBlocks} position="after_totals" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {get(s,"show_payment_details") !== false && <div onClick={() => onElementClick("show_payment_details")} style={{ marginTop: "8px", fontSize: `${get(s,"item_font_size")}px`, ...hl("show_payment_details") }}><div style={{ fontWeight: "700", marginBottom: "3px", color: accent }}>طريقة الدفع</div><div style={{ display: "flex", gap: "16px" }}><span>نقداً: {currency} 1500.00</span><span>الباقي: {currency} {smartFormat(1500 - mockTotal)}</span></div></div>}

      {get(s,"show_footer") !== false && (
        <><div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44` }} />
        <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div onClick={() => onElementClick("receipt_footer")} style={{ textAlign: "center", fontSize: `${get(s,"footer_font_size")}px`, color: "#94a3b8", fontStyle: "italic", ...hl("receipt_footer") }}>{get(s,"receipt_footer")}</div></>
      )}

      {get(s,"show_qr") !== false && (
        <QrPreview settings={s} onClick={() => onElementClick("show_qr")} />
      )}

      {addressAtBottom && (
        <div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44`, fontSize: "10px", color: "#94a3b8", textAlign: "center" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────────

function DocTypeNav({ activeDocType, onSelect }) {
  return (
    <div className="w-[220px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white pl-3">
      <div className="space-y-1">
        {DOC_TYPES.map((doc) => (
          <button key={doc.key} type="button" onClick={() => onSelect(doc.key)}
            className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right text-[11px] font-black transition-colors ${activeDocType === doc.key ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <span className={`min-w-8 rounded-sm px-1.5 py-0.5 text-center text-[9px] ${activeDocType === doc.key ? "bg-white/15" : "bg-slate-100 text-slate-400"}`}>{doc.icon}</span>
            <span className="truncate">{doc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Distinct mock previews — all delegate to ThermalPreview / PagePreview so
//     every toggle (show_item_code, show_logo, عناصر الظهور) and custom text
//     blocks are automatically respected. Doc-specific metadata is injected via
//     the "before_meta" / "after_header" custom-block positions using a shim.
// ────────────────────────────────────────────────────────────────────────────────

// Inject an extra fixed block at a given position so distinct docs can show
// their own metadata row inside the existing BlockRenderer flow.
function withMetaBlock(customBlocks, position, content) {
  return [
    ...customBlocks,
    { id: "__meta__", position, type: "text", text: content, paperSizes: ["58mm","80mm","A4","A5"] },
  ];
}

// ── Thermal-based docs (POS, Sales Invoice thermal, Sales Return thermal, Payment Receipt) ──

function PosReceiptPreview({ s }) {
  const blocks = getCustomBlocks(s);
  return <ThermalPreview settings={{ ...s, receipt_width: s._previewSize || "80mm" }} hovered={null} onElementClick={() => {}} customBlocks={blocks} />;
}

function SalesInvoicePreview({ s }) {
  const blocks = getCustomBlocks(s);
  const isRoll = ["58mm","80mm"].includes(s._previewSize || "A4");
  if (isRoll) return <ThermalPreview settings={{ ...s, receipt_width: s._previewSize }} hovered={null} onElementClick={() => {}} customBlocks={blocks} />;
  return <PagePreview settings={s} size={s._previewSize === "A5" ? "A5" : "A4"} hovered={null} onElementClick={() => {}} customBlocks={blocks} />;
}

function SalesReturnPreview({ s }) {
  const blocks = getCustomBlocks(s);
  const isRoll = ["58mm","80mm"].includes(s._previewSize || "80mm");
  const retAccent = s.accent_color || "#dc2626"; // red accent if user hasn't overridden
  const withMeta = withMetaBlock(blocks, "after_header",
    `↩ مرتجع مبيعات — RET-2025-007 | فاتورة: INV-2025-042 | سبب: عيب مصنعي`);
  if (isRoll) return <ThermalPreview settings={{ ...s, receipt_width: s._previewSize, accent_color: retAccent }} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
  return <PagePreview settings={{ ...s, accent_color: retAccent }} size={s._previewSize === "A5" ? "A5" : "A4"} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
}

function PaymentReceiptPreview({ s }) {
  const blocks = getCustomBlocks(s);
  const currency = get(s, "currency_symbol");
  const withMeta = withMetaBlock(blocks, "after_header",
    `💳 PAY-2025-088 | المبلغ: ${currency} 500.00 | نقدي | مرجع: INV-2025-042 | الرصيد: ${currency} 0.00`);
  return <ThermalPreview settings={{ ...s, receipt_width: s._previewSize || "80mm" }} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
}

// ── DocA4Base — shared A4/A5 shell that handles header/footer/blocks and injects
//    a distinct meta strip + items table for each doc type ──────────────────────

function DocA4Base({ s, title, docNo, metaStrip, itemsTable, totalsBlock, extraFooter }) {
  const accent = get(s, "accent_color");
  const font   = get(s, "print_font");
  const currency = get(s, "currency_symbol");
  const taxRate  = parseFloat(get(s, "tax_rate") || 0);
  const isA5 = (s._previewSize || "A4") === "A5";
  const w    = isA5 ? "148mm" : "210mm";
  const customBlocks = getCustomBlocks(s);
  const dashed = `1px dashed ${accent}44`;
  const addressAtBottom = get(s, "address_position") === "bottom";
  const extraAddresses = (() => { try { return JSON.parse(s.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(s.additional_phones || '[]'); } catch { return []; } })();

  const addrAlignMap = { right: "flex-start", center: "center", left: "flex-end" };

  const AddressBlock = () => {
    const addrs = [s.address, ...extraAddresses];
    const phones = [s.phone, ...extraPhones];
    const addrFlex = addrAlignMap[get(s, "address_alignment")] || "flex-start";
    const taxAlign = get(s, "tax_id_alignment") || "right";
    return (
      <>
        {addrs.map((addr, i) => {
          const phone = phones[i];
          const hasAddr = get(s,"show_address") !== false && addr;
          const hasPhone = get(s,"show_phone") !== false && phone;
          if (!hasAddr && !hasPhone) return null;
          return (
            <div key={i} style={{ display:"flex", gap:"8px", justifyContent: addrFlex, ...(i > 0 ? { marginTop:"4px", borderTop:"1px solid #e2e8f0", paddingTop:"4px" } : {}) }}>
              {hasAddr && <span style={{ fontSize:`${get(s,"address_font_size")}px`, color:"#94a3b8" }}>{addr}</span>}
              {hasPhone && <span style={{ fontSize:`${get(s,"address_font_size")}px`, color:"#94a3b8" }}>{phone}</span>}
            </div>
        )})}
        {get(s,"show_tax_id")  !== false && <div style={{ fontSize:`${get(s,"tax_id_font_size")}px`, color:"#94a3b8", marginTop:"4px", textAlign: taxAlign }}>الرقم الضريبي: {s.tax_id || "310122393500003"}</div>}
      </>
    );
  };

  return (
    <div dir="rtl" style={{ fontFamily: font, fontSize: `${get(s,"body_font_size")}px`, width: w, padding: "2mm 2mm", color: "#1e293b", background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* ── Company header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:`3px solid ${accent}`, paddingBottom:"10px", marginBottom:"12px" }}>
        <div>
          {get(s,"show_logo") !== false && s.logo_url && <img src={resolveImageUrl(s.logo_url)} alt="" style={{ maxHeight:`${get(s,"logo_max_height")}px`, marginBottom:"4px" }} />}
          <div style={{ fontSize:`${get(s,"header_font_size")}px`, fontWeight:900, color:accent }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
          {get(s,"show_branch")  !== false && <div style={{ fontSize:"10px", color:"#64748b" }}>{s.branch_name || "الفرع الرئيسي"}</div>}
          {!addressAtBottom && <AddressBlock />}
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:"18px", fontWeight:900, color:accent }}>{title}</div>
          <div style={{ fontSize:"10px", color:"#64748b", fontFamily:"monospace" }}>{docNo}</div>
          {get(s,"show_invoice_date") !== false && <div style={{ fontSize:"10px", color:"#94a3b8" }}>{new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}</div>}
        </div>
      </div>

      {get(s,"receipt_header") && <div style={{ textAlign:"center", fontSize:"10px", marginBottom:"8px", fontStyle:"italic", color:"#64748b" }}>{get(s,"receipt_header")}</div>}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />

      {/* ── Doc-specific meta strip (customer, supplier, etc.) ── */}
      {metaStrip}
      <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      {get(s,"show_customer_name") !== false && <BlockRenderer blocks={[]} position="after_meta" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />}
      <BlockRenderer blocks={customBlocks} position="after_meta" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />

      {/* ── Items table ── */}
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      {itemsTable}
      <BlockRenderer blocks={customBlocks} position="after_items" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />

      {/* ── Totals ── */}
      <BlockRenderer blocks={customBlocks} position="before_totals" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      {totalsBlock}
      <BlockRenderer blocks={customBlocks} position="after_totals" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />

      {extraFooter}

      {/* ── Footer ── */}
      {get(s,"show_footer") !== false && (
        <>
          <div style={{ borderTop: dashed, marginTop:"12px" }} />
          <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
          <div style={{ textAlign:"center", fontSize:`${get(s,"footer_font_size")}px`, color:"#94a3b8", fontStyle:"italic", paddingTop:"6px" }}>
            {get(s,"receipt_footer") || "شكراً لتعاملكم معنا"}
          </div>
        </>
      )}

      {addressAtBottom && (
        <div style={{ marginTop:"12px", paddingTop:"6px", borderTop: dashed, fontSize:"10px", color:"#94a3b8", textAlign:"center" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
}

// Shared items table for A4/A5 docs — SKU always first when show_item_code is on
function A4ItemsTable({ s, items, extraHeaders = [], extraCells = () => [] }) {
  const accent    = get(s, "accent_color");
  const currency  = get(s, "currency_symbol");
  const showCode  = get(s, "show_item_code") !== false;
  return (
    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:`${get(s,"item_font_size")}px`, marginBottom:"10px" }}>
      <thead>
        <tr style={{ background: accent, color: "#fff" }}>
          {showCode && <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900, fontSize:"9px", opacity:0.85 }}>كود</th>}
          <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900 }}>المنتج</th>
          {extraHeaders.map(h => <th key={h} style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>{h}</th>)}
          <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>كمية</th>
          <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>سعر</th>
          <th style={{ padding:"5px 8px", textAlign:"left",   fontWeight:900 }}>إجمالي</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ code, name, qty, price }, i) => (
          <tr key={i} style={{ background: i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
            {showCode && <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:"9px", color:"#94a3b8" }}>{code}</td>}
            <td style={{ padding:"5px 8px", fontWeight:600 }}>{name}</td>
            {extraCells(items[i]).map((v,j) => <td key={j} style={{ padding:"5px 8px", textAlign:"center", color:"#64748b" }}>{v}</td>)}
            <td style={{ padding:"5px 8px", textAlign:"center" }}>{qty}</td>
            <td style={{ padding:"5px 8px", textAlign:"center" }}>{smartFormat(price)}</td>
            <td style={{ padding:"5px 8px", fontWeight:700, textAlign:"left" }}>{smartFormat(qty*price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const MOCK_ITEMS = [
  { code:"SKU-001", name:"قميص قطني L",    qty:2, price:120 },
  { code:"SKU-002", name:"بنطلون جينز",    qty:1, price:150 },
  { code:"SKU-003", name:"حزام جلد",       qty:3, price:80  },
];

// Shared A4 totals block
function A4Totals({ s }) {
  const accent    = get(s, "accent_color");
  const currency  = get(s, "currency_symbol");
  const taxRate   = parseFloat(get(s, "tax_rate") || 0);
  const sub = MOCK_ITEMS.reduce((t,i)=>t+i.qty*i.price,0);
  const tax = get(s,"show_tax") !== false ? sub*(taxRate/100) : 0;
  const total = sub + tax;
  return (
    <div style={{ display:"flex", justifyContent:"flex-end" }}>
      <div style={{ width:"42%", fontSize:`${get(s,"item_font_size")}px` }}>
        {get(s,"show_subtotal")      !== false && <div style={{ display:"flex", justifyContent:"space-between", padding:"2px 0" }}><span style={{color:"#64748b"}}>الإجمالي الفرعي</span><span>{currency} {smartFormat(sub)}</span></div>}
        {get(s,"show_discount_line") !== false && <div style={{ display:"flex", justifyContent:"space-between", padding:"2px 0" }}><span style={{color:"#64748b"}}>الخصم</span><span style={{color:"#dc2626"}}>- 0.00</span></div>}
        {get(s,"show_tax")           !== false && <div style={{ display:"flex", justifyContent:"space-between", padding:"2px 0" }}><span style={{color:"#64748b"}}>الضريبة ({taxRate}%)</span><span>{currency} {smartFormat(tax)}</span></div>}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 8px", background:accent, color:"#fff", borderRadius:"4px", marginTop:"4px", fontWeight:900 }}>
          <span>المستحق</span><span>{currency} {smartFormat(total)}</span>
        </div>
        {get(s,"show_payment_details") !== false && (
          <div style={{ marginTop:"6px", fontSize:"10px", color:"#64748b" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}><span>نقداً:</span><span>{currency} {smartFormat(total+50)}</span></div>
            <div style={{ display:"flex", justifyContent:"space-between", color:"#16a34a", fontWeight:700 }}><span>الباقي للعميل:</span><span>{currency} 50.00</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PO, Q, TR, DT — truly distinct A4 layouts using DocA4Base ─────────────────

function PurchaseOrderPreview({ s }) {
  const accent = get(s, "accent_color");
  const currency = get(s, "currency_symbol");
  const showCode = get(s, "show_item_code") !== false;
  const isRoll = (s._previewSize || "A4") === "80mm";
  if (isRoll) {
    const blocks = getCustomBlocks(s);
    const withMeta = withMetaBlock(blocks, "after_header", `📦 PO-2025-018 | المورد: مؤسسة النور | توصيل: 2025-06-15`);
    return <ThermalPreview settings={{ ...s, receipt_width: "80mm" }} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
  }
  const poItems = [
    { code:"RM-001", name:"أقمشة قطنية",   qty:50,  price:30  },
    { code:"RM-002", name:"خيوط صناعية",   qty:200, price:2   },
    { code:"RM-003", name:"أزرار بلاستيك", qty:500, price:0.5 },
  ];
  return (
    <DocA4Base s={s} title="أمر شراء" docNo="PO-2025-018"
      metaStrip={
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px", background:"#f8fafc", borderRadius:"6px", padding:"10px", fontSize:"11px" }}>
          <div><span style={{color:"#64748b"}}>المورد: </span><strong>مؤسسة النور للتوريدات</strong></div>
          <div><span style={{color:"#64748b"}}>تاريخ التوصيل: </span><strong style={{color:"#16a34a"}}>2025-06-15</strong></div>
          <div><span style={{color:"#64748b"}}>المستودع: </span><strong>المستودع الرئيسي</strong></div>
          <div><span style={{color:"#64748b"}}>الحالة: </span><strong style={{color:"#d97706"}}>معلق الموافقة</strong></div>
        </div>
      }
      itemsTable={
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:`${get(s,"item_font_size")}px`, marginBottom:"10px" }}>
          <thead><tr style={{ background:accent, color:"#fff" }}>
            {showCode && <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900, fontSize:"9px", opacity:0.85 }}>كود</th>}
            <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900 }}>الصنف</th>
            <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>الكمية</th>
            <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>سعر الوحدة</th>
            <th style={{ padding:"5px 8px", textAlign:"left",   fontWeight:900 }}>الإجمالي</th>
          </tr></thead>
          <tbody>{poItems.map(({code,name,qty,price},i)=>(
            <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
              {showCode && <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:"9px", color:"#94a3b8" }}>{code}</td>}
              <td style={{ padding:"5px 8px", fontWeight:600 }}>{name}</td>
              <td style={{ padding:"5px 8px", textAlign:"center" }}>{qty}</td>
              <td style={{ padding:"5px 8px", textAlign:"center" }}>{smartFormat(price)}</td>
              <td style={{ padding:"5px 8px", fontWeight:700, textAlign:"left" }}>{smartFormat(qty*price)}</td>
            </tr>
          ))}</tbody>
        </table>
      }
      totalsBlock={
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"16px" }}>
          <div style={{ width:"38%", fontSize:`${get(s,"item_font_size")}px` }}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 8px", background:accent, color:"#fff", borderRadius:"4px", fontWeight:900 }}>
              <span>إجمالي الأمر</span><span>{currency} 2,150.00</span>
            </div>
          </div>
        </div>
      }
      extraFooter={
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"40px", marginTop:"24px" }}>
          <div style={{ borderTop:"2px solid #e2e8f0", paddingTop:"6px", textAlign:"center", fontSize:"10px", color:"#64748b" }}>توقيع المورد</div>
          <div style={{ borderTop:"2px solid #e2e8f0", paddingTop:"6px", textAlign:"center", fontSize:"10px", color:"#64748b" }}>توقيع المدير المفوض</div>
        </div>
      }
    />
  );
}

function QuotationPreview({ s }) {
  const accent = get(s, "accent_color");
  const currency = get(s, "currency_symbol");
  const isRoll = (s._previewSize || "A4") === "80mm";
  if (isRoll) {
    const blocks = getCustomBlocks(s);
    const withMeta = withMetaBlock(blocks, "after_header", `💬 Q-2025-011 | شركة الأمل | صالح حتى: 2025-06-30`);
    return <ThermalPreview settings={{ ...s, receipt_width: "80mm" }} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
  }
  return (
    <DocA4Base s={s} title="عرض سعر" docNo="Q-2025-011"
      metaStrip={
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"12px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"6px", padding:"10px", fontSize:"11px" }}>
          <div><span style={{color:"#64748b"}}>مقدم إلى: </span><strong>شركة الأمل التجارية</strong></div>
          <div><span style={{color:"#64748b"}}>صالح حتى: </span><strong style={{color:"#16a34a"}}>2025-06-30</strong></div>
          {get(s,"show_customer_name") !== false && <div><span style={{color:"#64748b"}}>جهة الاتصال: </span><strong>محمد الأمل</strong></div>}
          <div><span style={{color:"#64748b"}}>شروط الدفع: </span><strong>30 يوم</strong></div>
        </div>
      }
      itemsTable={<A4ItemsTable s={s} items={MOCK_ITEMS} extraHeaders={["الوحدة"]} extraCells={()=>["قطعة"]} />}
      totalsBlock={<A4Totals s={s} />}
      extraFooter={
        <div style={{ marginTop:"12px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"6px", padding:"10px", fontSize:"11px", color:"#15803d" }}>
          <strong>الشروط والأحكام:</strong> هذا العرض قابل للتفاوض. يُرجى التواصل قبل انتهاء الصلاحية.
        </div>
      }
    />
  );
}

function BranchTransferPreview({ s }) {
  const accent = get(s, "accent_color");
  const showCode = get(s, "show_item_code") !== false;
  const isRoll = (s._previewSize || "A4") === "80mm";
  if (isRoll) {
    const blocks = getCustomBlocks(s);
    const withMeta = withMetaBlock(blocks, "after_header", `🔄 TR-2025-003 | من: الرئيسي → فرع الشمالية`);
    return <ThermalPreview settings={{ ...s, receipt_width: "80mm" }} hovered={null} onElementClick={() => {}} customBlocks={withMeta} />;
  }
  const trItems = [
    { code:"SKU-001", name:"قميص قطني L",  qty:10, price:0 },
    { code:"SKU-002", name:"بنطلون جينز",  qty:5,  price:0 },
    { code:"SKU-004", name:"حذاء رياضي",   qty:8,  price:0 },
  ];
  return (
    <DocA4Base s={s} title="أمر تحويل فرع" docNo="TR-2025-003"
      metaStrip={
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
          {[["من المستودع","المستودع الرئيسي","#dbeafe","#1d4ed8"],["إلى المستودع","فرع الشمالية","#dcfce7","#15803d"]].map(([lbl,val,bg,col])=>(
            <div key={lbl} style={{ background:bg, borderRadius:"8px", padding:"12px", fontSize:"11px" }}>
              <div style={{ color:"#64748b", marginBottom:"4px" }}>{lbl}</div>
              <div style={{ fontWeight:900, fontSize:"14px", color:col }}>{val}</div>
            </div>
          ))}
        </div>
      }
      itemsTable={
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:`${get(s,"item_font_size")}px`, marginBottom:"10px" }}>
          <thead><tr style={{ background:accent, color:"#fff" }}>
            {showCode && <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900, fontSize:"9px", opacity:0.85 }}>كود</th>}
            <th style={{ padding:"5px 8px", textAlign:"right", fontWeight:900 }}>الصنف</th>
            <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>الكمية المحولة</th>
            <th style={{ padding:"5px 8px", textAlign:"center", fontWeight:900 }}>الوحدة</th>
            <th style={{ padding:"5px 8px", textAlign:"right",  fontWeight:900 }}>ملاحظات</th>
          </tr></thead>
          <tbody>{trItems.map(({code,name,qty},i)=>(
            <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
              {showCode && <td style={{ padding:"5px 8px", fontFamily:"monospace", fontSize:"9px", color:"#94a3b8" }}>{code}</td>}
              <td style={{ padding:"5px 8px", fontWeight:600 }}>{name}</td>
              <td style={{ padding:"5px 8px", textAlign:"center", fontWeight:700, color:accent }}>{qty}</td>
              <td style={{ padding:"5px 8px", textAlign:"center", color:"#64748b" }}>قطعة</td>
              <td style={{ padding:"5px 8px", fontSize:"10px", color:"#94a3b8" }}>—</td>
            </tr>
          ))}</tbody>
        </table>
      }
      totalsBlock={null}
      extraFooter={
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"40px", marginTop:"24px" }}>
          <div style={{ borderTop:"2px solid #e2e8f0", paddingTop:"6px", textAlign:"center", fontSize:"10px", color:"#64748b" }}>توقيع المرسل</div>
          <div style={{ borderTop:"2px solid #e2e8f0", paddingTop:"6px", textAlign:"center", fontSize:"10px", color:"#64748b" }}>توقيع المستلم</div>
        </div>
      }
    />
  );
}

function DailyTreasuryPreview({ s }) {
  const accent   = get(s, "accent_color");
  const currency = get(s, "currency_symbol");
  const font     = get(s, "print_font");
  const isA5 = (s._previewSize || "A4") === "A5";
  const w    = isA5 ? "148mm" : "210mm";
  const customBlocks = getCustomBlocks(s);
  const addressAtBottom = get(s, "address_position") === "bottom";
  const extraAddresses = (() => { try { return JSON.parse(s.additional_addresses || '[]'); } catch { return []; } })();
  const extraPhones = (() => { try { return JSON.parse(s.additional_phones || '[]'); } catch { return []; } })();

  const addrAlignMap = { right: "flex-start", center: "center", left: "flex-end" };

  const AddressBlock = () => {
    const addrs = [s.address, ...extraAddresses];
    const phones = [s.phone, ...extraPhones];
    const addrFlex = addrAlignMap[get(s, "address_alignment")] || "flex-start";
    return (
      <>
        {addrs.map((addr, i) => {
          const phone = phones[i];
          const hasAddr = get(s,"show_address") !== false && addr;
          const hasPhone = get(s,"show_phone") !== false && phone;
          if (!hasAddr && !hasPhone) return null;
          return (
            <div key={i} style={{ display:"flex", gap:"8px", justifyContent: addrFlex, ...(i > 0 ? { marginTop:"4px", borderTop:"1px solid #e2e8f0", paddingTop:"4px" } : {}) }}>
              {hasAddr && <span style={{ fontSize:`${get(s,"address_font_size")}px`, color:"#94a3b8" }}>{addr}</span>}
              {hasPhone && <span style={{ fontSize:`${get(s,"address_font_size")}px`, color:"#94a3b8" }}>{phone}</span>}
            </div>
        )})}
      </>
    );
  };

  return (
    <div dir="rtl" style={{ fontFamily:font, fontSize:`${get(s,"body_font_size")}px`, width:w, padding:"2mm 2mm", color:"#1e293b", background:"#fff", boxShadow:"0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:`3px solid ${accent}`, paddingBottom:"10px", marginBottom:"14px" }}>
        <div>
          {get(s,"show_logo") !== false && s.logo_url && <img src={resolveImageUrl(s.logo_url)} alt="" style={{ maxHeight:`${get(s,"logo_max_height")}px`, marginBottom:"4px" }} />}
          <div style={{ fontSize:`${get(s,"header_font_size")}px`, fontWeight:900, color:accent }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
          {get(s,"show_branch")  !== false && <div style={{ fontSize:"10px", color:"#64748b" }}>{s.branch_name || "الفرع الرئيسي"}</div>}
          {!addressAtBottom && <AddressBlock />}
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:"18px", fontWeight:900, color:accent }}>تقرير الخزينة اليومي</div>
          {get(s,"show_invoice_date") !== false && <div style={{ fontSize:"10px", color:"#94a3b8" }}>{new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}</div>}
          {get(s,"show_cashier_name") !== false && <div style={{ fontSize:"10px", color:"#94a3b8" }}>الكاشير: أحمد صالح</div>}
        </div>
      </div>
      {get(s,"receipt_header") && <div style={{ textAlign:"center", fontSize:"10px", marginBottom:"8px", fontStyle:"italic", color:"#64748b" }}>{get(s,"receipt_header")}</div>}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"14px" }}>
        {[["رصيد الافتتاح","5,200.00","#1d4ed8"],["إجمالي الداخل","12,450.00","#16a34a"],["إجمالي الخارج","3,800.00","#dc2626"]].map(([lbl,val,col])=>(
          <div key={lbl} style={{ border:"1px solid #e2e8f0", borderRadius:"8px", padding:"10px", textAlign:"center" }}>
            <div style={{ fontSize:"10px", color:"#64748b", marginBottom:"4px" }}>{lbl}</div>
            <div style={{ fontSize:"15px", fontWeight:900, color:col }}>{currency} {val}</div>
          </div>
        ))}
      </div>
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      {/* Transactions table — no item code column (treasury has no SKU) */}
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:`${get(s,"item_font_size")}px` }}>
        <thead><tr style={{ background:accent, color:"#fff" }}>
          {["المستند","النوع","المبلغ","وسيلة الدفع"].map(h=><th key={h} style={{ padding:"5px 8px", textAlign:"right", fontWeight:900 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {[["INV-042","مبيعات","1,500","نقدي"],["INV-043","مبيعات","2,000","شبكة"],["EXP-011","مصروف","-800","نقدي"],["RET-007","مرتجع","-120","نقدي"]].map(([d,t,a,m],i)=>(
            <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
              <td style={{ padding:"5px 8px", fontFamily:"monospace" }}>{d}</td>
              <td style={{ padding:"5px 8px" }}>{t}</td>
              <td style={{ padding:"5px 8px", fontWeight:700, color:a.startsWith("-")?"#dc2626":"#16a34a" }}>{currency} {a}</td>
              <td style={{ padding:"5px 8px", color:"#64748b" }}>{m}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <BlockRenderer blocks={customBlocks} position="after_items" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
      <div style={{ marginTop:"10px", display:"flex", justifyContent:"flex-end" }}>
        <div style={{ background:accent, color:"#fff", borderRadius:"6px", padding:"8px 20px", fontWeight:900, fontSize:"13px" }}>
          رصيد الختام: {currency} 13,850.00
        </div>
      </div>
      {get(s,"show_footer") !== false && (
        <>
          <div style={{ borderTop:`1px dashed ${accent}44`, marginTop:"12px" }} />
          <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={w} accentColor={accent} hovered={null} onElementClick={() => {}} />
          <div style={{ textAlign:"center", fontSize:`${get(s,"footer_font_size")}px`, color:"#94a3b8", fontStyle:"italic", paddingTop:"6px" }}>
            {get(s,"receipt_footer") || "شكراً لتعاملكم معنا"}
          </div>
        </>
      )}

      {addressAtBottom && (
        <div style={{ marginTop:"12px", paddingTop:"6px", borderTop:`1px dashed ${accent}44`, fontSize:"10px", color:"#94a3b8", textAlign:"center" }}>
          <AddressBlock />
        </div>
      )}
    </div>
  );
}

// ── Intentionally removed MockThermalDoc, MockA4Doc (replaced by DocA4Base above) ──

function MockThermalDoc({ s, title, lines = [], footer }) {
  // kept as no-op fallback — real components use ThermalPreview/DocA4Base directly
  return null;
}

function MockA4Doc({ s, title, subtitle, children }) {
  // kept as no-op fallback
  return null;
}

// ─── End distinct mock previews ─────────────────────────────────────────────────
// (SalesReturnPreview is defined above in the "Thermal-based docs" section)

const MOCK_DATA = {
  bank_statement: {
    bank: { name: "البنك الأهلي", balance: 50000 },
    transactions: [
      { id: 1, type: "deposit",    amount: 10000, reference: "DEP-001", notes: "إيداع نقدي",    created_at: new Date().toISOString(), reconciled: true },
      { id: 2, type: "withdrawal", amount: 5000,  reference: "WTH-001", notes: "سحب رواتب",    created_at: new Date().toISOString(), reconciled: false },
      { id: 3, type: "deposit",    amount: 8500,  reference: "DEP-002", notes: "تحصيل شيك",    created_at: new Date().toISOString(), reconciled: true },
    ],
    from: "2026-05-01", to: "2026-05-31",
  },
  ajal_statement: {
    debt: {
      customer_name: "محمد أحمد", customer_phone: "01012345678",
      original_amount: 5000, paid_amount: 2000, remaining: 3000,
      invoice_no: "INV-2025-042", due_date: new Date().toISOString(),
      payments: [
        { id: 1, payment_date: new Date().toISOString(), method_name: "نقدي", amount: 1000 },
        { id: 2, payment_date: new Date().toISOString(), method_name: "شبكة", amount: 1000 },
      ],
    },
  },
  ajal_schedule: {
    debt: {
      customer_name: "محمد أحمد", original_amount: 5000, remaining: 3000,
      schedule: [
        { id: 1, installment_no: 1, due_date: new Date().toISOString(), amount: 1000, status: "paid" },
        { id: 2, installment_no: 2, due_date: new Date(Date.now() + 30*86400000).toISOString(), amount: 1000, status: "pending" },
        { id: 3, installment_no: 3, due_date: new Date(Date.now() + 60*86400000).toISOString(), amount: 1000, status: "pending" },
      ],
    },
  },
  cheque_register: {
    rows: [
      { id: 1, cheque_no: "CHQ-001", bank_name: "البنك الأهلي", drawer_name: "محمد سالم", due_date: new Date().toISOString(), amount: 5000, status: "pending" },
      { id: 2, cheque_no: "CHQ-002", bank_name: "بنك مصر",      drawer_name: "أحمد علي",  due_date: new Date().toISOString(), amount: 3500, status: "cleared" },
      { id: 3, cheque_no: "CHQ-003", bank_name: "البنك العربي", drawer_name: "سارة حسن",  due_date: new Date().toISOString(), amount: 2000, status: "bounced" },
    ],
  },
  payment_methods_report: {
    rows: [
      { id: 1, doc_no: "INV-001", doc_type: "مبيعات",   amount: 1500, direction: "in",  party: "محمد أحمد", method_name: "نقدي",   created_at: new Date().toISOString() },
      { id: 2, doc_no: "INV-002", doc_type: "مبيعات",   amount: 2000, direction: "in",  party: "سالم علي",  method_name: "شبكة",   created_at: new Date().toISOString() },
      { id: 3, doc_no: "EXP-001", doc_type: "مصروفات",  amount: 500,  direction: "out", party: "مورد",      method_name: "نقدي",   created_at: new Date().toISOString() },
    ],
    totalIn: 3500, totalOut: 500,
    filters: { from: "2026-05-01", to: "2026-05-31" },
  },
};

function DocPreviewContent({ docType, merged, previewSize }) {
  const mock = MOCK_DATA[docType] || {};
  const s = { ...merged, _previewSize: previewSize };
  // Invoice-style docs render through the shared block library so the preview
  // honors the Designer layout (order, per-block styles, columns, inserts).
  if (BLOCK_DOCS.has(docType)) return <BlockDocPreview merged={merged} previewSize={previewSize} />;
  switch (docType) {
    case "daily_treasury":   return <DailyTreasuryPreview s={s} />;
    case "bank_statement":   return <BankStatementTemplate bank={mock.bank} transactions={mock.transactions} from={mock.from} to={mock.to} settings={s} />;
    case "ajal_statement":   return <AjalStatementTemplate debt={mock.debt} settings={s} />;
    case "ajal_schedule":    return <AjalScheduleTemplate debt={mock.debt} settings={s} />;
    case "cheque_register":  return <ChequeRegisterTemplate rows={mock.rows} settings={s} />;
    case "payment_methods_report": return <PaymentMethodsReportTemplate rows={mock.rows} filters={mock.filters} totalIn={mock.totalIn} totalOut={mock.totalOut} settings={s} />;
    default: return <PagePreview settings={{ ...s, receipt_width: previewSize || "A4" }} size={previewSize === "A5" ? "A5" : "A4"} hovered={null} onElementClick={() => {}} customBlocks={[]} />;
  }
}

function PerDocSettingsPanel({ docType, globalSettings, docSettings, onChange, onSave }) {
  const settings = docSettings[docType] || {};
  const set = (key, val) => onChange({ ...docSettings, [docType]: { ...(docSettings[docType] || {}), [key]: val } });
  const merged = { ...(globalSettings || {}), ...settings };
  const label = DOC_TYPES.find((d) => d.key === docType)?.label || docType;

  const cfg = DOC_PAPER_CONFIG[docType] || { sizes: ["58mm","80mm","A5","A4"], defaultSize: "A4" };
  const savedDefault = settings.paper_size && settings.paper_size !== "inherit" ? settings.paper_size : null;
  const effectiveDefault = savedDefault || cfg.defaultSize;

  // Which size tab is being previewed right now
  const [previewSize, setPreviewSize] = useState(effectiveDefault);

  // Silent auto-save per-doc settings after a debounce (like global settings)
  const autoSaveTimer = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await api.put(`/api/print-settings-per-doc/${docType}`, settingsRef.current || {});
      } catch { /* silent */ }
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [docType, settings]);

  useEffect(() => {
    setPreviewSize(savedDefault || cfg.defaultSize);
  }, [docType]);

  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [designerOpen, setDesignerOpen] = useState(false);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  useEffect(() => {
    setViewZoom(0.55);
    setPan({ x: 0, y: 0 });
  }, [docType, previewSize]);

  const handleWheel = (e) => {
    e.preventDefault();
    setViewZoom((prev) => Math.min(2, Math.max(0.2, prev + (e.deltaY > 0 ? -0.07 : 0.07))));
  };
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
  const resetView = () => { setViewZoom(0.55); setPan({ x: 0, y: 0 }); };

  return (
    <div className="flex flex-1 min-w-0 gap-4 overflow-hidden pr-4">
      {/* Controls */}
      <div className="w-[380px] shrink-0 overflow-y-auto space-y-4 rounded-sm border border-slate-200 bg-white p-4">
        <div>
          <div className="text-sm font-black text-slate-900">تجاوزات خاصة بـ "{label}"</div>
          <div className="text-[11px] font-bold text-slate-400">الإعدادات غير المحددة ترث من ⚙ الإعدادات العامة تلقائياً.</div>
        </div>

        <button type="button" onClick={() => setDesignerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 py-2.5 text-2sm font-black text-violet-700 hover:border-violet-500 hover:bg-violet-100">
          <Maximize2 size={14} /> المحرر المتقدم (ملء الشاشة)
        </button>

        {/* Paper size selector — valid sizes only for this doc type */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-black text-slate-600">حجم الورق المقبول</label>
            <span className="text-[9px] font-bold text-slate-400">الافتراضي: <span className="text-violet-600">{effectiveDefault}</span></span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg.sizes.map((size) => {
              const isDefault = effectiveDefault === size;
              const isPreviewing = previewSize === size;
              return (
                <button key={size} type="button"
                  onClick={() => { setPreviewSize(size); set("paper_size", size); }}
                  className={`relative rounded-xl border px-3 py-2 text-[11px] font-black transition-all ${
                    isDefault
                      ? "border-violet-600 bg-violet-600 text-white shadow-md"
                      : isPreviewing
                      ? "border-slate-700 bg-slate-700 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}>
                  {size}
                  {isDefault && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-[7px] font-black text-white">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[9px] font-bold text-slate-400">
            اضغط على حجم لمعاينته ← وحفظه كافتراضي لهذا المستند
          </div>
        </div>

        {[["receipt_header", "رأس المستند"], ["receipt_footer", "تذييل المستند"], ["watermark_text", "نص الطابع المائي"]].map(([key, labelText]) => (
          <label key={key} className="block space-y-1">
            <span className="text-[11px] font-black text-slate-600">{labelText}</span>
            <input value={settings[key] || ""} onChange={(e) => set(key, e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-2sm outline-none focus:border-violet-500" />
          </label>
        ))}
        {[["show_logo", "إظهار الشعار"], ["show_address", "إظهار العنوان"], ["show_phone", "إظهار الهاتف"], ["show_payment_details", "إظهار تفاصيل الدفع"], ["show_signature_lines", "إظهار خطوط التوقيع"], ["show_watermark", "طابع مائي"]].map(([key, labelText]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
            <span className="text-2sm font-bold text-slate-700">{labelText}</span>
            <input type="checkbox" checked={settings[key] !== undefined ? Boolean(settings[key]) : true} onChange={(e) => set(key, e.target.checked)} />
          </label>
        ))}
        <button type="button" onClick={() => setDesignerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-2sm font-black text-slate-700 hover:border-slate-500 hover:bg-slate-50">
          <Maximize2 size={14} /> المحرر المتقدم (ملء الشاشة)
        </button>
        <button type="button" onClick={() => onSave(docType, settings)}
          className="w-full rounded-xl bg-violet-600 py-3 text-sm font-black text-white hover:bg-violet-700">
          حفظ إعدادات هذا المستند
        </button>
      </div>

      {designerOpen && (
        <PrintDesigner
          open={designerOpen}
          docType={docType}
          label={label}
          initialFamily={familyForSize(previewSize)}
          globalSettings={globalSettings}
          value={settings}
          onChange={(next) => onChange({ ...docSettings, [docType]: next })}
          onSave={(next) => { onChange({ ...docSettings, [docType]: next }); onSave(docType, next); }}
          onClose={() => setDesignerOpen(false)}
        />
      )}

      {/* Preview with pan & zoom */}
      <div className="flex flex-1 min-w-0 flex-col rounded-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between bg-primary text-white px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span className="text-[11px] font-black uppercase tracking-widest">معاينة حية — {label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-slate-400">عجلة الفأرة للتكبير • اسحب للتنقل</span>
            <button type="button" onClick={() => setDesignerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-violet-500">
              <Maximize2 size={13} /> المحرر المتقدم
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden bg-[var(--bg-overlay)]"
          style={{ cursor: "grab", minHeight: 0 }}
          onWheel={handleWheel}
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
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              width: previewSize === "58mm" ? "58mm" : previewSize === "80mm" ? "80mm" : previewSize === "A5" ? "148mm" : "210mm",
            }}
          >
            <DocPreviewContent docType={docType} merged={merged} previewSize={previewSize} />
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 left-3 flex items-center gap-0 rounded-sm bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm overflow-hidden z-10">
            <button type="button" onClick={() => setViewZoom((v) => Math.min(2, v + 0.1))}
              className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 border-l border-slate-200">+</button>
            <button type="button" onClick={resetView}
              className="px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-100 min-w-[46px] text-center">
              {Math.round(viewZoom * 100)}%
            </button>
            <button type="button" onClick={() => setViewZoom((v) => Math.max(0.2, v - 0.1))}
              className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 border-r border-slate-200">−</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintingSettingsPanel({ settings, onChange }) {
  const [hovered, setHovered] = useState(null);
  const [previewTab, setPreviewTab] = useState(get(settings, "receipt_width"));
  const [activeDocType, setActiveDocType] = useState("global");
  const [docSettings, setDocSettings] = useState({});
  const [printers, setPrinters] = useState([]);
  const [sizePrinterMap, setSizePrinterMap] = useState(() => getPrinterSizeMap());
  const [calWizard, setCalWizard] = useState({ open: false, printerName: "", sizeKey: "" });
  const [calVersion, setCalVersion] = useState(0);
  const [printJobLog, setPrintJobLog] = useState(() => getPrintJobLog());
  const [logOpen, setLogOpen] = useState(false);
  const importFileRef = useRef(null);
  // Pan & Zoom
  const [viewZoom, setViewZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  useEffect(() => {
    api.get("/api/print-settings-per-doc")
      .then((r) => setDocSettings(r.data.data || {}))
      .catch(() => {});
    listPrinters().then(setPrinters);
  }, []);

  async function saveDocSettings(docType, nextSettings) {
    try {
      await api.put(`/api/print-settings-per-doc/${docType}`, nextSettings || {});
      toast.success("تم حفظ الإعدادات");
    } catch {
      toast.error("خطأ في الحفظ");
    }
  }

  function handleSizePrinterChange(size, printerName) {
    const next = { ...sizePrinterMap, [size]: printerName };
    setSizePrinterMap(next);
    setPrinterSizeMap(next);
  }

  function openCalibrationWizard(size) {
    const printerName = sizePrinterMap[size] || "";
    if (!printerName) return;
    setCalWizard({ open: true, printerName, sizeKey: size });
  }

  function closeCalibrationWizard() {
    setCalWizard((prev) => ({ ...prev, open: false }));
    setCalVersion((v) => v + 1); // force the "معايَر/غير معاير" chips to re-read localStorage
  }

  function handleExportDeviceProfile() {
    const profile = exportDeviceProfile(getPrinterSizeMap());
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "retailer-device-profile.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير ملف الجهاز");
  }

  function handleImportDeviceProfile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const profile = JSON.parse(String(reader.result || "{}"));
        const map = importDeviceProfile(profile);
        if (map) {
          setPrinterSizeMap(map);
          setSizePrinterMap(map);
        }
        setCalVersion((v) => v + 1);
        toast.success("تم استيراد ملف الجهاز");
      } catch {
        toast.error("ملف غير صالح");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function refreshPrintLog() {
    setPrintJobLog(getPrintJobLog());
  }

  function handleClearPrintLog() {
    clearPrintJobLog();
    setPrintJobLog([]);
  }

  const hover  = useCallback((k) => setHovered(k), []);
  const leave  = useCallback(() => setHovered(null), []);
  const width  = get(settings, "receipt_width");
  const s      = settings;

  const handleElementClick = (key) => {
    setHovered(key);
    const el = document.querySelector(`[data-field-key="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.querySelector("input,select")?.focus();
    }
  };

  const cf = (key, label, hint, children) => {
    const autoHint = hint ?? fmHint(key);
    return (
      <div key={key}>
        <ControlField label={label} hint={autoHint} fieldKey={key} hovered={hovered} onHover={hover} onLeave={leave}>
          {children}
        </ControlField>
      </div>
    );
  };

  const tog = (key, label, hint) => {
    const autoHint = hint ?? fmHint(key);
    return (
      <div key={key}>
        <ToggleSwitch checked={get(s, key) !== false} onChange={(v) => onChange(key, v)} label={label} hint={autoHint} fieldKey={key} hovered={hovered} onHover={hover} onLeave={leave} />
      </div>
    );
  };

  // Reset view when changing tabs
  const switchPreviewTab = (v) => {
    setPreviewTab(v);
    setViewZoom(v === "A4" ? 0.55 : v === "A5" ? 0.72 : 0.88);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.07 : 0.07;
    setViewZoom(prev => Math.min(2, Math.max(0.2, prev + delta)));
  };

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
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  };

  const resetView = () => {
    setViewZoom(previewTab === "A4" ? 0.55 : previewTab === "A5" ? 0.72 : 0.88);
    setPan({ x: 0, y: 0 });
  };

  const isRoll = previewTab === "58mm" || previewTab === "80mm";
  const customBlocks = getCustomBlocks(settings);

  // Scale A4/A5 to fit within the preview pane without scroll
  const previewZoom = previewTab === "A4" ? 0.48 : previewTab === "A5" ? 0.58 : 1;

  return (
    <div
      className="flex gap-4"
      style={{ height: "calc(100vh - 220px)", minHeight: "640px" }}
    >
      <DocTypeNav activeDocType={activeDocType} onSelect={setActiveDocType} />
      {activeDocType !== "global" ? (
        <PerDocSettingsPanel
          docType={activeDocType}
          globalSettings={settings}
          docSettings={docSettings}
          onChange={setDocSettings}
          onSave={saveDocSettings}
        />
      ) : (
      <>

      {/* ── Controls (right in RTL) — scrolls internally ── */}
      <div className="flex-1 min-w-0 overflow-y-auto pr-4 space-y-10" style={{ paddingBottom: "2rem" }}>

        {/* Printer assignment per paper size */}
        <section>
          <SectionLabel icon={PrinterIcon} title="الطباعة الفورية — اختر طابعة لكل حجم" hint="اختر طابعة ← عند الضغط على طباعة يُرسل المستند مباشرة للطابعة بدون أي نوافذ أو خطوات إضافية" />
          {!isElectronPrint() ? (
            <div className="mb-3 flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
              <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
              هذه الميزة تعمل فقط داخل تطبيق سطح المكتب (.exe) — قائمة الطابعات المتصلة بجهازك ستظهر هنا عند فتح التطبيق
            </div>
          ) : printers.length === 0 ? (
            <div className="mb-3 flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
              <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
              جارٍ تحميل الطابعات المتصلة بجهازك...
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
              <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
              تم اكتشاف {printers.length} طابعة متصلة — اختر طابعة لكل حجم لتفعيل الطباعة الفورية
            </div>
          )}
          <div className="grid grid-cols-2 gap-4" key={calVersion}>
            {[
              { size: "58mm", label: "58mm", sub: "رول حراري صغير" },
              { size: "80mm", label: "80mm", sub: "رول حراري قياسي" },
              { size: "A5",   label: "A5",   sub: "نصف صفحة" },
              { size: "A4",   label: "A4",   sub: "ورقة كاملة" },
            ].map(({ size, label, sub }) => {
              const isRollSize = size === "58mm" || size === "80mm";
              const assignedPrinter = sizePrinterMap[size] || "";
              const cal = isRollSize ? resolveCalibration(assignedPrinter, size) : null;
              const isCalibrated = !!(cal && cal.printAreaWidthMm > 0);
              return (
                <div key={size} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-black text-white">{label}</span>
                    <span className="text-[11px] font-bold text-slate-500">{sub}</span>
                  </div>
                  <StyledSelect
                    value={sizePrinterMap[size] || ""}
                    onChange={(e) => handleSizePrinterChange(size, e.target.value)}
                    options={[
                      { value: "", label: isElectronPrint() && printers.length > 0 ? "— بدون تعيين (ستظهر نافذة الطباعة) —" : "— بدون تعيين —" },
                      ...printers.map(p => ({ value: p.name, label: `🖨 ${p.displayName || p.name}${p.isDefault ? " (الافتراضية)" : ""}` })),
                    ]}
                  />
                  {isRollSize && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openCalibrationWizard(size)}
                        disabled={!assignedPrinter}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600 hover:border-slate-400 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Wrench size={11} /> معايرة
                      </button>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                        isCalibrated ? "bg-success-bg text-success-text" : "bg-slate-100 text-slate-400"
                      }`}>
                        {isCalibrated ? `معايَر: ${cal.printAreaWidthMm}mm` : "غير معاير"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExportDeviceProfile}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <Download size={12} /> تصدير ملف الجهاز
            </button>
            <button type="button" onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <Upload size={12} /> استيراد ملف الجهاز
            </button>
            <input ref={importFileRef} type="file" accept="application/json" className="hidden" onChange={handleImportDeviceProfile} />
          </div>
        </section>

        {/* Print job log */}
        <section>
          <button type="button" onClick={() => setLogOpen((v) => !v)} className="w-full flex items-center gap-2">
            <div className="flex-1">
              <SectionLabel icon={History} title="سجل الطباعة" hint="آخر عمليات الطباعة الصامتة على هذا الجهاز" />
            </div>
            {logOpen ? <ChevronUp size={14} className="text-slate-400 mb-4" /> : <ChevronDown size={14} className="text-slate-400 mb-4" />}
          </button>
          {logOpen && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{printJobLog.length} عملية</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={refreshPrintLog}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-all">
                    <RefreshCw size={11} /> تحديث
                  </button>
                  <button type="button" onClick={handleClearPrintLog}
                    className="flex items-center gap-1 rounded-md border border-danger-border bg-danger-bg px-2 py-1 text-[10px] font-black text-danger-text hover:bg-red-100 transition-all">
                    <Trash2 size={11} /> مسح
                  </button>
                </div>
              </div>
              {printJobLog.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] font-bold text-slate-400">لا توجد عمليات طباعة بعد</div>
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-slate-400 font-black uppercase tracking-widest">
                        <th className="px-2 py-1.5 text-right">الوقت</th>
                        <th className="px-2 py-1.5 text-right">المستند</th>
                        <th className="px-2 py-1.5 text-right">الطابعة</th>
                        <th className="px-2 py-1.5 text-right">المقاس</th>
                        <th className="px-2 py-1.5 text-right">الوضع</th>
                        <th className="px-2 py-1.5 text-right">النتيجة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printJobLog.map((entry, idx) => {
                        const d = entry.at ? new Date(entry.at) : null;
                        const timeLabel = d
                          ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
                          : "";
                        return (
                          <tr key={idx} className={`border-t border-slate-100 font-bold ${entry.ok ? "text-slate-600" : "bg-danger-bg text-danger-text"}`}>
                            <td className="px-2 py-1.5 whitespace-nowrap">{timeLabel}</td>
                            <td className="px-2 py-1.5">{entry.doc_label || entry.doc_type || "—"}</td>
                            <td className="px-2 py-1.5 truncate max-w-[100px]">{entry.printer || "—"}</td>
                            <td className="px-2 py-1.5">{entry.size || "—"}</td>
                            <td className="px-2 py-1.5">{entry.mode === "silent" ? "صامت" : "حوار"}</td>
                            <td className="px-2 py-1.5 flex items-center gap-1">
                              {entry.ok
                                ? <CheckCircle2 size={12} className="text-success-text" />
                                : <span className="flex items-center gap-1"><XCircle size={12} className="text-danger-text" /> {entry.reason || "فشل"}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Paper */}
        <section>
          <SectionLabel icon={Ruler} title="مقاس ورق الطباعة" hint="يؤثر على تخطيط القالب فوراً" />
          <PaperPicker value={width} onChange={(v) => { onChange("receipt_width", v); setPreviewTab(v); }} />
          <div className="mt-4">
            {cf("accent_color", "لون النظام (A4/A5)", "رأس الجدول، الفواجز، العناوين",
              <div className="flex items-center gap-2">
                <input type="color" value={get(s,"accent_color")} onChange={e => onChange("accent_color", e.target.value)} className="h-9 w-14 rounded-sm border border-slate-200 cursor-pointer" />
                <StyledInput value={get(s,"accent_color")} onChange={e => onChange("accent_color", e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {/* Texts */}
        <section>
          <SectionLabel icon={AlignLeft} title="نصوص الرأس والتذييل" hint="تُظهَر أعلى وأسفل كل مستند مطبوع" />
          <div className="space-y-4">
            {cf("receipt_header", "نص ترحيبي في الرأس", "أسفل اسم الشركة مباشرة", <StyledInput value={s.receipt_header ?? ""} onChange={e => onChange("receipt_header", e.target.value)} placeholder={DEFAULTS.receipt_header} />)}
            {cf("receipt_footer", "نص التذييل", "نهاية الإيصال أو الفاتورة",        <StyledInput value={s.receipt_footer ?? ""} onChange={e => onChange("receipt_footer", e.target.value)} placeholder={DEFAULTS.receipt_footer} />)}
          </div>
        </section>

        {/* Typography */}
        <section>
          <SectionLabel icon={Baseline} title="الخط والأحجام" hint="تحكم كامل في مظهر النصوص" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            {cf("print_font",      "عائلة الخط",     null, <StyledSelect value={get(s,"print_font")}      onChange={e => onChange("print_font", e.target.value)}       options={FONT_FAMILIES} />)}
            {cf("logo_alignment",  "محاذاة الشعار",  null, <StyledSelect value={get(s,"logo_alignment")}  onChange={e => onChange("logo_alignment", e.target.value)}   options={[{value:"center",label:"وسط"},{value:"right",label:"يمين"},{value:"left",label:"يسار"}]} />)}
            {cf("print_numerals",  "أرقام الطباعة",  null, <StyledSelect value={get(s,"print_numerals") || "western"} onChange={e => onChange("print_numerals", e.target.value)} options={[{value:"western",label:"إنجليزية 123"},{value:"arabic",label:"عربية ١٢٣"}]} />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {cf("header_font_size", "خط اسم الشركة", null, <Stepper value={get(s,"header_font_size")} onChange={v => onChange("header_font_size", v)} min={10} max={32} unit="px" />)}
            {cf("body_font_size",   "خط الجسم",      null, <Stepper value={get(s,"body_font_size")}   onChange={v => onChange("body_font_size", v)}   min={8}  max={18} unit="px" />)}
            {cf("item_font_size",   "خط الأصناف",    null, <Stepper value={get(s,"item_font_size")}   onChange={v => onChange("item_font_size", v)}   min={8}  max={16} unit="px" />)}
            {cf("footer_font_size", "خط التذييل",    null, <Stepper value={get(s,"footer_font_size")} onChange={v => onChange("footer_font_size", v)} min={8}  max={16} unit="px" />)}
            {cf("logo_max_height",  "ارتفاع الشعار", null, <Stepper value={get(s,"logo_max_height")}  onChange={v => onChange("logo_max_height", v)}  min={20} max={100} unit="px" />)}
          </div>
        </section>

        {/* Visibility */}
        <section>
          <SectionLabel icon={ListChecks} title="عناصر الظهور" hint="مرر فأرتك على مفتاح لتمييز مكانه في المعاينة — أو اضغط على عنصر المعاينة مباشرة" />
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            اضغط على أي عنصر في المعاينة للانتقال إلى إعداده المقابل هنا والعكس صحيح
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tog("show_logo",            "الشعار",           "في رأس المستند")}
            {tog("show_branch",          "اسم الفرع",        "أسفل اسم الشركة")}
            {tog("show_address",         "العنوان",          "عنوان المتجر")}
            {tog("show_phone",           "رقم الهاتف",       "هاتف التواصل")}
            {tog("show_tax_id",          "الرقم الضريبي",    "رقم التسجيل")}
          </div>
          <div className="mt-3">
            {cf("address_position", "موضع العنوان والهاتف", "في رأس المستند أو أسفله",
              <StyledSelect value={get(s,"address_position") || "top"} onChange={e => onChange("address_position", e.target.value)} options={[
                {value:"top", label:"في الرأس"},
                {value:"bottom", label:"أسفل المستند"},
              ]} />
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {cf("address_font_size", "حجم خط العنوان والهاتف", null,
              <Stepper value={get(s,"address_font_size")} onChange={v => onChange("address_font_size", v)} min={7} max={18} unit="px" />)}
            {cf("address_alignment", "محاذاة العنوان والهاتف", null,
              <StyledSelect value={get(s,"address_alignment") || "right"} onChange={e => onChange("address_alignment", e.target.value)} options={[
                {value:"right", label:"يمين"},
                {value:"center", label:"وسط"},
                {value:"left", label:"يسار"},
              ]} />)}
            {cf("tax_id_font_size", "حجم خط الرقم الضريبي", null,
              <Stepper value={get(s,"tax_id_font_size")} onChange={v => onChange("tax_id_font_size", v)} min={7} max={18} unit="px" />)}
            {cf("tax_id_alignment", "محاذاة الرقم الضريبي", null,
              <StyledSelect value={get(s,"tax_id_alignment") || "right"} onChange={e => onChange("tax_id_alignment", e.target.value)} options={[
                {value:"right", label:"يمين"},
                {value:"center", label:"وسط"},
                {value:"left", label:"يسار"},
              ]} />)}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {tog("show_invoice_date",    "تاريخ الفاتورة",   "التاريخ والوقت")}
            {tog("show_customer_name",   "اسم العميل",       "في رأس الفاتورة")}
            {tog("show_cashier_name",    "اسم الكاشير",      "موظف المبيعات")}
            {tog("show_subtotal",        "الإجمالي الفرعي",  "قبل الضريبة والخصم")}
            {tog("show_discount_line",   "سطر الخصم",        "إجمالي الخصومات")}
            {tog("show_tax",             "سطر الضريبة",      "مبلغ الضريبة")}
            {tog("show_payment_details", "طريقة الدفع",      "نقد / بنك / شبكة")}
            {tog("show_notes",           "ملاحظات الفاتورة", "الملاحظة المسجلة على المستند")}
            {tog("show_footer",          "التذييل النصي",    "رسالة الشكر")}
            {tog("show_qr",              "رمز QR",           "رمز التحقق")}
            {tog("show_barcode_line",    "باركود المستند",   "رقم المستند كباركود قابل للمسح")}
            {tog("show_item_code",       "كود المنتج (SKU)",  "رمز الصنف في جدول الأصناف")}
          </div>
          {/* logo_on_invoices/receipts/reports toggles removed: nothing in the
              live print path ever read them (only orphaned legacy renderers
              did). Per-document logo visibility = show_logo in each doc tab. */}
        </section>

        {/* Thermal Columns */}
        <section>
          <SectionLabel icon={ListChecks} title="أعمدة الطباعة الحرارية (58mm / 80mm)" hint="اختر الأعمدة التي تظهر في جدول الأصناف للإيصالات الحرارية" />
          <ThermalColumnsSection settings={s} onChange={onChange} />
        </section>

        {/* QR Code */}
        {get(s, "show_qr") !== false && (
          <section>
            <SectionLabel icon={QrCode} title="رمز QR" hint="تحكم في حجم ومحاذاة رمز QR في أسفل المستند" />
            <div className="mb-3">
              {cf("qr_mode", "نوع محتوى رمز QR", "فاتورة إلكترونية ZATCA يولّد رمز TLV متوافق مع هيئة الزكاة والضريبة السعودية",
                <StyledSelect value={get(s,"qr_mode") || "free_text"} onChange={e => onChange("qr_mode", e.target.value)} options={[
                  {value:"free_text", label:"نص حر"},
                  {value:"zatca", label:"فاتورة إلكترونية ZATCA"},
                ]} />)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {cf("qr_size", "حجم رمز QR", null, <Stepper value={get(s,"qr_size")} onChange={v => onChange("qr_size", v)} min={28} max={100} unit="px" />)}
              {cf("qr_alignment", "محاذاة رمز QR", null,
                <StyledSelect value={get(s,"qr_alignment") || "right"} onChange={e => onChange("qr_alignment", e.target.value)} options={[
                  {value:"right", label:"يمين"},
                  {value:"center", label:"وسط"},
                  {value:"left", label:"يسار"},
                ]} />)}
            </div>
            <div className="mt-3">
              {cf("qr_content", "محتوى رمز QR", "اتركه فارغاً لترميز بيانات الفاتورة تلقائياً",
                <StyledInput value={get(s,"qr_content") || ""} onChange={e => onChange("qr_content", e.target.value)} placeholder="https://example.com/invoice/..." />)}
            </div>
          </section>
        )}

        {/* Custom Text Blocks */}
        <section>
          <SectionLabel icon={AlignLeft} title="نصوص مخصصة" hint="أضف نصوصاً حرة في أي موضع من المستند — تحتفظ بالمسافات والأسطر كما كتبتها" />
          <CustomTextBlocksSection
            blocks={customBlocks}
            onUpdate={(newBlocks) => saveCustomBlocks(newBlocks, onChange)}
          />
        </section>

      </div>

      {/* ── Separator ── */}
      <div className="w-px self-stretch bg-slate-100 mx-2 shrink-0" />

      {/* ── Preview (left in RTL) — fixed height, no sticky needed ── */}
      <div className="w-[520px] shrink-0 flex flex-col" style={{ height: "100%" }}>

        {/* Preview Header */}
        <div className="flex items-center justify-between bg-primary text-white px-4 py-3 rounded-t-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span className="text-2sm font-black uppercase tracking-widest">معاينة حية</span>
          </div>
          <div className="text-[11px] font-bold">
            {hovered && VISUAL_FIELDS.has(hovered)
              ? <span className="flex items-center gap-1.5 text-amber-400"><MousePointerClick className="h-3 w-3" />يتم التمييز</span>
              : <span className="text-slate-500">مرر على الإعدادات</span>
            }
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex overflow-hidden border-x border-slate-200">
          {PAPER_OPTIONS.map(({ value: v, label }) => (
            <button key={v} type="button" onClick={() => switchPreviewTab(v)}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest transition-all border-l last:border-l-0 border-slate-200 ${previewTab === v ? "bg-amber-400 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Status Bar */}
        <div className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border-x border-slate-200 ${width === previewTab ? "bg-emerald-50 text-emerald-700 border-b border-emerald-100" : "bg-amber-50 text-amber-700 border-b border-amber-100"}`}>
          <div className="h-1.5 w-1.5 rounded-full bg-current" />
          {width === previewTab ? `المقاس الافتراضي للنظام (${width})` : `تعاين: ${previewTab} | الافتراضي: ${width}`}
        </div>

        {/* Hint */}
        <div className="border-x border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-bold text-slate-500 flex items-center gap-1.5">
          <MousePointerClick className="h-3 w-3 text-slate-400 shrink-0" />
          اضغط على أي عنصر لتحديد إعداده في القائمة
        </div>

        {/* Preview Viewport — interactive pan & zoom canvas */}
        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden border border-t-0 border-slate-200 bg-[var(--bg-overlay)]"
          style={{ cursor: "grab" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Content layer — absolutely positioned so transform doesn't affect layout */}
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
            }}
          >
            {isRoll
              ? <ThermalPreview settings={{ ...s, receipt_width: previewTab }} hovered={hovered} onElementClick={handleElementClick} customBlocks={customBlocks} />
              : <PagePreview    settings={s} hovered={hovered} onElementClick={handleElementClick} size={previewTab} customBlocks={customBlocks} />
            }
          </div>

          {/* Zoom Overlay Controls */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-sm bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setViewZoom(v => Math.min(2, v + 0.1))}
              className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors border-l border-slate-200"
              title="تكبير"
            >+</button>
            <button
              type="button"
              onClick={resetView}
              className="px-2 py-1.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 transition-colors min-w-[42px] text-center"
              title="إعادة ضبط"
            >{Math.round(viewZoom * 100)}%</button>
            <button
              type="button"
              onClick={() => setViewZoom(v => Math.max(0.2, v - 0.1))}
              className="px-2.5 py-1.5 text-sm font-black text-slate-700 hover:bg-slate-100 transition-colors border-r border-slate-200"
              title="تصغير"
            >−</button>
          </div>

          {/* Hint overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-sm bg-black/30 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none">
            عجلة الفأرة للتكبير • اسحب للتنقل
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="border border-t-0 border-slate-200 bg-white px-3 py-2.5">
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">تبديل سريع من المعاينة</div>
          <div className="flex flex-wrap gap-1.5">
            {[["show_logo","شعار"],["show_tax","ضريبة"],["show_qr","QR"],["show_footer","تذييل"],["show_payment_details","دفع"],["show_cashier_name","كاشير"],["show_customer_name","عميل"],["show_discount_line","خصم"]].map(([key, label]) => {
              const on = get(s, key) !== false;
              return (
                <button key={key} type="button"
                  onClick={() => onChange(key, !on)}
                  onMouseEnter={() => hover(key)} onMouseLeave={leave}
                  className={`rounded-sm border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${on ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      <CalibrationWizard
        open={calWizard.open}
        onClose={closeCalibrationWizard}
        printerName={calWizard.printerName}
        sizeKey={calWizard.sizeKey}
      />

      </>
      )}
    </div>
  );
}
