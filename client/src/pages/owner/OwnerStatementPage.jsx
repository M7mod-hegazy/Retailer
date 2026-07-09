import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  FileLock2,
  FileText,
  GitCompare,
  Loader2,
  Printer,
  RefreshCcw,
  Save,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Database,
  Wallet,
  Users,
  ShoppingBag,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Info,
  Percent,
  Activity,
  Sparkles,
  ArrowRight,
  CornerDownLeft,
  FileDown
} from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePermission } from "../../hooks/usePermission";
import { usePageTour } from "../../hooks/usePageTour";
import { formatNumber } from "../../utils/currency";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import ErrorBoundary from "../../components/ErrorBoundary";
import ErrorFallbackPage from "../error/ErrorFallbackPage";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";

const COST_METHODS = [
  { value: "wacc", label: "المتوسط المرجح" },
  { value: "fifo", label: "الوارد أولا صادر أولا" },
  { value: "lifo", label: "الوارد أخيرا صادر أولا" },
  { value: "last_purchase", label: "آخر سعر شراء" },
];

const COST_METHOD_LABELS = Object.fromEntries(COST_METHODS.map((method) => [method.value, method.label]));
const PROFIT_SOURCE_LABELS = {
  sales: "المبيعات",
  returns: "مرتجعات المبيعات",
  net_sales: "صافي المبيعات",
  cogs: "تكلفة البضاعة المباعة",
  gross_profit: "مجمل الربح",
  revenues: "الإيرادات الأخرى",
  expenses: "المصروفات",
  withdrawals: "المسحوبات",
  net_profit: "صافي الربح",
};

const QUICK_RANGES = [
  { key: "this_month", label: "الشهر الحالي" },
  { key: "last_month", label: "الشهر الماضي" },
  { key: "quarter", label: "ربع سنة" },
  { key: "year", label: "سنة" },
];

