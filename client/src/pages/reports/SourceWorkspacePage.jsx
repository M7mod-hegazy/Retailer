import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import toast from "react-hot-toast";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, ChevronDown, FileImage, FileSpreadsheet, FileText,
  LayoutTemplate, LayoutList, Loader2, Printer, RefreshCw, Search, SlidersHorizontal, Star, X,
  ChevronLeft, ChevronRight, Settings2, Eye, EyeOff, ArrowUp, ArrowDown, Info
} from "lucide-react";
import ChartWorkspace from "../../components/reports/ChartWorkspace";
import A4PageView from "../../components/ui/A4PageView";
import DataGrid from "../../components/ui/DataGrid";
import PDFExportDialog from "../../components/print/PDFExportDialog";
import { reportsApi } from "../../services/reports";
import { useReportsStore, buildPrefKey } from "../../stores/reportsStore";
import { useUiStore } from "../../stores/uiStore";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ReportViaLayout from "../../components/print/templates/ReportViaLayout";
import AccountStatementLedger from "./templates/AccountStatementLedger";
import api from "../../services/api";
import ProgressBar from "../../components/ui/ProgressBar";
import { ClassificationSelector, DataModeToggle, MultiSelectCheckboxes, LookupEntityFilter, ScopeSelector, DATE_PRESETS } from "./reportsCenterParts";
import { fmtDate, getReportDescription, formatReportCellValue, useReportsConfig } from "../../hooks/useReportsConfig";
import { formatNumber } from "../../utils/currency";
import { usePageTour } from '../../hooks/usePageTour';

// All display labels (classifications, filters, options, columns) come from the
// server registry/config — the single source of truth. `a` survives only as an
// identity fallback so an unmapped key degrades to itself instead of crashing.
function a(key) { return key; }
// The document/party cell itself is the link (styled as one); clicking opens a
// leave-confirmation modal that names the destination before navigating.
const LINK_CELLS = {
  sales: new Set(["invoice_no"]),
  purchases: new Set(["purchase_no"]),
  customers: new Set(["customer_name"]),
  suppliers: new Set(["supplier_name"]),
  items: new Set(["item_name", "item_code"]),
  profit: new Set(["item_name", "item_code"]),
};
const ID_TO_NAME_COLUMNS = new Set(["warehouse_id", "supplier_id", "customer_id", "cashier_id", "user_id", "category_id"]);

function arColLabel(key) { return key; }

const TYPE_LABELS = {
  invoice: "فاتورة",
  payment: "دفع",
  sales_return: "مرتجع مبيعات",
  purchase: "مشتريات",
  purchase_return: "مرتجع مشتريات",
  adjustment: "تسوية",
  item: "صنف",
};

function formatDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Row drill-down: an explicit, labeled button per row (never a silent whole-row
// click) — the user sees WHERE they'd go before leaving the report.
function resolveRowLink(sourceKey, classificationId, row) {
  if (row._is_item) return null;
  if (sourceKey === "sales" && row.invoice_no && row.id)
    return { href: `/invoices/${row.id}`, label: `فتح الفاتورة ${row.invoice_no}` };
  if (sourceKey === "purchases" && row.purchase_no && row.id)
    return { href: `/purchases/${row.id}`, label: `فتح فاتورة الشراء ${row.purchase_no}` };
  if (sourceKey === "customers" && classificationId !== "statement" && row.customer_id)
    return { href: `/reports/source/customers/statement/detailed?customer_id=${row.customer_id}`, label: `كشف حساب ${row.customer_name || "العميل"}` };
  if (sourceKey === "suppliers" && classificationId !== "statement" && row.supplier_id)
    return { href: `/reports/source/suppliers/statement/detailed?supplier_id=${row.supplier_id}`, label: `كشف حساب ${row.supplier_name || "المورد"}` };
  if ((sourceKey === "items" || sourceKey === "profit") && row.item_id)
    return { href: `/definitions/items/${row.item_id}`, label: `بطاقة الصنف ${row.item_name || ""}` };
  return null;
}

const CHART_COLORS = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#F59E0B", "#EC4899"];

// Mirror print template constants so workspace pagination matches print pages exactly
const PRINT_HEADER_MM = 22;
const PRINT_FOOTER_MM = 14;
const PRINT_MARGIN_MM = 8;
const PRINT_HEIGHT_MM = 297; // A4

const NOTE_KEYS = new Set([
  "notes","note","day_notes",
]);

const PRINT_TEXT_WRAP_KEYS = new Set([
  "name","item_name","customer_name","supplier_name","description","label",
  "category_name","warehouse_name","cashier","full_name","reason","notes",
]);

function calcPrintRowsPerPage(visibleCols) {
  const colCount = Array.isArray(visibleCols) ? visibleCols.length : visibleCols;
  const hasWrap = Array.isArray(visibleCols)
    ? visibleCols.some((c) => c.type === "text" || c.type === "name" || PRINT_TEXT_WRAP_KEYS.has(c.key || c.id))
    : false; // when only count given, assume no-wrap (conservative initial)
  const usableHeight = PRINT_HEIGHT_MM - PRINT_MARGIN_MM * 2 - PRINT_HEADER_MM - PRINT_FOOTER_MM - 15;
  const baseRowH = colCount > 8 ? 5.5 : colCount > 6 ? 6 : 7;
  const rowH = hasWrap ? baseRowH * 1.2 : baseRowH;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

function TableSkeleton({ colCount = 6 }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-3">
        {Array.from({ length: colCount }).map((_, i) => (
          <div key={i} className="h-8 flex-1 rounded-lg bg-bg-overlay animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: colCount }).map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-lg bg-bg-base animate-pulse" style={{ animationDelay: `${(rowIdx + i) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Shown for supplier/customer statements before a party is picked: a clear CTA
// plus a faded ghost preview of the ledger so the user knows what they'll get.
function StatementEmptyPreview({ partyType }) {
  const label = partyType === "customer" ? "اختر عميلاً لعرض كشف الحساب" : "اختر مورداً لعرض كشف الحساب";
  const ghostRows = [
    { d: "رصيد أول المدة", a: "—", tone: "bg-warning-bg/70" },
    { d: "فاتورة", a: "مدين", tone: "bg-info-bg/60" },
    { d: "أصناف الفاتورة", a: "", tone: "bg-bg-overlay/60", indent: true },
    { d: "دفعة", a: "دائن", tone: "bg-success-bg/60" },
    { d: "مرتجع", a: "دائن", tone: "bg-danger-bg/60" },
    { d: "الإجمالي / رصيد الحركة", a: "", tone: "bg-bg-overlay/80" },
  ];
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center flex-1 py-16 px-6 bg-bg-base/40">
      <div className="h-14 w-14 rounded-2xl bg-bg-surface border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
        <FileText size={26} />
      </div>
      <h3 className="text-[17px] font-black text-text-primary mb-1">{label}</h3>
      <p className="text-sm text-text-secondary mb-7 max-w-md text-center">
        ابحث عن {partyType === "customer" ? "العميل" : "المورد"} من حقل الفلتر بالأعلى لعرض كشف حساب تفصيلي بكل الحركات والأصناف.
      </p>
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-bg-surface shadow-sm overflow-hidden opacity-70 pointer-events-none select-none">
        <div className="grid grid-cols-2 text-[11px] font-bold">
          <div className="bg-bg-surface text-text-secondary px-3 py-2">{partyType === "customer" ? "العميل" : "المورد"}</div>
          <div className="bg-bg-overlay text-text-muted px-3 py-2 text-left">{partyType === "customer" ? "كود العميل" : "كود المورد"}</div>
        </div>
        {ghostRows.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-2.5 border-t border-border ${r.tone} ${r.indent ? "pr-10" : ""}`}>
            <div className="h-2.5 w-2.5 rounded-full bg-bg-overlay" />
            <div className="h-2.5 rounded bg-bg-overlay" style={{ width: r.indent ? "40%" : "55%" }} />
            <div className="ml-auto h-2.5 w-16 rounded bg-bg-overlay/80" />
          </div>
        ))}
      </div>
    </div>
  );
}

const EXPORT_CONFIGS = {
  pdf: { label: "PDF", icon: FileImage, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  excel: { label: "إكسل", icon: FileSpreadsheet, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  word: { label: "وورد", icon: FileText, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  print: { label: "طباعة", icon: Printer, color: "#475569", bg: "rgba(71,85,105,0.08)" },
};

// Save current report + filters as a named view (stored in reportsStore.presets
// as a URL; hub lists them for one-click re-run).
function SaveViewButton({ buildUrl, defaultName }) {
  const savePreset = useReportsStore((st) => st.savePreset);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const doSave = () => {
    const n = name.trim() || defaultName;
    savePreset(n, buildUrl(), null, null);
    toast.success("تم حفظ العرض: " + n);
    setName(""); setOpen(false);
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 rounded-lg bg-bg-surface border border-border text-text-secondary hover:bg-bg-overlay hover:text-text-primary text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm">
        <Star size={14} className="text-warning-text" /> حفظ العرض
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-64 rounded-xl border border-border bg-bg-surface p-3 shadow-2xl space-y-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
            placeholder={defaultName}
            className="w-full h-9 px-3 rounded-lg border border-border bg-bg-base text-sm text-text-primary focus:outline-none focus:border-primary" />
          <button onClick={doSave} className="w-full h-8 rounded-lg bg-primary text-white text-sm font-bold">حفظ</button>
        </div>
      )}
    </div>
  );
}

function ExportPill({ format, onExport }) {
  const [status, setStatus] = useState("idle");
  const cfg = EXPORT_CONFIGS[format];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const handleClick = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try { await onExport(format); setStatus("ready"); setTimeout(() => setStatus("idle"), 2500); }
    catch { setStatus("error"); setTimeout(() => setStatus("idle"), 4000); }
  };
  return (
    <button onClick={handleClick} disabled={status === "loading"}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold transition-all duration-200 border bg-bg-surface shadow-sm hover:shadow-md active:scale-95"
      style={{ color: status === "ready" ? "#047857" : status === "error" ? "#b91c1c" : cfg.color, borderColor: status === "ready" ? "#6ee7b7" : status === "error" ? "#fca5a5" : "#e4e4e7" }}>
      {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span>{status === "loading" ? "ثواني..." : status === "ready" ? "تم ✓" : status === "error" ? "حصلت مشكلة" : cfg.label}</span>
    </button>
  );
}

function FilterInput({ filter, value, onChange, dynamicOptions }) {
  const opts = (dynamicOptions && dynamicOptions.length > 0) ? dynamicOptions : (filter.options || []);
  if (filter.type === "lookup") {
    const entityLabel = { category: "تصنيف", product: "منتج", customer: "عميل", supplier: "مورد", user: "مستخدم", warehouse: "مخزن", payment_method: "وسيلة دفع", employee: "موظف" }[filter.entity] || filter.entity;
    const filterLabel = filter.label || a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-text-secondary">{filterLabel || entityLabel}</label>
        <LookupEntityFilter entity={filter.entity} value={value || ""} onChange={(v) => onChange(filter.key, v)} placeholder={`بحث عن ${entityLabel}...`} />
      </div>
    );
  }
  if (filter.type === "select") {
    const filterLabel = filter.label || a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-text-secondary">{filterLabel}</label>
        <select value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-bg-surface text-sm font-medium text-text-primary focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-bg-overlay transition-all shadow-sm cursor-pointer">
          <option value="">الكل</option>
          {opts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label || a(opt.label_key)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (filter.type === "text") {
    const filterLabel = filter.label || a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-text-secondary">{filterLabel}</label>
        <input type="text" value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-border bg-bg-surface text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-bg-overlay transition-all shadow-sm" />
      </div>
    );
  }
  return null;
}



// Old source/classification URLs that survive in saved views, recents, and
// browser bookmarks after the profit merge + treasury consolidation.
const LEGACY_WORKSPACE_REDIRECTS = {
  "profit-loader": (cls, mode) => `/reports/source/profit/${cls === "by-category" ? "by-category" : cls}/${mode || "detailed"}`,
  "net-profit": (cls, mode) => `/reports/source/profit/${cls}/${mode || "detailed"}`,
};
const LEGACY_CLS_REDIRECTS = {
  "sales.margin": "/reports/source/profit/by-item/detailed",
  "treasury.daily-sessions": "/reports/source/treasury/reconciliation/detailed",
  "treasury.reconciliation-exceptions": "/reports/source/treasury/reconciliation/detailed?variance_only=1",
  "treasury.payment-method-flow": "/reports/source/payment-flow/payment-flow-summary/summary",
  "employees.shifts": "/reports/source/treasury/reconciliation/detailed",
};

export default function SourceWorkspacePage() {
  usePageTour('source_workspace');
  const { sourceKey, classificationId, dataMode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const setColumnOrderAction = useReportsStore((s) => s.setColumnOrder);
  const setColumnVisibilityAction = useReportsStore((s) => s.setColumnVisibility);
  const getStorePreference = useReportsStore((s) => s.getPreference);
  const setCostMethodAction = useReportsStore((s) => s.setCostMethod);
  const store = useReportsStore();
  const { data: config, isLoading: configLoading, error: configError } = useReportsConfig();

  // Redirect retired report URLs to their merged replacements (keeps query string).
  useEffect(() => {
    const legacySource = LEGACY_WORKSPACE_REDIRECTS[sourceKey];
    const legacyCls = LEGACY_CLS_REDIRECTS[`${sourceKey}.${classificationId}`];
    const target = legacyCls || (legacySource ? legacySource(classificationId, dataMode) : null);
    if (target) {
      const qs = location.search && !target.includes("?") ? location.search : "";
      navigate(target + qs, { replace: true });
    }
  }, [sourceKey, classificationId, dataMode, navigate, location.search]);

  const prefKey = buildPrefKey(sourceKey, classificationId, dataMode);

  const { data: registry } = useQuery({
    queryKey: ["report-registry"],
    queryFn: () => reportsApi.fetchRegistry(),
    staleTime: 5 * 60 * 1000,
  });

  const sourceDef = useMemo(() => {
    return (config?.sources || []).find((s) => s.id === sourceKey) || null;
  }, [config, sourceKey]);

  const classifications = useMemo(() => {
    return registry?.classifications?.[sourceKey] || [];
  }, [registry, sourceKey]);

  const clsDef = useMemo(() => {
    return classifications.find((c) => c.id === classificationId) || null;
  }, [classifications, classificationId]);

  const effectiveFilters = useMemo(() => {
    if (!clsDef) return [];
    const pool = config?.filterDimensions?.[sourceKey] || registry?.filterDimensions?.[sourceKey] || [];
    const byKey = new Map(pool.map((filter) => [filter.key, filter]));
    const merged = [];
    (clsDef.dimensions || []).forEach((key) => {
      const filter = byKey.get(key);
      if (filter) merged.push(filter);
    });
    (clsDef.filters || []).forEach((filter) => merged.push(filter));
    return Array.from(new Map(merged.map((filter) => [filter.key, filter])).values());
  }, [clsDef, config, registry, sourceKey]);
  // Supplier/customer account statements get a dedicated ledger renderer instead
  // of the generic DataGrid, and need the full (un-paginated) transaction set.
  const isStatement = classificationId === "statement" && (sourceKey === "suppliers" || sourceKey === "customers");
  const statementPartyType = sourceKey === "customers" ? "customer" : "supplier";

  // Local state
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultTo = useMemo(() => fmtDate(today), [today]);

  const [activeTab, setActiveTab] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState(() => {
    const sp = new URLSearchParams(location.search);
    const initial = { from: sp.get("from") || defaultFrom, to: sp.get("to") || defaultTo, q: sp.get("q") || "" };
    sp.forEach((value, key) => {
      if (!["from", "to", "start_date", "end_date", "cost_method", "scope_type", "scope_value"].includes(key)) initial[key] = value;
    });
    if (sp.get("start_date")) initial.from = sp.get("start_date");
    if (sp.get("end_date")) initial.to = sp.get("end_date");
    return initial;
  });
  const [scope, setScope] = useState(() => {
    const sp = new URLSearchParams(location.search);
    const type = sp.get("scope_type") || "all";
    const value = sp.get("scope_value");
    return value ? { type, values: [value] } : { type: "all", values: [] };
  });
  const [costMethod, setCostMethod] = useState(() => new URLSearchParams(location.search).get("cost_method") || "wacc");
  const [exportProgress, setExportProgress] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { href, label } awaiting leave-confirmation
  const [printAllData, setPrintAllData] = useState(null);
  const [printAllLoading, setPrintAllLoading] = useState(false);
  const [measuredPrintRowsPerPage, setMeasuredPrintRowsPerPage] = useState(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [columnVisibility, setColumnVisibilityState] = useState(() => getStorePreference(prefKey, "columnVisibility", null) || {});
  const [columnOrder, setColumnOrderState] = useState(() => getStorePreference(prefKey, "columnOrder", null) || []);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const columnDropdownRef = useRef(null);
  const searchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const costMethodRef = useRef(null);
  const closeFilterRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  useEffect(() => {
    api.get("/api/reports/payment-type-options").then((r) => {
      if (r.data?.data) setPaymentTypeOptions(r.data.data);
    }).catch(() => {});
  }, []);

  // Report identity changed (client-side nav between classifications/modes):
  // load saved column visibility/order preferences for the new report.
  useEffect(() => {
    const savedVis = getStorePreference(prefKey, "columnVisibility", null);
    const savedOrd = getStorePreference(prefKey, "columnOrder", null);
    setColumnVisibilityState(savedVis || {});
    setColumnOrderState(savedOrd || []);
    setShowAllColumns(false);
  }, [prefKey, getStorePreference]);

  // Every visit counts as a "recent" (the hub links here directly now)
  const pushRecent = useReportsStore((s) => s.pushRecent);
  useEffect(() => {
    if (clsDef) pushRecent(prefKey);
  }, [prefKey, clsDef, pushRecent]);

  // Set topbar breadcrumb to show the current report name
  const setDynamicBreadcrumb = useUiStore((s) => s.setDynamicBreadcrumb);
  const clearDynamicBreadcrumb = useUiStore((s) => s.clearDynamicBreadcrumb);
  const reportLabel = useMemo(() => clsDef?.label || a(clsDef?.label_key || classificationId), [clsDef, classificationId]);
  useEffect(() => {
    setDynamicBreadcrumb({ label: reportLabel, path: `/reports/source/${sourceKey}/${classificationId}/${dataMode}` });
    return () => clearDynamicBreadcrumb();
  }, [sourceKey, classificationId, dataMode, reportLabel, setDynamicBreadcrumb, clearDynamicBreadcrumb]);

  const [appliedParams, setAppliedParams] = useState(() => {
    const params = {};
    if (clsDef?.supportsDates) { params.start_date = defaultFrom; params.end_date = defaultTo; }
    if (clsDef?.hasProfit) { params.cost_method = "wacc"; }
    params.page = 1;
    params.pageSize = calcPrintRowsPerPage(6); // initial count estimate; updated once columns load
    return params;
  });

  // Debounce for search text
  function useDebounce(value, delay) {
    const [dv, setDv] = useState(value);
    useEffect(() => { const h = setTimeout(() => setDv(value), delay); return () => clearTimeout(h); }, [value, delay]);
    return dv;
  }
  const debouncedQ = useDebounce(filters.q, 300);
  const invalidRange = clsDef?.supportsDates && filters.from > filters.to;

  // Live filters — auto-update params on any filter change.
  // NOTE: clsDef loads asynchronously from the registry. Its identity/flags MUST be part
  // of the signature, otherwise the effect won't re-run once clsDef arrives and the date
  // range is never applied for classifications with no extra `filters` (period ignored).
  const filterSignature = JSON.stringify({
    cls: clsDef ? `${classificationId}:${dataMode}` : null,
    sup: !!clsDef?.supportsDates, prof: !!clsDef?.hasProfit,
    from: filters.from, to: filters.to, q: debouncedQ, scope, costMethod,
    dims: effectiveFilters.map((f) => filters[f.key] || ""),
    msf: (clsDef?.multiSelectFilters || []).map((f) => (filters[f.key] || []).join(",")),
  });
  useEffect(() => {
    if (invalidRange) return;
    const params = { page: 1, pageSize: calcPrintRowsPerPage(6) }; // refined once visibleColumns stabilizes
    if (clsDef?.supportsDates) { params.start_date = filters.from; params.end_date = filters.to; }
    if (clsDef?.hasProfit) { params.cost_method = costMethod; setCostMethodAction(prefKey, costMethod); }
    effectiveFilters.forEach((f) => { if (filters[f.key]) params[f.key] = filters[f.key]; });
    (clsDef?.multiSelectFilters || []).forEach((f) => {
      const vals = filters[f.key];
      if (Array.isArray(vals) && vals.length) params[f.key] = vals.join(",");
    });
    if (scope.type === "category" && scope.values?.length) params.category_id = scope.values[0];
    else if (scope.type === "product" && scope.values?.length) params.item_id = scope.values[0];
    else if (scope.type === "customer" && scope.values?.length) params.customer_id = scope.values[0];
    else if (scope.type === "supplier" && scope.values?.length) params.supplier_id = scope.values[0];
    if (debouncedQ) params.q = debouncedQ;
    if (isStatement) { params.page = 1; params.pageSize = 5000; } // ledger needs every row
    setAppliedParams(params);
  }, [filterSignature, effectiveFilters, invalidRange, clsDef, filters.from, filters.to, costMethod, prefKey, scope, debouncedQ, isStatement, setCostMethodAction]);

  useEffect(() => {
    if (!columnVisibilityOpen) return;
    const handler = (e) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target)) setColumnVisibilityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [columnVisibilityOpen]);

  const {
    data: result,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["source-report", sourceKey, classificationId, dataMode, appliedParams],
    queryFn: () => reportsApi.fetchSourceReport(sourceKey, classificationId, dataMode, appliedParams),
    enabled: !!clsDef,
    placeholderData: keepPreviousData,
  });

  const rows = Array.isArray(result?.data) ? result.data : [];
  const columnsDef = result?.columns || [];
  const totalRows = result?.total || 0;
  const currentPage = result?.page || 1;
  const currentPageSize = result?.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPageSize));
  const serverTotals = result?.totals || {};
  const summary = result?.summary || null;
  const partySelected = !!(filters.supplier_id || filters.customer_id);

  // Normalize columns
  const allColumns = useMemo(() => {
    let cols;
    if (columnsDef.length > 0) {
      cols = columnsDef.map((c) => {
        const key = c?.key || c?.id || c;
        const label = c?.label || arColLabel(key);
        const isNote = NOTE_KEYS.has(key);
        return { id: key, key, header: label, label, desc: c?.desc || "", type: c?.type || "text", defaultVisible: c?.defaultVisible !== false && !isNote, printPriority: c?.printPriority, isNote };
      });
    } else {
      const sample = rows[0];
      if (!sample) return [];
      cols = Object.keys(sample).map((key) => {
        const label = arColLabel(key);
        const isNote = NOTE_KEYS.has(key);
        return { id: key, key, header: label, label, type: "text", defaultVisible: !isNote, isNote };
      });
    }
    if (columnOrder.length > 0 && columnOrder.length === cols.length) {
      const colMap = {};
      cols.forEach((c) => { colMap[c.id] = c; });
      return columnOrder.map((id) => colMap[id]).filter(Boolean);
    }
    return cols;
  }, [columnsDef, rows, columnOrder]);

  useEffect(() => {
    if (allColumns.length === 0) return;
    // Seed visibility from each column's server defaultVisible, and merge in any columns
    // missing from a previously-saved preference (e.g. newly-added analytics columns) so
    // they correctly default to hidden instead of appearing because their key is absent.
    setColumnVisibilityState((prev) => {
      let changed = false;
      const next = { ...prev };
      allColumns.forEach((c) => {
        if (!(c.id in next)) { next[c.id] = c.defaultVisible !== false; changed = true; }
      });
      return changed ? next : prev;
    });
    if (columnOrder.length === 0) {
      setColumnOrderState(allColumns.map((c) => c.id));
    }
  }, [allColumns]);

  const visibleColumns = useMemo(() => allColumns.filter((c) => columnVisibility[c.id] !== false), [allColumns, columnVisibility]);

  // When print template measures exact rows/page, update workspace pagination immediately
  const handleRowsPerPage = useCallback((measured) => {
    if (isStatement) return; // ledger needs the full row set; don't shrink to a print page
    setMeasuredPrintRowsPerPage(measured);
    setAppliedParams((prev) => {
      if (prev.pageSize === measured) return prev;
      return { ...prev, page: 1, pageSize: measured };
    });
  }, [isStatement]);

  // Reset measurement when column set changes (different report = different row heights)
  useEffect(() => {
    setMeasuredPrintRowsPerPage(null);
  }, [visibleColumns.length]);

  // Keep pageSize in sync with print rows-per-page estimate as visible columns change;
  // the measured value (from DOM) takes over once the user opens print preview
  useEffect(() => {
    if (isStatement) return; // statement ledger fetches all rows; never shrink pageSize
    if (visibleColumns.length === 0) return;
    if (measuredPrintRowsPerPage !== null) return; // measured value already in use
    const printPageSize = calcPrintRowsPerPage(visibleColumns);
    setAppliedParams((prev) => {
      if (prev.pageSize === printPageSize) return prev;
      return { ...prev, page: 1, pageSize: printPageSize };
    });
  }, [visibleColumns, measuredPrintRowsPerPage]);

  // Smart column ordering by priority, demoting columns related to active filters
  const activeFilterIds = useMemo(() => {
    const ids = new Set();
    if (filters.customer_id || (scope.type === "customer" && scope.values?.[0])) { ids.add("customer_id"); ids.add("customer_name"); }
    if (filters.supplier_id || (scope.type === "supplier" && scope.values?.[0])) { ids.add("supplier_id"); ids.add("supplier_name"); }
    if (filters.category_id || (scope.type === "category" && scope.values?.[0])) { ids.add("category_id"); ids.add("category_name"); }
    if (filters.item_id || (scope.type === "product" && scope.values?.[0])) { ids.add("item_id"); ids.add("item_name"); }
    if (filters.warehouse_id || (scope.type === "warehouse" && scope.values?.[0])) { ids.add("warehouse_id"); ids.add("warehouse_name"); }
    if (filters.cashier_id) { ids.add("cashier_id"); ids.add("cashier_name"); }
    if (filters.user_id) { ids.add("user_id"); ids.add("user_name"); }
    return ids;
  }, [filters, scope]);

  const smartColumns = useMemo(() => {
    return [...visibleColumns]
      .map((c) => {
        let p = c.printPriority || "useful";
        if (activeFilterIds.has(c.id)) p = "optional";
        return { ...c, adjustedPriority: p };
      })
      .sort((a, b) => {
        const order = { essential: 0, useful: 1, optional: 2 };
        return (order[a.adjustedPriority] || 2) - (order[b.adjustedPriority] || 2);
      });
  }, [visibleColumns, activeFilterIds]);

  const [showAllColumns, setShowAllColumns] = useState(false);
  // The table renders exactly the columns the user has enabled (columnVisibility, seeded
  // from the server's defaultVisible). Toggling a column's eye in the picker is the single
  // source of truth for what shows.
  const displayColumns = smartColumns;

  // The picker lists EVERY available column (visible + hidden extras), so any column can be
  // toggled on/off — including hidden-by-default analytics columns and ones the user hid.
  const pickerColumns = useMemo(() => {
    return [...allColumns]
      .filter((c) => !c.isNote)
      .map((c) => {
        // Hidden-by-default analytics columns read as "optional" (collapsed behind "إظهار الكل");
        // default-visible columns keep their essential/useful rank and never collapse.
        let p;
        if (c.defaultVisible === false) p = "optional";
        else { p = c.printPriority && c.printPriority !== "optional" ? c.printPriority : "useful"; }
        if (activeFilterIds.has(c.id)) p = "optional";
        return { ...c, adjustedPriority: p };
      })
      .sort((a, b) => {
        const order = { essential: 0, useful: 1, optional: 2 };
        return (order[a.adjustedPriority] || 2) - (order[b.adjustedPriority] || 2);
      });
  }, [allColumns, activeFilterIds]);

  // Collapsed view: show core columns plus any currently-enabled optional columns;
  // "إظهار الكل" reveals the hidden-by-default optional columns so they can be turned on.
  const pickerDisplay = useMemo(() => {
    if (showAllColumns) return pickerColumns;
    return pickerColumns.filter((c) => c.adjustedPriority !== "optional" || columnVisibility[c.id] !== false);
  }, [pickerColumns, showAllColumns, columnVisibility]);
  const hiddenOptionalCount = useMemo(
    () => pickerColumns.filter((c) => c.adjustedPriority === "optional" && columnVisibility[c.id] === false).length,
    [pickerColumns, columnVisibility],
  );

  const PRIORITY_LABELS = { essential: "أساسي", useful: "مهم", optional: "اختياري" };
  const PRIORITY_COLORS = { essential: "text-primary bg-primary-50 border-primary", useful: "text-info-text bg-info-bg border-info-border", optional: "text-text-muted bg-bg-overlay border-border" };

  function toggleColumnVisibility(colId) {
    setColumnVisibilityState((prev) => {
      const next = { ...prev, [colId]: !(prev[colId] !== false) };
      setColumnVisibilityAction(prefKey, next);
      return next;
    });
  }

  function moveColumn(colId, direction) {
    setColumnOrderState((prev) => {
      const idx = prev.indexOf(colId);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      setColumnOrderAction(prefKey, next);
      return next;
    });
  }

  const columnTotals = useMemo(() => {
    if (!rows.length) return {};
    if (Object.keys(serverTotals).length > 0) return serverTotals;
    const totals = {};
    allColumns.forEach((col) => {
      if (col.type === "money" || col.type === "number" || col.type === "percent") {
        let sum = 0;
        let hasValue = false;
        rows.forEach((r) => {
          const val = Number(r[col.id]);
          if (!isNaN(val)) { sum += val; hasValue = true; }
        });
        if (hasValue && sum !== 0) totals[col.id] = Math.round(sum * 100) / 100;
      }
    });
    return totals;
  }, [rows, allColumns, serverTotals]);

  const hasItemsRows = useMemo(() => rows.some(r => r._items?.length > 0), [rows]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleExpand = useCallback((rowId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);
  const renderItemExpandedRow = useCallback((row, idx) => {
    if (!hasItemsRows) return null;
    const rowId = row.id ?? idx;
    if (!expandedRows.has(rowId) || !row._items?.length) return null;
    return (
      <tr key={`exp-${rowId}`}>
        <td colSpan={displayColumns.length} className="bg-bg-base/80 p-0">
          <div className="border-b border-border mx-4" />
          <div className="py-2 px-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-text-secondary font-bold border-b border-border">
                  <th className="text-right py-1.5 px-2">الصنف</th>
                  <th className="text-right py-1.5 px-2">الكود</th>
                  <th className="text-right py-1.5 px-2">الكمية</th>
                  <th className="text-right py-1.5 px-2">سعر الوحدة</th>
                  <th className="text-right py-1.5 px-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {row._items.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5 px-2 text-text-primary font-medium">{item.item_name}</td>
                    <td className="py-1.5 px-2 text-text-secondary font-mono text-left" dir="ltr">{item.code || item.barcode || "-"}</td>
                    <td className="py-1.5 px-2 text-text-secondary tabular-nums">{item.quantity}</td>
                    <td className="py-1.5 px-2 text-text-secondary tabular-nums text-left" dir="ltr">{formatNumber(item.unit_price)}</td>
                    <td className="py-1.5 px-2 text-text-primary tabular-nums font-bold text-left" dir="ltr">{formatNumber(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  }, [hasItemsRows, expandedRows, displayColumns.length]);

  function handleResetFilters() {
    setFilters({ from: defaultFrom, to: defaultTo, q: "" });
    setScope({ type: "all", values: [] });
    setCostMethod("wacc");
  }

  // Chips for every filter currently shaping the numbers — visible even when the
  // tray is closed, so the user always knows WHY the table looks the way it does.
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (clsDef?.supportsDates && filters.from && filters.to) {
      const preset = DATE_PRESETS.find((p) => { const r = p.get(); return r.from === filters.from && r.to === filters.to; });
      const isDefault = filters.from === defaultFrom && filters.to === defaultTo;
      chips.push({
        key: "__dates",
        label: preset ? `الفترة: ${preset.label}` : `الفترة: ${filters.from} ← ${filters.to}`,
        clear: isDefault ? null : () => setFilters((c) => ({ ...c, from: defaultFrom, to: defaultTo })),
      });
    }
    if (filters.q) chips.push({ key: "q", label: `بحث: ${filters.q}`, clear: () => setFilters((c) => ({ ...c, q: "" })) });
    effectiveFilters.forEach((f) => {
      const v = filters[f.key];
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) return;
      const name = f.label || f.label_key || f.key;
      let display;
      if (f.type === "select") {
        const opt = (f.options || []).find((o) => String(o.value) === String(v));
        display = opt?.label || String(v);
      } else if (f.type === "lookup") {
        display = "مفعّل";
      } else {
        display = String(v);
      }
      chips.push({ key: f.key, label: `${name}: ${display}`, clear: () => setFilters((c) => ({ ...c, [f.key]: "" })) });
    });
    (clsDef?.multiSelectFilters || []).forEach((msf) => {
      const vals = filters[msf.key];
      if (!Array.isArray(vals) || !vals.length) return;
      chips.push({ key: msf.key, label: `${msf.label || msf.key}: ${vals.length} مختارين`, clear: () => setFilters((c) => ({ ...c, [msf.key]: [] })) });
    });
    if (scope.type !== "all" && scope.values?.length) {
      const scopeNames = { category: "فئة", product: "صنف", customer: "عميل", supplier: "مورد", warehouse: "مخزن" };
      chips.push({ key: "__scope", label: `النطاق: ${scopeNames[scope.type] || scope.type} محدد`, clear: () => setScope({ type: "all", values: [] }) });
    }
    if (clsDef?.hasProfit && costMethod !== "wacc") {
      const m = (config?.costMethods || []).find((x) => x.value === costMethod);
      chips.push({ key: "__cost", label: `التكلفة: ${m?.label || costMethod}`, clear: () => setCostMethod("wacc") });
    }
    return chips;
  }, [clsDef, filters, effectiveFilters, scope, costMethod, config?.costMethods, defaultFrom, defaultTo]);
  const clearableChips = activeFilterChips.filter((c) => c.clear);

  function handlePageChange(page) {
    setAppliedParams((prev) => ({ ...prev, page: Math.max(1, Math.min(page, totalPages)) }));
  }

  const doDownload = useCallback(async (format, querySlug, exportColumns, extraParams = {}) => {
    setExportProgress({ format, percent: 0 });
    try {
      const blob = await reportsApi.exportReport(querySlug, format, {
        ...appliedParams,
        ...extraParams,
        columns: exportColumns,
        onProgress: (e) => {
          if (e.total) setExportProgress((prev) => prev ? { ...prev, percent: Math.round((e.loaded / e.total) * 100) } : null);
        },
      });
      setExportProgress((prev) => prev ? { ...prev, percent: 100 } : null);
      const extMap = { pdf: "pdf", excel: "xlsx", word: "docx" };
      const ext = extMap[format] || "xlsx";
      const filename = `${sourceKey}-${classificationId}-${formatDate(new Date())}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`تم تحميل ${filename}`);
    } catch (error) {
      toast.error(error.message || "فشل التصدير");
      throw error;
    } finally { setTimeout(() => setExportProgress(null), 2000); }
  }, [sourceKey, classificationId, appliedParams]);

  const handleExport = useCallback(async (format, exportColumns = visibleColumns) => {
    if (format === "print") {
      setPrintAllLoading(true);
      try {
        const MAX_PAGE_SIZE = 10000;
        const batchSize = Math.min(Math.max(totalRows, 1), MAX_PAGE_SIZE);
        const totalPagesNeeded = Math.ceil(totalRows / batchSize);

        let allData;
        if (totalPagesNeeded <= 1) {
          allData = await reportsApi.fetchSourceReport(sourceKey, classificationId, dataMode, {
            ...appliedParams,
            page: 1,
            pageSize: batchSize,
          });
        } else {
          const batchPromises = [];
          for (let p = 1; p <= totalPagesNeeded; p++) {
            batchPromises.push(reportsApi.fetchSourceReport(sourceKey, classificationId, dataMode, {
              ...appliedParams,
              page: p,
              pageSize: batchSize,
            }));
          }
          const batchResults = await Promise.all(batchPromises);
          const mergedData = batchResults.flatMap(r => r?.data || []);
          allData = {
            ...batchResults[0],
            data: mergedData,
            total: totalRows,
          };
        }

        setPrintAllData(allData);
        setPrintOpen(true);
      } catch (err) {
        setPrintAllData(null);
        setPrintOpen(true);
      }
      setPrintAllLoading(false);
      return;
    }
    if (format === "pdf") { setPdfDialogOpen(true); return; }
    const querySlug = dataMode === "summary" ? clsDef?.summaryQuery : clsDef?.detailedQuery;
    await doDownload(format, querySlug, exportColumns);
  }, [visibleColumns, dataMode, clsDef, doDownload, sourceKey, classificationId, appliedParams, totalRows]);

  const handlePdfExport = useCallback(async (exportColumns, pdfParams) => {
    const querySlug = dataMode === "summary" ? clsDef?.summaryQuery : clsDef?.detailedQuery;
    await doDownload("pdf", querySlug, exportColumns, pdfParams);
  }, [dataMode, clsDef, doDownload]);

  if (configLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm font-medium text-text-secondary">ثواني... بنجهّز التقرير</p>
        </div>
      </div>
    );
  }

  if (!sourceDef) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-bg-overlay flex items-center justify-center text-text-muted shadow-inner"><LayoutTemplate size={36} /></div>
          <div>
            <h1 className="text-2xl font-black text-text-primary mb-2">التقرير ده مش موجود</h1>
            <p className="text-sm text-text-secondary">يمكن الرابط قديم أو التقرير اتنقل مكان تاني — ارجع لمركز التقارير وهتلاقيه هناك.</p>
          </div>
          <Link to="/reports/center" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors shadow-lg">
            <ArrowLeft size={16} /> العودة إلى مركز التقارير
          </Link>
        </div>
      </div>
    );
  }

  const SourceIcon = sourceDef.icon;
  const exportFormats = ["pdf", "excel", "word", "csv", "print"];
  const categoryColor = sourceDef.color;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8 text-text-primary" dir="rtl">
      {/* COMMAND COCKPIT (DASHBOARD HARDENED) */}
      <div className="flex flex-col mb-8 bg-bg-surface border border-border shadow-sm rounded-2xl relative">
        
        {/* Row 1: Header & Primary Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-5 border-b border-border bg-bg-base/50">
          <div className="flex items-center gap-4">
            <Link 
              to="/reports/center" 
              className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-surface border border-border/80 shadow-sm text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-bg-overlay transition-all active:scale-95 shrink-0"
              title="العودة لمركز التقارير"
            >
              <ArrowRight size={18} />
            </Link>
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-bg-surface border border-border/50 shadow-sm" style={{ color: categoryColor }}>
              <SourceIcon size={22} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold tracking-widest text-text-muted uppercase mb-0.5">{sourceDef.label}</span>
              <h1 className="text-[20px] font-bold text-text-primary tracking-tight leading-none mb-1.5">{clsDef?.label || a(clsDef?.label_key || classificationId)}</h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-overlay/80 border border-border/60 text-text-secondary text-xs font-medium max-w-xl transition-all duration-300">
                <Info size={13} className="shrink-0 text-text-accent" />
                <span>{clsDef?.desc || getReportDescription(classificationId || clsDef?.label_key)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-bg-surface p-1 rounded-xl border border-border/60 shadow-sm">
            <div className="w-64">
              <ClassificationSelector
                classifications={classifications}
                value={classificationId}
                onChange={(clsId) => {
                  const cls = classifications.find((c) => c.id === clsId);
                  const mode = cls?.availableModes?.[0] || "detailed";
                  navigate(`/reports/source/${sourceKey}/${clsId}/${mode}`);
                }}
                formatLabel={a}
              />
            </div>
            <div className="w-px h-5 bg-border hidden sm:block" />
            <DataModeToggle
              availableModes={clsDef?.availableModes || ["detailed"]}
              value={dataMode}
              onChange={(mode) => {
                navigate(`/reports/source/${sourceKey}/${classificationId}/${mode}`);
              }}
            />
          </div>
        </div>

        {/* Row 2: Action Bar (Filters, Refresh, Exports) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3 bg-bg-surface">
          <div className="flex items-center gap-2">
            <button onClick={() => setFiltersOpen(!filtersOpen)}
              className={`h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${filtersOpen ? "bg-primary text-white shadow-sm" : "bg-bg-surface text-text-secondary hover:bg-bg-overlay border border-border"}`}>
              <SlidersHorizontal size={14} />
              <span>الفلاتر</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
            <button onClick={() => refetch()} className="h-9 px-4 rounded-lg bg-bg-surface border border-border text-text-secondary hover:bg-bg-overlay hover:text-text-primary text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm">
              <RefreshCw size={14} className={isFetching ? "animate-spin text-text-primary" : "text-text-muted"} /> تحديث
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <SaveViewButton
              defaultName={`${sourceDef?.label || sourceKey} — ${reportLabel}`}
              buildUrl={() => {
                const sp = new URLSearchParams();
                Object.entries(appliedParams).forEach(([k, v]) => {
                  if (v == null || v === "" || ["page", "pageSize"].includes(k)) return;
                  sp.set(k === "start_date" ? "from" : k === "end_date" ? "to" : k, v);
                });
                return `/reports/source/${sourceKey}/${classificationId}/${dataMode}?${sp.toString()}`;
              }}
            />
            {exportFormats.map((fmt) => <ExportPill key={fmt} format={fmt} onExport={handleExport} />)}
          </div>
        </div>

        {/* Row 2.5: Active-filter chips — the "why does the table look like this" strip */}
        {activeFilterChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap px-5 pb-3 bg-bg-surface">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                chip.clear ? "bg-primary/5 border-primary/30 text-primary" : "bg-bg-base border-border text-text-secondary"
              }`}>
                {chip.label}
                {chip.clear && (
                  <button onClick={chip.clear} className="hover:bg-primary/10 rounded-full p-0.5 transition-colors" title="شيل الفلتر ده">
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            {clearableChips.length > 1 && (
              <button onClick={handleResetFilters} className="text-[11px] font-bold text-text-muted hover:text-danger-text transition-colors px-1.5">
                امسح الكل
              </button>
            )}
          </div>
        )}

        {/* Row 3: Filters Tray (Collapsible) */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className={`border-t border-border bg-bg-base/50 ${filtersOpen ? "overflow-visible" : "overflow-hidden"}`}>
              <div className="p-6">
                
                {/* Search & Dates Row */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {/* Global Search */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary">بحث عام</label>
                    <div className="relative group">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-text-primary transition-colors" />
                      <input ref={searchRef} type="text" value={filters.q || ""} onChange={(e) => setFilters((c) => ({ ...c, q: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: dateFromRef })}
                        placeholder="ابحث بالاسم، الكود، الوصف..." className="w-full h-10 pr-9 pl-3 rounded-xl border border-border bg-bg-surface text-sm text-text-primary focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-bg-overlay transition-all shadow-sm font-medium" />
                    </div>
                  </div>

                  {/* Dates */}
                  {clsDef?.supportsDates && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-text-secondary flex justify-between items-center">
                        <span>الفترة الزمنية</span>
                        <div className="flex gap-1 flex-wrap">
                          {DATE_PRESETS.map((p) => {
                            const range = p.get();
                            const isActive = filters.from === range.from && filters.to === range.to;
                            return (
                              <button key={p.label} onClick={() => setFilters((c) => ({ ...c, from: range.from, to: range.to }))}
                                className={`text-[11px] transition-colors px-2 py-0.5 rounded border ${
                                  isActive
                                    ? "bg-primary text-white border-primary"
                                    : "text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-overlay border-border"
                                }`}>{p.label}</button>
                            );
                          })}
                        </div>
                      </label>
                      <div className="flex items-center bg-bg-surface border border-border rounded-xl shadow-sm h-10 overflow-hidden focus-within:border-border-strong focus-within:ring-2 focus-within:ring-bg-overlay transition-all">
                        <input ref={dateFromRef} type="date" value={filters.from} onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: searchRef })} className="flex-1 h-full px-3 bg-transparent text-sm font-medium text-text-primary focus:outline-none font-mono" />
                        <div className="w-px h-6 bg-border" />
                        <input ref={dateToRef} type="date" value={filters.to} onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: costMethodRef, prevRef: dateFromRef })} className="flex-1 h-full px-3 bg-transparent text-sm font-medium text-text-primary focus:outline-none font-mono" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Specific Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {effectiveFilters.map((f) => (
                    <FilterInput key={f.key} filter={f} value={filters[f.key]}
                      onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
                      dynamicOptions={f.dynamic ? paymentTypeOptions : undefined}
                    />
                  ))}
                  {(clsDef?.multiSelectFilters || []).map((msf) => (
                    <div key={msf.key} className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-text-secondary">{msf.label || a(msf.label_key)}</label>
                      <MultiSelectCheckboxes options={msf.options} value={filters[msf.key] || []} onChange={(v) => setFilters((prev) => ({ ...prev, [msf.key]: v }))} label={msf.label || a(msf.label_key)} formatLabel={a} />
                    </div>
                  ))}
                  {clsDef?.supportsScope && (
                    <div className="space-y-1.5 col-span-1 md:col-span-2 xl:col-span-1">
                      <label className="text-[11px] font-semibold text-text-secondary">النطاق التحليلي</label>
                      <ScopeSelector scopeOptions={config?.scopeOptions?.[sourceKey] || config?.scopeOptions?.sales} scope={scope} onScopeChange={setScope} />
                    </div>
                  )}
                  {clsDef?.hasProfit && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-text-secondary">طريقة حساب التكلفة</label>
                      <select ref={costMethodRef} value={costMethod} onChange={(e) => setCostMethod(e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: closeFilterRef, prevRef: dateToRef })} className="w-full h-10 px-3 rounded-xl border border-border bg-bg-surface text-sm font-medium text-text-primary focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-bg-overlay transition-all shadow-sm cursor-pointer">
                        {(config?.costMethods || []).map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Footer Toolbar */}
                <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-border/60">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-bg-overlay/50 px-3 py-1 text-[11px] font-medium text-text-secondary border border-border/60">
                      <motion.span animate={{ scale: isFetching ? [1, 1.2, 1] : 1, opacity: isFetching ? [1, 0.5, 1] : 1 }} transition={{ duration: 0.8, repeat: isFetching ? Infinity : 0, ease: "easeInOut" }} className="w-2 h-2 rounded-full bg-primary" />
                      {isFetching ? "بنحدّث الأرقام..." : "الفلاتر بتتطبق أول ما تغيّرها"}
                    </span>
                    {invalidRange && <span className="text-[11px] font-medium text-danger-text bg-danger-bg border border-danger-border px-3 py-1 rounded-full">تاريخ البداية لازم يكون قبل تاريخ النهاية</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleResetFilters} className="h-9 px-4 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-base hover:text-text-primary transition-colors">امسح الفلاتر</button>
                    <button ref={closeFilterRef} onClick={() => setFiltersOpen(false)} onKeyDown={e => handleKeyDown(e, { prevRef: costMethodRef, onEnter: () => closeFilterRef.current?.click() })} className="h-9 px-5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-600 transition-colors active:scale-95 shadow-sm">تمام، اقفل الفلاتر</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {exportProgress && (
        <div className="mb-6 rounded-[20px] border border-border-accent bg-primary-50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-2sm font-bold text-primary mb-2">
            <span>جاري تصدير {exportProgress.format.toUpperCase()}...</span>
            <span>{exportProgress.percent}%</span>
          </div>
          <ProgressBar value={exportProgress.percent} max={100} color="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setActiveTab("table")}
          className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "table" ? "bg-primary text-white shadow-md" : "bg-transparent text-text-secondary hover:bg-bg-base/50"}`}>
          <LayoutList size={16} /> جدول
        </button>
        <button onClick={() => setActiveTab("chart")}
          className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "chart" ? "bg-primary text-white shadow-md" : "bg-transparent text-text-secondary hover:bg-bg-base/50"}`}>
          <BarChart3 size={16} /> رسم بياني
        </button>
      </div>

      {/* Data Area */}
      <div className="bg-bg-surface rounded-[24px] border border-border shadow-sm flex flex-col relative">
        {isLoading ? (
          <TableSkeleton colCount={Math.min(visibleColumns.length || 6, 8)} />
        ) : isStatement && !partySelected ? (
          <StatementEmptyPreview partyType={statementPartyType} />
        ) : isStatement && activeTab === "table" ? (
          <div className="p-4 md:p-6">
            <AccountStatementLedger
              rows={rows}
              summary={summary || {}}
              partyType={statementPartyType}
              period={{ from: appliedParams.start_date, to: appliedParams.end_date }}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-24 bg-bg-base/50">
            <div className="h-16 w-16 rounded-3xl bg-bg-surface border border-border flex items-center justify-center text-text-muted mb-4 shadow-sm"><Search size={28} /></div>
            <h3 className="text-[16px] font-black text-text-primary mb-1">مفيش بيانات هنا</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-5">
              {clsDef?.supportsDates
                ? "الفترة اللي مختارها مفيهاش أي حركة مسجّلة. وسّع الفترة شوية أو شيل فلتر من اللي مفعّلينه."
                : "لسه مفيش بيانات تتعرض في التقرير ده — أول ما يتسجل شغل هيظهر هنا."}
            </p>
            <div className="flex items-center gap-2">
              {clsDef?.supportsDates && (
                <button
                  onClick={() => {
                    const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - 90);
                    setFilters((c) => ({ ...c, from: formatDate(s), to: formatDate(t) }));
                  }}
                  className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors">
                  وسّع لآخر 90 يوم
                </button>
              )}
              <button onClick={handleResetFilters}
                className="h-9 px-4 rounded-lg border border-border bg-bg-surface text-sm font-bold text-text-secondary hover:bg-bg-overlay transition-colors">
                امسح كل الفلاتر
              </button>
            </div>
          </div>
        ) : activeTab === "table" ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-base/50 shrink-0">
              <div className="flex items-center gap-3">
                <motion.span
                  animate={isFetching ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  className="text-sm font-black text-text-primary"
                >
                  {isFetching ? "بنحدّث الأرقام..." : "البيانات"}
                </motion.span>
                <span className="text-[11px] font-bold text-text-secondary bg-bg-surface border border-border rounded-full px-2.5 py-0.5 shadow-sm">{formatNumber(totalRows, { decimals: 0 })} صف</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" ref={columnDropdownRef}>
                  <button onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold text-text-secondary bg-bg-surface border border-border hover:bg-bg-overlay transition-all shadow-sm">
                    <Settings2 size={14} /> الأعمدة
                  </button>
                  <AnimatePresence>
                    {columnVisibilityOpen && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-bg-surface shadow-xl p-3 max-h-[420px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
                          <span className="text-[11px] font-black text-text-muted">الأعمدة</span>
                          <button onClick={() => setShowAllColumns(!showAllColumns)}
                            className="text-[11px] font-bold text-primary hover:text-text-accent transition-colors">
                            {showAllColumns ? "إخفاء الاختياري" : "إظهار الكل"}
                          </button>
                        </div>
                        {pickerDisplay.map((col, idx) => {
                          const isOptional = col.defaultVisible === false;
                          return (
                            <div key={col.id} className="flex items-center justify-between group px-2 py-1.5 rounded-xl hover:bg-bg-overlay">
                              <button onClick={() => toggleColumnVisibility(col.id)} className="flex items-center gap-2 flex-1 text-right">
                                {columnVisibility[col.id] !== false ? <Eye size={14} className="text-primary shrink-0" /> : <EyeOff size={14} className="text-text-muted shrink-0" />}
                                <span className={`text-2sm font-bold ${columnVisibility[col.id] !== false ? "text-text-primary" : "text-text-muted line-through"}`}>{col.header}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${isOptional ? "text-text-muted bg-bg-overlay border-border" : "text-primary bg-primary-50 border-primary"} shrink-0`}>
                                  {isOptional ? "اختياري" : "افتراضي"}
                                </span>
                              </button>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0} className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-base disabled:opacity-30"><ArrowUp size={12} /></button>
                                <button onClick={() => moveColumn(col.id, 1)} disabled={idx === pickerDisplay.length - 1} className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-base disabled:opacity-30"><ArrowDown size={12} /></button>
                              </div>
                            </div>
                          );
                        })}
                        {pickerColumns.some(c => c.adjustedPriority === 'optional') && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <button onClick={() => setShowAllColumns(!showAllColumns)}
                              className="w-full text-center text-[11px] font-bold text-primary hover:text-text-accent py-1 rounded-lg hover:bg-primary-50 transition-all">
                              {showAllColumns ? "إخفاء الأعمدة الاختيارية" : `إظهار الأعمدة الإضافية${hiddenOptionalCount > 0 ? ` (${hiddenOptionalCount})` : ""}`}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <motion.div
              layout
              className="overflow-x-auto"
              animate={{ opacity: isFetching ? 0.7 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <DataGrid
                columns={displayColumns.map((c, colIdx) => ({
                  ...c,
                  width: c.width || (c.type === "date" ? 90 : c.type === "cur" ? 130 : c.type === "num" ? 80 : c.type === "code" ? 110 : c.type === "percent" ? 80 : (c.key?.includes("name") || c.key?.includes("item") || c.key?.includes("label") || c.key?.includes("description") ? 220 : 140)),
                  render: (row, idx) => {
                    const raw = row[c.id];
                    if (raw == null || raw === "") return <span className="text-text-muted">—</span>;
                    if (ID_TO_NAME_COLUMNS.has(c.id)) {
                      const nameKey = c.id.replace("_id", "_name");
                      const displayName = row[nameKey] || row[c.id];
                      if (displayName == null || displayName === "") return <span className="text-text-muted">—</span>;
                      return <span className="text-sm font-medium text-text-secondary">{String(displayName)}</span>;
                    }
                    if (c.type === "cur" || c.type === "num" || c.type === "percent" || c.type === "money" || c.type === "number") {
                      const num = Number(raw);
                      if (!isNaN(num) && String(raw).trim() !== "") {
                        const suffix = c.type === "percent" ? "%" : "";
                        // Negative money/percent (عجز، خسارة، فرق بالسالب) reads in danger color at a glance
                        const toneClass = num < 0 ? "text-danger-text" : "text-text-primary";
                        return (
                          <span className={`tabular-nums text-sm font-bold ${toneClass}`} dir="ltr" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                            {formatNumber(num)}{suffix}
                          </span>
                        );
                      }
                    }
                    const formatted = formatReportCellValue(c.id, TYPE_LABELS[raw] || a(raw) || raw);
                    if (LINK_CELLS[sourceKey]?.has(c.id)) {
                      const link = resolveRowLink(sourceKey, classificationId, row);
                      if (link) {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPendingNav(link); }}
                            title={link.label}
                            className="max-w-full truncate text-sm font-bold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary-600 hover:decoration-primary"
                          >
                            {String(formatted)}
                          </button>
                        );
                      }
                    }
                    if (colIdx === 0 && hasItemsRows) {
                      const rowId = row.id ?? idx;
                      const hasItems = row._items?.length > 0;
                      const isExpanded = expandedRows.has(rowId);
                      return (
                        <div className="flex items-center gap-1.5">
                          {hasItems ? (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(rowId); }}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-bg-overlay transition-colors">
                              <ChevronDown size={13} className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : <span className="w-5 shrink-0" />}
                          <span className="text-sm font-medium text-text-secondary truncate">{formatted != null ? String(formatted) : "-"}</span>
                        </div>
                      );
                    }
                    return <span className="text-sm font-medium text-text-secondary">{String(formatted)}</span>;
                  },
                }))}
                data={rows}
                rowKey="id"
                renderExpandedRow={renderItemExpandedRow}
                rowClass={(row) => `${row._is_item ? "bg-bg-base/50" : ""} ${resolveRowLink(sourceKey, classificationId, row) ? "hover:bg-primary/5" : ""}`}
                totals={columnTotals}
              />
            </motion.div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-bg-base/50 shrink-0">
                <div className="flex items-center gap-2 text-2sm font-bold text-text-secondary">
                  <span>
                    بتشوف {formatNumber((currentPage - 1) * currentPageSize + 1, { decimals: 0 })}–{formatNumber(Math.min(currentPage * currentPageSize, totalRows), { decimals: 0 })} من {formatNumber(totalRows, { decimals: 0 })} صف
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg border border-border bg-bg-surface hover:bg-bg-overlay disabled:opacity-30"><ChevronRight size={16} /></button>
                  <span className="text-2sm font-bold text-text-secondary px-2">{formatNumber(currentPage, { decimals: 0 })} / {formatNumber(totalPages, { decimals: 0 })}</span>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg border border-border bg-bg-surface hover:bg-bg-overlay disabled:opacity-30"><ChevronLeft size={16} /></button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <ChartWorkspace rows={rows} columns={allColumns} isLoading={isLoading} title={sourceDef?.label || sourceKey} />
        )}
      </div>

      {/* Print Modal */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => { setPrintOpen(false); setPrintAllData(null); }}
        docType="reports_generic"
        reportColumns={visibleColumns.map((c) => ({
          key: c.key || c.id,
          label: c.label || c.header,
          type: c.type,
          printPriority: c.printPriority,
        }))}
        totalRows={printAllData?.total || totalRows}
        renderContent={(s) => {
          const summary = printAllData?.summary || {};
          const partyName = summary.customer_name || summary.supplier_name || "";
          const openingBal = summary.opening_balance;
          const subtitleParts = [];
          if (partyName) subtitleParts.push(partyName);
          if (openingBal != null) subtitleParts.push(`الرصيد الافتتاحي: ${formatNumber(openingBal)}`);
          const computedSubtitle = subtitleParts.length ? subtitleParts.join(" | ") : undefined;
          return (
            <ReportViaLayout
              rows={printAllData?.data || rows}
              columns={visibleColumns}
              noteColumns={allColumns.filter((c) => c.isNote)}
              title={`${sourceDef?.label || ''} - ${clsDef?.label || a(clsDef?.label_key || classificationId)}`}
              subtitle={computedSubtitle}
              filters={filters}
              settings={s}
              totals={columnTotals}
              currentPage={s.currentPage || 1}
              onPageCount={s.onPageCount}
              onRowsPerPage={handleRowsPerPage}
              forcedRowsPerPage={appliedParams.pageSize}
              statement={isStatement ? {
                rows: printAllData?.data || rows,
                summary: printAllData?.summary || summary || {},
                partyType: statementPartyType,
                period: { from: appliedParams.start_date, to: appliedParams.end_date },
              } : null}
            />
          );
        }}
      />

      {/* PDF Export Dialog */}
      <PDFExportDialog
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        columns={allColumns}
        title={`${sourceDef?.label || ''} - ${clsDef?.label || a(clsDef?.label_key || classificationId)}`}
        onExport={handlePdfExport}
      />
      {pendingNav && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setPendingNav(null)}>
          <div dir="rtl" className="w-[400px] max-w-[90vw] rounded-2xl border border-border bg-bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1.5 text-[15px] font-black text-text-primary">مغادرة التقرير</h3>
            <p className="mb-5 text-sm leading-relaxed text-text-secondary">
              سيتم الانتقال إلى: <span className="font-bold text-text-primary">{pendingNav.label}</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingNav(null)}
                className="h-9 rounded-lg border border-border bg-bg-surface px-4 text-sm font-bold text-text-secondary transition-colors hover:bg-bg-overlay">إلغاء</button>
              <button onClick={() => { const l = pendingNav; setPendingNav(null); navigate(l.href); }}
                className="h-9 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-600">متابعة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
