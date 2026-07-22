import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Ruler, Receipt, FileText, FileBarChart2, Wrench, Download, Upload,
  Trash2, CheckCircle2, XCircle, History, ChevronDown, ChevronUp, RefreshCw,
  Paintbrush, Maximize2, Printer as PrinterIcon, Copy, Palette, Eye, ExternalLink,
  Zap,
} from "lucide-react";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { usePermission } from "../../hooks/usePermission";

import api from "../../services/api";
import toast from "react-hot-toast";
import CalibrationWizard from "../../components/print/calibration/CalibrationWizard";
import PrinterSetupWizard from "../../components/print/PrinterSetupWizard";
import PrintStudio from "../../components/print/studio/PrintStudio";
import DocPreviewModal from "../../components/print/studio/DocPreviewModal";
import DocPreviewGallery, { MiniPreview } from "../../components/print/studio/DocPreviewGallery";
import { familyOfSize, pageWidthStr, pageHeightStr, pageDimensions, PX_PER_MM, sampleById, templateMockBySample, DOC_PAPER_CONFIG, resolveDocPaperSize, BLOCK_DOC_SCOPES } from "../../components/print/studio/studioData";
import {
  listPrinters, isElectronPrint, getPrinterSizeMap, setPrinterSizeMap,
  getPrintJobLog, clearPrintJobLog,
} from "../../services/printService";
import { resolveCalibration, exportDeviceProfile, importDeviceProfile } from "../../services/printCalibration";
import LayoutRenderer from "../../components/print/LayoutRenderer";
import { resolveEffectiveLayout, seedFamilyLayout } from "../../components/print/layout/layoutModel";

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
  { key: "pos_receipt",           label: "فاتورة / إيصال المبيعات", badge: "المبيعات (رول / A4 مكتبية)",      hint: "يُطبع تلقائياً فور النقر على 'دفع وحفظ الفاتورة' (F12) في شاشة نقطة البيع (الكاشير)، وعند طباعة أي فاتورة مبيعات محفوظة من سجل المبيعات.", category: "المبيعات", catColor: "#1e40af", pages: ["نقطة البيع (POS)", "سجل المبيعات"] },
  { key: "kitchen_ticket",       label: "تيكت المطبخ",           badge: "طباعة مختصرة (رول)",               hint: "يُطبع تلقائياً مع فاتورة المبيعات عند تفعيل خيار 'طباعة تيكت المطبخ' في نقطة البيع، ويحتوي على أصناف الطلب فقط.", category: "المبيعات", catColor: "#1e40af", pages: ["نقطة البيع (POS)"] },
  { key: "sales_return",          label: "مرتجع مبيعات",          badge: "رول / ورق A4 (مرتجع عميل)",         hint: "يُطبع تلقائياً أو يدوياً عند النقر على 'طباعة المرتجع' بعد إتمام الفاتورة الاسترجاعية في شاشة 'مرتجع المبيعات'.", category: "المبيعات", catColor: "#1e40af", pages: ["مرتجع المبيعات"] },
  { key: "quotation",             label: "عرض سعر",               badge: "سند عرض تسعير للعملاء",             hint: "يُطبع بالضغط على زر 'طباعة العرض' في شاشة 'عروض الأسعار' (Sales -> Quotations) لتقديمه للعميل للموافقة على الأسعار.", category: "المبيعات", catColor: "#1e40af", pages: ["عروض الأسعار"] },
  { key: "payment_receipt",       label: "إيصال دفع",             badge: "سند مالي (قبض وصرف)",               hint: "يُطبع فور حفظ مستند دفع أو قبض في شاشة 'السندات المالية -> سندات الصرف والقبض' لتسليم العميل أو المورد وصلاً ماليًا.", category: "المبيعات", catColor: "#1e40af", pages: ["السندات المالية"] },

  { key: "purchase_order",        label: "أمر شراء",              badge: "سند طلب مشتريات للموردين",         hint: "يُطبع عبر زر 'طباعة' داخل شاشة 'أوامر الشراء' (Purchases -> Orders) لإرساله بالبريد أو الواتساب للمورد لتوفير البضائع.", category: "المشتريات", catColor: "#059669", pages: ["أوامر الشراء"] },
  { key: "purchase_return",       label: "مرتجع مشتريات",         badge: "سند مرتجع بضائع للمورد",            hint: "يُطبع من خلال زر 'طباعة السند' داخل شاشة 'مرتجع المشتريات' لتسليمه للمندوب أو المورد مع البضائع المرجعة.", category: "المشتريات", catColor: "#059669", pages: ["مرتجع المشتريات"] },

  { key: "branch_transfer",       label: "تحويل فرع",             badge: "سند نقل مخزني بين الفروع",          hint: "يُطبع عبر زر 'طباعة إذن التحويل' في شاشة 'حركات المخزون -> تحويلات الفروع' لمرافقة البضائع المنقولة مع السائق.", category: "المخزون", catColor: "#7c3aed", pages: ["تحويلات الفروع"] },
  { key: "physical_count_report", label: "تقرير جرد المخزون",      badge: "تقرير جرد فعلي مع فروقات",          hint: "يُطبع من شاشة جرد المخزون بعد اعتماد الجرد أو من معاينة الجلسة — يشمل ملخص الفروقات وجدول الأصناف والتوقيعات.", category: "المخزون", catColor: "#7c3aed", pages: ["جرد المخزون"] },

  { key: "account_statement",     label: "كشف حساب (عميل/مورد)",  badge: "كشف حركات عميل أو مورد",             hint: "يُطبع عبر زر 'طباعة كشف الحساب' في شاشات حسابات العملاء والموردين عند تحديد عميل/مورد والضغط على طباعة/تصدير → طباعة. يدعم التصميم الكامل عبر الاستوديو.", category: "الحسابات", catColor: "#dc2626", pages: ["حسابات العملاء", "حسابات الموردين"] },
  { key: "ajal_statement",        label: "كشف آجل",               badge: "كشف مديونية عميل محدد",             hint: "يُطبع بالضغط على زر 'طباعة كشف الحساب' من الملف الشخصي للعميل في شاشة 'العملاء والمندوبين -> حسابات العملاء الآجلين'.", category: "الحسابات", catColor: "#dc2626", pages: ["الحسابات الآجلة"] },
  { key: "ajal_schedule",          label: "جدول أقساط",            badge: "تواريخ وجداول الأقساط",              hint: "يُطبع بالضغط على زر 'جدول الأقساط' في نافذة تفاصيل الدين لشاشة 'المبيعات الآجلة والأقساط' لتسليم العميل قائمة التواريخ.", category: "الحسابات", catColor: "#dc2626", pages: ["المبيعات الآجلة والأقساط"] },
  { key: "ajal_full_statement",   label: "كشف حساب كامل",         badge: "سجل الديون لجميع العملاء",           hint: "يُطبع بالضغط على زر 'تصدير وطباعة' في شاشة 'التقارير -> تقرير الديون والأرصدة الآجلة الشامل' لمتابعة كافة التحصيلات المستحقة.", category: "الحسابات", catColor: "#dc2626", pages: ["تقرير الديون الشامل"] },

  { key: "daily_treasury",        label: "تقرير الخزينة",         badge: "تقرير جرد الصناديق والخزائن",        hint: "يُطبع بالضغط على 'طباعة تقرير الإغلاق' في شاشة 'الخزائن والصناديق -> حركة الخزينة اليومية' لتسليم الإدارة جرد الإيرادات والمصاريف.", category: "الخزينة والمالية", catColor: "#d97706", pages: ["حركة الخزينة اليومية"] },
  { key: "bank_statement",        label: "كشف بنكي",              badge: "تقرير مالي (حساب بنك)",             hint: "يُطبع بالنقر على زر 'طباعة الكشف' في شاشة 'الحسابات المالية -> كشوف البنوك' بعد تحديد البنك وفترة الحركة.", category: "الخزينة والمالية", catColor: "#d97706", pages: ["كشوف البنوك"] },
  { key: "cheque_register",       label: "سجل شيكات",             badge: "تقرير شيكات صادرة وواردة",          hint: "يُطبع بالضغط على زر 'طباعة السجل' في شاشة 'شؤون الشيكات والأوراق المالية' لمراجعة الشيكات المستحقة وتواريخ التحصيل البنكي.", category: "الخزينة والمالية", catColor: "#d97706", pages: ["شؤون الشيكات والأوراق المالية"] },
  { key: "payment_methods_report",label: "تقرير وسائل الدفع",     badge: "تحليل المقبوضات حسب الوسيلة",       hint: "يُطبع بالضغط على زر 'طباعة تقرير المدفوعات' من شاشة 'التقارير -> مبيعات وسائل الدفع' لمطابقة مبالغ الكاش والشبكة والتحويل البنكي.", category: "الخزينة والمالية", catColor: "#d97706", pages: ["مبيعات وسائل الدفع"] },
  { key: "owner_statement",       label: "لوحة صاحب المحل",       badge: "كشف الإقفال المالي الشهري",          hint: "يُطبع بالضغط على زر 'طباعة الصفحة' في شاشة 'لوحة صاحب المحل' ويشمل المؤشرات المالية الأساسية والتدفقات النقدية للفترة المحددة.", category: "الخزина والمالية", catColor: "#d97706", pages: ["لوحة صاحب المحل"] },

  { key: "reports_generic",       label: "قوالب تقارير (عام)",    badge: "قالب عام لتقارير النظام",            hint: "يتحكم في التصميم الموحد والخط وحجم الهوامش لكافة تقارير النظام الأخرى الصادرة من 'مركز التقارير وقوائم المخزون وجرد المستودعات'.", category: "التقارير العامة", catColor: "#0f172a", pages: ["مركز التقارير", "قوائم المخزون", "جرد المستودعات"] },
];

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
    <select value={value ?? ""} onChange={onChange} className="w-full rounded-md border border-[var(--border-normal)] bg-[var(--bg-input)] py-2 px-3 text-2sm font-bold text-[var(--text-primary)] outline-none hover:border-[var(--border-strong)] focus:bg-[var(--bg-surface)] focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm transition-all appearance-none cursor-pointer">
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

