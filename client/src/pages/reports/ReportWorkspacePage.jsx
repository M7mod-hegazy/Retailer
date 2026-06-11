import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowUp, ArrowDown, BarChart3, CalendarDays, ChevronDown, ChevronUp,
  FileImage, FileSpreadsheet, FileText, Filter, LayoutTemplate,
  LayoutList, Loader2, Printer, RefreshCw, RotateCcw, Search,
  TrendingUp, Package, Wallet, Receipt, Shield, ClipboardList,
  SlidersHorizontal, X, ChevronLeft, ChevronRight, Settings2, Eye, EyeOff, PieChart, LineChart, Download
} from "lucide-react";
import {
  LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell
} from "recharts";
import DataGrid from "../../components/ui/DataGrid";
import { reportsApi } from "../../services/reports";
import { useReportsStore } from "../../stores/reportsStore";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ReportPrintTemplate from "./templates/ReportPrintTemplate";
import api from "../../services/api";
import ProgressBar from "../../components/ui/ProgressBar";
import { LookupEntityFilter, ScopeSelector } from "./reportsCenterParts";
import { SCOPE_OPTIONS } from "./reportsCenterConfig";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function prettifyLabel(rawKey) {
  const key = String(rawKey).toLowerCase();
  const labels = {
    item_code: "كود الصنف", code: "الكود", sku: "SKU",
    item_id: "معرّف الصنف", item_name: "اسم الصنف", name: "الاسم",
    wacc: "متوسط التكلفة", sale_price: "سعر البيع",
    current_margin_percent: "الهامش الحالي %", min_margin_percent: "الحد الأدنى %",
    suggested_price: "السعر المقترح", below_threshold: "تحت الحد",
    invoice_no: "رقم الفاتورة", customer_name: "العميل", supplier_name: "المورد",
    date: "التاريخ", total: "الإجمالي", total_sales: "إجمالي المبيعات",
    invoice_count: "عدد الفواتير", quantity: "الكمية", quantity_sold: "الكمية المباعة",
    stock_quantity: "رصيد المخزون", system_quantity: "رصيد النظام",
    category_name: "التصنيف", payment_type: "طريقة الدفع", status: "الحالة",
    balance: "الرصيد", source: "المصدر", tax_rate: "نسبة الضريبة",
    taxable_sales: "المبيعات الخاضعة", outstanding_balance: "الرصيد المستحق",
    hour_slot: "الساعة", weekday: "يوم الأسبوع", action: "الإجراء",
    resource: "الكيان", created_at: "تاريخ الإنشاء", line_total: "إجمالي السطر",
    movement_type: "نوع الحركة", reference_type: "نوع المرجع", reference_id: "رقم المرجع",
    revenue: "الإيراد", min_stock_qty: "حد أدنى للمخزون", min_stock: "حد أدنى",
    unit_name: "الوحدة", total_quantity: "إجمالي الكمية", cost_price: "سعر التكلفة",
    total_value: "القيمة الإجمالية", total_spent: "إجمالي الإنفاق",
    barcode: "الباركود", payload_json: "تفاصيل", user_id: "المستخدم",
    gross_sales: "المبيعات الإجمالية", net_sales: "المبيعات الصافية",
    total_discount: "إجمالي الخصم", avg_discount: "متوسط الخصم",
    return_total: "إجمالي المرتجع", reason: "السبب", profit_margin: "هامش الربح",
    margin_percent: "نسبة الربح %", cost: "التكلفة",
    purchase_count: "عدد المشتريات", total_purchases: "إجمالي المشتريات",
    purchase_no: "رقم الشراء", quantity_purchased: "الكمية المشتراة",
    total_cost: "إجمالي التكلفة", unit_price: "سعر الوحدة",
    purchase_date: "تاريخ الشراء", stock_status: "حالة المخزون",
    shift_id: "رقم الوردية", opening_cash: "النقد الافتتاحي",
    closing_cash: "النقد الختامي", variance: "الفرق",
    transaction_count: "عدد المعاملات", total_amount: "إجمالي المبلغ",
    type: "النوع", taxable_amount: "المبلغ الخاضع", vat_amount: "قيمة الضريبة",
    output_vat: "ضريبة المخرجات", input_vat: "ضريبة المدخلات",
    return_amount: "قيمة المرتجع", vat_reversed: "الضريبة المستردة",
    total_invoices: "إجمالي الفواتير", total_billed: "إجمالي الفوترة",
    collected: "المحصل", outstanding: "المستحق", collection_rate: "نسبة التحصيل %",
    action_count: "عدد العمليات", returns_amount: "قيمة المرتجعات", returns_count: "عدد المرتجعات",
    warehouse_id: "المخزن", warehouse_name: "اسم المخزن", warehouse: "المخزن",
    supplier_id: "المورد", customer_id: "العميل", cashier_id: "الكاشير",
    category_id: "التصنيف", item_category: "تصنيف الصنف",
    ref_no: "رقم المستند", debit: "مدين", credit: "دائن", running_balance: "الرصيد الجاري",
  };
  return labels[key] || rawKey;
}

function orderReportColumnKeys(keys) {
  const out = [];
  const used = new Set();
  for (const k of ["item_code", "code", "sku", "barcode"]) {
    if (keys.includes(k) && !used.has(k)) { out.push(k); used.add(k); }
  }
  for (const k of ["item_name", "name"]) {
    if (keys.includes(k) && !used.has(k)) { out.push(k); used.add(k); }
  }
  for (const k of keys) { if (!used.has(k)) out.push(k); }
  return out;
}

const SKU_COLUMN_KEYS = new Set(["item_code", "code", "sku", "barcode"]);
const MONEY_HINTS = ["price", "cost", "total", "amount", "balance", "sales", "profit", "discount", "vat", "cash", "revenue", "value", "collected", "outstanding", "due"];

function inferColumnType(key) {
  const lower = String(key || "").toLowerCase();
  if (SKU_COLUMN_KEYS.has(lower) || ["id", "invoice_no", "doc_no", "purchase_no", "ref_no", "return_ref", "reference_id", "shift_id", "user_id", "warehouse_id"].includes(lower)) return "code";
  if (lower === "date" || lower.endsWith("_date") || lower.includes("created_at") || lower.includes("closed_at")) return "date";
  if (lower.includes("percent") || lower === "pct" || lower.includes("rate") || lower === "percentage") return "percent";
  if (lower.includes("quantity") || lower.endsWith("_count") || lower.includes("days_")) return "number";
  if (MONEY_HINTS.some((hint) => lower.includes(hint))) return "money";
  return "text";
}

