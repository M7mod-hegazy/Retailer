import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import toast from "react-hot-toast";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, ChevronDown, FileImage, FileSpreadsheet, FileText,
  LayoutTemplate, LayoutList, Loader2, Printer, RefreshCw, Search, SlidersHorizontal, X,
  ChevronLeft, ChevronRight, Settings2, Eye, EyeOff, ArrowUp, ArrowDown
} from "lucide-react";
import {
  LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell
} from "recharts";
import A4PageView from "../../components/ui/A4PageView";
import DataGrid from "../../components/ui/DataGrid";
import PDFExportDialog from "../../components/print/PDFExportDialog";
import { reportsApi } from "../../services/reports";
import { useReportsStore, buildPrefKey } from "../../stores/reportsStore";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ReportPrintTemplate from "./templates/ReportPrintTemplate";
import AccountStatementLedger from "./templates/AccountStatementLedger";
import api from "../../services/api";
import ProgressBar from "../../components/ui/ProgressBar";
import { ClassificationSelector, DataModeToggle, MultiSelectCheckboxes, LookupEntityFilter, ScopeSelector } from "./reportsCenterParts";
import { SOURCES, SCOPE_OPTIONS, COST_METHODS, fmtDate } from "./reportsCenterConfig";

const CLS_ARABIC = {
  "cls_sales_daily": "الملخص اليومي",
  "cls_sales_detailed": "المبيعات التفصيلية",
  "cls_sales_by_item": "حسب الصنف",
  "cls_sales_by_category": "حسب الفئة",
  "cls_sales_by_cashier": "حسب الكاشير",
  "cls_sales_by_payment": "حسب طريقة الدفع",
  "cls_sales_heatmap": "خريطة حرارة",
  "cls_sales_period_compare": "مقارنة فترتين",
  "cls_sales_discounts": "تحليل الخصومات",
  "cls_sales_margin": "هوامش الربح",
  "cls_sales_tax": "تحليل الضرائب",
  "cls_purchases_summary": "ملخص المشتريات",
  "cls_purchases_detailed": "المشتريات التفصيلية",
  "cls_purchases_by_supplier": "حسب المورد",
  "cls_purchases_by_item": "حسب الصنف",
  "cls_purchases_supplier_pricing": "تسعير الموردين",
  "cls_preturn_summary": "ملخص المرتجعات",
  "cls_preturn_detailed": "مرتجعات تفصيلية",
  "cls_preturn_by_supplier": "حسب المورد",
  "cls_sreturn_summary": "ملخص المرتجعات",
  "cls_sreturn_detailed": "مرتجعات تفصيلية",
  "cls_sreturn_by_customer": "حسب العميل",
  "cls_supplier_statement": "كشف حساب المورد",
  "cls_supplier_aging": "تقادم ذمم الموردين",
  "cls_supplier_purchases": "سجل المشتريات",
  "cls_supplier_returns": "سجل المرتجعات",
  "cls_supplier_reliability": "موثوقية الموردين",
  "cls_customer_statement": "كشف حساب العميل",
  "cls_customer_aging": "تقادم ذمم العملاء",
  "cls_top_customers": "أفضل العملاء",
  "cls_collection_efficiency": "كفاءة التحصيل",
  "cls_customer_loyalty": "ولاء العملاء",
  "cls_emp_cashier_perf": "أداء الكاشير",
  "cls_emp_shifts": "الورديات",
  "cls_emp_user_activity": "نشاط المستخدمين",
  "cls_emp_incentives": "الحوافز",
  "cls_inst_plans": "خطط التقسيط",
  "cls_inst_collections": "تحصيلات",
  "cls_inst_by_customer": "حسب العميل",
  "cls_inst_delinquent": "المتأخرات",
  "cls_item_stock_levels": "مستويات المخزون",
  "cls_item_valuation": "تقييم المخزون",
  "cls_item_count_sheet": "ورقة جرد",
  "cls_item_reorder": "إعادة الطلب",
  "cls_item_expiry": "انتهاء الصلاحية",
  "cls_item_slow_moving": "الراكد",
  "cls_item_aging": "تقادم المخزون",
  "cls_item_dead_stock": "مخزون ميت",
  "cls_wh_movements": "حركات المخازن",
  "cls_wh_transfers": "تحويلات",
  "cls_wh_per_warehouse": "حسب المخزن",
  "cls_exp_summary": "ملخص المصروفات",
  "cls_exp_detailed": "مصروفات تفصيلية",
  "cls_exp_by_category": "حسب الفئة",
  "cls_exp_by_payment": "حسب طريقة الدفع",
  "cls_rev_summary": "ملخص الإيرادات",
  "cls_rev_detailed": "إيرادات تفصيلية",
  "cls_rev_by_category": "حسب الفئة",
  "cls_rev_by_payment": "حسب طريقة الدفع",
  "cls_trs_cash_flow": "التدفق النقدي",
  "cls_trs_balances": "الأرصدة",
  "cls_trs_reconciliation": "التسويات",
  "cls_trs_daily_sessions": "الجلسات اليومية",
  "cls_trs_withdrawals": "السحوبات",
  "cls_profit_by_item": "الربح حسب الصنف",
  "cls_profit_by_category": "الربح حسب الفئة",
  "cls_profit_health": "صحة الأرباح",
  "cls_net_income": "قائمة الدخل",
  "cls_net_by_category": "صافي الربح حسب الفئة",
  "cls_net_by_customer": "صافي الربح حسب العميل",
  "cls_net_by_period": "صافي الربح حسب الفترة",
  "cheques": "الشيكات",
  "bank-transactions": "الحركات البنكية",
  "bank-summary": "ملخص البنوك",
  "daily-summary": "الملخص اليومي",
  "detailed": "تفصيلي",
  "summary": "ملخص",
  "by-item": "حسب الصنف",
  "by-category": "حسب الفئة",
  "by-cashier": "حسب الكاشير",
  "by-payment": "حسب طريقة الدفع",
  "by-supplier": "حسب المورد",
  "by-customer": "حسب العميل",
  "supplier-pricing": "تسعير الموردين",
  "reliability": "موثوقية الموردين",
  "purchases": "سجل المشتريات",
  "returns": "سجل المرتجعات",
  "aging": "تقادم الذمم",
  "top-customers": "أفضل العملاء",
  "collection-efficiency": "كفاءة التحصيل",
  "loyalty": "ولاء العملاء",
  "income-statement": "قائمة الدخل",
  "by-period": "حسب الفترة",
  "health": "صحة الأرباح",
  "status": "الحالة",
  "paid": "مدفوع",
  "unpaid": "غير مدفوع",
  "cancelled": "ملغي",
  "cash": "نقداً",
  "card": "بطاقة",
  "credit": "آجل",
  "wallet": "محفظة",
  // Lookup/select filter label_keys (avoid raw English leaking into filter labels)
  "supplier": "المورد",
  "customer": "العميل",
  "product": "الصنف",
  "category": "الفئة",
  "user": "المستخدم",
  "warehouse": "المخزن",
  "cashier": "الكاشير",
  "role": "الصلاحية",
  "action": "الإجراء",
  "payment_type": "طريقة الدفع",
  "movement_type": "نوع الحركة",
  "in": "وارد",
  "out": "صادر",
  "transfer": "تحويل",
  "admin": "مدير النظام",
  "manager": "مدير",
  "pending": "معلق",
  "cleared": "محصّل",
  "bounced": "مرتجع",
  "replaced": "مستبدل",
};