const stripLayout = ({ layout, ...rest } = {}) => rest;

/** Match Studio's effFam() exactly — raw layout, no normalizeLayout. */
function getRawLayout(scopeSettings, globalSettings, fam, scope) {
  const isReport = scope !== "_global" && !BLOCK_DOC_SCOPES.has(scope);
  // Respect per-family inherit flags (inherit_global_roll / inherit_global_page)
  const familyKey = fam ? `inherit_global_${fam}` : null;
  const docInherit = familyKey ? (scopeSettings?.[familyKey] ?? scopeSettings?.inherit_global) : scopeSettings?.inherit_global;
  const inherit = docInherit !== undefined ? docInherit : !isReport;
  if (scope === "_global" || inherit) {
    return (globalSettings?.layout || {})[fam] || seedFamilyLayout(fam, scope);
  }
  return (scopeSettings?.layout || {})[fam] || seedFamilyLayout(fam, scope);
}

/** Compute merged flat settings matching what the Studio passes to LayoutRenderer.
 *  appSettings → _global flat → per-doc flat (respecting per-family inherit). */
function mergeRendererSettings(appSettings, docSettings, scope, family) {
  const globalDoc = docSettings._global || {};
  const doc = docSettings[scope] || {};
  const isReportScope = scope !== "_global" && !BLOCK_DOC_SCOPES.has(scope);
  // Per-family inherit: check inherit_global_roll / inherit_global_page, fallback to legacy inherit_global
  const familyKey = family ? `inherit_global_${family}` : null;
  const docInherit = familyKey ? (doc[familyKey] ?? doc.inherit_global) : doc.inherit_global;
  const inheritGlobal = docInherit !== undefined ? docInherit : !isReportScope;
  if (scope === "_global" || inheritGlobal) {
    return { ...appSettings, ...stripLayout(globalDoc) };
  }
  return { ...appSettings, ...stripLayout(doc) };
}

