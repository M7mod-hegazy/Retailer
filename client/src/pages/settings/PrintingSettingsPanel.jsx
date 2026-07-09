import React, { useEffect, useRef, useState } from "react";
import {
  Ruler, AlignLeft, Receipt, FileText, FileBarChart2, Wrench, Download, Upload,
  Trash2, CheckCircle2, XCircle, History, ChevronDown, ChevronUp, RefreshCw,
  Paintbrush, Maximize2, Printer as PrinterIcon, Copy, Palette, Eye,
} from "lucide-react";
import { CustomTextBlocksSection, getCustomBlocks, saveCustomBlocks } from "./CustomTextBlocks";
import api from "../../services/api";
import toast from "react-hot-toast";
import CalibrationWizard from "../../components/print/calibration/CalibrationWizard";
import PrintStudio from "../../components/print/studio/PrintStudio";
import DocPreviewModal from "../../components/print/studio/DocPreviewModal";
import { familyOfSize } from "../../components/print/studio/studioData";
import {
  listPrinters, isElectronPrint, getPrinterSizeMap, setPrinterSizeMap,
  getPrintJobLog, clearPrintJobLog,
} from "../../services/printService";
import { resolveCalibration, exportDeviceProfile, importDeviceProfile } from "../../services/printCalibration";

// ─── Constants ─────────────────────────────────────────────────────────────────
// This panel is a thin HUB: device concerns (printers, calibration, job log,
// device profile) + per-doc print behavior (paper default, mode, preset).
// ALL design editing lives in the Print Studio — one control center, opened
// from here at the right scope. The old duplicated previews/deep controls
// were removed (they drifted from real print output and confused users).

const PAPER_OPTIONS = [
  { value: "58mm", label: "58mm", sub: "رول حراري صغير",   dims: "58 × ∞ mm",  icon: Receipt       },
  { value: "80mm", label: "80mm", sub: "رول حراري قياسي",  dims: "80 × ∞ mm",  icon: Receipt       },
  { value: "A5",   label: "A5",   sub: "نصف صفحة A4",      dims: "148 × 210mm", icon: FileText      },
  { value: "A4",   label: "A4",   sub: "ورقة كاملة",       dims: "210 × 297mm", icon: FileBarChart2 },
];

const DEFAULTS = { receipt_width: "80mm" };
const get = (s, k) => s[k] ?? DEFAULTS[k];