function a(key) { return CLS_ARABIC[key] || key; }
const ID_TO_NAME_COLUMNS = new Set(["warehouse_id", "supplier_id", "customer_id", "cashier_id", "user_id", "category_id"]);

const ARABIC_COL_LABELS = {
  id: "#", date: "التاريخ", created_at: "تاريخ الإنشاء", updated_at: "تاريخ التحديث",
  invoice_no: "رقم الفاتورة", doc_no: "رقم المستند", reference_no: "المرجع", ref_no: "رقم المستند",
  customer_name: "العميل", customer_id: "العميل", supplier_name: "المورد", supplier_id: "المورد",
  item_name: "الصنف", item_code: "كود الصنف", item_id: "الصنف", barcode: "الباركود",
  category_name: "الفئة", category_id: "الفئة",
  warehouse_name: "المخزن", warehouse_id: "المخزن",
  cashier: "الكاشير", cashier_id: "الكاشير", user_id: "المستخدم", full_name: "الاسم",
  payment_type: "طريقة الدفع", payment_method: "طريقة الدفع", payment_breakdown: "تفاصيل الدفع",
  status: "الحالة", cancel_reason: "سبب الإلغاء",
  total: "الإجمالي", subtotal: "قبل الخصم", discount: "الخصم", increase: "الإضافة",
  net_sales: "صافي المبيعات", gross_sales: "إجمالي المبيعات", total_sales: "إجمالي المبيعات",
  total_cost: "التكلفة", gross_profit: "إجمالي الربح", net_profit: "صافي الربح",
  profit_margin: "هامش الربح", avg_transaction: "متوسط الفاتورة",
  invoice_count: "عدد الفواتير", item_count: "عدد الأصناف", quantity: "الكمية",
  unit_price: "سعر الوحدة", cost_price: "سعر التكلفة",
  returns_amount: "المرتجعات", total_discount: "إجمالي الخصومات",
  amount: "المبلغ", balance: "الرصيد", opening_balance: "الرصيد الافتتاحي",
  description: "الوصف", reason: "السبب", notes: "ملاحظات", note: "ملاحظة",
  refund_method: "طريقة الاسترداد", settlement_type: "نوع التسوية",
  supplier_count: "عدد الموردين", customer_count: "عدد العملاء",
  transaction_count: "عدد الحركات", running_total: "الإجمالي التراكمي", total_amount: "إجمالي المبلغ",
  type: "النوع", name: "الاسم", label: "التسمية",
  from_warehouse: "من مخزن", to_warehouse: "إلى مخزن", movement_type: "نوع الحركة",
  opening_cash: "نقد الافتتاح", closing_cash: "نقد الإغلاق", cash_variance: "فرق النقد",
  shift_id: "الوردية", total_withdrawals: "المسحوبات",
  due_date: "تاريخ الاستحقاق", paid_amount: "المدفوع", remaining: "المتبقي",
  tax_rate: "نسبة الضريبة", tax_amount: "قيمة الضريبة", vat_amount: "ضريبة القيمة المضافة",
  role: "الصلاحية", username: "اسم المستخدم", last_login: "آخر دخول",
  action: "الإجراء", resource: "المورد",
  debit: "مدين", credit: "دائن", running_balance: "الرصيد الجاري", line_total: "إجمالي السطر",
  aging_0_30: "0-30 يوم", aging_31_60: "31-60 يوم", aging_61_90: "61-90 يوم", aging_90_plus: "أكثر من 90 يوم",
  weekday_name: "اليوم", hour_slot: "الساعة",
  stock_status: "حالة المخزون", reorder_level: "حد إعادة الطلب", current_stock: "المخزون الحالي",
  avg_daily_sales: "متوسط المبيعات اليومية", days_of_stock: "أيام المخزون",
};
const NOTE_KEYS = new Set(["notes", "note", "description", "cancel_reason", "reason"]);
function arColLabel(key) { return ARABIC_COL_LABELS[key] || key; }

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
  return date.toISOString().slice(0, 10);
}