export default function PrintingSettingsPanel({ settings, onChange, onDirty }) {
  const restaurantEnabled = useFeatureEnabled("feature_restaurant");
  const canEdit = usePermission("print_settings", "edit");
  const canStudio = usePermission("print_settings", "studio");
  const canCalibrate = usePermission("print_settings", "calibrate");
  const canDeviceProfile = usePermission("print_settings", "device_profile");
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fullPreview, setFullPreview] = useState({ open: false, scope: null, size: "A4", label: "" });
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [globalBlockStamp, setGlobalBlockStamp] = useState(false);
  const importFileRef = useRef(null);

  const visibleDocTypes = useMemo(
    () => DOC_TYPES.filter((d) => d.key !== "kitchen_ticket" || restaurantEnabled),
    [restaurantEnabled]
  );

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

  useEffect(() => {
    const g = docSettings._global || {};
    setGlobalBlockStamp(g.reprint_stamp === false);
  }, [docSettings]);

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

  function toggleGlobalBlockStamp() {
    const next = !globalBlockStamp;
    setGlobalBlockStamp(next);
    api.put("/api/print-settings-per-doc/_global", { reprint_stamp: !next })
      .then(() => loadDocSettings())
      .catch(() => toast.error("خطأ في حفظ إعدادات الختم"));
    onDirty?.();
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

  return (
    <div className="mx-auto max-w-[1100px] space-y-10 pb-8">

      {/* ── Print Studio hero — the ONE design surface ── */}
      <section className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-accent)] bg-[var(--accent-soft)] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <Paintbrush className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text-primary)]">استوديو الطباعة (تصميم الفواتير)</div>
            <div className="mt-0.5 text-[11px] font-bold leading-relaxed text-[var(--text-muted)]">
              المكان اللي بتصمم فيه شكل الفواتير والتقارير. فيه قوالب جاهزة كتير وتعديل على الخطوط والأعمدة براحتك.
            </div>
          </div>
        </div>
        {canStudio && <button type="button" onClick={() => openStudio("_global")}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]">
          <Maximize2 size={15} /> فتح الاستوديو
        </button>}
      </section>

      {/* ── Printer assignment per paper size ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel icon={PrinterIcon} title="الطباعة السريعة — اربط طابعة بكل مقاس" hint="اختار طابعة هنا عشان لما تدوس طباعة، الورقة تطلع على طول من غير ما يسألك." />
          {canEdit && <button type="button" onClick={() => setSetupWizardOpen(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[11px] font-black text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]">
            <Zap size={13} /> تأسيس سريع
          </button>}
        </div>
        {!isElectronPrint() ? (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-[11px] font-bold text-[var(--warning-text)]">
            <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
            الميزة دي شغالة بس لو فاتح البرنامج من الأيقونة بتاعته (.exe)، مش من المتصفح. الطابعات هتظهر هناك.
          </div>
        ) : printers.length === 0 ? (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--border-normal)] bg-[var(--bg-input)] px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
            بنحاول نشوف الطابعات المتوصلة بالجهاز...
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[11px] font-bold text-[var(--success-text)]">
            <PrinterIcon className="h-3.5 w-3.5 shrink-0" />
            لقينا {printers.length} طابعة واصلة بجهازك — اختار واحدة لكل مقاس عشان تشتغل معاك طلقة.
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
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">{label}</span>
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
                      disabled={!assignedPrinter || !canCalibrate}
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
          {canDeviceProfile && <>
            <button type="button" onClick={handleExportDeviceProfile}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] transition-all">
              <Download size={12} /> تصدير ملف الجهاز
            </button>
            <button type="button" onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-normal)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-input-hover)] transition-all">
              <Upload size={12} /> استيراد ملف الجهاز
            </button>
          </>}
          <input ref={importFileRef} type="file" accept="application/json" className="hidden" onChange={handleImportDeviceProfile} />
        </div>
      </section>

      {/* ── Per-document print behavior + Studio entry ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel icon={FileText} title="إعدادات الورق والفواتير" hint="دوس على أي نوع فاتورة عشان تختار مقاس الورق والقالب بتاعها." />
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all"
          >
            <Maximize2 size={12} />
            معرض المعاينات
          </button>
        </div>

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

        {/* Global reprint stamp toggle */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border-normal)] bg-[var(--bg-input)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Copy size={13} className="text-[var(--text-muted)]" />
            {globalBlockStamp ? (
              <>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">ختم "نسخة" معطّل</span>
                <span className="text-[9px] font-bold text-[var(--text-muted)]">(لن يظهر ختم عند إعادة الطباعة)</span>
              </>
            ) : (
              <>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">ختم "نسخة" مفعّل</span>
                <span className="text-[9px] font-bold text-[var(--text-muted)]">(يظهر ختم عند إعادة طباعة مستند مطبوع سابقاً)</span>
              </>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={globalBlockStamp}
            onClick={() => canEdit && toggleGlobalBlockStamp()}
            disabled={!canEdit}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${globalBlockStamp ? "bg-primary" : "bg-[var(--border-normal)]"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-surface shadow-sm transition-transform duration-200 ${globalBlockStamp ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-[3px] rtl:-translate-x-[3px]"}`} />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--border-normal)]">
          <table className="w-full text-[11px]">
            <thead className="bg-[var(--bg-input)]">
              <tr className="font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-normal)]">
                <th className="px-3 py-2 text-right">المستند</th>
                <th className="px-3 py-2 text-right">الحجم النشط حالياً</th>
                <th className="px-3 py-2 text-right">سلوك الطباعة</th>
                <th className="px-3 py-2 text-center">النسخ</th>
                <th className="px-3 py-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = [];
                let lastCat = null;
                visibleDocTypes.forEach(({ key, label, badge, hint, category, catColor, pages }) => {
                  if (category !== lastCat) {
                    lastCat = category;
                    rows.push(
                      <tr key={`cat-${category}`} className="bg-[var(--bg-surface)] border-t-2 border-[var(--border-normal)]">
                        <td colSpan={5} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-5 w-5 items-center justify-center rounded text-white text-[9px] font-black shrink-0" style={{ backgroundColor: catColor }}>
                              {category.charAt(0)}
                            </div>
                            <span className="text-[11px] font-black" style={{ color: catColor }}>{category}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const cfg = DOC_PAPER_CONFIG[key] || { sizes: ["A4"], defaultSize: "A4" };
                  const doc = docSettings[key] || {};
                  const effSize = resolveDocPaperSize(key, doc);
                  const hasOverride = !!doc.paper_size;
                  const isExpanded = expandedDocs.includes(key);
                  rows.push(
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
                            {pages && pages.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {pages.map((p) => (
                                  <span key={p} className="inline-flex items-center gap-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1 py-0.5 text-[8px] font-bold text-[var(--text-muted)]">
                                    <ExternalLink size={6} />
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
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
                          onChange={(e) => {
                            if (!canEdit) return;
                            updateDoc(key, { print_mode: e.target.value });
                            onDirty?.();
                          }}
                          disabled={!canEdit}
                          className="rounded-md border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] outline-none hover:border-[var(--border-strong)] focus:bg-[var(--bg-surface)] focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {PRINT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={doc.print_copies || 1}
                          onChange={(e) => {
                            if (!canEdit) return;
                            const v = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                            updateDoc(key, { print_copies: v });
                            onDirty?.();
                          }}
                          disabled={!canEdit}
                          className="w-14 rounded-md border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] text-center outline-none hover:border-[var(--border-strong)] focus:bg-[var(--bg-surface)] focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="عدد النسخ المطبوعة عند الطباعة الفورية"
                        />
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
                        <td colSpan={5} className="px-4 py-4">
                          <div className="flex flex-wrap gap-3">
                            {cfg.sizes.map((sz) => {
                              const isEffective = effSize === sz;
                              const isUserOverride = doc.paper_size === sz;
                              const isSysDefault = sz === cfg.defaultSize && !doc.paper_size;
                              const preset = doc[`preset_${familyOfSize(sz)}`];
                              const hasLayout = !!(doc && doc.layout);
                              return (
                                <div
                                  key={sz}
                                  className={[
                                    "flex flex-col gap-3 rounded-xl border p-4 min-w-[220px] max-h-[380px] flex-1 transition-all relative overflow-hidden",
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
                                        {isUserOverride && canEdit && (
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
                                    ) : canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => updateDoc(key, { paper_size: sz })}
                                        className="rounded border border-dashed border-[var(--border-strong)] bg-transparent px-2 py-0.5 text-[9px] font-black text-[var(--text-muted)] hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                                      >
                                        تعيين كافتراضي
                                      </button>
                                    ) : null}
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

                                  {/* Mini preview — click to go fullscreen */}
                                  <button
                                    type="button"
                                    onClick={() => setFullPreview({ open: true, scope: key, size: sz, label })}
                                    className="w-full cursor-pointer rounded-lg overflow-hidden border border-[var(--border-normal)] hover:border-primary hover:shadow-md transition-all group relative"
                                    title={`معاينة ${label} بمقاس ${sz}`}
                                  >
                                    <MiniPreview
                                      scope={key}
                                      scopeSettings={{ ...doc, paper_size: sz }}
                                      globalSettings={docSettings._global || {}}
                                      rendererSettings={{ ...mergeRendererSettings(settings, docSettings, key, familyOfSize(sz)), paper_size: sz }}
                                      width={180}
                                      height={240}
                                    />
                                    {/* Inheritance indicator — per-family */}
                                    {(() => {
                                      const szFamily = familyOfSize(sz);
                                      const szInheritKey = `inherit_global_${szFamily}`;
                                      const szInherit = doc[szInheritKey] ?? doc.inherit_global;
                                      const szIsInheriting = szInherit !== undefined ? szInherit : key !== "_global" && BLOCK_DOC_SCOPES.has(key);
                                      if (szIsInheriting && key !== "_global") return (
                                        <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/25 px-1.5 py-0.5 text-[7px] font-black text-[var(--primary)] backdrop-blur-sm">
                                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                                          يرث من العام
                                        </span>
                                      );
                                      if (!szIsInheriting && key !== "_global") return (
                                        <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-[var(--success-bg)] border border-[var(--success-border)] px-1.5 py-0.5 text-[7px] font-black text-[var(--success-text)] backdrop-blur-sm">
                                          تصميم خاص
                                        </span>
                                      );
                                      return null;
                                    })()}
                                    {/* Saved badge */}
                                    {hasLayout && (
                                      <span className="absolute top-1.5 left-1.5 z-10 h-2 w-2 rounded-full bg-[var(--success-text)] shadow-sm" title="تصميم محفوظ" />
                                    )}
                                    <div className="flex items-center justify-center gap-1 py-1 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] group-hover:bg-primary/5 transition-colors">
                                      <Eye size={10} className="text-[var(--text-muted)] group-hover:text-primary" />
                                      <span className="text-[9px] font-black text-[var(--text-muted)] group-hover:text-primary">عرض كامل</span>
                                    </div>
                                  </button>

                                  {/* Studio button */}
                                  {canStudio && <button
                                    type="button"
                                    onClick={() => openStudio(key, sz)}
                                    title={`فتح الاستوديو بمقاس ${sz}`}
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] py-1.5 text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all"
                                  >
                                    <Paintbrush size={11} /> الاستوديو
                                  </button>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)]">
          <Copy size={11} />
          "طباعة فورية" تُرسل المستند مباشرة للطابعة المعيَّنة أعلاه بدون نافذة معاينة. "النسخ" تحدد عدد النسخ المطبوعة (1-10). التغييرات تُحفظ تلقائياً.
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

      <CalibrationWizard
        open={calWizard.open}
        onClose={closeCalibrationWizard}
        printerName={calWizard.printerName}
        sizeKey={calWizard.sizeKey}
      />

      <PrinterSetupWizard
        open={setupWizardOpen}
        onClose={() => setSetupWizardOpen(false)}
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

      {galleryOpen && (
        <DocPreviewGallery
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          docSettings={docSettings}
          appSettings={settings}
        />
      )}

      {/* Fullscreen preview for individual doc+size */}
      {fullPreview.open && fullPreview.scope && (
        <FullscreenDocPreview
          scope={fullPreview.scope}
          size={fullPreview.size}
          label={fullPreview.label}
          docSettings={docSettings}
          appSettings={settings}
          onClose={() => setFullPreview({ open: false, scope: null, size: "A4", label: "" })}
          onOpenStudio={(scope, sz) => {
            setFullPreview({ open: false, scope: null, size: "A4", label: "" });
            openStudio(scope, sz);
          }}
        />
      )}
    </div>
  );
}

function FullscreenDocPreview({ scope, size, label, docSettings, appSettings, onClose, onOpenStudio }) {
  const settings = docSettings[scope] || {};
  const globalSettings = docSettings._global || {};
  // Compute effective size first so we can pass its family to mergeRendererSettings
  const effectiveSize = size || settings.paper_size || "A4";
  const fam = familyOfSize(effectiveSize);
  const rendererSettings = useMemo(
    () => ({
      ...mergeRendererSettings(appSettings, docSettings, scope, fam),
      paper_size: effectiveSize,
      ...(fam === "roll" ? { receipt_width: effectiveSize } : {}),
    }),
    [appSettings, docSettings, scope, fam, effectiveSize]
  );
  const orientation = rendererSettings.orientation || settings.orientation || "portrait";
  const mockData = useMemo(
    () => templateMockBySample(scope, "normal") || sampleById("normal"),
    [scope]
  );
  const layout = useMemo(
    () => getRawLayout(settings, globalSettings, fam, scope),
    [settings, globalSettings, fam, scope]
  );

  const paperRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [rollH, setRollH] = useState(null);

  const dims = pageDimensions(effectiveSize, orientation);
  const contentW = dims.wMm * PX_PER_MM;
  const isRoll = fam === "roll";
  // Reference width: always 80mm so 58mm is narrower at the same zoom
  const ROLL_REF_MM = 80;
  const refPxW = ROLL_REF_MM * PX_PER_MM;

  useEffect(() => {
    if (!isRoll) {
      setRollH(null);
    }
  }, [isRoll, scope, effectiveSize, layout, mockData]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    const container = containerRef.current?.closest('[data-scroll-area]');
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      const availW = container.clientWidth - 48;
      const availH = container.clientHeight - 48;
      if (availW <= 0 || availH <= 0) return;
      if (isRoll) {
        if (rollH === null) {
          const el = paperRef.current;
          if (el) {
            const h = el.scrollHeight || el.offsetHeight;
            if (h > 0) {
              setRollH(h / scale);
            }
          }
        } else {
          const z = Math.min(availW / refPxW, availH / rollH, 1);
          setScale(Math.round(z * 100) / 100);
        }
      } else {
        const contentH = dims.hMm * PX_PER_MM;
        if (contentW <= 0 || contentH <= 0) return;
        const z = Math.min(availW / contentW, availH / contentH, 1);
        setScale(Math.round(z * 100) / 100);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isRoll, contentW, dims.hMm, rollH, scale]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="relative w-full max-w-5xl h-[92vh] bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-normal)] bg-[var(--bg-surface)] px-6 py-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-[10px] font-bold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              رجوع
            </button>
            <span className="text-border-subtle">|</span>
            <div>
              <div className="text-sm font-black text-[var(--text-primary)]">{label}</div>
              <div className="text-[9px] font-bold text-[var(--text-muted)]">{effectiveSize}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-black">{effectiveSize}</span>
            {(() => {
              const inheritKey = `inherit_global_${fam}`;
              const val = settings[inheritKey] ?? settings.inherit_global;
              const isInheriting = val !== undefined ? val : scope !== "_global" && BLOCK_DOC_SCOPES.has(scope);
              if (isInheriting && scope !== "_global") return (
                <span className="flex items-center gap-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-2 py-0.5 text-[9px] font-black text-[var(--primary)]">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                  يرث من التصميم العام
                </span>
              );
              if (!isInheriting && scope !== "_global") return (
                <span className="flex items-center gap-1 rounded-full bg-[var(--success-bg)] border border-[var(--success-border)] px-2 py-0.5 text-[9px] font-black text-[var(--success-text)]">
                  تصميم خاص
                </span>
              );
              return null;
            })()}
            {settings.layout ? (
              <span className="rounded-full bg-success-bg text-success-text border border-success-border px-2 py-0.5 text-[9px] font-black">✔ محفوظ</span>
            ) : (
              <span className="rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] px-2 py-0.5 text-[9px] font-black">افتراضي</span>
            )}
            <button
              type="button"
              onClick={() => onOpenStudio?.(scope, effectiveSize)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-accent)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[10px] font-black text-primary hover:bg-primary hover:text-white transition-all"
            >
              <Paintbrush size={11} /> الاستوديو
            </button>
            <button type="button" onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-danger-bg hover:text-danger-text hover:border-danger-border transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div data-scroll-area className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[var(--bg-base)]">
          <div ref={containerRef}>
            <div
              ref={paperRef}
              style={{
                zoom: scale,
                width: pageWidthStr(effectiveSize, orientation),
                ...(isRoll ? {} : { minHeight: pageHeightStr(effectiveSize, orientation) }),
                background: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                borderRadius: "2px",
              }}
            >
              <LayoutRenderer
                family={fam}
                size={effectiveSize}
                orientation={orientation}
                invoice={mockData}
                settings={rendererSettings}
                layout={{ [fam]: layout }}
                scope={scope}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