const DOC_TYPES = [
  { key: "pos_receipt",           label: "فاتورة / إيصال المبيعات", badge: "المبيعات (رول / A4 مكتبية)",      hint: "يُطبع تلقائياً فور النقر على 'دفع وحفظ الفاتورة' (F12) في شاشة نقطة البيع (الكاشير)، وعند طباعة أي فاتورة مبيعات محفوظة من سجل المبيعات." },
  { key: "purchase_order",        label: "أمر شراء",              badge: "سند طلب مشتريات للموردين",         hint: "يُطبع عبر زر 'طباعة' داخل شاشة 'أوامر الشراء' (Purchases -> Orders) لإرساله بالبريد أو الواتساب للمورد لتوفير البضائع." },
  { key: "sales_return",          label: "مرتجع مبيعات",          badge: "رول / ورق A4 (مرتجع عميل)",         hint: "يُطبع تلقائياً أو يدوياً عند النقر على 'طباعة المرتجع' بعد إتمام الفاتورة الاسترجاعية في شاشة 'مرتجع المبيعات'." },
  { key: "purchase_return",       label: "مرتجع مشتريات",         badge: "سند مرتجع بضائع للمورد",            hint: "يُطبع من خلال زر 'طباعة السند' داخل شاشة 'مرتجع المشتريات' لتسليمه للمندوب أو المورد مع البضائع المرجعة." },
  { key: "quotation",             label: "عرض سعر",               badge: "سند عرض تسعير للعملاء",             hint: "يُطبع بالضغط على زر 'طباعة العرض' في شاشة 'عروض الأسعار' (Sales -> Quotations) لتقديمه للعميل للموافقة على الأسعار." },
  { key: "branch_transfer",       label: "تحويل فرع",             badge: "سند نقل مخزني بين الفروع",          hint: "يُطبع عبر زر 'طباعة إذن التحويل' في شاشة 'حركات المخزون -> تحويلات الفروع' لمرافقة البضائع المنقولة مع السائق." },
  { key: "bank_statement",        label: "كشف بنكي",              badge: "تقرير مالي (حساب بنك)",             hint: "يُطبع بالنقر على زر 'طباعة الكشف' في شاشة 'الحسابات المالية -> كشوف البنوك' بعد تحديد البنك وفترة الحركة." },
  { key: "ajal_statement",        label: "كشف آجل",               badge: "كشف مديونية عميل محدد",             hint: "يُطبع بالضغط على زر 'طباعة كشف الحساب' من الملف الشخصي للعميل في شاشة 'العملاء والمندوبين -> حسابات العملاء الآجلين'." },
  { key: "ajal_schedule",          label: "جدول أقساط",            badge: "تواريخ وجداول الأقساط",              hint: "يُطبع بالضغط على زر 'جدول الأقساط' في نافذة تفاصيل الدين لشاشة 'المبيعات الآجلة والأقساط' لتسليم العميل قائمة التواريخ." },
  { key: "ajal_full_statement",   label: "كشف حساب كامل",         badge: "سجل الديون لجميع العملاء",           hint: "يُطبع بالضغط على زر 'تصدير وطباعة' في شاشة 'التقارير -> تقرير الديون والأرصدة الآجلة الشامل' لمتابعة كافة التحصيلات المستحقة." },
  { key: "cheque_register",       label: "سجل شيكات",             badge: "تقرير شيكات صادرة وواردة",          hint: "يُطبع بالضغط على زر 'طباعة السجل' في شاشة 'شؤون الشيكات والأوراق المالية' لمراجعة الشيكات المستحقة وتواريخ التحصيل البنكي." },
  { key: "payment_receipt",       label: "إيصال دفع",             badge: "سند مالي (قبض وصرف)",               hint: "يُطبع فور حفظ مستند دفع أو قبض في شاشة 'السندات المالية -> سندات الصرف والقبض' لتسليم العميل أو المورد وصلاً ماليًا." },
  { key: "daily_treasury",        label: "تقرير الخزينة",         badge: "تقرير جرد الصناديق والخزائن",        hint: "يُطبع بالضغط على 'طباعة تقرير الإغلاق' في شاشة 'الخزائن والصناديق -> حركة الخزينة اليومية' لتسليم الإدارة جرد الإيرادات والمصاريف." },
  { key: "payment_methods_report",label: "تقرير وسائل الدفع",     badge: "تحليل المقبوضات حسب الوسيلة",       hint: "يُطبع بالضغط على زر 'طباعة تقرير المدفوعات' من شاشة 'التقارير -> مبيعات وسائل الدفع' لمطابقة مبالغ الكاش والشبكة والتحويل البنكي." },
  { key: "owner_statement",       label: "لوحة صاحب المحل",       badge: "كشف الإقفال المالي الشهري",          hint: "يُطبع بالضغط على زر 'طباعة الصفحة' في شاشة 'لوحة صاحب المحل' ويشمل المؤشرات المالية الأساسية والتدفقات النقدية للفترة المحددة." },
  { key: "reports_generic",       label: "قوالب تقارير (عام)",    badge: "قالب عام لتقارير النظام",            hint: "يتحكم في التصميم الموحد والخط وحجم الهوامش لكافة تقارير النظام الأخرى الصادرة من 'مركز التقارير وقوائم المخزون وجرد المستودعات'." },
];

// Valid paper sizes per doc type + system default (user can override)
export const DOC_PAPER_CONFIG = {
  pos_receipt:            { sizes: ["58mm","80mm","A5","A4"],     defaultSize: "80mm" },
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
  payment_receipt:        { sizes: ["58mm","80mm","A5","A4"],     defaultSize: "80mm" },
  daily_treasury:         { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  payment_methods_report: { sizes: ["A5","A4"],                   defaultSize: "A4"   },
  owner_statement:        { sizes: ["A5","A4"],                   defaultSize: "A4"   },
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

// Print behavior per doc: preview modal (default) or instant silent print.
const PRINT_MODES = [
  { value: "preview", label: "معاينة قبل الطباعة" },
  { value: "instant", label: "طباعة فورية بدون معاينة" },
];

// ─── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, title, hint }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-2.5 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-white">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]">{title}</div>
        {hint && <div className="text-[11px] font-bold text-[var(--text-muted)]">{hint}</div>}
      </div>
    </div>
  );
}