const ROW_COLUMNS = {
  stock: [
    ["item_code", "الكود"],
    ["item_name", "الصنف"],
    ["category_name", "القسم"],
    ["warehouse_name", "المخزن"],
    ["quantity", "الكمية", "number"],
    ["unit_cost", "التكلفة", "money"],
    ["cost_source", "مصدر التكلفة"],
    ["value", "القيمة", "money"],
  ],
  cash: [
    ["group", "المجموعة"],
    ["label", "البند"],
    ["count", "عدد الحركات", "number"],
    ["amount", "القيمة", "money"],
  ],
  ar: [
    ["customer_name", "العميل"],
    ["phone", "الهاتف"],
    ["balance", "الرصيد", "money"],
    ["balance_label", "الاتجاه"],
  ],
  ap: [
    ["supplier_name", "المورد"],
    ["phone", "الهاتف"],
    ["balance", "الرصيد", "money"],
    ["balance_label", "الاتجاه"],
  ],
  expenses: [["date", "التاريخ"], ["category_name", "التصنيف"], ["description", "الوصف"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  revenues: [["date", "التاريخ"], ["category_name", "التصنيف"], ["description", "الوصف"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  withdrawals: [["date", "التاريخ"], ["category_name", "التصنيف"], ["reason", "السبب"], ["payment_method", "الدفع"], ["amount", "المبلغ", "money"], ["user_name", "المستخدم"]],
  net_profit: [["label", "البند"], ["count", "عدد المستندات", "number"], ["amount", "التأثير", "money"]],
};

const METRIC_HELP = {
  stock: "التكلفة هي تكلفة الوحدة المستخدمة في تقييم المخزون. إذا لم توجد حركة تكلفة، يستخدم التقرير سعر الشراء المسجل للصنف.",
  ar: "القيمة الموجبة = ذمم مدينة (العملاء مديونون)، القيمة السالبة = ذمم دائنة (لنا عند العملاء).",
  ap: "القيمة الموجبة = ذمم دائنة (لنا عند الموردين)، القيمة السالبة = ذمم مدينة (الموردون مديونون).",
  net_profit: "صافي الربح هنا = صافي المبيعات - تكلفة البضاعة المباعة حسب طريقة تقييم الكلفة المختارة.",
};

const FULL_LINKS = {
  stock: "/reports/stock-valuation",
  cash: "/daily-treasury",
  ar: "/reports/ar-aging",
  ap: "/reports/ap-aging",
  expenses: "/expenses",
  revenues: "/revenues",
  withdrawals: "/withdrawals",
  net_profit: "/reports/profit-loss",
};

function iso(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function initialRange() {
  const now = new Date();
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: iso(now),
  };
}

function rangeFromSearch(searchParams) {
  const fallback = initialRange();
  return {
    from: searchParams.get("from") || searchParams.get("start_date") || fallback.from,
    to: searchParams.get("to") || searchParams.get("end_date") || fallback.to,
  };
}

function costMethodFromSearch(searchParams) {
  const value = searchParams.get("cost_method") || "wacc";
  return COST_METHODS.some((method) => method.value === value) ? value : "wacc";
}

function money(value) {
  return formatNumber(value);
}

function displayValue(row, key, type) {
  if (key === "source_label") return row.source_label || PROFIT_SOURCE_LABELS[row.source] || row.source || "—";
  if (key === "cost_method_label") return row.cost_method_label || COST_METHOD_LABELS[row.cost_method] || row.cost_method || "—";
  if ((key === "actual_cash" || key === "discrepancy") && row[key] == null) return "—";
  if (type === "money") return money(row[key]);
  if (type === "number") return formatNumber(row[key]);
  return String(row[key] ?? "—").slice(0, 120);
}

function applyQuickRange(key) {
  const now = new Date();
  if (key === "last_month") {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (key === "quarter") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(now.getFullYear(), startMonth, 1)), to: iso(now) };
  }
  if (key === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return initialRange();
}

function rowText(row) {
  return Object.values(row || {}).join(" ").toLowerCase();
}

function exportCsv(filename, rows, columns) {
  const header = columns.map(([, label]) => label).join(",");
  const body = rows.map((row) => columns.map(([key, , type]) => `"${displayValue(row, key, type).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsTotalForMetric(metricKey, rows) {
  if (metricKey === "net_profit") {
    const totalRow = rows.find((row) => row.source === "net_profit");
    if (totalRow) return Number(totalRow.amount || 0);
    return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }
  if (metricKey === "cash") {
    const totalRow = rows.find((row) => row.source === "expected_cash");
    if (totalRow) return Number(totalRow.amount || 0);
    return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }
  const field = metricKey === "stock" ? "value" : (metricKey === "ar" || metricKey === "ap") ? "balance" : "amount";
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

const THEME_CLASSES = {
  net_profit: {
    icon: Sparkles,
    accentBg: "bg-success-text",
    gradient: "from-bg-bg-base to-bg-bg-base border border-border-strong shadow-card",
    cardCls: "border-primary",
    headerBg: "bg-primary text-white",
  },
  stock: {
    icon: Database,
    accentBg: "bg-info-text",
    bgTextCls: "bg-info-bg text-info-text border-info-border",
    cardCls: "border-border-normal hover:border-info-border hover:shadow-md",
    trend: "+2.4% متوقع",
    trendCls: "bg-info-bg text-info-text border-info-border",
    headerBg: "bg-primary text-white",
  },
  cash: {
    icon: Wallet,
    accentBg: "bg-primary",
    bgTextCls: "bg-primary-50 text-primary border-primary",
    cardCls: "border-border-normal hover:border-primary hover:shadow-md",
    trend: "رصيد مستقر",
    trendCls: "bg-primary-50 text-primary border-primary",
    headerBg: "bg-primary text-white",
  },
  ar: {
    icon: Users,
    accentBg: "bg-primary",
    bgTextCls: "bg-primary-50 text-primary border-primary",
    cardCls: "border-border-normal hover:border-primary hover:shadow-md",
    trend: "-1.8% تحصيل",
    trendCls: "bg-primary-50 text-primary border-primary",
    headerBg: "bg-primary text-white",
  },
  ap: {
    icon: Users,
    accentBg: "bg-primary",
    bgTextCls: "bg-primary-50 text-primary border-primary",
    cardCls: "border-border-normal hover:border-primary hover:shadow-md",
    trend: "+4.1% توريد",
    trendCls: "bg-primary-50 text-primary border-primary",
    headerBg: "bg-primary text-white",
  },
  expenses: {
    icon: TrendingDown,
    accentBg: "bg-danger-text",
    bgTextCls: "bg-danger-bg text-danger-text border-danger-border",
    cardCls: "border-border-normal hover:border-danger-border hover:shadow-md",
    trend: "تحت الرقابة",
    trendCls: "bg-danger-bg text-danger-text border-danger-border",
    headerBg: "bg-primary text-white",
  },
  revenues: {
    icon: TrendingUp,
    accentBg: "bg-success-text",
    bgTextCls: "bg-success-bg text-success-text border-success-border",
    cardCls: "border-border-normal hover:border-success-border hover:shadow-md",
    trend: "+8.9% إضافي",
    trendCls: "bg-success-bg text-success-text border-success-border",
    headerBg: "bg-primary text-white",
  },
  withdrawals: {
    icon: ShoppingBag,
    accentBg: "bg-warning-text",
    bgTextCls: "bg-warning-bg text-warning-text border-warning-border",
    cardCls: "border-border-normal hover:border-warning-border hover:shadow-md",
    trend: "معدل طبيعي",
    trendCls: "bg-warning-bg text-warning-text border-warning-border",
    headerBg: "bg-primary text-white",
  },
};

function MetricModal({ metric, rows, period, onClose, currencySymbol }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const columns = ROW_COLUMNS[metric?.key] || [];

  const filtered = useMemo(() => {
    let next = rows.filter((row) => rowText(row).includes(search.trim().toLowerCase()));
    if (sortKey) next = [...next].sort((a, b) => String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "ar"));
    return next;
  }, [rows, search, sortKey]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const displayTotal = rowsTotalForMetric(metric?.key, filtered);
  const fullTotal = rowsTotalForMetric(metric?.key, rows);

  useEffect(() => setPage(1), [search, sortKey, pageSize]);

  if (!metric) return null;
  const cfg = THEME_CLASSES[metric.key] || THEME_CLASSES.stock;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-bg-overlay backdrop-blur-xl p-4 overflow-y-auto" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.5rem] bg-bg-surface border border-border-normal shadow-2xl font-sans"
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Crowned Colored Header Banner reflecting document signatures */}
          <div className={`${cfg.headerBg} p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm select-none relative`}>
            <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)] pointer-events-none" />
            <div className="relative z-10 min-w-[260px] flex-1 space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-[9px] font-black text-white uppercase tracking-wider">
                <FileText size={11} /> وثيقة كشف تفصيلي معتمدة
              </span>
              <h2 className="inline-flex rounded-2xl bg-white/10 px-4 py-2 text-3xl font-black tracking-tight text-white shadow-sm ring-1 ring-white/10">
                {metric.label}
              </h2>
              <p className="text-xs font-bold text-white/80">
                الفترة من <span className="font-mono font-black" dir="ltr">{period.from}</span> إلى <span className="font-mono font-black" dir="ltr">{period.to}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 relative z-10">
              <div className="relative">
                <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/60" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="بحث سريع..."
                  className="w-44 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/60 py-2 pr-9 pl-3 text-xs font-bold outline-none focus:bg-white focus:text-text-primary focus:placeholder-slate-400 transition-all"
                />
              </div>

              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 text-white px-3 py-2 text-xs font-bold outline-none [&>option]:text-text-primary"
              >
                <option value="">ترتيب تلقائي</option>
                {columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>

              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-xl border border-white/20 bg-white/10 text-white px-3 py-2 text-xs font-bold outline-none [&>option]:text-text-primary"
              >
                {[50, 100, 200].map((size) => <option key={size} value={size}>عرض {size}</option>)}
              </select>

              <button
                onClick={() => exportCsv(`${metric.key}-${period.from}-${period.to}.csv`, filtered, columns)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white hover:text-text-primary px-4 py-2 text-xs font-black transition-colors"
              >
                <FileDown size={13} /> Excel
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white hover:text-text-primary px-4 py-2 text-xs font-black transition-colors"
              >
                <Printer size={13} /> طباعة
              </button>

              <button
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Help Banner if present */}
          {METRIC_HELP[metric.key] && (
            <div className="bg-amber-50/40 border-b border-amber-100 p-4 px-6 flex items-start gap-2.5 text-xs text-amber-800">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="font-bold leading-normal">{METRIC_HELP[metric.key]}</p>
            </div>
          )}

          {/* Table Container */}
          <div className="flex-1 overflow-auto bg-bg-base/20 scrollbar-thin">
            <table className="w-full min-w-[760px] border-collapse text-right text-xs">
              <thead className="sticky top-0 bg-bg-overlay/90 backdrop-blur-md text-[11px] font-black uppercase text-text-muted border-b border-border-normal/80">
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key} className="px-6 py-4 font-black text-text-muted tracking-wider">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-bg-surface">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-20 text-center text-xs font-bold text-text-muted">
                      لا توجد بيانات مطابقة للبحث أو الفترة المحددة
                    </td>
                  </tr>
                ) : (
                  visible.map((row, index) => (
                    <tr key={index} className="hover:bg-bg-base/40 transition-colors">
                      {columns.map(([key, , type]) => {
                        const val = displayValue(row, key, type);
                        const isMoney = key === "value" || key === "balance" || key === "total_due" || key === "amount";
                        return (
                          <td key={key} className="px-6 py-3.5 font-bold text-text-primary">
                            {isMoney ? (
                              <span className="font-mono text-text-primary text-sm whitespace-nowrap" dir="ltr">{val} {currencySymbol}</span>
                            ) : (
                              <span>{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer stats / pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle bg-bg-base/50 px-6 py-4.5 text-xs font-black">
            <div className="flex items-center gap-6 text-text-muted">
              <span className="flex items-center gap-2">
                إجمالي المعروض الحالي: <span className="font-mono text-sm text-text-primary" dir="ltr">{money(displayTotal)} {currencySymbol}</span>
              </span>
              <div className="w-px h-4 bg-border-normal" />
              <span className="flex items-center gap-2">
                إجمالي السجل الكلي: <span className="font-mono text-sm text-text-primary" dir="ltr">{money(fullTotal)} {currencySymbol}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-xl border border-border-normal bg-bg-surface px-3.5 py-1.5 hover:bg-bg-overlay disabled:opacity-40 transition-colors shadow-sm"
              >
                السابق
              </button>
              <span className="text-text-secondary font-bold">الصفحة <strong className="text-text-primary font-black">{page}</strong> من <strong className="text-text-primary font-black">{pages}</strong></span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
                className="rounded-xl border border-border-normal bg-bg-surface px-3.5 py-1.5 hover:bg-bg-overlay disabled:opacity-40 transition-colors shadow-sm"
              >
                التالي
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ComparePanel({ data, onClose }) {
  if (!data) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-bg-overlay backdrop-blur-xl p-4 overflow-y-auto" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="w-full max-w-4xl rounded-[2.5rem] bg-bg-surface border border-border-normal p-6 shadow-2xl font-sans"
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between border-b border-border-subtle pb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-[11px] font-black text-white uppercase tracking-wider shadow-[0_2px_8px_rgba(15,23,42,0.15)]">
                <GitCompare size={11} className="text-indigo-400" /> تحليل ومقارنة الفترات
              </span>
              <h2 className="text-2xl font-black text-text-primary tracking-tight mt-1.5">كشف مقارنة الفترات المالية</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl p-2 text-text-muted hover:text-text-primary hover:bg-bg-overlay transition-all border border-transparent hover:border-border-normal active:scale-90"
            >
              <X size={18} />
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-subtle shadow-inner">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-bg-base text-[11px] font-black text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <th className="px-5 py-3.5">البند المالي</th>
                  <th className="px-5 py-3.5">الفترة الأولى (أ)</th>
                  <th className="px-5 py-3.5">الفترة الثانية (ب)</th>
                  <th className="px-5 py-3.5">فرق القيمة (ب - أ)</th>
                  <th className="px-5 py-3.5">نسبة التغير (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-bg-surface">
                {data.rows.map((row) => {
                  const isNegativeDiff = row.diff < 0;
                  return (
                    <tr key={row.metric_key} className="hover:bg-bg-base/50 transition-colors">
                      <td className="px-5 py-4 font-black text-text-primary">{row.label}</td>
                      <td className="px-5 py-4 font-mono text-sm text-text-secondary" dir="ltr">{money(row.left_value)} {currencySymbol}</td>
                      <td className="px-5 py-4 font-mono text-sm text-text-secondary" dir="ltr">{money(row.right_value)} {currencySymbol}</td>
                       <td className={`px-5 py-4 font-mono text-sm font-black ${isNegativeDiff ? "text-danger-text" : "text-success-text"}`} dir="ltr">
                        <span className="flex items-center justify-end gap-1">
                          {money(row.diff)} {currencySymbol}
                          {isNegativeDiff ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {row.diff_pct == null ? (
                          <span className="text-text-muted font-bold">—</span>
                        ) : (
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-mono font-black ${isNegativeDiff ? "bg-danger-bg text-danger-text" : "bg-success-bg text-success-text"}`}>
                            {row.diff_pct >= 0 ? "+" : ""}{money(row.diff_pct)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function OwnerStatementPage() {
  const { t } = useTranslation();
  usePageTour("owner_statement");
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const [range, setRange] = useState(() => rangeFromSearch(searchParams));
  const [costMethod, setCostMethod] = useState(() => costMethodFromSearch(searchParams));
  const [data, setData] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedPaymentFlow, setSelectedPaymentFlow] = useState(null);
  const [paymentFlowDetails, setPaymentFlowDetails] = useState([]);
  const [paymentFlowDetailsLoading, setPaymentFlowDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState("ج.م");
  const [printOpen, setPrintOpen] = useState(false);
  const [leftCompare, setLeftCompare] = useState("");
  const [rightCompare, setRightCompare] = useState("");
  const [compareData, setCompareData] = useState(null);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const costMethodRef = useRef(null);
  const leftCompareRef = useRef(null);
  const rightCompareRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  const frozen = !!activeSnapshot;
  const display = activeSnapshot || data;
  const canSave = usePermission("owner_statement", "save");
  const canLock = usePermission("owner_statement", "lock");
  const paymentFlowRows = Array.isArray(display?.rows?.payment_flow) ? display.rows.payment_flow : [];
  const paymentFlowTotals = useMemo(() => paymentFlowRows.reduce((acc, row) => {
    acc.totalIn += Number(row.total_in || 0);
    acc.totalOut += Number(row.total_out || 0);
    acc.net += Number(row.net_amount || 0);
    acc.count += Number(row.transaction_count || 0);
    return acc;
  }, { totalIn: 0, totalOut: 0, net: 0, count: 0 }), [paymentFlowRows]);
  const ownerPaymentFlowHref = useMemo(() => {
    const params = new URLSearchParams({
      start_date: display?.period_start || range.from,
      end_date: display?.period_end || range.to,
    });
    return `/reports/source/payment-flow/payment-flow-summary/summary?${params.toString()}`;
  }, [display?.period_start, display?.period_end, range.from, range.to]);

  useEffect(() => {
    const nextRange = rangeFromSearch(searchParams);
    const nextCostMethod = costMethodFromSearch(searchParams);
    setActiveSnapshot(null);
    setRange((current) => (current.from === nextRange.from && current.to === nextRange.to ? current : nextRange));
    setCostMethod((current) => (current === nextCostMethod ? current : nextCostMethod));
  }, [searchKey]);

  async function loadSnapshots() {
    setSnapshotsLoading(true);
    try {
      const res = await api.get("/api/owner-statements");
      setSnapshots(res.data?.data || []);
    } catch {
      toast.error("تعذر تحميل أرشيف الإقفالات");
    } finally {
      setSnapshotsLoading(false);
    }
  }

  async function loadCurrent() {
    setLoading(true);
    try {
      const res = await api.get("/api/owner-statements/current", {
        params: { start_date: range.from, end_date: range.to, cost_method: costMethod },
      });
      setData(res.data?.data || null);
    } catch (error) {
      toast.error("تعذر تحميل لوحة صاحب المحل");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSnapshots().catch(() => {}); }, []);
  useEffect(() => {
    api.get("/api/settings").then((res) => {
      const data = res.data?.data;
      if (Array.isArray(data)) {
        const symbol = data.find((s) => s.setting_key === "currency_symbol")?.setting_value;
        if (symbol) setCurrencySymbol(symbol);
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!activeSnapshot) loadCurrent();
  }, [range.from, range.to, costMethod, activeSnapshot]);

  function updateRange(next) {
    setActiveSnapshot(null);
    setRange(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await api.post("/api/owner-statements", {
        period_start: range.from,
        period_end: range.to,
        cost_method: costMethod,
      });
      setActiveSnapshot(res.data?.data || null);
      await loadSnapshots();
      toast.success("تم حفظ النسخة");
    } catch {
      toast.error("تعذر حفظ النسخة");
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    setSaving(true);
    try {
      let snapshot = activeSnapshot;
      if (!snapshot) {
        const saved = await api.post("/api/owner-statements", {
          period_start: range.from,
          period_end: range.to,
          cost_method: costMethod,
        });
        snapshot = saved.data?.data;
      }
      const locked = await api.post(`/api/owner-statements/${snapshot.id}/lock`);
      setActiveSnapshot(locked.data?.data || null);
      await loadSnapshots();
      toast.success("تم إقفال النسخة");
    } catch {
      toast.error("تعذر إقفال النسخة");
    } finally {
      setSaving(false);
    }
  }

  async function loadSnapshot(id) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/owner-statements/${id}`);
      const snapshot = res.data?.data;
      setActiveSnapshot(snapshot);
      setRange({ from: snapshot.period_start, to: snapshot.period_end });
      setCostMethod(snapshot.cost_method);
    } catch {
      toast.error("تعذر تحميل النسخة");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (!leftCompare || !rightCompare) return toast.error("اختر نسختين للمقارنة");
    if (leftCompare === rightCompare) return toast.error("اختر نسختين مختلفتين للمقارنة");
    const res = await api.get("/api/owner-statements/compare", { params: { left_id: leftCompare, right_id: rightCompare } });
    setCompareData(res.data?.data || null);
  }

  async function openPaymentFlowDetails(row) {
    setSelectedPaymentFlow(row);
    setPaymentFlowDetails([]);
    setPaymentFlowDetailsLoading(true);
    try {
      const params = {
        start_date: display?.period_start || range.from,
        end_date: display?.period_end || range.to,
        pageSize: 500,
      };
      if (row?.method_id) params.method_id = row.method_id;
      const res = await api.get("/api/reports/run/payment-flow-ledger", { params });
      let rows = res.data?.data || [];
      if (!row?.method_id && row?.method_name) {
        rows = rows.filter((item) => String(item.method_name || "") === String(row.method_name || ""));
      }
      setPaymentFlowDetails(rows);
    } catch {
      toast.error("تعذر تحميل تفاصيل وسيلة الدفع");
    } finally {
      setPaymentFlowDetailsLoading(false);
    }
  }
  return (
    <ErrorBoundary FallbackComponent={ErrorFallbackPage}>
    <div className="min-h-screen bg-[var(--bg-base)] p-6 text-text-primary font-sans" dir="rtl">
      {/* Visual Mesh Glow Top Overlay */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-indigo-500/[0.015] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[400px] h-[250px] bg-emerald-500/[0.01] rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl space-y-6 relative z-10">

        {/* Top Header Deck */}
        <div data-help="owner-header" className="flex flex-wrap items-start justify-between gap-6 pb-2">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-black text-white uppercase tracking-widest shadow-sm">
              <FileText size={11} className="text-indigo-400" /> لوحة صاحب المحل التأسيسية
            </div>
            <h1 className="text-3xl font-black text-text-primary tracking-tight flex items-center gap-3">
              {frozen ? "وثيقة الإقفال المحفوظة" : "الإقفال المالي والشهري"}
              {frozen && (
                <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${activeSnapshot?.status === "locked" ? "bg-success-bg border-success-border text-success-text" : "bg-warning-bg border-warning-border text-warning-text"}`}>
                  {activeSnapshot?.status === "locked" ? "مؤرشف ومقفل" : "نسخة مسودة"}
                </span>
              )}
            </h1>
            <p className="text-sm font-bold text-text-muted max-w-2xl leading-relaxed">
              تحليل شامل لثمانية مؤشرات مالية أساسية لتقييم أداء المحل، تقييم مخزونه المالي، والتدفقات النقدية مع خيارات الأرشفة التاريخية والمقارنة.
            </p>
          </div>

          <AnimatePresence>
            {frozen && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setActiveSnapshot(null)}
                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 px-5 py-3 text-xs font-black text-indigo-700 transition-all shadow-sm active:scale-95"
              >
                <ArrowRight size={13} /> الرجوع للقيم التشغيلية الحالية
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Filter Command Center Deck */}
        <div data-help="owner-filters" className="rounded-[2rem] border border-border-normal bg-bg-surface p-5 shadow-card relative overflow-hidden">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] items-center">

            {/* Range Presets and Custom Picks */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 p-2 bg-bg-base border border-border-subtle rounded-2xl">
                <Calendar size={15} className="text-text-muted mr-1.5" />
                <input
                  disabled={frozen}
                  type="date"
                  ref={fromRef}
                  value={range.from}
                  onChange={(event) => updateRange({ ...range, from: event.target.value })}
                  onKeyDown={e => handleKeyDown(e, { nextRef: toRef, prevRef: null })}
                  className="bg-transparent text-xs font-bold text-text-primary outline-none disabled:opacity-60 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-text-muted px-1">إلى</span>
                <input
                  disabled={frozen}
                  type="date"
                  ref={toRef}
                  value={range.to}
                  onChange={(event) => updateRange({ ...range, to: event.target.value })}
                  onKeyDown={e => handleKeyDown(e, { nextRef: costMethodRef, prevRef: fromRef })}
                  className="bg-transparent text-xs font-bold text-text-primary outline-none disabled:opacity-60 cursor-pointer"
                />
              </div>

              <div className="h-6 w-px bg-border-normal" />

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-text-muted block tracking-wider">تقييم الكلفة:</span>
                <select
                  disabled={frozen}
                  ref={costMethodRef}
                  value={costMethod}
                  onChange={(event) => { setActiveSnapshot(null); setCostMethod(event.target.value); }}
                  onKeyDown={e => handleKeyDown(e, { nextRef: leftCompareRef, prevRef: toRef })}
                  className="rounded-2xl border border-border-normal bg-bg-base px-3.5 py-2 text-xs font-black text-text-primary outline-none cursor-pointer disabled:opacity-60"
                >
                  {COST_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
              </div>

              {!frozen && (
                <>
                  <div className="h-6 w-px bg-border-normal" />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_RANGES.map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => updateRange(applyQuickRange(preset.key))}
                        className="rounded-xl border border-border-normal hover:border-border-strong bg-bg-surface hover:bg-bg-overlay px-3.5 py-2 text-[11px] font-black text-text-secondary transition-colors shadow-sm"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* General Actions Desk */}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={loadCurrent}
                disabled={frozen || loading}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border-normal bg-bg-surface hover:bg-bg-overlay px-5 py-2.5 text-xs font-black text-text-primary disabled:opacity-40 transition-colors shadow-sm"
              >
                <RefreshCcw size={13} className={loading ? "animate-spin text-text-muted" : "text-text-muted"} /> تحديث السجل
              </button>

              {canSave && (
                <button
                  onClick={handleSave}
                  disabled={saving || frozen}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-md shadow-indigo-500/10"
                >
                  <Save size={13} /> أرشفة مسودة
                </button>
              )}

              {canLock && (
                <button
                  onClick={handleLock}
                  disabled={saving || activeSnapshot?.status === "locked"}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-xs font-black text-white hover:bg-primary-600 disabled:opacity-40 transition-colors shadow-md"
                >
                  <FileLock2 size={13} /> إقفال نهائي
                </button>
              )}

              <button
                onClick={() => setPrintOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-border-normal bg-bg-surface hover:bg-bg-overlay px-5 py-2.5 text-xs font-black text-text-primary transition-colors shadow-sm"
              >
                <Printer size={13} className="text-text-muted" /> طباعة الصفحة
              </button>
            </div>
          </div>
        </div>

        {/* Main Dashboard Bento Grid (Re-architected to a 3-column system to balance orphans) */}
        {loading ? (
          <div className="rounded-[2.5rem] border border-border-normal bg-bg-surface p-24 text-center text-text-muted shadow-card flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={36} />
            <span className="text-xs font-black">جاري مراجعة وتحليل السجلات الحالية...</span>
          </div>
        ) : (
          <div data-help="owner-metrics" className="grid gap-4 lg:grid-cols-3">

            {/* Double-width net profit card */}
            {(() => {
              const netProfitMetric = (display?.metrics || []).find((m) => m.key === "net_profit");
              if (!netProfitMetric) return null;
              const isLoss = Number(netProfitMetric.value) < 0;
              return (
                <motion.button
                  whileHover={{ y: -4, scale: 1.002 }}
                  onClick={() => setSelectedMetric(netProfitMetric)}
                  className={`lg:col-span-2 rounded-[2.5rem] p-6 text-right ${
                    isLoss
                      ? "bg-rose-950 border border-rose-800 text-white shadow-[0_12px_30px_rgba(244,63,94,0.2)]"
                      : "bg-slate-950 border border-slate-800 text-white shadow-[0_12px_30px_rgba(15,23,42,0.2)]"
                  } relative overflow-hidden group`}
                >
                  <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#fff_1.5px,transparent_1.5px)] [background-size:16px_16px] pointer-events-none" />

                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl ${isLoss ? "bg-danger-text/20 text-danger-text" : "bg-success-text/20 text-success-text"} border border-white/10`}>
                        <DollarSign size={20} />
                      </div>
                      <span className="text-lg font-black text-white">
                        {netProfitMetric.label}
                      </span>
                    </div>
                    <span className={`inline-flex rounded-full px-3.5 py-1 text-[11px] font-black ${isLoss ? "bg-danger-text/35 text-danger-text" : "bg-success-text/35 text-success-text"} border border-white/5`}>
                      إجمالي
                    </span>
                  </div>

                  <div className="mt-8 relative z-10 space-y-2">
                    <span className="text-xs font-bold text-white/60 block">القيمة النهائية للفترة</span>
                    <div className="font-mono text-5xl font-extrabold tracking-tight text-white leading-none whitespace-nowrap">
                      {money(netProfitMetric.value)} <span className={`text-lg font-sans font-black ${isLoss ? "text-danger-text" : "text-success-text"} mr-1.5`}>{currencySymbol}</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center relative z-10">
                    <span className="text-xs font-bold text-white/50">كشف مختصر لصافي الربح</span>
                    <span className={`text-xs font-black ${isLoss ? "text-danger-text hover:text-danger-text" : "text-success-text hover:text-success-text"} flex items-center gap-1`}>
                      عرض الكشف التفصيلي <ChevronLeft size={12} className="stroke-[2.5]" />
                    </span>
                  </div>
                </motion.button>
              );
            })()}

            {/* Standard Bento Grid Metric Cards (Perfect 3-column flow with no orphans!) */}
            {(display?.metrics || [])
              .filter((m) => m.key !== "net_profit")
              .map((metric) => {
                const cfg = THEME_CLASSES[metric.key] || THEME_CLASSES.stock;
                const Icon = cfg.icon;
                return (
                  <motion.button
                    whileHover={{ y: -4, scale: 1.01 }}
                    key={metric.key}
                    onClick={() => setSelectedMetric(metric)}
                    className={`rounded-[2.5rem] border ${cfg.cardCls} bg-bg-surface p-6 text-right transition-all flex flex-col justify-between group shadow-card min-h-[190px]`}
                  >
                    <div className="space-y-5">
                      {/* Top bar with vertical accent line and icon */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-5 rounded-full ${cfg.accentBg}`} />
                          <span className="text-lg font-black text-text-primary tracking-tight">
                            {metric.label}
                          </span>
                        </div>
                        <div className={`p-2 rounded-xl ${cfg.bgTextCls || "bg-bg-overlay text-text-secondary"} transition-all`}>
                          <Icon size={16} className="stroke-[2.2]" />
                        </div>
                      </div>

                      {/* Core numbers stack with maximum clarity */}
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-text-muted block tracking-wider">القيمة الإجمالية المعتمدة</span>
                        <div className="font-mono text-3xl font-extrabold text-text-primary tracking-tight leading-none whitespace-nowrap">
                          {money(metric.value)} <span className="text-xs font-sans font-black text-text-muted mr-1.5">{currencySymbol}</span>
                        </div>
                      </div>
                    </div>

                    {/* Trend indicator and action footer */}
                    <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between">
                      {cfg.trend ? (
                        <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-black ${cfg.trendCls}`}>
                          {cfg.trend}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-text-muted">سجل اليوم</span>
                      )}

                      <span className="text-xs font-black text-indigo-600 group-hover:text-indigo-800 flex items-center gap-0.5">
                        فتح التفاصيل <ChevronLeft size={11} className="stroke-[2.2]" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
          </div>
        )}

        <section data-help="owner-payment-flow" className="rounded-[2.5rem] border border-border-normal bg-bg-surface p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-success-border bg-success-bg p-2.5 text-success-text">
                <Wallet size={18} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-text-primary">تدفقات وسائل الدفع</h3>
                <p className="text-[10px] font-bold text-text-muted">
                  من <span dir="ltr" className="font-mono">{display?.period_start || range.from}</span> إلى <span dir="ltr" className="font-mono">{display?.period_end || range.to}</span>
                </p>
              </div>
            </div>
            <Link
              to={ownerPaymentFlowHref}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              فتح التقرير الكامل <ChevronLeft size={13} />
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-success-border bg-success-bg/70 p-4">
              <div className="mb-2 flex items-center justify-between text-success-text">
                <span className="text-[11px] font-black">إجمالي الداخل</span>
                <ArrowDownRight size={15} />
              </div>
              <div className="font-mono text-xl font-black text-success-text" dir="ltr">{money(paymentFlowTotals.totalIn)} {currencySymbol}</div>
            </div>
            <div className="rounded-2xl border border-danger-border bg-danger-bg/70 p-4">
              <div className="mb-2 flex items-center justify-between text-danger-text">
                <span className="text-[11px] font-black">إجمالي الخارج</span>
                <ArrowUpRight size={15} />
              </div>
              <div className="font-mono text-xl font-black text-danger-text" dir="ltr">{money(paymentFlowTotals.totalOut)} {currencySymbol}</div>
            </div>
            <div className="rounded-2xl border border-border-normal bg-bg-base p-4">
              <div className="mb-2 flex items-center justify-between text-text-secondary">
                <span className="text-[11px] font-black">الصافي</span>
                <Activity size={15} />
              </div>
              <div className={`font-mono text-xl font-black ${paymentFlowTotals.net < 0 ? "text-danger-text" : "text-text-primary"}`} dir="ltr">{money(paymentFlowTotals.net)} {currencySymbol}</div>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="mb-2 flex items-center justify-between text-indigo-700">
                <span className="text-[11px] font-black">عدد الحركات</span>
                <FileText size={15} />
              </div>
              <div className="font-mono text-xl font-black text-indigo-900" dir="ltr">{formatNumber(paymentFlowTotals.count)}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {paymentFlowRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-normal bg-bg-base/50 py-8 text-center text-xs font-bold text-text-muted lg:col-span-4">
                لا توجد تدفقات وسائل دفع في الفترة المحددة
              </div>
            ) : paymentFlowRows.map((row) => (
              <button type="button" onClick={() => openPaymentFlowDetails(row)} key={`${row.method_id || row.method_name}-${row.method_type}`} className="rounded-2xl border border-border-normal bg-bg-surface p-4 text-right shadow-sm transition-all hover:border-success-border hover:shadow-md">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-text-primary">{row.method_name || "وسيلة غير محددة"}</span>
                  <span className="rounded-full bg-bg-overlay px-2 py-0.5 text-[10px] font-black text-text-muted">{formatNumber(row.transaction_count || 0)}</span>
                </div>
                <div className="space-y-2 text-[11px] font-bold text-text-muted">
                  <div className="flex items-center justify-between"><span>داخل</span><span className="font-mono text-success-text" dir="ltr">{money(row.total_in)} {currencySymbol}</span></div>
                  <div className="flex items-center justify-between"><span>خارج</span><span className="font-mono text-danger-text" dir="ltr">{money(row.total_out)} {currencySymbol}</span></div>
                  <div className="flex items-center justify-between border-t border-border-normal pt-2"><span>الصافي</span><span className={`font-mono ${Number(row.net_amount || 0) < 0 ? "text-danger-text" : "text-text-primary"}`} dir="ltr">{money(row.net_amount)} {currencySymbol}</span></div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <AnimatePresence>
          {selectedPaymentFlow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4 backdrop-blur-sm"
              onClick={() => setSelectedPaymentFlow(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 16 }}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[86vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border-normal bg-bg-surface shadow-modal"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-5">
                  <div>
                    <h3 className="text-base font-black text-text-primary">{selectedPaymentFlow.method_name || "وسيلة دفع"}</h3>
                    <p className="mt-1 text-[11px] font-bold text-text-muted">
                      داخل {money(selectedPaymentFlow.total_in)} {currencySymbol} · خارج {money(selectedPaymentFlow.total_out)} {currencySymbol} · صافي {money(selectedPaymentFlow.net_amount)} {currencySymbol}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`${ownerPaymentFlowHref}${selectedPaymentFlow.method_id ? `&method_id=${selectedPaymentFlow.method_id}` : ""}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                    >
                      فتح التقرير الكامل <ChevronLeft size={13} />
                    </Link>
                    <button onClick={() => setSelectedPaymentFlow(null)} className="rounded-xl border border-border-normal p-2 text-text-muted hover:bg-bg-base">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="max-h-[62vh] overflow-auto p-5">
                  {paymentFlowDetailsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-xs font-black text-text-muted"><Loader2 className="animate-spin" size={18} /> جاري تحميل التفاصيل...</div>
                  ) : paymentFlowDetails.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border-normal bg-bg-base py-12 text-center text-xs font-bold text-text-muted">لا توجد تفاصيل لهذه الوسيلة في الفترة</div>
                  ) : (
                    <table className="w-full min-w-[760px] text-right text-xs">
                      <thead>
                        <tr className="border-b border-border-subtle text-[10px] font-black text-text-muted">
                          <th className="px-3 py-2">التاريخ</th>
                          <th className="px-3 py-2">المستند</th>
                          <th className="px-3 py-2">النوع</th>
                          <th className="px-3 py-2">الاتجاه</th>
                          <th className="px-3 py-2">الطرف</th>
                          <th className="px-3 py-2">المبلغ</th>
                          <th className="px-3 py-2">الصافي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {paymentFlowDetails.map((row, index) => (
                          <tr key={`${row.id || row.doc_no || index}-${index}`} className="hover:bg-bg-base/70">
                            <td className="px-3 py-3 font-mono text-text-secondary" dir="ltr">{row.created_at || row.date || "-"}</td>
                            <td className="px-3 py-3 font-black text-text-primary">{row.doc_no || "-"}</td>
                            <td className="px-3 py-3 text-text-secondary">{row.doc_type_label || row.doc_type || "-"}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.direction === "out" ? "bg-danger-bg text-danger-text" : "bg-success-bg text-success-text"}`}>{row.direction_label || row.direction}</span></td>
                            <td className="px-3 py-3 text-text-secondary">{row.party || "-"}</td>
                            <td className="px-3 py-3 font-mono font-black text-text-primary" dir="ltr">{money(row.amount)} {currencySymbol}</td>
                            <td className={`px-3 py-3 font-mono font-black ${Number(row.net_amount || 0) < 0 ? "text-danger-text" : "text-success-text"}`} dir="ltr">{money(row.net_amount)} {currencySymbol}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Saved Snapshots and Periodic Comparisons Workspace */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Snapshots Audit Trails Panel */}
          <div data-help="owner-snapshots" className="rounded-[2.5rem] border border-border-normal bg-bg-surface p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2.5 border-b border-border-subtle pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <FileLock2 size={16} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-text-primary">أرشيف الإقفالات والنسخ المحفوظة</h3>
                <p className="text-[9px] font-bold text-text-muted">مراجعة وتثبيت التسويات التاريخية المحفوظة للمحل</p>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {snapshots.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-text-muted border border-dashed border-border-normal rounded-2xl bg-bg-base/20">
                  لا توجد إقفالات مالية مؤرشفة حتى الآن
                </div>
              ) : (
                snapshots.map((snapshot) => {
                  const isLocked = snapshot.status === "locked";
                  return (
                    <button
                      key={snapshot.id}
                      onClick={() => loadSnapshot(snapshot.id)}
                      className="flex w-full items-center justify-between border border-border-normal hover:border-indigo-200 rounded-2xl p-4 text-right hover:bg-bg-base/50 transition-all shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-black text-text-primary flex items-center gap-1.5">
                          <span>من {snapshot.period_start} إلى {snapshot.period_end}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black ${isLocked ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"}`}>
                            {isLocked ? <Lock size={9} /> : <Unlock size={9} />}
                            {isLocked ? "مغلق تاريخي" : "سجل مسودة"}
                          </span>
                        </div>
                        <div className="text-[9px] font-bold text-text-muted">
                          طريقة التكلفة: <strong className="text-text-secondary">{COST_METHOD_LABELS[snapshot.cost_method] || snapshot.cost_method}</strong>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <span className="text-[9px] font-bold text-text-muted block font-sans">صافي الربح</span>
                        <div className="flex items-baseline justify-end gap-0.5">
                          <span className="text-xs font-black text-text-primary">{money(snapshot.net_profit)}</span>
                          <span className="text-[8px] font-sans font-bold text-text-muted">{currencySymbol}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Period Comparisons Deck */}
          <div data-help="owner-compare" className="rounded-[2.5rem] border border-border-normal bg-bg-surface p-6 shadow-card flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2.5 border-b border-border-subtle pb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <GitCompare size={16} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-text-primary">مقارنة فترتين ماليتين</h3>
                  <p className="text-[9px] font-bold text-text-muted">تحليل الفروقات والنمو المالي للنسخ المحفوظة</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 mt-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-text-muted block tracking-wider mr-1">الفترة الأولى (أ):</label>
                  <select
                    ref={leftCompareRef}
                    value={leftCompare}
                    onChange={(event) => setLeftCompare(event.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: rightCompareRef, prevRef: costMethodRef })}
                    className="w-full rounded-2xl border border-border-normal bg-bg-base px-3.5 py-3 text-xs font-black text-text-primary outline-none cursor-pointer"
                  >
                    <option value="">اختر نسخة أولى...</option>
                    {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>#{snapshot.id} ({snapshot.period_start})</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-text-muted block tracking-wider mr-1">الفترة الثانية (ب):</label>
                  <select
                    ref={rightCompareRef}
                    value={rightCompare}
                    onChange={(event) => setRightCompare(event.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: null, prevRef: leftCompareRef })}
                    className="w-full rounded-2xl border border-border-normal bg-bg-base px-3.5 py-3 text-xs font-black text-text-primary outline-none cursor-pointer"
                  >
                    <option value="">اختر نسخة ثانية...</option>
                    {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>#{snapshot.id} ({snapshot.period_start})</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border-subtle flex items-center justify-between mt-6">
              <p className="text-[9px] font-bold text-text-muted leading-relaxed max-w-[280px]">
                سيتم استخراج كشف مقارن مفصل يوضح الفروقات بين المؤشرات وقيمة النمو المالي ونسبة الانحراف المئوية.
              </p>
              <button
                onClick={handleCompare}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-6 py-3 text-xs font-black text-white hover:bg-primary-600 transition-colors shadow-md active:scale-95"
              >
                قارن بين الفترتين
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Details Immersive Drawers */}
      <MetricModal
        metric={selectedMetric}
        rows={selectedMetric ? (display?.rows?.[selectedMetric.key] || []) : []}
        period={range}
        onClose={() => setSelectedMetric(null)}
        currencySymbol={currencySymbol}
      />

      <ComparePanel data={compareData} onClose={() => setCompareData(null)} />

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        docType="owner_statement"
        renderContent={(settings) => (
          <div className="p-8 font-sans" dir="rtl">
            <div className="mb-6 text-center border-b pb-4">
              <h1 className="text-2xl font-black mb-1">كشف صاحب المحل</h1>
              <p className="text-sm text-text-secondary">
                من {display?.period_start || range.from} إلى {display?.period_end || range.to}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(display?.metrics || []).map((metric) => (
                <div key={metric.key} className="border rounded-2xl p-4 bg-bg-surface">
                  <div className="text-sm font-black text-text-primary mb-2">{metric.label}</div>
                  <div className="font-mono text-xl font-black text-text-primary" dir="ltr">
                    {money(metric.value)} {settings.currency_symbol || currencySymbol}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      />

    </div>
    </ErrorBoundary>
  );
}