function normalizeColumn(c, index = 0) {
  const key = c?.key || c?.id || c;
  return {
    id: key,
    key,
    header: c?.label || c?.header || prettifyLabel(key),
    label: c?.label || c?.header || prettifyLabel(key),
    type: c?.type || inferColumnType(key),
    printPriority: c?.printPriority || (index < 5 ? "essential" : index < 9 ? "useful" : "optional"),
    defaultVisible: c?.defaultVisible !== false,
  };
}

const CATEGORY_META = {
  sales: { color: "#059669", bg: "rgba(5,150,105,0.10)", icon: TrendingUp, label: "مبيعات" },
  purchases: { color: "#2563EB", bg: "rgba(37,99,235,0.10)", icon: Package, label: "مشتريات" },
  inventory: { color: "#7C3AED", bg: "rgba(124,58,237,0.10)", icon: Package, label: "مخزون" },
  accounts: { color: "#D97706", bg: "rgba(217,119,6,0.10)", icon: Wallet, label: "حسابات" },
  treasury: { color: "#0891B2", bg: "rgba(8,145,178,0.10)", icon: Receipt, label: "خزينة" },
  tax: { color: "#DC2626", bg: "rgba(220,38,38,0.10)", icon: FileText, label: "ضرائب" },
  audit: { color: "#475569", bg: "rgba(71,85,105,0.10)", icon: Shield, label: "تدقيق" },
};

const EXPORT_CONFIGS = {
  pdf: { label: "PDF", icon: FileImage, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  word: { label: "Word", icon: FileText, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  print: { label: "طباعة", icon: Printer, color: "#475569", bg: "rgba(71,85,105,0.08)" },
};

const DATE_PRESETS = [
  { label: "اليوم", days: 0 },
  { label: "أمس", days: 1 },
  { label: "الأسبوع", days: 7 },
  { label: "الشهر", days: 30 },
  { label: "الربع", days: 90 },
];

const COST_METHODS = [
  { value: "wacc", label: "المتوسط المرجح" },
  { value: "fifo", label: "الوارد أولا" },
  { value: "lifo", label: "الوارد أخيرا" },
  { value: "last_purchase", label: "آخر سعر شراء" },
];

const COST_METHOD_REPORTS = new Set([
  "stock-valuation",
  "inventory-aging",
  "dead-stock",
  "slow-moving",
  "supplier-pricing",
  "top-customers",
  "period-comparison",
  "profit-loss",
  "cost-method-comparison",
  "item-lifecycle",
  "margin-drift",
  "inventory-turnover",
  "cashier-override-impact",
  "customer-profitability",
  "daily-owner-snapshot",
]);

function supportsCostMethod(definition) {
  return !!definition?.hasProfit || COST_METHOD_REPORTS.has(definition?.slug);
}

// Mirror print template constants so workspace pagination matches print pages exactly
const PRINT_HEADER_MM = 22;
const PRINT_FOOTER_MM = 14;
const PRINT_MARGIN_MM = 8;
const PRINT_HEIGHT_MM = 297; // A4
const PRINT_TEXT_WRAP_KEYS = new Set([
  "name","item_name","customer_name","supplier_name","description","label",
  "category_name","warehouse_name","cashier","full_name","reason","notes",
]);

function calcPrintRowsPerPage(visibleCols) {
  const colCount = Array.isArray(visibleCols) ? visibleCols.length : visibleCols;
  const hasWrap = Array.isArray(visibleCols)
    ? visibleCols.some((c) => c.type === "text" || c.type === "name" || PRINT_TEXT_WRAP_KEYS.has(c.key || c.id))
    : false;
  const usableHeight = PRINT_HEIGHT_MM - PRINT_MARGIN_MM * 2 - PRINT_HEADER_MM - PRINT_FOOTER_MM - 15;
  const baseRowH = colCount > 8 ? 5.5 : colCount > 6 ? 6 : 7;
  const rowH = hasWrap ? baseRowH * 1.2 : baseRowH;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

const CHART_COLORS = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#F59E0B", "#EC4899"];

function TableSkeleton({ colCount = 6 }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-3">
        {Array.from({ length: colCount }).map((_, i) => (
          <div key={i} className="h-8 flex-1 rounded-lg bg-zinc-100 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: colCount }).map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-lg bg-zinc-50 animate-pulse" style={{ animationDelay: `${(rowIdx + i) * 30}ms` }} />
          ))}
        </div>
      ))}
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
    try {
      await onExport(format);
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const isReady = status === "ready";
  const isError = status === "error";
  const isLoading = status === "loading";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold transition-all duration-200 border bg-white shadow-sm hover:shadow-md active:scale-95"
      style={{
        color: isReady ? "#047857" : isError ? "#b91c1c" : cfg.color,
        borderColor: isReady ? "#6ee7b7" : isError ? "#fca5a5" : "#e4e4e7",
      }}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span>{isLoading ? "جاري..." : isReady ? "تم ✓" : isError ? "خطأ" : cfg.label}</span>
    </button>
  );
}

function FilterInput({ filter, t, value, onChange, dynamicOptions }) {
  const opts = dynamicOptions || filter.options || [];
  if (filter.type === "lookup") {
    const entityLabel = { category: "تصنيف", product: "منتج", customer: "عميل", supplier: "مورد", user: "مستخدم", warehouse: "مخزن" }[filter.entity] || filter.entity;
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{t(filter.label_key) || entityLabel}</label>
        <LookupEntityFilter
          entity={filter.entity}
          value={value || ""}
          onChange={(v) => onChange(filter.key, v)}
          placeholder={`بحث عن ${entityLabel}...`}
        />
      </div>
    );
  }
  if (filter.type === "select") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{t(filter.label_key)}</label>
        <select
          value={value || ""}
          onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
        >
          <option value="">الكل</option>
          {opts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label || t(opt.label_key) || opt.label_key}</option>
          ))}
        </select>
      </div>
    );
  }
  if (filter.type === "text") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{t(filter.label_key)}</label>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(filter.key, e.target.value)}
          placeholder={t(filter.label_key)}
          className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
        />
      </div>
    );
  }
  return null;
}