function StyledSelect({ value, onChange, options }) {
  return (
    <select value={value ?? ""} onChange={onChange} className="w-full rounded-sm border border-[var(--border-normal)] bg-[var(--bg-input)] py-2 px-3 text-2sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)] shadow-sm transition-all appearance-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function PaperPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {PAPER_OPTIONS.map(({ value: v, label, sub, dims, icon: Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1.5 rounded-sm border py-4 transition-all ${value === v ? "border-primary bg-primary shadow-lg scale-[1.02]" : "border-[var(--border-normal)] bg-[var(--bg-input)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)]"}`}>
          <Icon className={`h-5 w-5 ${value === v ? "text-white" : "text-[var(--text-muted)]"}`} />
          <div className="text-center">
            <div className={`text-sm font-black tracking-widest leading-none ${value === v ? "text-white" : "text-[var(--text-primary)]"}`}>{label}</div>
            <div className={`text-[9px] font-bold mt-1 ${value === v ? "text-white/70" : "text-[var(--text-muted)]"}`}>{sub}</div>
            <div className={`text-[9px] font-bold ${value === v ? "text-white/60" : "text-[var(--text-muted)]"}`}>{dims}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Main hub ───────────────────────────────────────────────────────────────────

export default function PrintingSettingsPanel({ settings, onChange }) {
  const [docSettings, setDocSettings] = useState({});
  const [expandedDocs, setExpandedDocs] = useState([]); // array of scope keys
  const [printers, setPrinters] = useState([]);
  const [sizePrinterMap, setSizePrinterMap] = useState(() => getPrinterSizeMap());
  const [calWizard, setCalWizard] = useState({ open: false, printerName: "", sizeKey: "" });
  const [calVersion, setCalVersion] = useState(0);
  const [printJobLog, setPrintJobLog] = useState(() => getPrintJobLog());
  const [logOpen, setLogOpen] = useState(false);
  const [studio, setStudio] = useState({ open: false, scope: "_global", size: null });
  const [preview, setPreview] = useState({ open: false, scope: null, size: "A4", label: "" });
  const importFileRef = useRef(null);

  function toggleExpand(key) {
    setExpandedDocs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }


  const loadDocSettings = () => {
    api.get("/api/print-settings-per-doc")
      .then((r) => setDocSettings(r.data.data || {}))
      .catch(() => {});
  };

  useEffect(() => {
    loadDocSettings();
    listPrinters().then(setPrinters);
  }, []);

  function updateDoc(docType, patch) {
    setDocSettings((prev) => {
      const next = { ...prev, [docType]: { ...(prev[docType] || {}), ...patch } };
      api.put(`/api/print-settings-per-doc/${docType}`, patch).catch(() => toast.error("خطأ في حفظ إعدادات المستند"));
      return next;
    });
  }

  function openStudio(scope, size) {
    setStudio({ open: true, scope, size: size || null });
  }
  function closeStudio() {
    setStudio((prev) => ({ ...prev, open: false }));
    loadDocSettings(); // the Studio saves rows itself — re-sync the hub
  }

  // Preview what a doc prints at a specific (or effective default) size.
  function openPreview(scope, label, size) {
    setPreview({ open: true, scope, label, size: size || resolveDocPaperSize(scope, docSettings[scope] || {}) });
  }
  function closePreview() {
    setPreview((prev) => ({ ...prev, open: false }));
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
        toast.success("تم استيراد ملف الجهاز — أعد تشغيل معالج المعايرة للتحقق");
      } catch {
        toast.error("ملف غير صالح");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const s = settings;
  const customBlocks = getCustomBlocks(settings);

  return (
    <div className="mx-auto max-w-[1100px] space-y-10 pb-8">

      {/* ── Print Studio hero — the ONE design surface ── */}
      <section className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <Paintbrush className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-primary)]">استوديو الطباعة</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed text-[var(--text-muted)]">
              كل تصميم المستندات في مكان واحد: التصميم العام المشترك، تخصيص كل مستند، القوالب الجاهزة (+20 لكل مقاس)، الأعمدة، الخطوط، والطباعة التجريبية.
            </div>
          </div>
        </div>
        <button type="button" onClick={() => openStudio("_global")}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]">
          <Maximize2 size={15} /> فتح الاستوديو
        </button>
      </section>

      {/* ── Printer assignment per paper size ── */}
      <section>
        <SectionLabel icon={PrinterIcon} title="الطباعة الفورية — اختر طابعة لكل حجم" hint="اختر طابعة ← عند الضغط على طباعة يُرسل المستند مباشرة للطابعة بدون أي نوافذ أو خطوات إضافية" />
        {!isElectronPrint() ? (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[11px] font-bold text-[var(--warning-text)]">
            <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
            هذه الميزة تعمل فقط داخل تطبيق سطح المكتب (.exe) — قائمة الطابعات المتصلة بجهازك ستظهر هنا عند فتح التطبيق
          </div>
        ) : printers.length === 0 ? (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--border-normal)] bg-[var(--bg-input)] px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
            جارٍ تحميل الطابعات المتصلة بجهازك...
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[11px] font-bold text-[var(--success-text)]">
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
              <div key={size} className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-black text-white">{label}</span>
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">{sub}</span>
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
                      className="flex items-center gap-1 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Wrench size={11} /> معايرة
                    </button>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                      isCalibrated ? "bg-success-bg text-success-text" : "bg-[var(--bg-input-hover)] text-[var(--text-muted)]"
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
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] transition-all">
            <Download size={12} /> تصدير ملف الجهاز
          </button>
          <button type="button" onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] transition-all">
            <Upload size={12} /> استيراد ملف الجهاز
          </button>
          <input ref={importFileRef} type="file" accept="application/json" className="hidden" onChange={handleImportDeviceProfile} />
        </div>
      </section>

      {/* ── Per-document print behavior + Studio entry ── */}
      <section>
        <SectionLabel icon={FileText} title="إعدادات طباعة المستندات" hint="اضغط على أي مستند لعرض المقاسات واختيار القوالب والمعاينة" />

        {/* Premium Instruction Box */}
        <div className="mb-4 rounded-xl border border-[var(--primary)]/10 bg-[var(--primary)]/5 p-4 text-[12px] text-[var(--text-secondary)] leading-relaxed shadow-sm">
          <div className="flex items-center gap-2 font-black text-[var(--text-primary)] text-sm mb-1.5">
            <span className="text-primary text-base">💡</span>
            <span>دليل الاستخدام والضبط السريع:</span>
          </div>
          <ul className="list-decimal list-inside space-y-1 text-[11px] font-bold">
            <li>
              <strong>انقر على أي مستند</strong> (مثل: فاتورة مبيعات، إيصال نقطة البيع) لتوسيع السطر وعرض المقاسات المتاحة له.
            </li>
            <li>
              لكل مقاس ورق (مثل: A4 أو 80mm)، يمكنك تعيينه كـ <strong>"افتراضي"</strong> ليُعتمد تلقائياً عند طباعة هذا المستند.
            </li>
            <li>
              بجانب كل مقاس، اضغط على زر <strong>"قالب جاهز" (مثل: بدون قالب)</strong> لتطبيق تصميم جاهز بضغطة واحدة، أو زر <strong>"الاستوديو"</strong> للتحكم الكامل.
            </li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-normal)]">
          <table className="w-full text-[11px]">
            <thead className="bg-[var(--bg-input)]">
              <tr className="font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-normal)]">
                <th className="px-3 py-2 text-right">المستند</th>
                <th className="px-3 py-2 text-right">الحجم النشط حالياً</th>
                <th className="px-3 py-2 text-right">سلوك الطباعة</th>
                <th className="px-3 py-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {DOC_TYPES.map(({ key, label, badge, hint }) => {
                const cfg = DOC_PAPER_CONFIG[key] || { sizes: ["A4"], defaultSize: "A4" };
                const doc = docSettings[key] || {};
                const effSize = resolveDocPaperSize(key, doc);
                const hasOverride = !!doc.paper_size;
                const isExpanded = expandedDocs.includes(key);
                return (
                  <React.Fragment key={key}>
                    {/* ── Collapsed header row ── */}
                    <tr
                      className={[
                        "border-t border-[var(--border-subtle)] font-bold transition-all duration-150 cursor-pointer select-none",
                        isExpanded
                          ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                      title="انقر لتوسيع السطر وعرض مقاسات الورق والقوالب"
                      onClick={() => toggleExpand(key)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2.5">
                          <div className={["flex h-5 w-5 items-center justify-center rounded transition-colors mt-0.5 shrink-0", isExpanded ? "bg-primary text-white" : "bg-[var(--bg-input)] text-[var(--text-muted)]"].join(" ")}>
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={isExpanded ? "font-black text-primary text-2sm" : "font-black text-[var(--text-primary)] text-2sm"}>{label}</span>
                              <span className="rounded bg-[var(--bg-input)] border border-[var(--border-normal)] px-1.5 py-0.5 text-[9px] font-black text-[var(--text-muted)] leading-none select-none">
                                {badge}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-[var(--text-muted)] mt-1.5 leading-relaxed max-w-[450px]">
                              {hint}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        {/* Single chip showing the currently effective size */}
                        <span className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black leading-none",
                          hasOverride
                            ? "bg-primary text-white shadow-sm"
                            : "border border-dashed border-[var(--border-strong)] text-[var(--text-secondary)]",
                        ].join(" ")}>
                          {effSize}
                          {!hasOverride && <span className="text-[8px] opacity-60">افتراضي</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={doc.print_mode || "preview"}
                          onChange={(e) => updateDoc(key, { print_mode: e.target.value })}
                          className="rounded-md border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-accent)] cursor-pointer"
                        >
                          {PRINT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-[10px] font-black text-[var(--text-muted)] bg-[var(--bg-input)] rounded px-1.5 py-0.5">
                          {cfg.sizes.length} خيارات
                        </span>
                      </td>
                    </tr>

                    {/* ── Expanded: one card per available size ── */}
                    {isExpanded && (
                      <tr className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="flex flex-wrap gap-3">
                            {cfg.sizes.map((sz) => {
                              const isEffective = effSize === sz;
                              const isUserOverride = doc.paper_size === sz;
                              const isSysDefault = sz === cfg.defaultSize && !doc.paper_size;
                              const preset = doc[`preset_${familyOfSize(sz)}`];
                              return (
                                <div
                                  key={sz}
                                  className={[
                                    "flex flex-col gap-3 rounded-xl border p-3.5 min-w-[170px] flex-1 transition-all relative overflow-hidden",
                                    isEffective
                                      ? "border-primary bg-[var(--accent-soft)] shadow-md ring-1 ring-primary/20 scale-[1.01]"
                                      : "border-[var(--border-normal)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:shadow-sm",
                                  ].join(" ")}
                                >
                                  {/* Size header + default toggle */}
                                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                                    <span className={["text-lg font-black tracking-wide", isEffective ? "text-primary" : "text-[var(--text-primary)]"].join(" ")}>
                                      {sz}
                                    </span>
                                    {isEffective ? (
                                      <div className="flex items-center gap-1">
                                        <span className="inline-flex items-center gap-1 rounded bg-[var(--success-bg)] border border-[var(--success-border)] px-1.5 py-0.5 text-[9px] font-black text-[var(--success-text)] shadow-sm">
                                          ✔ المقاس الافتراضي
                                        </span>
                                        {isUserOverride && (
                                          <button
                                            type="button"
                                            title="إلغاء التخصيص والعودة لافتراضي النظام"
                                            onClick={() => updateDoc(key, { paper_size: "" })}
                                            className="flex h-5 w-5 items-center justify-center rounded border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[9px] text-[var(--text-muted)] hover:bg-danger-bg hover:text-danger-text hover:border-danger-border transition-all"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => updateDoc(key, { paper_size: sz })}
                                        className="rounded border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[9px] font-black text-[var(--text-muted)] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                                      >
                                        تعيين كافتراضي
                                      </button>
                                    )}
                                  </div>

                                  {/* Preset for this size — read-only display. All design changes go through the Studio. */}
                                  <div className="text-[9px] font-bold text-[var(--text-muted)] leading-none -mb-1 mt-1">
                                    القالب المطبق:
                                  </div>
                                  <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1.5">
                                    <Palette size={12} className="shrink-0 text-[var(--text-muted)]" />
                                    <span className="truncate text-[10px] font-bold text-[var(--text-primary)]">
                                      {preset?.label || "—"}
                                    </span>
                                    {!preset && (
                                      <span className="text-[9px] text-[var(--text-muted)] mr-auto">لا يوجد — استخدم الاستوديو لاختيار قالب</span>
                                    )}
                                  </div>

                                  {/* Preview + Studio for this size */}
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openPreview(key, label, sz)}
                                      title={`معاينة كما يُطبع بمقاس ${sz}`}
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-primary transition-all"
                                    >
                                      <Eye size={11} /> معاينة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openStudio(key, sz)}
                                      title={`فتح الاستوديو بمقاس ${sz}`}
                                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] py-1.5 text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all"
                                    >
                                      <Paintbrush size={11} /> الاستوديو
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)]">
          <Copy size={11} />
          "طباعة فورية" تُرسل المستند مباشرة للطابعة المعيَّنة أعلاه بدون نافذة معاينة. التغييرات تُحفظ تلقائياً.
        </div>
      </section>

      {/* ── System default paper (fallback when a doc has no override) ── */}
      <section>
        <SectionLabel icon={Ruler} title="مقاس الورق الافتراضي للنظام" hint="يُستخدم عندما لا يحدد المستند مقاساً خاصاً به" />
        <PaperPicker value={get(s, "receipt_width")} onChange={(v) => onChange("receipt_width", v)} />
      </section>

      {/* ── Print job log ── */}
      <section>
        <button type="button" onClick={() => setLogOpen((v) => !v)} className="w-full flex items-center gap-2">
          <div className="flex-1">
            <SectionLabel icon={History} title="سجل الطباعة" hint="آخر عمليات الطباعة الصامتة على هذا الجهاز" />
          </div>
          {logOpen ? <ChevronUp size={14} className="text-[var(--text-muted)] mb-4" /> : <ChevronDown size={14} className="text-[var(--text-muted)] mb-4" />}
        </button>
        {logOpen && (
          <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{printJobLog.length} عملية</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPrintJobLog(getPrintJobLog())}
                  className="flex items-center gap-1 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input-hover)] transition-all">
                  <RefreshCw size={11} /> تحديث
                </button>
                <button type="button" onClick={() => { clearPrintJobLog(); setPrintJobLog([]); }}
                  className="flex items-center gap-1 rounded-md border border-danger-border bg-danger-bg px-2 py-1 text-[10px] font-black text-danger-text hover:bg-[var(--danger-light)] transition-all">
                  <Trash2 size={11} /> مسح
                </button>
              </div>
            </div>
            {printJobLog.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11px] font-bold text-[var(--text-muted)]">لا توجد عمليات طباعة بعد</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-[var(--bg-input)]">
                    <tr className="text-[var(--text-muted)] font-black uppercase tracking-widest">
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
                        <tr key={idx} className={`border-t border-[var(--border-subtle)] font-bold ${entry.ok ? "text-[var(--text-secondary)]" : "bg-danger-bg text-danger-text"}`}>
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

      {/* ── Legacy custom text blocks (rendered on paper via the bridge) ── */}
      <section>
        <SectionLabel icon={AlignLeft} title="نصوص مخصصة" hint="نصوص حرة تظهر في مواضع محددة من كل المستندات — للتحكم الكامل بالتصميم استخدم الاستوديو" />
        <CustomTextBlocksSection
          blocks={customBlocks}
          onUpdate={(newBlocks) => saveCustomBlocks(newBlocks, onChange)}
        />
      </section>

      <CalibrationWizard
        open={calWizard.open}
        onClose={closeCalibrationWizard}
        printerName={calWizard.printerName}
        sizeKey={calWizard.sizeKey}
      />

      {studio.open && (
        <PrintStudio
          open={studio.open}
          onClose={closeStudio}
          initialScope={studio.scope}
          initialSize={
            studio.size
            || (studio.scope === "_global"
              ? get(s, "receipt_width")
              : resolveDocPaperSize(studio.scope, docSettings[studio.scope] || {}))
          }
        />
      )}

      {preview.open && (
        <DocPreviewModal
          open={preview.open}
          scope={preview.scope}
          size={preview.size}
          label={preview.label}
          appSettings={settings}
          globalSettings={docSettings._global || {}}
          docSettings={docSettings[preview.scope] || {}}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