const CHART_COLORS = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#F59E0B", "#EC4899"];

const DATE_PRESETS = [
  { label: "اليوم", days: 0 },
  { label: "أمس", days: 1 },
  { label: "الأسبوع", days: 7 },
  { label: "الشهر", days: 30 },
  { label: "الربع", days: 90 },
];

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

// Shown for supplier/customer statements before a party is picked: a clear CTA
// plus a faded ghost preview of the ledger so the user knows what they'll get.
function StatementEmptyPreview({ partyType }) {
  const label = partyType === "customer" ? "اختر عميلاً لعرض كشف الحساب" : "اختر مورداً لعرض كشف الحساب";
  const ghostRows = [
    { d: "رصيد أول المدة", a: "—", tone: "bg-amber-100/70" },
    { d: "فاتورة", a: "مدين", tone: "bg-blue-100/60" },
    { d: "أصناف الفاتورة", a: "", tone: "bg-zinc-100/60", indent: true },
    { d: "دفعة", a: "دائن", tone: "bg-emerald-100/60" },
    { d: "مرتجع", a: "دائن", tone: "bg-rose-100/60" },
    { d: "الإجمالي / رصيد الحركة", a: "", tone: "bg-zinc-300/60" },
  ];
  return (
    <div dir="rtl" className="flex flex-col items-center justify-center flex-1 py-16 px-6 bg-zinc-50/40">
      <div className="h-14 w-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-emerald-500 mb-4 shadow-sm">
        <FileText size={26} />
      </div>
      <h3 className="text-[17px] font-black text-zinc-800 mb-1">{label}</h3>
      <p className="text-sm text-zinc-500 mb-7 max-w-md text-center">
        ابحث عن {partyType === "customer" ? "العميل" : "المورد"} من حقل الفلتر بالأعلى لعرض كشف حساب تفصيلي بكل الحركات والأصناف.
      </p>
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden opacity-70 pointer-events-none select-none">
        <div className="grid grid-cols-2 text-[11px] font-bold">
          <div className="bg-zinc-800 text-zinc-300 px-3 py-2">{partyType === "customer" ? "العميل" : "المورد"}</div>
          <div className="bg-zinc-100 text-zinc-400 px-3 py-2 text-left">{partyType === "customer" ? "كود العميل" : "كود المورد"}</div>
        </div>
        {ghostRows.map((r, i) => (
          <div key={i} className={`flex items-center gap-3 px-3 py-2.5 border-t border-zinc-100 ${r.tone} ${r.indent ? "pr-10" : ""}`}>
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-300/80" />
            <div className="h-2.5 rounded bg-zinc-300/70" style={{ width: r.indent ? "40%" : "55%" }} />
            <div className="ml-auto h-2.5 w-16 rounded bg-zinc-300/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

const EXPORT_CONFIGS = {
  pdf: { label: "PDF", icon: FileImage, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  word: { label: "Word", icon: FileText, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  print: { label: "طباعة", icon: Printer, color: "#475569", bg: "rgba(71,85,105,0.08)" },
};

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
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold transition-all duration-200 border bg-white shadow-sm hover:shadow-md active:scale-95"
      style={{ color: status === "ready" ? "#047857" : status === "error" ? "#b91c1c" : cfg.color, borderColor: status === "ready" ? "#6ee7b7" : status === "error" ? "#fca5a5" : "#e4e4e7" }}>
      {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span>{status === "loading" ? "جاري..." : status === "ready" ? "تم ✓" : status === "error" ? "خطأ" : cfg.label}</span>
    </button>
  );
}

function FilterInput({ filter, value, onChange, dynamicOptions }) {
  const opts = (dynamicOptions && dynamicOptions.length > 0) ? dynamicOptions : (filter.options || []);
  if (filter.type === "lookup") {
    const entityLabel = { category: "تصنيف", product: "منتج", customer: "عميل", supplier: "مورد", user: "مستخدم", warehouse: "مخزن" }[filter.entity] || filter.entity;
    const filterLabel = a(filter.label_key) === 'payment_type' ? 'طريقة الدفع' : a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500">{filterLabel || entityLabel}</label>
        <LookupEntityFilter entity={filter.entity} value={value || ""} onChange={(v) => onChange(filter.key, v)} placeholder={`بحث عن ${entityLabel}...`} />
      </div>
    );
  }
  if (filter.type === "select") {
    const filterLabel = a(filter.label_key) === 'payment_type' ? 'طريقة الدفع' : a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500">{filterLabel}</label>
        <select value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm cursor-pointer">
          <option value="">الكل</option>
          {opts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label || a(opt.label_key)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (filter.type === "text") {
    const filterLabel = a(filter.label_key) === 'payment_type' ? 'طريقة الدفع' : a(filter.label_key);
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-500">{filterLabel}</label>
        <input type="text" value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm" />
      </div>
    );
  }
  return null;
}

function suggestChartType(columns) {
  const keys = columns.map((c) => c.id || c.key || c);
  if (keys.some((k) => k.toLowerCase().includes("date") || k === "created_at")) return "line";
  return "bar";
}

function prepareChartData(rows, columns, chartType) {
  if (!rows.length || !columns.length) return { data: [], xKey: null, yKey: null };
  const keys = columns.map((c) => c.id || c.key || c);
  const dateKey = keys.find((k) => k.toLowerCase().includes("date") || k === "created_at");
  const catKey = keys.find((k) => ["category_name", "payment_type", "movement_type", "status", "type", "hour_slot", "weekday", "reason", "stock_status", "source", "name", "item_name", "customer_name", "supplier_name"].includes(k.toLowerCase()));
  const numericKeys = keys.filter((k) => {
    if (["id", "shift_id", "user_id", "reference_id", "item_id", "resource", "action"].includes(k.toLowerCase())) return false;
    const sample = rows[0]?.[k];
    return sample != null && !isNaN(Number(sample));
  });
  const totalKey = numericKeys.find((k) => ["total", "total_sales", "total_purchases", "revenue", "total_value", "total_amount", "net_sales", "gross_sales", "total_cost", "quantity", "quantity_sold", "balance", "vat_amount"].includes(k.toLowerCase()));
  const yKey = totalKey || numericKeys[0];
  const xKey = chartType === "line" ? dateKey : catKey || keys[0];
  if (!xKey || !yKey) return { data: [], xKey: null, yKey: null };
  let chartData = rows.map((r) => ({ ...r }));
  if (chartType === "line" && dateKey) {
    chartData = [...chartData].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
  }
  return { data: chartData, xKey, yKey };
}

export default function SourceWorkspacePage() {
  const { sourceKey, classificationId, dataMode } = useParams();
  const navigate = useNavigate();
  const setColumnOrderAction = useReportsStore((s) => s.setColumnOrder);
  const setColumnVisibilityAction = useReportsStore((s) => s.setColumnVisibility);
  const getStorePreference = useReportsStore((s) => s.getPreference);
  const setCostMethodAction = useReportsStore((s) => s.setCostMethod);
  const store = useReportsStore();

  const prefKey = buildPrefKey(sourceKey, classificationId, dataMode);

  const { data: registry } = useQuery({
    queryKey: ["report-registry"],
    queryFn: () => reportsApi.fetchRegistry(),
    staleTime: 5 * 60 * 1000,
  });

  const sourceDef = useMemo(() => {
    return (SOURCES || []).find((s) => s.id === sourceKey) || null;
  }, [sourceKey]);

  const classifications = useMemo(() => {
    return registry?.classifications?.[sourceKey] || [];
  }, [registry, sourceKey]);

  const clsDef = useMemo(() => {
    return classifications.find((c) => c.id === classificationId) || null;
  }, [classifications, classificationId]);

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
  const [filters, setFilters] = useState({ from: defaultFrom, to: defaultTo, q: "" });
  const [scope, setScope] = useState({ type: "all", values: [] });
  const [costMethod, setCostMethod] = useState("wacc");
  const [exportProgress, setExportProgress] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printAllData, setPrintAllData] = useState(null);
  const [printAllLoading, setPrintAllLoading] = useState(false);
  const [measuredPrintRowsPerPage, setMeasuredPrintRowsPerPage] = useState(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [columnVisibility, setColumnVisibilityState] = useState({});
  const [columnOrder, setColumnOrderState] = useState([]);
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
  // reset column visibility/order so they re-derive for the new report's columns.
  useEffect(() => {
    setColumnVisibilityState({});
    setColumnOrderState([]);
    setShowAllColumns(false);
  }, [sourceKey, classificationId, dataMode]);

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

  // Live filters — auto-update params on any filter change.
  // NOTE: clsDef loads asynchronously from the registry. Its identity/flags MUST be part
  // of the signature, otherwise the effect won't re-run once clsDef arrives and the date
  // range is never applied for classifications with no extra `filters` (period ignored).
  const filterSignature = JSON.stringify({
    cls: clsDef ? `${classificationId}:${dataMode}` : null,
    sup: !!clsDef?.supportsDates, prof: !!clsDef?.hasProfit,
    from: filters.from, to: filters.to, q: debouncedQ, scope, costMethod,
    dims: (clsDef?.filters || []).map((f) => filters[f.key] || ""),
    msf: (clsDef?.multiSelectFilters || []).map((f) => (filters[f.key] || []).join(",")),
  });
  useEffect(() => {
    if (invalidRange) return;
    const params = { page: 1, pageSize: calcPrintRowsPerPage(6) }; // refined once visibleColumns stabilizes
    if (clsDef?.supportsDates) { params.start_date = filters.from; params.end_date = filters.to; }
    if (clsDef?.hasProfit) { params.cost_method = costMethod; setCostMethodAction(prefKey, costMethod); }
    (clsDef?.filters || []).forEach((f) => { if (filters[f.key]) params[f.key] = filters[f.key]; });
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
  }, [filterSignature]);

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
        return { id: key, key, header: label, label, type: c?.type || "text", defaultVisible: c?.defaultVisible !== false && !isNote, printPriority: c?.printPriority, isNote };
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
  const PRIORITY_COLORS = { essential: "text-emerald-600 bg-emerald-50 border-emerald-200", useful: "text-blue-600 bg-blue-50 border-blue-200", optional: "text-zinc-400 bg-zinc-50 border-zinc-200" };

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

  const chartType = useMemo(() => suggestChartType(allColumns), [allColumns]);
  const { data: chartData, xKey, yKey } = useMemo(() => prepareChartData(rows, allColumns, chartType), [rows, allColumns, chartType]);

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
        <td colSpan={displayColumns.length} className="bg-zinc-50/80 p-0">
          <div className="border-b border-zinc-200 mx-4" />
          <div className="py-2 px-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-zinc-500 font-bold border-b border-zinc-200">
                  <th className="text-right py-1.5 px-2">الصنف</th>
                  <th className="text-right py-1.5 px-2">الكود</th>
                  <th className="text-right py-1.5 px-2">الكمية</th>
                  <th className="text-right py-1.5 px-2">سعر الوحدة</th>
                  <th className="text-right py-1.5 px-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {row._items.map((item, i) => (
                  <tr key={i} className="border-b border-zinc-100 last:border-0">
                    <td className="py-1.5 px-2 text-zinc-800 font-medium">{item.item_name}</td>
                    <td className="py-1.5 px-2 text-zinc-500 font-mono text-left" dir="ltr">{item.code || item.barcode || "-"}</td>
                    <td className="py-1.5 px-2 text-zinc-700 tabular-nums">{item.quantity}</td>
                    <td className="py-1.5 px-2 text-zinc-700 tabular-nums text-left" dir="ltr">{Number(item.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td className="py-1.5 px-2 text-zinc-800 tabular-nums font-bold text-left" dir="ltr">{Number(item.line_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  }, [hasItemsRows, expandedRows, displayColumns.length]);

  const invalidRange = clsDef?.supportsDates && filters.from > filters.to;

  function handleResetFilters() {
    setFilters({ from: defaultFrom, to: defaultTo, q: "" });
    setScope({ type: "all", values: [] });
    setCostMethod("wacc");
  }

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
      const filename = `${sourceKey}-${classificationId}-${new Date().toISOString().slice(0, 10)}.${ext}`;
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

  if (!sourceDef) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-inner"><LayoutTemplate size={36} /></div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 mb-2">المصدر غير متاح</h1>
            <p className="text-sm text-zinc-500">مصدر التقرير غير معروف.</p>
          </div>
          <Link to="/reports/center" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-colors shadow-lg">
            <ArrowLeft size={16} /> العودة إلى مركز التقارير
          </Link>
        </div>
      </div>
    );
  }

  const SourceIcon = sourceDef.icon;
  const exportFormats = ["pdf", "excel", "word", "print"];
  const categoryColor = sourceDef.color;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8 text-slate-900" dir="rtl">
      {/* COMMAND COCKPIT (DASHBOARD HARDENED) */}
      <div className="flex flex-col mb-8 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden relative">
        
        {/* Row 1: Header & Primary Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <Link 
              to="/reports/center" 
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200/80 shadow-sm text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95 shrink-0"
              title="العودة لمركز التقارير"
            >
              <ArrowRight size={18} />
            </Link>
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-slate-200/50 shadow-sm" style={{ color: categoryColor }}>
              <SourceIcon size={22} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">{sourceDef.label}</span>
              <h1 className="text-[20px] font-bold text-slate-900 tracking-tight leading-none">{a(classificationId)}</h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm">
            <select
              value={classificationId}
              onChange={(e) => {
                const cls = classifications.find((c) => c.id === e.target.value);
                const mode = cls?.availableModes?.[0] || "detailed";
                navigate(`/reports/source/${sourceKey}/${e.target.value}/${mode}`);
              }}
              className="h-9 px-4 rounded-lg border-none bg-transparent text-sm font-semibold text-slate-800 focus:outline-none focus:ring-0 transition-all cursor-pointer"
            >
              {classifications.map((cls) => (
                <option key={cls.id} value={cls.id}>{a(cls.label_key)}</option>
              ))}
            </select>
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3 bg-white">
          <div className="flex items-center gap-2">
            <button onClick={() => setFiltersOpen(!filtersOpen)}
              className={`h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${filtersOpen ? "bg-primary text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"}`}>
              <SlidersHorizontal size={14} />
              <span>فلاتر متقدمة</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
            <button onClick={() => refetch()} className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-sm">
              <RefreshCw size={14} className={isFetching ? "animate-spin text-slate-900" : "text-slate-400"} /> تحديث
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {exportFormats.map((fmt) => <ExportPill key={fmt} format={fmt} onExport={handleExport} />)}
          </div>
        </div>

        {/* Row 3: Filters Tray (Collapsible) */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden border-t border-slate-100 bg-slate-50/50">
              <div className="p-6">
                
                {/* Search & Dates Row */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                  {/* Global Search */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">بحث عام</label>
                    <div className="relative group">
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                      <input ref={searchRef} type="text" value={filters.q || ""} onChange={(e) => setFilters((c) => ({ ...c, q: e.target.value }))}
                        onKeyDown={e => handleKeyDown(e, { nextRef: dateFromRef })}
                        placeholder="ابحث بالاسم، الكود، الوصف..." className="w-full h-10 pr-9 pl-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm font-medium" />
                    </div>
                  </div>

                  {/* Dates */}
                  {clsDef?.supportsDates && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                        <span>الفترة الزمنية</span>
                        <div className="flex gap-1">
                          {DATE_PRESETS.map((p) => (
                            <button key={p.label} onClick={() => {
                              const end = new Date(); const start = new Date();
                              if (p.days > 0) start.setDate(end.getDate() - p.days);
                              setFilters((c) => ({ ...c, from: formatDate(start), to: formatDate(end) }));
                            }} className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors bg-white hover:bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{p.label}</button>
                          ))}
                        </div>
                      </label>
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm h-10 overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
                        <input ref={dateFromRef} type="date" value={filters.from} onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: searchRef })} className="flex-1 h-full px-3 bg-transparent text-sm font-medium text-slate-900 focus:outline-none font-mono" />
                        <div className="w-px h-6 bg-slate-200" />
                        <input ref={dateToRef} type="date" value={filters.to} onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))} onKeyDown={e => handleKeyDown(e, { nextRef: costMethodRef, prevRef: dateFromRef })} className="flex-1 h-full px-3 bg-transparent text-sm font-medium text-slate-900 focus:outline-none font-mono" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Specific Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {(clsDef?.filters || []).map((f) => (
                    <FilterInput key={f.key} filter={f} value={filters[f.key]}
                      onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
                      dynamicOptions={f.dynamic ? paymentTypeOptions : undefined}
                    />
                  ))}
                  {(clsDef?.multiSelectFilters || []).map((msf) => (
                    <div key={msf.key} className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500">{a(msf.label_key) === 'payment_type' ? 'طريقة الدفع' : a(msf.label_key)}</label>
                      <MultiSelectCheckboxes options={msf.options} value={filters[msf.key] || []} onChange={(v) => setFilters((prev) => ({ ...prev, [msf.key]: v }))} label={a(msf.label_key) === 'payment_type' ? 'طريقة الدفع' : a(msf.label_key)} formatLabel={a} />
                    </div>
                  ))}
                  {clsDef?.supportsScope && (
                    <div className="space-y-1.5 col-span-1 md:col-span-2 xl:col-span-1">
                      <label className="text-[11px] font-semibold text-slate-500">النطاق التحليلي</label>
                      <ScopeSelector scopeOptions={SCOPE_OPTIONS[sourceKey] || SCOPE_OPTIONS.sales} scope={scope} onScopeChange={setScope} />
                    </div>
                  )}
                  {clsDef?.hasProfit && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500">طريقة حساب التكلفة</label>
                      <select ref={costMethodRef} value={costMethod} onChange={(e) => setCostMethod(e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: closeFilterRef, prevRef: dateToRef })} className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm cursor-pointer">
                        {COST_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Footer Toolbar */}
                <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100/50 px-3 py-1 text-[11px] font-medium text-slate-600 border border-slate-200/60">
                      <motion.span animate={{ scale: isFetching ? [1, 1.2, 1] : 1, opacity: isFetching ? [1, 0.5, 1] : 1 }} transition={{ duration: 0.8, repeat: isFetching ? Infinity : 0, ease: "easeInOut" }} className="w-2 h-2 rounded-full bg-slate-500" />
                      {isFetching ? "جاري التحديث..." : "تحديث تلقائي"}
                    </span>
                    {invalidRange && <span className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">تاريخ البداية يجب أن يكون قبل تاريخ النهاية</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleResetFilters} className="h-9 px-4 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">إعادة تعيين</button>
                    <button ref={closeFilterRef} onClick={() => setFiltersOpen(false)} onKeyDown={e => handleKeyDown(e, { prevRef: costMethodRef, onEnter: () => closeFilterRef.current?.click() })} className="h-9 px-5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-600 transition-colors active:scale-95 shadow-sm">تطبيق الفلاتر</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {exportProgress && (
        <div className="mb-6 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-2sm font-bold text-emerald-800 mb-2">
            <span>جاري تصدير {exportProgress.format.toUpperCase()}...</span>
            <span>{exportProgress.percent}%</span>
          </div>
          <ProgressBar value={exportProgress.percent} max={100} color="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setActiveTab("table")}
          className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "table" ? "bg-primary text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50"}`}>
          <LayoutList size={16} /> جدول
        </button>
        <button onClick={() => setActiveTab("chart")}
          className={`px-5 py-2.5 text-sm font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "chart" ? "bg-primary text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50"}`}>
          <BarChart3 size={16} /> رسم بياني
        </button>
      </div>

      {/* Data Area */}
      <div className="bg-white rounded-[24px] border border-zinc-200 shadow-sm flex flex-col relative">
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
          <div className="flex flex-col items-center justify-center flex-1 text-center py-24 bg-zinc-50/50">
            <div className="h-16 w-16 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-300 mb-4 shadow-sm"><Search size={28} /></div>
            <h3 className="text-[16px] font-black text-zinc-800 mb-1">لا توجد بيانات</h3>
            <p className="text-sm text-zinc-500 max-w-xs">يرجى تغيير الفلاتر أو اختيار تصنيف آخر.</p>
          </div>
        ) : activeTab === "table" ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <motion.span
                  animate={isFetching ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  className="text-sm font-black text-zinc-900"
                >
                  {isFetching ? "جاري التحديث..." : "البيانات"}
                </motion.span>
                <span className="text-[11px] font-bold text-zinc-500 bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 shadow-sm">{totalRows.toLocaleString("en-US")} صف</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" ref={columnDropdownRef}>
                  <button onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2sm font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-all shadow-sm">
                    <Settings2 size={14} /> الأعمدة
                  </button>
                  <AnimatePresence>
                    {columnVisibilityOpen && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 top-full mt-2 z-50 w-80 rounded-2xl border border-zinc-200 bg-white shadow-xl p-3 max-h-[420px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100">
                          <span className="text-[11px] font-black text-zinc-400">الأعمدة</span>
                          <button onClick={() => setShowAllColumns(!showAllColumns)}
                            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                            {showAllColumns ? "إخفاء الاختياري" : "إظهار الكل"}
                          </button>
                        </div>
                        {pickerDisplay.map((col, idx) => {
                          const isOptional = col.defaultVisible === false;
                          return (
                            <div key={col.id} className="flex items-center justify-between group px-2 py-1.5 rounded-xl hover:bg-zinc-50">
                              <button onClick={() => toggleColumnVisibility(col.id)} className="flex items-center gap-2 flex-1 text-right">
                                {columnVisibility[col.id] !== false ? <Eye size={14} className="text-emerald-500 shrink-0" /> : <EyeOff size={14} className="text-zinc-300 shrink-0" />}
                                <span className={`text-2sm font-bold ${columnVisibility[col.id] !== false ? "text-zinc-800" : "text-zinc-400 line-through"}`}>{col.header}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${isOptional ? "text-zinc-400 bg-zinc-50 border-zinc-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"} shrink-0`}>
                                  {isOptional ? "اختياري" : "افتراضي"}
                                </span>
                              </button>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"><ArrowUp size={12} /></button>
                                <button onClick={() => moveColumn(col.id, 1)} disabled={idx === pickerDisplay.length - 1} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"><ArrowDown size={12} /></button>
                              </div>
                            </div>
                          );
                        })}
                        {pickerColumns.some(c => c.adjustedPriority === 'optional') && (
                          <div className="mt-2 pt-2 border-t border-zinc-100">
                            <button onClick={() => setShowAllColumns(!showAllColumns)}
                              className="w-full text-center text-[11px] font-bold text-emerald-600 hover:text-emerald-700 py-1 rounded-lg hover:bg-emerald-50 transition-all">
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
                  render: c.id === "type"
                    ? (row) => {
                        const raw = row[c.id];
                        return <span className="text-sm font-medium text-zinc-700">{TYPE_LABELS[raw] || raw || "-"}</span>;
                      }
                    : ID_TO_NAME_COLUMNS.has(c.id)
                      ? (row) => {
                          const nameKey = c.id.replace("_id", "_name");
                          const displayName = row[nameKey] || row[c.id];
                          if (displayName == null || displayName === "") return <span className="text-zinc-300">—</span>;
                          return <span className="text-sm font-medium text-zinc-700">{String(displayName)}</span>;
                        }
                      : c.type === "cur" || c.type === "num" || c.type === "percent" || c.type === "money" || c.type === "number"
                        ? (row) => {
                            const val = row[c.id];
                            if (val == null || val === "") return <span className="text-zinc-300">—</span>;
                            const num = Number(val);
                            if (isNaN(num)) return <span className="text-sm font-medium text-zinc-700">{String(val)}</span>;
                            const suffix = c.type === "percent" ? "%" : "";
                            return (
                              <span className="tabular-nums text-sm font-bold text-zinc-900" dir="ltr" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                                {num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
                              </span>
                            );
                          }
                        : colIdx === 0 && hasItemsRows
                          ? (row, idx) => {
                              const rowId = row.id ?? idx;
                              const hasItems = row._items?.length > 0;
                              const isExpanded = expandedRows.has(rowId);
                              const raw = row[c.id];
                              return (
                                <div className="flex items-center gap-1.5">
                                  {hasItems ? (
                                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(rowId); }}
                                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors">
                                      <ChevronDown size={13} className={`text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  ) : <span className="w-5 shrink-0" />}
                                  <span className="text-sm font-medium text-zinc-700 truncate">{raw != null ? String(raw) : "-"}</span>
                                </div>
                              );
                            }
                          : undefined,
                }))}
                data={rows}
                rowKey="id"
                renderExpandedRow={renderItemExpandedRow}
                rowClass={(row) => row._is_item ? "bg-zinc-50/50" : ""}
              />
              {/* Totals Bar */}
              {rows.length > 0 && Object.keys(columnTotals).length > 0 && (
                <div className="flex items-stretch border-t-2 border-emerald-500 bg-emerald-50/50">
                  {displayColumns.map((col) => {
                    const val = columnTotals[col.id];
                    const hasVal = val != null && !isNaN(Number(val));
                    return (
                      <div key={col.id}
                        style={{ minWidth: col.width || 120, flex: 1 }}
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
            </motion.div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                <div className="flex items-center gap-2 text-2sm font-bold text-zinc-500">
                  <span>إجمالي الصفحات: {totalPages.toLocaleString("en-US")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30"><ChevronRight size={16} /></button>
                  <span className="text-2sm font-bold text-zinc-700 px-2">{currentPage.toLocaleString("en-US")} / {totalPages.toLocaleString("en-US")}</span>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30"><ChevronLeft size={16} /></button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 p-6">
            {chartData.length > 0 && xKey && yKey ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <RechartsLine data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={yKey} stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                  </RechartsLine>
                ) : (
                  <RechartsBar data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={yKey} fill="#059669" radius={[4, 4, 0, 0]} />
                  </RechartsBar>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400 text-sm font-bold">
                لا توجد بيانات كافية للرسم البياني
              </div>
            )}
          </div>
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
          if (openingBal != null) subtitleParts.push(`الرصيد الافتتاحي: ${Number(openingBal).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
          const computedSubtitle = subtitleParts.length ? subtitleParts.join(" | ") : undefined;
          return (
            <ReportPrintTemplate
              rows={printAllData?.data || rows}
              columns={visibleColumns}
              noteColumns={allColumns.filter((c) => c.isNote)}
              title={`${sourceDef?.label || ''} - ${a(classificationId)}`}
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
        title={`${sourceDef?.label || ''} - ${a(classificationId)}`}
        onExport={handlePdfExport}
      />
    </div>
  );
}