function suggestChartType(columns) {
  const keys = columns.map((c) => c.id || c.key || c);
  const hasDate = keys.some((k) => k.toLowerCase().includes("date") || k === "created_at");
  const hasCategory = keys.some((k) =>
    ["category_name", "payment_type", "movement_type", "status", "type", "hour_slot", "weekday", "reason", "stock_status", "source"].includes(k.toLowerCase())
  );
  if (hasDate) return "line";
  if (hasCategory) return "bar";
  return "bar";
}

function prepareChartData(rows, columns, chartType) {
  if (!rows.length || !columns.length) return { data: [], xKey: null, yKey: null };

  const keys = columns.map((c) => c.id || c.key || c);
  const dateKey = keys.find((k) => k.toLowerCase().includes("date") || k === "created_at");
  const catKey = keys.find((k) =>
    ["category_name", "payment_type", "movement_type", "status", "type", "hour_slot", "weekday", "reason", "stock_status", "source", "name", "item_name", "customer_name", "supplier_name"].includes(k.toLowerCase())
  );
  const numericKeys = keys.filter((k) => {
    if (["id", "shift_id", "user_id", "reference_id", "item_id", "resource", "action"].includes(k.toLowerCase())) return false;
    const sample = rows[0]?.[k];
    return sample != null && !isNaN(Number(sample)) && String(sample).trim() !== "";
  });
  const totalKey = numericKeys.find((k) =>
    ["total", "total_sales", "total_purchases", "revenue", "total_value", "total_amount", "net_sales", "gross_sales", "total_cost", "quantity", "quantity_sold", "balance", "vat_amount"].includes(k.toLowerCase())
  );
  const yKey = totalKey || numericKeys[0];
  const xKey = chartType === "line" ? dateKey : catKey || keys[0];

  if (!xKey || !yKey) return { data: [], xKey: null, yKey: null };

  let chartData = rows.map((r) => ({ ...r }));
  if (chartType === "line" && dateKey) {
    chartData = [...chartData].sort((a, b) => {
      const da = new Date(a[dateKey]);
      const db = new Date(b[dateKey]);
      return da - db;
    });
  }

  return { data: chartData, xKey, yKey };
}

export default function ReportWorkspacePage() {
  const { reportSlug } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const setColumnOrderAction = useReportsStore((s) => s.setColumnOrder);
  const setColumnVisibilityAction = useReportsStore((s) => s.setColumnVisibility);
  const getStorePreference = useReportsStore((s) => s.getPreference);
  const setCostMethodAction = useReportsStore((s) => s.setCostMethod);

  const { data: registry } = useQuery({
    queryKey: ["report-registry"],
    queryFn: () => reportsApi.fetchRegistry(),
    staleTime: 5 * 60 * 1000,
  });
  const definition = useMemo(() => {
    if (!registry?.reports) return null;
    return registry.reports.find((r) => r.slug === reportSlug) || null;
  }, [registry, reportSlug]);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const defaultFrom = useMemo(() => formatDate(monthStart), [monthStart]);
  const defaultTo = useMemo(() => formatDate(today), [today]);

  const initialFrom = useMemo(() => {
    const value = searchParams.get("start_date");
    return isValidDateString(value) ? value : defaultFrom;
  }, [defaultFrom, searchParams]);

  const initialTo = useMemo(() => {
    const value = searchParams.get("end_date");
    return isValidDateString(value) ? value : defaultTo;
  }, [defaultTo, searchParams]);

  const initialCostMethod = useMemo(() => {
    return searchParams.get("cost_method") || getStorePreference(reportSlug, "costMethod", "wacc");
  }, [reportSlug, searchParams, getStorePreference]);

  const [activeTab, setActiveTab] = useState("table");
  const storedVisibility = useMemo(() => getStorePreference(reportSlug, "columnVisibility", null), [getStorePreference, reportSlug]);
  const storedOrder = useMemo(() => getStorePreference(reportSlug, "columnOrder", null), [getStorePreference, reportSlug]);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const [columnVisibility, setColumnVisibilityState] = useState(() => storedVisibility || {});
  const [columnOrder, setColumnOrderState] = useState(() => storedOrder || []);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => {
    const init = { from: initialFrom, to: initialTo, q: "" };
    if (definition?.filters) {
      definition.filters.forEach((f) => { init[f.key] = searchParams.get(f.key) || ""; });
    }
    return init;
  });

  const [scope, setScope] = useState(() => {
    const cat = searchParams.get("category_id");
    const item = searchParams.get("item_id");
    const cust = searchParams.get("customer_id");
    const supp = searchParams.get("supplier_id");
    if (cat) return { type: "category", values: [cat], valueLabels: [] };
    if (item) return { type: "product", values: [item], valueLabels: [] };
    if (cust) return { type: "customer", values: [cust], valueLabels: [] };
    if (supp) return { type: "supplier", values: [supp], valueLabels: [] };
    return { type: "all", values: [] };
  });

  const [appliedParams, setAppliedParams] = useState(() => {
    const params = {};
    if (definition?.supportsDates) { params.start_date = initialFrom; params.end_date = initialTo; }
    if (supportsCostMethod(definition)) { params.cost_method = initialCostMethod; }
    if (definition?.filters) {
      definition.filters.forEach((f) => {
        const v = searchParams.get(f.key);
        if (v) params[f.key] = v;
      });
    }
    params.q = searchParams.get("q") || "";
    params.page = 1;
    params.pageSize = calcPrintRowsPerPage(6);
    return params;
  });

  const columnDropdownRef = useRef(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printAllData, setPrintAllData] = useState(null);
  const [printAllLoading, setPrintAllLoading] = useState(false);
  const [measuredPrintRowsPerPage, setMeasuredPrintRowsPerPage] = useState(null);
  const [costMethod, setCostMethod] = useState(initialCostMethod);
  const [exportProgress, setExportProgress] = useState(null);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [globalPrintSettings, setGlobalPrintSettings] = useState({});
  useEffect(() => {
    api.get("/api/reports/payment-type-options").then((r) => {
      if (r.data?.data) setPaymentTypeOptions(r.data.data);
    }).catch(() => {});
    api.get("/api/settings").then((r) => {
      if (r.data?.data) setGlobalPrintSettings(r.data.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const init = { from: initialFrom, to: initialTo, q: "" };
    if (definition?.filters) {
      definition.filters.forEach((f) => { init[f.key] = searchParams.get(f.key) || ""; });
    }
    setFilters(init);
    const params = {};
    if (definition?.supportsDates) { params.start_date = initialFrom; params.end_date = initialTo; }
    if (supportsCostMethod(definition)) { params.cost_method = initialCostMethod; }
    if (definition?.filters) {
      definition.filters.forEach((f) => {
        const v = searchParams.get(f.key);
        if (v) params[f.key] = v;
      });
    }
    // Apply initial scope from النطاق التحليلي (set by ReportsCenter)
    if (scope.type === "category" && scope.values?.length) {
      params.category_id = scope.values[0];
    } else if (scope.type === "product" && scope.values?.length) {
      params.item_id = scope.values[0];
    } else if (scope.type === "customer" && scope.values?.length) {
      params.customer_id = scope.values[0];
    } else if (scope.type === "supplier" && scope.values?.length) {
      params.supplier_id = scope.values[0];
    }
    params.q = "";
    params.page = 1;
    params.pageSize = calcPrintRowsPerPage(6);
    setAppliedParams(params);
    setScope(() => {
      const cat = searchParams.get("category_id");
      const item = searchParams.get("item_id");
      const cust = searchParams.get("customer_id");
      const supp = searchParams.get("supplier_id");
      if (cat) return { type: "category", values: [cat], valueLabels: [] };
      if (item) return { type: "product", values: [item], valueLabels: [] };
      if (cust) return { type: "customer", values: [cust], valueLabels: [] };
      if (supp) return { type: "supplier", values: [supp], valueLabels: [] };
      return { type: "all", values: [] };
    });
    setCostMethod(initialCostMethod);
    setColumnVisibilityState(storedVisibility || {});
    setColumnOrderState(storedOrder || []);
    setColumnVisibilityOpen(false);
    setActiveTab("table");
    setExportProgress(null);
  // Intentionally depend only on reportSlug/initial so column changes don't reset page
  }, [reportSlug, initialFrom, initialTo, initialCostMethod, definition, searchParams]);

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
    queryKey: ["report", reportSlug, appliedParams],
    queryFn: () => reportsApi.fetchReport(reportSlug, appliedParams),
    enabled: !!definition,
    placeholderData: keepPreviousData,
  });

  const rows = Array.isArray(result?.data) ? result.data : [];
  const columnsDef = result?.columns || definition?.columns || [];
  const totalRows = result?.total || 0;
  const currentPage = result?.page || appliedParams.page || 1;
  const currentPageSize = result?.pageSize || appliedParams.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPageSize));
  const serverTotals = result?.totals || {};

  const allColumns = useMemo(() => {
    let cols;
    if (columnsDef.length > 0) {
      cols = columnsDef.map((c, index) => normalizeColumn(c, index));
    } else {
      const sample = rows[0];
      if (!sample) return [];
      const keys = orderReportColumnKeys(Object.keys(sample));
      cols = keys.map((key, index) => normalizeColumn({ key }, index));
    }
    if (columnOrder.length > 0 && columnOrder.length === cols.length) {
      const colMap = {};
      cols.forEach((c) => { colMap[c.id] = c; });
      return columnOrder.map((id) => colMap[id]).filter(Boolean);
    }
    return cols;
  }, [columnsDef, rows, columnOrder]);

  useEffect(() => {
    if (allColumns.length > 0) {
      if (Object.keys(columnVisibility).length === 0) {
        const initial = {};
        allColumns.forEach((c) => { initial[c.id] = c.defaultVisible !== false; });
        setColumnVisibilityState(initial);
      }
      if (columnOrder.length === 0) {
        const order = allColumns.map((c) => c.id);
        setColumnOrderState(order);
        setColumnOrderAction(reportSlug, order);
      }
    }
  }, [allColumns, columnVisibility, columnOrder, reportSlug, setColumnOrderAction]);

  const visibleColumns = useMemo(() => {
    return allColumns.filter((c) => columnVisibility[c.id] !== false);
  }, [allColumns, columnVisibility]);

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
  const displayColumns = useMemo(() => {
    if (showAllColumns) return smartColumns;
    return smartColumns.filter((c) => c.adjustedPriority !== "optional");
  }, [smartColumns, showAllColumns]);

  const PRIORITY_LABELS = { essential: "أساسي", useful: "مهم", optional: "اختياري" };
  const PRIORITY_COLORS = { essential: "text-emerald-600 bg-emerald-50 border-emerald-200", useful: "text-blue-600 bg-blue-50 border-blue-200", optional: "text-zinc-400 bg-zinc-50 border-zinc-200" };

  const printReadiness = useMemo(() => {
    const score = visibleColumns.reduce((sum, col) => {
      if (col.type === "money" || col.type === "text") return sum + 1.2;
      if (col.type === "code") return sum + 1.05;
      return sum + 0.9;
    }, 0);
    if (score <= 7) return { label: "جاهز للطباعة", tone: "emerald" };
    if (score <= 10) return { label: "مزدحم", tone: "amber" };
    return { label: "اختر أعمدة للطباعة", tone: "red" };
  }, [visibleColumns]);

  function toggleColumnVisibility(colId) {
    setColumnVisibilityState((prev) => {
      const next = { ...prev, [colId]: !(prev[colId] !== false) };
      setColumnVisibilityAction(reportSlug, next);
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
      setColumnOrderAction(reportSlug, next);
      return next;
    });
  }

  // When print template measures exact rows/page, update workspace pagination immediately
  const handleRowsPerPage = useCallback((measured) => {
    setMeasuredPrintRowsPerPage(measured);
    setAppliedParams((prev) => {
      if (prev.pageSize === measured) return prev;
      return { ...prev, page: 1, pageSize: measured };
    });
  }, []);

  // Reset measurement when column set changes
  useEffect(() => {
    setMeasuredPrintRowsPerPage(null);
  }, [visibleColumns.length]);

  // Keep pageSize in sync with print rows-per-page estimate as visible columns change
  useEffect(() => {
    if (visibleColumns.length === 0) return;
    if (measuredPrintRowsPerPage !== null) return;
    const printPageSize = calcPrintRowsPerPage(visibleColumns);
    setAppliedParams((prev) => {
      if (prev.pageSize === printPageSize) return prev;
      return { ...prev, page: 1, pageSize: printPageSize };
    });
  }, [visibleColumns, measuredPrintRowsPerPage]);

  const chartType = useMemo(() => suggestChartType(allColumns), [allColumns]);
  const { data: chartData, xKey, yKey } = useMemo(() => prepareChartData(rows, allColumns, chartType), [rows, allColumns, chartType]);

  const columnTotals = useMemo(() => {
    if (!rows.length) return {};
    // Prefer server-computed full-dataset totals
    if (Object.keys(serverTotals).length > 0) {
      return serverTotals;
    }
    // Fallback: compute from current page only
    const totals = {};
    const summableKeys = allColumns.map(c => c.id).filter(k => {
      const lower = k.toLowerCase();
      if (lower.includes("id") || lower.includes("code") || lower.includes("sku") || lower.includes("barcode") || lower.includes("no") || lower.includes("status") || lower.includes("date") || lower.includes("created") || lower.includes("name") || lower.includes("phone")) return false;
      if (lower.includes("rate") && !lower.includes("tax")) return false;
      return true;
    });

    summableKeys.forEach(key => {
      let isNumeric = true;
      let sum = 0;
      let hasValue = false;
      for (let i = 0; i < rows.length; i++) {
        const val = rows[i][key];
        if (val == null || val === "") continue;
        const num = Number(val);
        if (isNaN(num)) {
          isNumeric = false;
          break;
        }
        sum += num;
        hasValue = true;
      }
      if (isNumeric && hasValue && sum !== 0) totals[key] = sum;
    });
    return totals;
  }, [rows, allColumns, serverTotals]);

  const topStats = useMemo(() => {
    if (!rows.length) return null;
    const out = [];
    const entries = Object.entries(columnTotals).sort((a, b) => b[1] - a[1]); // Sort by largest value
    
    // prioritize keys with "net", "total", "gross"
    entries.sort((a, b) => {
       const aKey = a[0].toLowerCase();
       const bKey = b[0].toLowerCase();
       const aScore = aKey.includes("net") ? 3 : (aKey.includes("total") || aKey.includes("gross") || aKey.includes("amount") ? 2 : 1);
       const bScore = bKey.includes("net") ? 3 : (bKey.includes("total") || bKey.includes("gross") || bKey.includes("amount") ? 2 : 1);
       return bScore - aScore;
    });
    
    // Take top 3 max
    entries.slice(0, 3).forEach(([k, v]) => {
      out.push({ label: allColumns.find((c) => c.id === k)?.header || prettifyLabel(k), value: v.toLocaleString("en-US", { maximumFractionDigits: 2 }) });
    });
    
    if (out.length === 0) {
      out.push({ label: "عدد السجلات", value: rows.length.toLocaleString("en-US") });
    }
    return out;
  }, [rows, columnTotals, allColumns]);

  const gridData = useMemo(() => {
    return rows;
  }, [rows]);

  const categoryMeta = definition ? CATEGORY_META[definition.cat] : null;
  const CategoryIcon = categoryMeta?.icon || BarChart3;
  const exportFormats = definition?.exportFormats || ["pdf", "excel", "print"];
  const invalidRange = definition?.supportsDates && filters.from > filters.to;
  const hasCostMethodSelector = supportsCostMethod(definition);

  // Debounce for search text
  function useDebounce(value, delay) {
    const [dv, setDv] = useState(value);
    useEffect(() => { const h = setTimeout(() => setDv(value), delay); return () => clearTimeout(h); }, [value, delay]);
    return dv;
  }
  const debouncedQ = useDebounce(filters.q, 300);

  // Live filters — auto-update params on any filter change
  const filterSignature = JSON.stringify({
    from: filters.from, to: filters.to, q: debouncedQ, scope, costMethod,
    dims: (definition?.filters || []).map((f) => filters[f.key] || ""),
    printPageSize: measuredPrintRowsPerPage || (visibleColumns.length > 0 ? calcPrintRowsPerPage(visibleColumns) : calcPrintRowsPerPage(6)),
  });
  useEffect(() => {
    if (invalidRange) return;
    const pageSize = measuredPrintRowsPerPage || (visibleColumns.length > 0 ? calcPrintRowsPerPage(visibleColumns) : calcPrintRowsPerPage(6));
    const params = { page: 1, pageSize };
    if (definition?.supportsDates) { params.start_date = filters.from; params.end_date = filters.to; }
    if (hasCostMethodSelector) { params.cost_method = costMethod; setCostMethodAction(reportSlug, costMethod); }
    if (definition?.filters) {
      definition.filters.forEach((f) => { if (filters[f.key]) params[f.key] = filters[f.key]; });
    }
    if (scope.type === "category" && scope.values?.length) { params.category_id = scope.values[0];
    } else if (scope.type === "product" && scope.values?.length) { params.item_id = scope.values[0];
    } else if (scope.type === "customer" && scope.values?.length) { params.customer_id = scope.values[0];
    } else if (scope.type === "supplier" && scope.values?.length) { params.supplier_id = scope.values[0]; }
    if (debouncedQ) params.q = debouncedQ;
    setAppliedParams(params);
  }, [filterSignature, reportSlug, hasCostMethodSelector]);

  function handleResetFilters() {
    const reset = { from: defaultFrom, to: defaultTo, q: "" };
    if (definition?.filters) {
      definition.filters.forEach((f) => { reset[f.key] = ""; });
    }
    setFilters(reset);
    setScope({ type: "all", values: [] });
    setCostMethod("wacc");
  }

  function handlePageChange(page) {
    setAppliedParams((prev) => ({ ...prev, page: Math.max(1, Math.min(page, totalPages)) }));
  }

  function applyDatePreset(days) {
    const end = new Date();
    const start = new Date();
    if (days > 0) { start.setDate(end.getDate() - days); }
    setFilters((cur) => ({ ...cur, from: formatDate(start), to: formatDate(end) }));
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const handleExport = useCallback(async (format, exportColumns = visibleColumns) => {
    if (format === "print") {
      console.group("[PrintDebug] handleExport print");
      console.log("totalRows:", totalRows, "pageSize requested:", Math.max(totalRows, 10000), "appliedParams:", appliedParams);
      setPrintAllLoading(true);
      try {
        const MAX_PAGE_SIZE = 10000;
        const batchSize = Math.min(Math.max(totalRows, 1), MAX_PAGE_SIZE);
        const totalPagesNeeded = Math.ceil(totalRows / batchSize);

        let allData;
        if (totalPagesNeeded <= 1) {
          allData = await reportsApi.fetchReport(reportSlug, {
            ...appliedParams,
            page: 1,
            pageSize: batchSize,
          });
        } else {
          // Batch fetch data in chunks for large reports
          const batchPromises = [];
          for (let p = 1; p <= totalPagesNeeded; p++) {
            batchPromises.push(reportsApi.fetchReport(reportSlug, {
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
          console.log("batched fetch — batches:", totalPagesNeeded, "total rows merged:", mergedData.length);
        }

        const rowCount = allData?.data?.length;
        console.log("fetchReport response — rows received:", rowCount, "server total:", allData?.total, "hasData array:", Array.isArray(allData?.data));
        console.groupEnd();
        setPrintAllData(allData);
        setPrintOpen(true);
      } catch (err) {
        console.warn("[PrintDebug] fetchReport error", err);
        console.groupEnd();
        setPrintAllData(null);
        setPrintOpen(true);
      }
      setPrintAllLoading(false);
      return;
    }
    setExportProgress({ format, percent: 0 });
    try {
      const blob = await reportsApi.exportReport(reportSlug, format, {
        ...appliedParams,
        columns: exportColumns,
        onProgress: (e) => {
          if (e.total) setExportProgress((prev) => prev ? { ...prev, percent: Math.round((e.loaded / e.total) * 100) } : null);
        },
      });
      setExportProgress((prev) => prev ? { ...prev, percent: 100 } : null);
      const extMap = { pdf: "pdf", excel: "xlsx", word: "docx" };
      const ext = extMap[format] || "xlsx";
      const filename = `${definition?.slug || reportSlug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`تم تحميل ${filename}`);
    } catch (error) {
      toast.error(error.message || "فشل التصدير");
      throw error;
    } finally {
      setTimeout(() => setExportProgress(null), 2000);
    }
  }, [reportSlug, appliedParams, definition, visibleColumns, totalRows]);

  if (!definition) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-inner">
            <LayoutList size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 mb-2">التقرير غير متاح</h1>
            <p className="text-sm text-zinc-500 max-w-sm">هذا التقرير غير معروف في النظام الحالي.</p>
          </div>
          <Link to="/reports/center" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors shadow-lg">
            <ArrowLeft size={16} /> العودة إلى مركز التقارير
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8 bg-[#fafafa] min-h-screen text-zinc-900 font-satoshi" dir="rtl">
      
      {/* 1. LIGHT MODE BENTO HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        
        {/* Main Title Card */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-[24px] border border-zinc-200 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -left-32 -top-32 w-96 h-96 rounded-full blur-[80px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-20" style={{ backgroundColor: categoryMeta?.color || "#10b981" }} />
          
          <div>
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-zinc-50 border border-zinc-100" style={{ color: categoryMeta?.color }}>
                <CategoryIcon size={26} strokeWidth={2} />
              </div>
              <div className="pt-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{definition.id}</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-300" />
                  <span className="text-[11px] font-bold text-zinc-500">{categoryMeta?.label}</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-1">{definition.title}</h1>
                <p className="text-sm font-medium text-zinc-500 max-w-xl leading-relaxed">{definition.desc}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-100/80">
            <Link to="/reports/center" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-2sm font-bold transition-all hover:scale-[1.02] active:scale-95">
              <LayoutTemplate size={16} /> الرجوع للمركز
            </Link>
            {definition.supportsDates && (
              <div className="flex items-center gap-2 text-2sm font-bold text-zinc-500 bg-zinc-50 px-4 py-2 rounded-xl border border-zinc-100">
                <CalendarDays size={14} className="text-zinc-400" />
                <span>الفترة: <span className="text-zinc-900 tabular-nums">{appliedParams.start_date || "—"}</span> إلی <span className="text-zinc-900 tabular-nums">{appliedParams.end_date || "—"}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Column */}
        <div className="col-span-1 flex flex-col gap-3">
          {topStats ? topStats.map((s, idx) => (
             <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={s.label} 
                className="flex-1 bg-white rounded-[24px] border border-zinc-200 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden group min-h-[100px]"
             >
               <div className="absolute right-0 top-0 bottom-0 w-1 bg-zinc-100 group-hover:bg-emerald-400 transition-colors duration-300" />
               <div className="text-[11px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest truncate">{s.label}</div>
               <div className="text-3xl font-black text-zinc-900 tabular-nums tracking-tight truncate">{s.value}</div>
             </motion.div>
          )) : (
             <div className="flex-1 bg-white rounded-[24px] border border-zinc-200 p-6 shadow-sm flex items-center justify-center text-zinc-300">
               <Loader2 size={24} className="animate-spin" />
             </div>
          )}
        </div>
      </div>

      {/* 2. STICKY COMMAND BAR */}
      <div className="sticky top-4 z-40 bg-white/80 backdrop-blur-xl border border-zinc-200 rounded-[20px] p-2.5 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3 transition-all">
         <div className="flex items-center gap-2">
           <button onClick={() => setFiltersOpen(!filtersOpen)} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${filtersOpen ? "bg-zinc-900 text-white shadow-md" : "bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200"}`}>
             <SlidersHorizontal size={16} /> 
             <span>الفلاتر المتقدمة</span>
             <ChevronDown size={14} className={`transition-transform duration-300 ${filtersOpen ? "rotate-180 text-zinc-400" : ""}`} />
           </button>
           <div className="w-px h-6 bg-zinc-200 mx-1" />
           <button onClick={() => refetch()} className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-sm font-bold flex items-center gap-2 transition-all hover:shadow-sm active:scale-95">
             <RefreshCw size={14} className={isFetching ? "animate-spin text-emerald-500" : ""} /> تحديث البيانات
           </button>
         </div>

         <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black ${
              printReadiness.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
              printReadiness.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" :
              "border-red-200 bg-red-50 text-red-700"
            }`}>
              <Printer size={12} /> {printReadiness.label}
            </span>
            <span className="text-[11px] font-bold text-zinc-400 ml-2 uppercase tracking-widest">تصدير</span>
            {exportFormats.map(fmt => <ExportPill key={fmt} format={fmt} onExport={handleExport} />)}
         </div>
      </div>

      {/* COLLAPSIBLE FILTERS PANEL */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white rounded-[24px] border border-zinc-200 p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Search */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">بحث عام</label>
                  <div className="relative group">
                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="text" 
                      value={filters.q || ""} 
                      onChange={(e) => setFilters(c => ({ ...c, q: e.target.value }))} 
                      placeholder="ابحث بالاسم، الكود، الوصف..." 
                      className="w-full h-11 pr-11 pl-4 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 font-bold placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
                    />
                  </div>
                </div>

                {/* Dates */}
                {definition.supportsDates && (
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex justify-between items-center">
                      الفترة الزمنية
                      <div className="flex gap-1">
                        {DATE_PRESETS.map(p => (
                          <button key={p.label} onClick={() => applyDatePreset(p.days)} className="text-[11px] text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-md">{p.label}</button>
                        ))}
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={filters.from} onChange={(e) => setFilters(c => ({ ...c, from: e.target.value }))} className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900" />
                      <span className="text-zinc-400">-</span>
                      <input type="date" value={filters.to} onChange={(e) => setFilters(c => ({ ...c, to: e.target.value }))} className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900" />
                    </div>
                  </div>
                )}

                {/* Dynamic Filters */}
                {definition.filters?.map(f => (
                  <FilterInput key={f.key} filter={f} t={t} value={filters[f.key]}
                    onChange={handleFilterChange}
                    dynamicOptions={f.key === 'payment_type' ? paymentTypeOptions : undefined}
                  />
                ))}

                {/* Analytical Scope (النطاق التحليلي) */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">النطاق التحليلي</label>
                  <ScopeSelector
                    scopeOptions={SCOPE_OPTIONS[definition.cat] || SCOPE_OPTIONS.sales}
                    scope={scope}
                    onScopeChange={setScope}
                  />
                </div>

                {/* Cost Method */}
                {hasCostMethodSelector && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">طريقة حساب التكلفة</label>
                    <select value={costMethod} onChange={(e) => setCostMethod(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900">
                      {COST_METHODS.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <motion.span animate={{ scale: isFetching ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.4, repeat: isFetching ? Infinity : 0 }} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {isFetching ? "تحديث..." : "تلقائي"}
                  </span>
                  {invalidRange && <span className="text-[11px] font-bold text-red-600">تاريخ البداية يجب أن يكون قبل تاريخ النهاية</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleResetFilters} className="px-4 py-2 rounded-xl text-2sm font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">إعادة تعيين</button>
                  <button onClick={() => setFiltersOpen(false)} className="px-4 py-2 rounded-xl text-2sm font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors">إغلاق</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {exportProgress && (
        <div className="mb-6 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-2sm font-bold text-emerald-800 mb-2">
            <span>جاري تجهيز وتصدير ملف {exportProgress.format.toUpperCase()}...</span>
            <span>{exportProgress.percent}%</span>
          </div>
          <ProgressBar value={exportProgress.percent} max={100} color="emerald" />
        </div>
      )}

      {/* 3. WORKSPACE TABS */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setActiveTab("table")} className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "table" ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900"}`}>
          <LayoutList size={16} /> جدول البيانات
        </button>
        <button onClick={() => setActiveTab("chart")} className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "chart" ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900"}`}>
          <BarChart3 size={16} /> تحليل بياني
        </button>
      </div>

      {/* 4. MAIN DATA GRID */}
      <div className="bg-white rounded-[24px] border border-zinc-200 shadow-sm flex flex-col relative">
        
        {activeTab === "table" ? (
          <>
            {/* Grid Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 z-10 shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-zinc-200 shadow-sm text-zinc-500"><LayoutList size={12} /></span>
                <span className="text-sm font-black text-zinc-900">سجلات التقرير التفصيلية</span>
                {!isLoading && <span className="text-[11px] font-bold text-zinc-500 bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 shadow-sm">{totalRows.toLocaleString("en-US")} صف</span>}
              </div>
              <div className="flex items-center gap-3">
                {/* Column settings */}
                <div className="relative" ref={columnDropdownRef}>
                  <button onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-all shadow-sm">
                    <Settings2 size={14} /> تخصيص الأعمدة
                  </button>
                  <AnimatePresence>
                    {columnVisibilityOpen && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-zinc-200 bg-white shadow-xl p-3 flex flex-col gap-1" style={{ maxHeight: "400px", overflow: "auto" }}>
                        <div className="text-[11px] font-black text-zinc-400 px-2 py-1 uppercase tracking-widest mb-2 border-b border-zinc-100 pb-2">الأعمدة الظاهرة وترتيبها</div>
                        {allColumns.map((col, idx) => (
                          <div key={col.id} className="flex items-center justify-between group px-2 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors">
                            <button onClick={() => toggleColumnVisibility(col.id)} className="flex items-center gap-2.5 flex-1 text-right">
                              {columnVisibility[col.id] !== false ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} className="text-zinc-300" />}
                              <span className={`text-2sm font-bold ${columnVisibility[col.id] !== false ? "text-zinc-800" : "text-zinc-400 line-through decoration-zinc-300"}`}>{col.header}</span>
                            </button>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowUp size={12} /></button>
                              <button onClick={() => moveColumn(col.id, 1)} disabled={idx === allColumns.length - 1} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowDown size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Grid Body */}
            {isLoading ? (
              <div className="p-6"><TableSkeleton colCount={Math.min(visibleColumns.length || 6, 8)} /></div>
            ) : visibleColumns.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-24 bg-zinc-50/50">
                <div className="h-16 w-16 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-300 mb-4 shadow-sm"><Search size={28} /></div>
                <h3 className="text-[16px] font-black text-zinc-800 mb-1">لا توجد بيانات للعرض</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-xs">يرجى تغيير فلاتر البحث أو تحديد أعمدة لعرضها.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <DataGrid
                  data={gridData}
                  columns={visibleColumns.map((c) => ({
                    id: c.id,
                    header: c.header,
                    width: SKU_COLUMN_KEYS.has(c.id) ? 140 : Math.max(120, Math.min(200, 80 + c.header.length * 8)),
                    sortable: true,
                    headerClass: "text-right font-black text-[11px] text-zinc-500 uppercase tracking-wide bg-zinc-50/80 border-b border-zinc-200",
                    cellClass: "text-right border-b border-zinc-100 py-3",
                    render: SKU_COLUMN_KEYS.has(c.id)
                      ? (row) => (<span className="font-mono text-sm font-bold tabular-nums px-2 py-0.5 rounded-md text-zinc-700 bg-zinc-100/50 border border-zinc-200/50" dir="ltr">{row[c.id] != null && row[c.id] !== "" ? String(row[c.id]) : "—"}</span>)
                      : c.id === "warehouse_id" || c.id === "supplier_id" || c.id === "customer_id" || c.id === "cashier_id" || c.id === "user_id" || c.id === "category_id"
                        ? (row) => {
                            const nameKey = c.id.replace("_id", "_name");
                            const displayName = row[nameKey] || row[c.id];
                            if (displayName == null || displayName === "") return <span className="text-zinc-300">—</span>;
                            return <span className="text-sm font-medium text-zinc-700">{String(displayName)}</span>;
                          }
                        : (row) => {
                          const val = row[c.id];
                          if (val == null || val === "") return <span className="text-zinc-300">—</span>;
                          const num = Number(val);
                          const isNum = !isNaN(num) && String(val).trim() !== "";
                          if (isNum) return (<span className="tabular-nums text-sm font-bold text-zinc-900" dir="ltr" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>{num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>);
                          return <span className="text-sm font-medium text-zinc-700">{String(val)}</span>;
                        },
                  }))}
                  rowKey={(row) => row.id || JSON.stringify(row)}
                />
              </div>
            )}

            {/* Totals Bar */}
            {rows.length > 0 && Object.keys(columnTotals).length > 0 && (
              <div className="flex items-stretch border-t-2 border-emerald-500 bg-emerald-50/50">
                {visibleColumns.map((col) => {
                  const val = columnTotals[col.id];
                  const hasVal = val != null && !isNaN(Number(val));
                  return (
                    <div key={col.id}
                      style={{ minWidth: SKU_COLUMN_KEYS.has(col.id) ? 140 : Math.max(120, Math.min(200, 80 + col.header.length * 8)), flex: 1 }}
                      className="flex items-center justify-center px-3 py-2.5 text-center border-l border-emerald-100 last:border-l-0"
                    >
                      {hasVal ? (
                        <span className="text-sm font-black text-emerald-800 tabular-nums" dir="ltr">
                          {Number(val).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600">الإجمالي</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50 shrink-0">
                <div className="flex items-center gap-2 text-2sm font-bold text-zinc-500">
                  <span>إجمالي الصفحات: {totalPages.toLocaleString("en-US")}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-xl p-1 shadow-sm">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 disabled:opacity-30 hover:bg-zinc-100 hover:text-zinc-900 transition-all"><ChevronRight size={16} /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    const page = start + i;
                    if (page > totalPages) return null;
                    const isActive = page === currentPage;
                    return (<button key={page} onClick={() => handlePageChange(page)} className={`h-8 min-w-[32px] px-2 flex items-center justify-center rounded-lg text-sm font-black transition-all ${isActive ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>{page}</button>);
                  })}
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 disabled:opacity-30 hover:bg-zinc-100 hover:text-zinc-900 transition-all"><ChevronLeft size={16} /></button>
                </div>
                <div className="text-2sm font-bold text-zinc-400">صفحة {currentPage} من {totalPages}</div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 p-8 overflow-auto">
            {isLoading ? (
              <TableSkeleton colCount={3} />
            ) : !chartData.length || !xKey || !yKey ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-20 w-20 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-6 shadow-inner"><BarChart3 size={32} /></div>
                <h3 className="text-[18px] font-black text-zinc-900 mb-2">لا يمكن رسم بياني لهذه البيانات</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">جرب اختيار أعمدة تحتوي على قيم رقمية وتصنيفات (أو تواريخ).</p>
              </div>
            ) : (
              <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex items-center gap-4 text-sm font-bold text-zinc-500 bg-zinc-50 px-6 py-4 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-2"><LineChart size={16} className="text-emerald-500" /> <span>المحور السيني: <span className="text-zinc-900 bg-white px-2 py-1 rounded border border-zinc-200">{prettifyLabel(xKey)}</span></span></div>
                  <span className="w-px h-4 bg-zinc-300" />
                  <div className="flex items-center gap-2"><PieChart size={16} className="text-emerald-500" /> <span>المحور الصادي: <span className="text-zinc-900 bg-white px-2 py-1 rounded border border-zinc-200">{prettifyLabel(yKey)}</span></span></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <ResponsiveContainer width="100%" height={480}>
                    {chartType === "line" ? (
                      <RechartsLine data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f4f4f5" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#71717a", fontWeight: "bold" }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fontSize: 12, fill: "#71717a", fontWeight: "bold" }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "none", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "13px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }} itemStyle={{ color: "#fff" }} />
                        <Line type="monotone" dataKey={yKey} stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 7, strokeWidth: 0 }} name={prettifyLabel(yKey)} animationDuration={1500} animationEasing="ease-out" />
                      </RechartsLine>
                    ) : chartType === "bar" ? (
                      <RechartsBar data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f4f4f5" vertical={false} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#71717a", fontWeight: "bold" }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fontSize: 12, fill: "#71717a", fontWeight: "bold" }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip cursor={{ fill: "#f4f4f5" }} contentStyle={{ background: "#18181b", border: "none", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "13px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }} itemStyle={{ color: "#fff" }} />
                        <Bar dataKey={yKey} fill="#10b981" radius={[6, 6, 0, 0]} name={prettifyLabel(yKey)} animationDuration={1500} />
                      </RechartsBar>
                    ) : (
                      <RechartsPie>
                        <Pie data={chartData} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={120} outerRadius={180} paddingAngle={4} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} animationDuration={1500}>
                          {chartData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#18181b", border: "none", borderRadius: "12px", color: "#fff", fontWeight: "bold", fontSize: "13px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }} itemStyle={{ color: "#fff" }} />
                      </RechartsPie>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PrintPreviewModal
        open={printOpen}
        onClose={() => { setPrintOpen(false); setPrintAllData(null); }}
        settings={{}}
        operationLabel={definition.title}
        docType="reports_generic"
        reportColumns={visibleColumns}
        totalRows={printAllData?.total || totalRows}
        onExportAllColumns={() => handleExport("excel", allColumns)}
        renderContent={(printSettings) => (
          <ReportPrintTemplate
            title={definition.title}
            subtitle={definition.desc}
            rows={printAllData?.data || rows}
            columns={visibleColumns}
            totalRows={printAllData?.total || totalRows}
            currentPage={printSettings.currentPage || 1}
            filters={definition.supportsDates ? { from: appliedParams.start_date, to: appliedParams.end_date } : null}
            settings={printSettings}
            onPageCount={printSettings.onPageCount}
            onRowsPerPage={handleRowsPerPage}
            forcedRowsPerPage={appliedParams.pageSize}
          />
        )}
      />
    </div>
  );
}
