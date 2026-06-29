import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, Line } from "recharts";
import {
  Wallet, TrendingDown, TrendingUp, AlertTriangle, Layers, Pickaxe,
  BarChart3, Activity, ArrowDownToLine, ArrowUpFromLine, FileText,
  Boxes, Calendar, PieChart, ShoppingBag, Sparkles, ShoppingCart,
  Maximize2, X, Clock, Trophy, ChevronUp, ChevronDown, Package,
  Download, Users, ArrowLeftRight, Grid3X3, Percent, HeartPulse
} from "lucide-react";
import api from "../../services/api";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { usePermission } from "../../hooks/usePermission";

const zeroSummary = {
  todaySales: 0,
  weekSales: 0,
  itemsCount: 0,
  customersCount: 0,
  upcomingInstallments: 0,
};

function ChartTooltip({ active, payload, label, isCurrency = true, showMargin = false }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-[16px] border border-white/40 bg-white/70 backdrop-blur-2xl px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[13px] font-bold text-slate-500">{entry.name}:</span>
          <span className="text-[18px] font-black text-slate-900">
            {entry.dataKey === "margin_percent" ? `${Number(entry.value).toFixed(1)}%` :
             isCurrency ? <CurrencyDisplay value={entry.value} /> : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrendBadge({ current, previous, inverse = false }) {
  const pct = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const isUp = pct > 0;
  const isDown = pct < 0;
  const good = inverse ? isDown : isUp;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-black px-1.5 py-0.5 rounded-full ${
      Math.abs(pct) < 0.5 ? "bg-slate-100 text-slate-500" :
      good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
    }`}>
      {Math.abs(pct) < 0.5 ? "—" : isUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const DAY_NAMES = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const HOUR_LABELS = Array.from({length:13}, (_,i) => `${String(i+8).padStart(2,"0")}:00`);

function SensitiveValue({ children, canView, fallback }) {
  if (canView) return children;
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-300 select-none" title="بيانات مقيدة">
      <span>🔒</span>
      <span className="text-[10px] font-black tracking-widest uppercase">مقيد</span>
    </span>
  );
}

export default function AnalyticsPage() {
  usePageTour('analytics');
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const handleKeyDown = useFieldNavigation();
  const canViewSensitive = usePermission("analytics", "view_sensitive");
  const navigate = useNavigate();
  const [summary, setSummary] = useState(zeroSummary);
  const [allSalesRows, setAllSalesRows] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [lowStock, setLowStock] = useState([]);
  const [belowMargin, setBelowMargin] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [expiryStats, setExpiryStats] = useState(null);
  const [expiryStatusFilter, setExpiryStatusFilter] = useState("all");
  const [expirySearch, setExpirySearch] = useState("");
  const [expiryWarehouseId, setExpiryWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [allTopItems, setAllTopItems] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [topItemsModalOpen, setTopItemsModalOpen] = useState(false);

  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayRevenues, setTodayRevenues] = useState(0);
  const [loading, setLoading] = useState(true);

  // New feature states
  const [comparison, setComparison] = useState(null);
  const [cashFlow, setCashFlow] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [returnRate, setReturnRate] = useState({ rate: 0, today: 0, period: 0 });
  const [exporting, setExporting] = useState(false);
  const [healthCounts, setHealthCounts] = useState({ low_stock: 0, below_margin: 0, expiring_soon: 0, total: 0 });

  // Period-aware section data (follows the global period selector)
  const [deadStock, setDeadStock] = useState([]);
  const [paymentMix, setPaymentMix] = useState([]);
  const [paymentFlow, setPaymentFlow] = useState([]);
  const [periodSummary, setPeriodSummary] = useState(null);
  const [periodCompare, setPeriodCompare] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  // Two-period comparison — default to "previous 7 days" vs "last 7 days"
  const dayStr = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
  const [compareA, setCompareA] = useState({ start: dayStr(13), end: dayStr(7) });
  const [compareB, setCompareB] = useState({ start: dayStr(6), end: dayStr(0) });
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Heatmap Controls (display preferences only)
  const [heatmapMetric, setHeatmapMetric] = useState("total_sales");
  const [heatmapGranularity, setHeatmapGranularity] = useState(2); // 1 | 2 | 4 hours per bucket
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Items Controls
  const [itemsSort, setItemsSort] = useState("top");
  const [itemsLoading, setItemsLoading] = useState(false);
  
  // Refs for keyboard navigation
  const globalDateModeRef = useRef(null);
  const globalRangeRef = useRef(null);
  const globalStartRef = useRef(null);
  const globalEndRef = useRef(null);
  const itemsSortRef = useRef(null);
  const expiryWhRef = useRef(null);
  const expirySearchRef = useRef(null);

  // Chart Controls (display preferences only)
  const [chartMetric, setChartMetric] = useState("revenue");
  const [showMarginLine, setShowMarginLine] = useState(false);

  // Global Period — shared across chart, heatmap, and items
  const [globalDateMode, setGlobalDateMode] = useState("predefined");
  const [globalCustomDates, setGlobalCustomDates] = useState({ start: "", end: "" });
  const [globalRange, setGlobalRange] = useState(14);

  // Initial Dashboard Mount
  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const [summaryRes, stockRes, expensesRes, revenuesRes, marginRes, expiringRes, whRes, comparisonRes, healthRes] = await Promise.all([
          api.get("/api/dashboard"),
          api.get("/api/reports/low-stock"),
          api.get(`/api/expenses?date_from=${todayIso}&date_to=${todayIso}`),
          api.get(`/api/revenues?date_from=${todayIso}&date_to=${todayIso}`),
          api.get("/api/reports/margin-alerts").catch(() => ({ data: { data: [] } })),
          api.get("/api/reports/expiring-soon").catch(() => ({ data: { data: [], stats: null } })),
          api.get("/api/warehouses").catch(() => ({ data: { data: [] } })),
          api.get("/api/dashboard/comparison"),
          api.get("/api/dashboard/inventory-health").catch(() => ({ data: { data: null } })),
        ]);

        setSummary(summaryRes.data?.data || zeroSummary);
        setLowStock(stockRes.data?.data?.slice(0, 5) || []);
        setBelowMargin(marginRes.data?.data?.slice(0, 5) || []);
        setExpiringSoon(expiringRes.data?.data || []);
        setExpiryStats(expiringRes.data?.stats || null);
        setWarehouses(whRes.data?.data || []);
        setComparison(comparisonRes.data?.data || null);
        if (healthRes.data?.data) setHealthCounts(healthRes.data.data);

        const expenseTotal = (expensesRes.data?.data || [])
          .reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const revenueTotal = (revenuesRes.data?.data || [])
          .reduce((sum, row) => sum + Number(row.amount || 0), 0);

        setTodayExpenses(expenseTotal);
        setTodayRevenues(revenueTotal);
      } catch {
        // Fallbacks
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // Fetch Items Dynamic
  useEffect(() => {
    async function loadItems() {
      setItemsLoading(true);
      try {
        let qs = "";
        if (globalDateMode === "custom") {
           qs = `?start_date=${globalCustomDates.start || ""}&end_date=${globalCustomDates.end || ""}`;
        } else {
           const start_date = new Date(Date.now() - globalRange * 86400000).toISOString().split('T')[0];
           qs = `?start_date=${start_date}`;
        }
        const res = await api.get("/api/reports/run/sales-by-item" + qs);
        const allItems = res.data?.data || [];
        const sorted = itemsSort === "top" ? allItems : [...allItems].reverse();
        setAllTopItems(sorted);
        setTopItems(sorted.slice(0, 5));
      } catch {
        setTopItems([]);
      } finally {
        setItemsLoading(false);
      }
    }
    loadItems();
  }, [globalRange, itemsSort, globalDateMode, globalCustomDates]);

  // Fetch Expiry Data Dynamic
  useEffect(() => {
    async function loadExpiry() {
      const params = new URLSearchParams();
      params.set("days", "90");
      if (expiryStatusFilter !== "all") params.set("status", expiryStatusFilter);
      if (expiryWarehouseId) params.set("warehouse_id", expiryWarehouseId);
      if (expirySearch.trim()) params.set("search", expirySearch.trim());
      const res = await api.get(`/api/reports/expiring-soon?${params}`).catch(() => ({ data: { data: [], stats: null } }));
      setExpiringSoon(res.data?.data || []);
      setExpiryStats(res.data?.stats || null);
    }
    loadExpiry();
  }, [expiryStatusFilter, expiryWarehouseId, expirySearch]);

  // Fetch Chart Dynamic  
  useEffect(() => {
    async function loadChartData() {
      setChartLoading(true);
      try {
        let qs = "";
        if (globalDateMode === "custom") {
           qs = `?start_date=${globalCustomDates.start || ""}&end_date=${globalCustomDates.end || ""}`;
        } else {
           const start_date = new Date(Date.now() - globalRange * 86400000).toISOString().split('T')[0];
           qs = `?start_date=${start_date}`;
        }
        const res = await api.get(`/api/reports/sales-summary${qs}`);
        const salesRows = res.data?.data || [];

        setAllSalesRows(salesRows.map(r => ({
          date: r.date,
          revenue: Number(r.revenue || 0),
          count: Number(r.invoice_count || r.orders_count || 0),
          profit: Number(r.gross_profit || 0),
          margin_percent: Number(r.margin_percent || 0),
          total_discount: Number(r.total_discount || 0),
        })));
      } catch {
        setAllSalesRows([]);
      } finally {
        setChartLoading(false);
      }
    }
    loadChartData();
  }, [globalRange, globalDateMode, globalCustomDates]);

  // Resolve the active global period into concrete {start, end} date strings
  const resolvedPeriod = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    if (globalDateMode === "custom") {
      return { start: globalCustomDates.start || "", end: globalCustomDates.end || today };
    }
    const start = new Date(Date.now() - globalRange * 86400000).toISOString().split('T')[0];
    return { start, end: today };
  }, [globalDateMode, globalCustomDates, globalRange]);

  // Enumerate every calendar day in the active period (newest first) — one heatmap row per day
  const previousResolvedPeriod = useMemo(() => {
    const { start, end } = resolvedPeriod;
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    if (!start || !end || isNaN(s) || isNaN(e)) return { start: "", end: "" };
    const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
    const prevEnd = new Date(s);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - days + 1);
    return { start: prevStart.toISOString().split("T")[0], end: prevEnd.toISOString().split("T")[0] };
  }, [resolvedPeriod]);

  const heatmapDayList = useMemo(() => {
    const { start, end } = resolvedPeriod;
    if (!start || !end) return [];
    const days = [];
    let d = new Date(`${start}T00:00:00Z`);
    const endD = new Date(`${end}T00:00:00Z`);
    if (isNaN(d) || isNaN(endD) || d > endD) return [];
    let guard = 0;
    while (d <= endD && guard < 370) {
      days.push(d.toISOString().split('T')[0]);
      d.setUTCDate(d.getUTCDate() + 1);
      guard++;
    }
    return days.reverse();
  }, [resolvedPeriod]);

  // Fetch Heatmap Dynamic
  useEffect(() => {
    async function loadHeatmap() {
      setHeatmapLoading(true);
      try {
        const { start, end } = resolvedPeriod;
        const qs = `?start_date=${start || ""}&end_date=${end || ""}`;
        const hmRes = await api.get(`/api/dashboard/heatmap${qs}`);
        setHeatmap(hmRes.data?.data || []);
      } catch {
        setHeatmap([]);
      } finally {
        setHeatmapLoading(false);
      }
    }
    loadHeatmap();
  }, [resolvedPeriod]);

  // Period-aware section data — categories, customers, returns, cash-flow, dead stock,
  // payment mix. All of these used to be fetched once on mount with a hardcoded 30-day
  // window and silently ignored the period selector; now they follow it.
  useEffect(() => {
    async function loadPeriodData() {
      const { start, end } = resolvedPeriod;
      if (!start || !end) return;
      setPeriodLoading(true);
      const qs = `?start_date=${start}&end_date=${end}`;
      try {
        const [catRes, custRes, summaryRes, cashRes, deadRes, payRes, flowRes, cmpRes] = await Promise.all([
          api.get(`/api/reports/run/sales-by-category${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/reports/run/top-customers${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/dashboard/period-summary${qs}`).catch(() => ({ data: { data: null } })),
          api.get(`/api/dashboard/cash-flow${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/reports/run/dead-stock${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/reports/run/sales-by-payment${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/reports/run/payment-flow-summary${qs}`).catch(() => ({ data: { data: [] } })),
          api.get(`/api/dashboard/period-compare?a_start=${previousResolvedPeriod.start}&a_end=${previousResolvedPeriod.end}&b_start=${start}&b_end=${end}`).catch(() => ({ data: { data: null } })),
        ]);

        setTopCategories((catRes.data?.data || []).slice(0, 5));
        setTopCustomers((custRes.data?.data || []).filter(c => c.customer_name !== "عميل نقدي").slice(0, 5));
        setCashFlow(cashRes.data?.data || []);
        setDeadStock((deadRes.data?.data || []).slice(0, 6));
        setPaymentMix(payRes.data?.data || []);
        setPaymentFlow(flowRes.data?.data || []);

        const ps = summaryRes.data?.data;
        setPeriodSummary(ps || null);
        setPeriodCompare(cmpRes.data?.data || null);
        setReturnRate(prev => ({
          ...prev,
          period: Number(ps?.returns_total || 0),
          serverRate: ps?.return_rate != null ? Number(ps.return_rate) : null,
        }));
      } catch {
        setPaymentFlow([]);
        setPaymentMix([]);
        setDeadStock([]);
        setTopCustomers([]);
        setTopCategories([]);
        setPeriodSummary(null);
        setPeriodCompare(null);
        // keep previous values on failure
      } finally {
        setPeriodLoading(false);
      }
    }
    loadPeriodData();
  }, [resolvedPeriod, previousResolvedPeriod]);

  // Return rate calculation: compare returns to sales — both numerator (returnRate.period)
  // and denominator (allSalesRows) now share the same selected period.
  const computedReturnRate = useMemo(() => {
    // Prefer the server-computed rate (returns ÷ gross sales for the same window);
    // fall back to a client estimate only if the server value is unavailable.
    if (returnRate.serverRate != null) return { ...returnRate, rate: returnRate.serverRate };
    const grossSales = allSalesRows.reduce((s, r) => s + r.revenue, 0);
    if (grossSales === 0) return { rate: 0, ...returnRate };
    return { ...returnRate, rate: (returnRate.period / grossSales) * 100 };
  }, [returnRate, allSalesRows]);

  // Period totals for the discount-leakage card
  const periodTotals = useMemo(() => {
    const revenue = allSalesRows.reduce((s, r) => s + r.revenue, 0);
    const profit = allSalesRows.reduce((s, r) => s + (r.profit || 0), 0);
    const discount = allSalesRows.reduce((s, r) => s + (r.total_discount || 0), 0);
    const gross = revenue + discount; // pre-discount selling value (approx)
    return {
      revenue, profit, discount,
      discountRate: gross > 0 ? (discount / gross) * 100 : 0,
      discountVsProfit: profit > 0 ? (discount / profit) * 100 : 0,
    };
  }, [allSalesRows]);

  const periodRevenueSeparate = useMemo(() => cashFlow.reduce((s, d) => s + Number(d.revenues || 0), 0), [cashFlow]);
  const periodExpenseTotal = useMemo(() => cashFlow.reduce((s, d) => s + Number(d.expenses || 0), 0), [cashFlow]);
  const periodSalesTotal = Number(periodSummary?.net_sales ?? periodSummary?.gross_sales ?? periodTotals.revenue ?? 0);
  const periodInvoiceCount = Number(periodSummary?.invoice_count ?? allSalesRows.reduce((s, r) => s + Number(r.count || 0), 0));
  const periodItemsSold = Number(periodSummary?.items_sold ?? allSalesRows.reduce((s, r) => s + Number(r.items_sold || 0), 0));
  const currentPeriodCompare = periodCompare?.b || null;
  const previousPeriodCompare = periodCompare?.a || null;
  // Peak-hours insight derived from the heatmap data (best weekday + best hour slot)
  const peakInsight = useMemo(() => {
    if (!heatmap.length) return null;
    const byDow = {}, byHour = {};
    let bestCell = null;
    heatmap.forEach(r => {
      const dow = new Date(`${r.day}T00:00:00Z`).getUTCDay();
      const hour = parseInt((r.hour_slot || "0").split(":")[0] || "0");
      byDow[dow] = (byDow[dow] || 0) + Number(r.total_sales || 0);
      byHour[hour] = (byHour[hour] || 0) + Number(r.total_sales || 0);
      if (!bestCell || Number(r.total_sales || 0) > bestCell.value) {
        bestCell = { dow, hour, value: Number(r.total_sales || 0) };
      }
    });
    const topDow = Object.entries(byDow).sort((a, b) => b[1] - a[1])[0];
    const topHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    return {
      bestDay: topDow ? { name: DAY_NAMES[Number(topDow[0])], value: topDow[1] } : null,
      bestHour: topHour ? { hour: Number(topHour[0]), value: topHour[1] } : null,
      bestCell: bestCell ? { name: DAY_NAMES[bestCell.dow], hour: bestCell.hour, value: bestCell.value } : null,
    };
  }, [heatmap]);

  // Run the two-period comparison
  const runCompare = useCallback(async () => {
    if (!compareA.start || !compareA.end || !compareB.start || !compareB.end) return;
    setCompareLoading(true);
    try {
      const res = await api.get(`/api/dashboard/period-compare?a_start=${compareA.start}&a_end=${compareA.end}&b_start=${compareB.start}&b_end=${compareB.end}`);
      setCompareResult(res.data?.data || null);
    } catch {
      setCompareResult(null);
    } finally {
      setCompareLoading(false);
    }
  }, [compareA, compareB]);

  // Inventory health summary — uses true counts from the server (the old version summed
  // capped display slices and was corrupted by the expiry tab filter).
  const inventoryHealth = useMemo(() => {
    const lowStockCount = Number(healthCounts.low_stock || 0);
    const belowMarginCount = Number(healthCounts.below_margin || 0);
    const expiringCount = Number(healthCounts.expiring_soon || 0);
    const total = lowStockCount + belowMarginCount + expiringCount;
    return { total, lowStock: lowStockCount, belowMargin: belowMarginCount, expiringSoon: expiringCount, healthy: total === 0 };
  }, [healthCounts]);

  const displayedChartData = useMemo(() => {
    return allSalesRows;
  }, [allSalesRows]);

  // Human label for the currently selected period (reused across period-aware sections)
  const paymentFlowReportHref = useMemo(() => {
    const { start, end } = resolvedPeriod;
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    const qs = params.toString();
    return `/reports/source/treasury/payment-flow-summary/summary${qs ? `?${qs}` : ""}`;
  }, [resolvedPeriod]);
  const periodLabel = useMemo(() => {
    if (globalDateMode === "custom") {
      return globalCustomDates.start && globalCustomDates.end
        ? `${globalCustomDates.start} → ${globalCustomDates.end}`
        : "فترة مخصصة";
    }
    return globalRange === 1 ? "اليوم" : `آخر ${globalRange} يوم`;
  }, [globalDateMode, globalCustomDates, globalRange]);

  const handleExportSnapshot = useCallback(async () => {
    setExporting(true);
    try {
      const payload = {
        summary: { today_sales: summary.todaySales, week_sales: summary.weekSales, items_count: summary.itemsCount, customers_count: summary.customersCount },
        revenue_expenses: { revenues: todayRevenues, expenses: todayExpenses },
        low_stock_count: lowStock.length,
        below_margin_count: belowMargin.length,
        comparison: comparison || {},
        cash_flow_summary: { total_in: cashFlow.reduce((s, d) => s + d.sales + d.revenues, 0), total_out: cashFlow.reduce((s, d) => s + d.expenses + d.withdrawals, 0), net: cashFlow.reduce((s, d) => s + d.net, 0) },
        top_customers: topCustomers.slice(0, 5).map(c => ({ name: c.customer_name, sales: c.total_sales, invoices: c.invoice_count })),
        top_items: topItems.map(i => ({ name: i.item_name, revenue: i.revenue, qty: i.quantity_sold })),
        top_categories: topCategories.map(c => ({ name: c.category_name, revenue: c.revenue })),
        sales_chart: allSalesRows.slice(-7).map(r => ({ date: r.date, revenue: r.revenue, count: r.count })),
        generated_at: new Date().toISOString(),
      };
      const res = await api.post("/api/dashboard/export-snapshot", payload, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-snapshot-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      window.print();
    } finally {
      setExporting(false);
    }
  }, [summary, todayRevenues, todayExpenses, lowStock, belowMargin, comparison, cashFlow, topCustomers, topItems, topCategories, allSalesRows]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center space-y-6 bg-[var(--bg-base)]">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-full animate-ping bg-slate-900 opacity-10"></div>
          <Activity className="h-8 w-8 animate-pulse text-slate-800" />
        </div>
        <div className="text-[11px] font-black tracking-[0.2em] text-slate-400 uppercase">جاري تجميع البيانات...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-sans bg-[var(--bg-base)] p-4 md:p-8 relative overflow-x-hidden" dir="rtl">

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-6 relative z-10 w-full max-w-[1400px] mx-auto gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white p-3 rounded-[20px] shadow-[0_8px_20px_rgba(15,23,42,0.15)] flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">الرؤية والتحليلات</h1>
            <p className="text-sm font-bold text-slate-500 mt-1">
              راقب أداء المبيعات لحظة بلحظة لقرارات أسرع وأدق.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportSnapshot} disabled={exporting}
            className="flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-black text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-sm disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "جاري التصدير..." : "تصدير لمحة"}
          </button>
          <Link to="/reports/center" className="hidden md:flex items-center gap-4 bg-white border border-slate-200 rounded-[20px] py-2 px-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
            <div className="flex flex-col text-left items-end">
              <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">المركز</span>
              <span className="text-sm font-bold text-slate-700">تقارير مفصلة</span>
            </div>
            <div className="w-10 h-10 rounded-[14px] bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 text-slate-400 group-hover:text-slate-600 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto space-y-5 relative z-10">

        {/* Global Period Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-white border border-slate-200/80 px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-[13px] font-black text-slate-600">الفترة:</span>
          </div>
          <div className="flex p-0.5 bg-slate-100 rounded-[12px] items-center shadow-inner border border-slate-200">
            <select ref={globalDateModeRef}
              value={globalDateMode}
              onChange={e => setGlobalDateMode(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, { nextRef: globalStartRef })}
              className="bg-slate-200/50 hover:bg-slate-200 border-none outline-none text-[11px] font-black text-slate-700 py-1.5 px-2 rounded-[9px] transition-colors cursor-pointer"
            >
              <option value="predefined">فترة محددة</option>
              <option value="custom">تاريخ مخصص</option>
            </select>
            <div className="h-4 w-px bg-slate-300 mx-1" />
            {globalDateMode === "predefined" ? (
              <div className="flex">
                {[1, 7, 14, 30].map(days => (
                  <button key={days} onClick={() => setGlobalRange(days)}
                    className={`px-3 py-1.5 rounded-[9px] text-[11px] font-black transition-all ${globalRange === days ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
                  >{days === 1 ? 'يوم' : days === 7 ? 'أسبوع' : days === 14 ? '١٤ي' : 'شهر'}</button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pl-2 pr-1">
                <input ref={globalStartRef}
                  type="date" value={globalCustomDates.start}
                  onChange={e => setGlobalCustomDates(c => ({...c, start: e.target.value}))}
                  onKeyDown={(e) => handleKeyDown(e, { nextRef: globalEndRef, prevRef: globalDateModeRef })}
                  className="text-[11px] bg-white rounded-[8px] px-2 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                />
                <span className="text-[11px] uppercase font-black tracking-widest text-slate-400">الي</span>
                <input ref={globalEndRef}
                  type="date" value={globalCustomDates.end}
                  onChange={e => setGlobalCustomDates(c => ({...c, end: e.target.value}))}
                  onKeyDown={(e) => handleKeyDown(e, { nextRef: globalDateModeRef, prevRef: globalStartRef })}
                  className="text-[11px] bg-white rounded-[8px] px-2 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Live snapshot — these cards are always "now" and intentionally do NOT follow the period selector */}
        <div className="flex items-center gap-2 pt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-[13px] font-black text-slate-500 uppercase tracking-widest">مؤشرات الفترة المحددة — {periodLabel}</h2>
        </div>

        {/* Metrics Ribbon */}
        <div data-help="stats-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <BentoMetric title="مبيعات الفترة" value={<SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={periodSalesTotal} /></SensitiveValue>} icon={TrendingUp} theme="dark" hint={`إجمالي المبيعات داخل الفترة المحددة: ${periodLabel}`} />
          <BentoMetric title="فواتير الفترة" value={periodInvoiceCount.toLocaleString()} icon={Activity} hint={`عدد الفواتير داخل الفترة المحددة: ${periodLabel}`} />
          <BentoMetric title="إيرادات الفترة" value={<SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={periodRevenueSeparate} /></SensitiveValue>} icon={ArrowDownToLine} hint={`إيرادات منفصلة داخل الفترة المحددة: ${periodLabel}`} />
          <BentoMetric title="مصروفات الفترة" value={<SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={periodExpenseTotal} /></SensitiveValue>} icon={ArrowUpFromLine} hint={`مصروفات التشغيل داخل الفترة المحددة: ${periodLabel}`} />
          <BentoMetric title="نسبة المرتجعات (الفترة)" value={<SensitiveValue canView={canViewSensitive}>{`${computedReturnRate.rate.toFixed(1)}%`}</SensitiveValue>} icon={Percent} theme={computedReturnRate.rate > 5 ? "alert" : "default"} hint="نسبة قيمة المرتجعات إلى إجمالي المبيعات خلال الفترة المحددة في الأعلى" />
          <BentoMetric title={inventoryHealth.healthy ? "تنبيهات حالية" : `تنبيهات حالية ${inventoryHealth.total}`} value={inventoryHealth.healthy ? "0" : inventoryHealth.total} icon={HeartPulse} theme={inventoryHealth.healthy ? "default" : "alert"} hint={`تنبيهات مخزون حالية لا تتبع الفترة: نواقص ${inventoryHealth.lowStock} · هوامش ${inventoryHealth.belowMargin} · صلاحية ${inventoryHealth.expiringSoon}`} />
        </div>

        {/* Selected Period Comparison Strip */}
        {currentPeriodCompare && previousPeriodCompare && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-[20px] bg-white border border-slate-200/60 p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">مبيعات الفترة</span>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-black text-slate-900 tabular-nums"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={currentPeriodCompare.net_sales ?? currentPeriodCompare.gross_sales ?? 0} /></SensitiveValue></span>
                <TrendBadge current={Number(currentPeriodCompare.net_sales ?? currentPeriodCompare.gross_sales ?? 0)} previous={Number(previousPeriodCompare.net_sales ?? previousPeriodCompare.gross_sales ?? 0)} />
              </div>
              <span className="text-[11px] font-bold text-slate-400">{periodLabel} · السابق: <SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={previousPeriodCompare.net_sales ?? previousPeriodCompare.gross_sales ?? 0} /></SensitiveValue></span>
            </div>
            <div className="rounded-[20px] bg-white border border-slate-200/60 p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">فواتير الفترة</span>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-black text-slate-900 tabular-nums">{currentPeriodCompare.invoice_count || 0}</span>
                <TrendBadge current={Number(currentPeriodCompare.invoice_count || 0)} previous={Number(previousPeriodCompare.invoice_count || 0)} />
              </div>
              <span className="text-[11px] font-bold text-slate-400">السابق: {previousPeriodCompare.invoice_count || 0}</span>
            </div>
            <div className="rounded-[20px] bg-white border border-slate-200/60 p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ربح الفترة</span>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-black text-slate-900 tabular-nums"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={currentPeriodCompare.gross_profit || 0} /></SensitiveValue></span>
                <TrendBadge current={Number(currentPeriodCompare.gross_profit || 0)} previous={Number(previousPeriodCompare.gross_profit || 0)} />
              </div>
              <span className="text-[11px] font-bold text-slate-400">السابق: <SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={previousPeriodCompare.gross_profit || 0} /></SensitiveValue></span>
            </div>
            <div className="rounded-[20px] bg-white border border-slate-200/60 p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">متوسط الفاتورة</span>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-black text-slate-900 tabular-nums"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={currentPeriodCompare.avg_basket || 0} /></SensitiveValue></span>
                <TrendBadge current={Number(currentPeriodCompare.avg_basket || 0)} previous={Number(previousPeriodCompare.avg_basket || 0)} />
              </div>
              <span className="text-[11px] font-bold text-slate-400">مقارنة بالفترة السابقة المساوية</span>
            </div>
          </div>
        )}
        {/* Central Dashboard - Asymmetrical split */}
        <div className="grid gap-5 xl:grid-cols-[1fr_minmax(350px,400px)]">
          
          {/* Main Chart Area */}
          <div data-help="sales-chart" className="flex flex-col min-w-0 rounded-[32px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-6">
              <div>
                <h2 className="text-[20px] font-black text-slate-900 tracking-tight">حركة المبيعات</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-2sm font-bold text-slate-500">مبيعات الفترة المحددة · {periodLabel}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                {/* Metric Selector */}
                <div className="flex p-1 bg-slate-100 rounded-[14px]">
                  <button
                    onClick={() => setChartMetric("revenue")}
                    className={`px-4 py-1.5 rounded-[10px] text-[11px] font-black transition-all ${chartMetric === "revenue" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالقيمة
                  </button>
                  <button
                    onClick={() => setChartMetric("profit")}
                    className={`px-4 py-1.5 rounded-[10px] text-[11px] font-black transition-all ${chartMetric === "profit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالربح
                  </button>
                  <button
                    onClick={() => setChartMetric("count")}
                    className={`px-4 py-1.5 rounded-[10px] text-[11px] font-black transition-all ${chartMetric === "count" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالعدد
                  </button>
                </div>
                {/* Margin toggle */}
                <button
                  onClick={() => setShowMarginLine(v => !v)}
                  className={`px-3 py-1.5 rounded-[10px] text-[11px] font-black transition-all border ${
                    showMarginLine ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                  }`}
                >
                  <Percent className="w-3.5 h-3.5 inline ml-1" />
                  الهامش
                </button>

              </div>
            </div>
            
            <div className="h-[360px] min-h-[360px] min-w-0 flex-1 relative">
              {!canViewSensitive && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-[24px]">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <span className="text-2xl">🔒</span>
                    <span className="text-[13px] font-black tracking-widest">بيانات مالية مقيدة</span>
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayedChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chart-gradient-alt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="chart-gradient-profit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} axisLine={false} tickLine={false} dy={15} />
                  <YAxis yAxisId="left"
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => chartMetric !== "count" ? `ج ${val.toLocaleString()}` : val}
                  />
                  {showMarginLine && (
                    <YAxis yAxisId="right" orientation="right"
                      tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(val) => `${val}%`}
                      domain={[0, 100]}
                    />
                  )}
                  <Tooltip
                    content={<ChartTooltip isCurrency={chartMetric !== "count"} showMargin={showMarginLine} />}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area yAxisId="left"
                    type="natural"
                    dataKey={chartMetric}
                    name={chartMetric === "revenue" ? "القيمة" : chartMetric === "profit" ? "الربح" : "العدد"}
                    stroke={chartMetric === "revenue" ? "#4f46e5" : chartMetric === "profit" ? "#10b981" : "#0f172a"}
                    strokeWidth={4}
                    fill={chartMetric === "revenue" ? "url(#chart-gradient)" : chartMetric === "profit" ? "url(#chart-gradient-profit)" : "url(#chart-gradient-alt)"}
                    activeDot={{ r: 6, fill: '#ffffff', stroke: chartMetric === "revenue" ? '#4f46e5' : chartMetric === "profit" ? '#10b981' : '#0f172a', strokeWidth: 3 }}
                  />
                  {showMarginLine && (
                    <Line yAxisId="right" type="natural" dataKey="margin_percent" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} connectNulls />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column Grid */}
          <div className="flex flex-col gap-5">
            
            {/* Top Categories Distribution */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 tracking-tight">توزيع المبيعات بالأقسام</h3>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">{periodLabel}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-[14px]">
                  <PieChart className="w-5 h-5 text-slate-500" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {topCategories.length === 0 ? (
                  <div className="text-center text-sm text-slate-400 font-bold py-6">لا توجد بيانات كافية للأقسام</div>
                ) : (
                  topCategories.map((cat, idx) => {
                    const maxRev = topCategories[0].revenue || 1;
                    const percent = Math.max(5, (cat.revenue / maxRev) * 100);
                    const margin = Number(cat.margin_percent || 0);
                    return (
                      <div key={idx} className="relative">
                        <div className="flex justify-between text-[11px] font-black mb-1.5 relative z-10 px-1">
                          <span className="text-slate-700">{cat.category_name}</span>
                          <span className="text-slate-900"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={cat.revenue || 0} /></SensitiveValue></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-900 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        {canViewSensitive && (
                          <div className="flex items-center justify-between mt-1 px-1">
                            <span className="text-[10px] font-bold text-slate-400">ربح: <CurrencyDisplay value={cat.gross_profit || 0} /></span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${margin >= 20 ? "bg-emerald-50 text-emerald-700" : margin >= 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cash Flow Mini-Chart */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm relative">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-slate-400" />
                  <h3 className="text-[14px] font-black text-slate-900">التدفق النقدي · {periodLabel}</h3>
                </div>
              </div>
              {!canViewSensitive ? (
                <div className="h-20 flex items-center justify-center text-slate-300 font-bold text-sm gap-2">
                  <span>🔒</span> بيانات مقيدة
                </div>
              ) : cashFlow.length > 0 ? (
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cf-pos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cf-neg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={false} axisLine={false} />
                      <YAxis tick={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-[12px] border border-white/40 bg-white/80 backdrop-blur px-3 py-2 text-xs shadow-lg">
                              <div className="font-bold text-slate-500 mb-1">{label}</div>
                              <div className="text-emerald-700 font-bold">مبيعات: <CurrencyDisplay value={d.sales} /></div>
                              <div className="text-emerald-500 font-bold">إيرادات: <CurrencyDisplay value={d.revenues} /></div>
                              <div className="text-rose-600 font-bold">مصروفات: <CurrencyDisplay value={d.expenses} /></div>
                              {d.withdrawals > 0 && <div className="text-rose-400 font-bold">مسحوبات: <CurrencyDisplay value={d.withdrawals} /></div>}
                              <div className={`border-t border-slate-100 mt-1 pt-1 font-black ${d.net >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                                الصافي: <CurrencyDisplay value={d.net} />
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fill="url(#cf-pos)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-slate-400 font-bold text-sm">لا توجد بيانات</div>
              )}
              {canViewSensitive && cashFlow.length > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">
                    الداخل: <CurrencyDisplay value={cashFlow.reduce((s, d) => s + d.sales + d.revenues, 0)} />
                  </span>
                  <span className="text-[11px] font-bold text-rose-600">
                    الخارج: <CurrencyDisplay value={cashFlow.reduce((s, d) => s + d.expenses + d.withdrawals, 0)} />
                  </span>
                </div>
              )}
            </div>

            {/* Quick Stats Bento */}
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-[120px]">
              <div className="rounded-[24px] bg-indigo-600 p-5 text-white flex flex-col justify-between border border-indigo-500 shadow-[0_10px_30px_rgba(79,70,229,0.3)]">
                 <Layers className="w-6 h-6 opacity-80" />
                 <div>
                   <div className="text-[28px] font-black tracking-tighter leading-none mt-2">{summary.itemsCount}</div>
                   <div className="text-[11px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">إجمالي الأصناف</div>
                 </div>
              </div>
              <div className="rounded-[24px] bg-white p-5 border border-slate-200 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                 <Boxes className="w-6 h-6 text-slate-400" />
                 <div>
                   <div className="text-[28px] font-black tracking-tighter text-slate-900 leading-none mt-2">{inventoryHealth.lowStock}</div>
                   <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">أصناف نواقص</div>
                 </div>
              </div>
            </div>

          </div>
        </div>

        {/* Day-of-Week Heatmap */}
        <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[16px] bg-slate-50 flex items-center justify-center text-slate-500">
                <Grid3X3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">خريطة حرارة المبيعات</h2>
                <p className="text-2sm font-bold text-slate-500">توزيع المبيعات حسب اليوم والساعة · {periodLabel}</p>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Metric toggle */}
              <div className="flex p-0.5 bg-slate-100 rounded-[12px]">
                <button onClick={() => setHeatmapMetric("total_sales")}
                  className={`px-3 py-1.5 rounded-[9px] text-[11px] font-black transition-all ${heatmapMetric === "total_sales" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >بالقيمة</button>
                <button onClick={() => setHeatmapMetric("invoice_count")}
                  className={`px-3 py-1.5 rounded-[9px] text-[11px] font-black transition-all ${heatmapMetric === "invoice_count" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >بالعدد</button>
              </div>

              {/* Granularity toggle */}
              <div className="flex p-0.5 bg-slate-100 rounded-[12px]">
                {[1, 2, 4].map(g => (
                  <button key={g} onClick={() => setHeatmapGranularity(g)}
                    className={`px-2.5 py-1.5 rounded-[9px] text-[11px] font-black transition-all ${heatmapGranularity === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >{g === 1 ? "ساعة" : g === 2 ? "ساعتين" : "٤س"}</button>
                ))}
              </div>



              {heatmapLoading && (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              )}
            </div>
          </div>

          {/* Grid */}
          {(() => {
            const bucketSize = heatmapGranularity;
            const numBuckets = Math.ceil(24 / bucketSize);
            const bucketLabels = Array.from({ length: numBuckets }, (_, i) =>
              `${String(i * bucketSize).padStart(2, "0")}:00`
            );
            const bucketDisplay = Array.from({ length: numBuckets }, (_, i) => {
              const s = i * bucketSize;
              const e = Math.min(s + bucketSize, 24);
              return `${String(s).padStart(2, "0")}:00-${String(e).padStart(2, "0")}:00`;
            });
            const bucketed = {};
            heatmap.forEach(row => {
              const hour = parseInt((row.hour_slot || "0").split(":")[0] || "0");
              const bIdx = Math.floor(hour / bucketSize);
              const bLabel = bucketLabels[bIdx] || row.hour_slot;
              const day = row.day;
              const key = `${day}|${bLabel}`;
              if (!bucketed[key]) {
                bucketed[key] = { day, hour_slot: bLabel, total_sales: 0, invoice_count: 0, avg_sale: 0 };
              }
              bucketed[key].total_sales += Number(row.total_sales || 0);
              bucketed[key].invoice_count += Number(row.invoice_count || 0);
            });
            Object.values(bucketed).forEach(b => {
              b.avg_sale = b.invoice_count > 0 ? b.total_sales / b.invoice_count : 0;
            });
            const bucketedArr = Object.values(bucketed);
            // Single scale across the whole grid so busier days actually look busier
            const maxVal = Math.max(...bucketedArr.map(b => Number(b[heatmapMetric] || 0)), 1);

            return bucketedArr.length > 0 ? (
              <div className="overflow-auto max-h-[560px] rounded-[12px]">
                <div className="inline-grid gap-1" style={{
                  gridTemplateColumns: `auto repeat(${numBuckets}, minmax(56px, 1fr))`,
                  minWidth: `${200 + numBuckets * 64}px`,
                }}>
                  {/* Column headers — show start-end range */}
                  <div className="sticky top-0 z-20 bg-[var(--bg-surface)]" />
                  {bucketLabels.map((label, bi) => (
                    <div key={label} className="sticky top-0 z-20 bg-[var(--bg-surface)] flex flex-col items-center justify-center mb-1 h-10 leading-tight">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{bucketDisplay[bi]}</span>
                      <span className="text-[7px] font-bold text-slate-300 mt-0.5">{bucketSize === 1 ? 'ساعة' : `${bucketSize} ساعات`}</span>
                    </div>
                  ))}

                  {/* Rows — one per calendar day in the selected period (newest first) */}
                  {heatmapDayList.map((dayStr, di) => {
                    const dow = new Date(`${dayStr}T00:00:00Z`).getUTCDay();
                    const [, mm, dd] = dayStr.split("-");
                    const rowLabel = `${DAY_NAMES[dow]} ${dd}/${mm}`;
                    const rowData = bucketedArr.filter(b => b.day === dayStr);
                    return (
                      <React.Fragment key={dayStr}>
                        <div className="sticky right-0 z-10 bg-[var(--bg-surface)] text-[12px] font-bold text-slate-500 flex items-center h-10 pl-2 whitespace-nowrap">
                          {rowLabel}
                        </div>
                        {bucketLabels.map((bLabel, bi) => {
                          const cell = rowData.find(b => b.hour_slot === bLabel);
                          const val = Number(cell?.[heatmapMetric] || 0);
                          const intensity = val > 0 ? Math.min(1, val / maxVal) : 0;
                          const displayVal = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toLocaleString();

                          return (
                            <div key={`${di}-${bi}`}
                              className="h-10 rounded-[8px] flex items-center justify-center cursor-pointer transition-all hover:scale-105 hover:shadow-md relative"
                              style={{
                                backgroundColor: val > 0
                                  ? `color-mix(in srgb, var(--bg-surface) ${100 - intensity * 55}%, var(--primary) ${intensity * 55}%)`
                                  : "var(--bg-base)",
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredCell({ rowLabel, bLabel: bucketDisplay[bi], cell, dayStr, rect });
                              }}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {val > 0 && (
                                <span className="text-[10px] font-black leading-none px-1 truncate max-w-full"
                                  style={{ color: intensity > 0.45 ? "#fff" : "var(--text-primary)" }}
                                >
                                  {displayVal}{heatmapMetric === "total_sales" && "ج"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Floating tooltip */}
                {hoveredCell && (
                  <div className="fixed z-50 pointer-events-none" style={{
                    right: Math.min(hoveredCell.rect.right + 12, window.innerWidth - 280),
                    top: Math.max(hoveredCell.rect.top - 10, 8),
                  }}>
                    <div className="rounded-[14px] bg-white px-5 py-3 text-xs shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-slate-200 whitespace-nowrap">
                      <div className="font-black text-slate-900 mb-1.5">{hoveredCell.rowLabel} — {hoveredCell.bLabel}</div>
                      <div className="text-slate-500 flex gap-5">
                        <span>الفواتير: <strong className="text-slate-800">{Number(hoveredCell.cell?.invoice_count || 0).toLocaleString()}</strong></span>
                        <span>المبيعات: <strong className="text-slate-800">{Number(hoveredCell.cell?.total_sales || 0).toLocaleString()} ج.م</strong></span>
                      </div>
                      {Number(hoveredCell.cell?.avg_sale || 0) > 0 && (
                        <div className="text-slate-500 mt-1">
                          متوسط الفاتورة: <strong className="text-slate-800">{Number(hoveredCell.cell?.avg_sale).toLocaleString()} ج.م</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Legend */}
                <div className="flex items-center justify-center gap-3 mt-5 pt-4 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400">منخفض</span>
                  <div className="flex h-3 w-36 rounded-full overflow-hidden" style={{
                    background: "linear-gradient(to left, color-mix(in srgb, var(--bg-surface) 95%, var(--primary) 5%), color-mix(in srgb, var(--bg-surface) 70%, var(--primary) 30%), color-mix(in srgb, var(--bg-surface) 40%, var(--primary) 60%))",
                  }} />
                  <span className="text-[11px] font-bold text-slate-400">مرتفع</span>
                  <span className="w-px h-4 bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">{heatmapMetric === "total_sales" ? "قيمة المبيعات" : "عدد الفواتير"}</span>
                  <span className="w-px h-4 bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">{heatmapGranularity === 1 ? "كل ساعة" : heatmapGranularity === 2 ? "كل ساعتين" : "كل ٤ ساعات"}</span>
                  <span className="w-px h-4 bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400">{globalDateMode === "custom" ? "مخصص" : `${globalRange} يوم`}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm font-bold text-slate-400">
                {heatmapLoading ? "جاري تحميل البيانات..." : "لا توجد بيانات كافية"}
              </div>
            );
          })()}
        </div>

        {/* Peak-hours insight — derived from the heatmap data above */}
        {peakInsight && (peakInsight.bestDay || peakInsight.bestCell) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-[20px] bg-white border border-slate-200/70 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-[14px] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Calendar className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">أفضل يوم</div>
                <div className="text-[15px] font-black text-slate-900 truncate">{peakInsight.bestDay?.name || "—"}</div>
                {canViewSensitive && peakInsight.bestDay && <div className="text-[11px] font-bold text-slate-500"><CurrencyDisplay value={peakInsight.bestDay.value} /></div>}
              </div>
            </div>
            <div className="rounded-[20px] bg-white border border-slate-200/70 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-[14px] bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ساعة الذروة</div>
                <div className="text-[15px] font-black text-slate-900">{peakInsight.bestHour ? `${String(peakInsight.bestHour.hour).padStart(2, "0")}:00` : "—"}</div>
                {canViewSensitive && peakInsight.bestHour && <div className="text-[11px] font-bold text-slate-500"><CurrencyDisplay value={peakInsight.bestHour.value} /></div>}
              </div>
            </div>
            <div className="rounded-[20px] bg-white border border-slate-200/70 p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5" /></div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">أقوى فترة مبيعات</div>
                <div className="text-[15px] font-black text-slate-900 truncate">{peakInsight.bestCell ? `${peakInsight.bestCell.name} ${String(peakInsight.bestCell.hour).padStart(2, "0")}:00` : "—"}</div>
                {canViewSensitive && peakInsight.bestCell && <div className="text-[11px] font-bold text-slate-500"><CurrencyDisplay value={peakInsight.bestCell.value} /></div>}
              </div>
            </div>
          </div>
        )}

        {/* Lower Row: Top Selling Items & Top Customers & Low Stock */}
        <div className="grid gap-5 xl:grid-cols-[2fr_1fr_1fr]">
          
          {/* Top Selling Items */}
          <div data-help="top-items" className="rounded-[32px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">
                  الأصناف {itemsSort === 'top' ? 'الأكثر' : 'الأقل'} مبيعاً
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                   <select ref={itemsSortRef} value={itemsSort} onChange={e => setItemsSort(e.target.value)} onKeyDown={(e) => handleKeyDown(e, {})} className="text-2sm font-bold bg-white border border-slate-200 shadow-sm rounded-[10px] px-2 py-1.5 outline-none text-slate-700 cursor-pointer">
                     <option value="top">الأكثر مبيعاً</option>
                     <option value="bottom">الأقل مبيعاً</option>
                   </select>
<span className="text-[11px] font-bold text-slate-400">{periodLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                <button onClick={() => setTopItemsModalOpen(true)} title="عرض تحليل مفصل"
                  className="flex items-center gap-2 rounded-[16px] border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[12px] font-black text-indigo-700 hover:bg-indigo-100 transition-all active:scale-95 shadow-sm">
                  <Maximize2 className="w-4 h-4" /> تحليل مفصل
                </button>
                <div className="w-12 h-12 rounded-[20px] bg-primary text-white flex items-center justify-center shadow-[0_8px_20px_rgba(15,23,42,0.15)]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
            </div>

            {topItems.length > 0 && (() => {
              const max = Math.max(...topItems.map(i => Number(i.revenue || 0)), 1);
              const rankColors = ["bg-amber-400", "bg-slate-400", "bg-orange-400", "bg-slate-300", "bg-slate-200"];
              return (
                <div className="flex flex-col gap-3 mb-4">
                  {topItems.map((item, idx) => {
                    const pct = Math.round((Number(item.revenue || 0) / max) * 100);
                    const margin = Number(item.margin_percent || 0);
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${rankColors[idx] || "bg-slate-200"}`}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {item.item_code && <span className="font-mono text-[10px] font-black text-slate-400 ml-1" dir="ltr">{item.item_code} · </span>}
                              {item.item_name}
                            </span>
                            <span className="text-sm font-black text-slate-900 tabular-nums shrink-0 mr-3"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={item.revenue} /></SensitiveValue></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-black tabular-nums shrink-0 text-slate-500 w-14 text-left">{Number(item.quantity_sold || 0)} و</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${margin >= 20 ? "bg-emerald-50 text-emerald-700" : margin >= 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {topItems.length === 0 && !itemsLoading && (
              <div className="text-center py-10 text-sm text-slate-400 font-bold">لا يوجد مبيعات في الفترة المحددة</div>
            )}
            {itemsLoading && (
              <div className="flex items-center justify-center py-10 text-slate-300 animate-pulse">
                <Activity className="w-6 h-6 animate-spin" />
              </div>
            )}
            {allTopItems.length > 5 && (
              <button onClick={() => setTopItemsModalOpen(true)}
                className="w-full mt-2 py-2 text-center text-[11px] font-black text-indigo-600 bg-indigo-50/50 rounded-[16px] hover:bg-indigo-50 transition-colors">
                {"عرض جميع "}{allTopItems.length}{" صنف بالتحليل الكامل ←"}
              </button>
            )}
          </div>

          {topItemsModalOpen && (
            <TopItemsModal
              items={allTopItems}
              onClose={() => setTopItemsModalOpen(false)}
              dateLabel={globalDateMode === "custom"
                ? `${globalCustomDates.start || "—"} → ${globalCustomDates.end || "—"}`
                : globalRange === 1 ? "اليوم" : `آخر ${globalRange} يوم`}
            />
          )}

          {/* Top Customers Widget */}
          <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 w-5 h-5 text-slate-500" />
                <div>
                  <h3 className="text-[16px] font-black text-slate-900">أفضل العملاء</h3>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">{periodLabel}</p>
                </div>
              </div>
              <Link to="/reports/center" className="text-[10px] font-black text-indigo-600 hover:underline">تقرير كامل ←</Link>
            </div>
            {topCustomers.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 font-bold">لا توجد بيانات</div>
            ) : (
              <div className="flex-1 space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-[14px] hover:bg-slate-50 transition-colors">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-200 text-slate-500"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{c.customer_name}</div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {Number(c.invoice_count || 0)} فاتورة
                        {c.phone && <span className="mr-2 font-mono">{c.phone}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-900 tabular-nums shrink-0"><SensitiveValue canView={canViewSensitive}><CurrencyDisplay value={c.total_sales} /></SensitiveValue></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Detailed List */}
          <div className="rounded-[32px] border border-orange-200/50 bg-gradient-to-b from-orange-50/50 to-white p-6 shadow-sm flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[16px] bg-orange-100/50 text-orange-600 flex items-center justify-center border border-orange-100">
                  <Pickaxe className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-black text-slate-900 tracking-tight">تنبيهات المخزون</h2>
              </div>
              {lowStock.length > 0 && (
                <button
                  onClick={() => {
                    const bySupplier = {};
                    lowStock.forEach(item => {
                      const key = item.last_supplier_id || "__none__";
                      if (!bySupplier[key]) bySupplier[key] = { supplier_id: item.last_supplier_id, supplier_name: item.last_supplier_name, lines: [] };
                      bySupplier[key].lines.push({
                        item_id: item.id,
                        name: item.name,
                        code: item.item_code,
                        quantity: Math.max(1, Number(item.min_stock_qty || 1) - Number(item.quantity || 0)),
                        unit_cost: Number(item.purchase_price || 0),
                      });
                    });
                    const groups = Object.values(bySupplier);
                    const first = groups[0];
                    navigate("/purchases/orders/new", {
                      state: {
                        prefill: {
                          supplier_id: first.supplier_id,
                          notes: groups.length > 1
                            ? `أمر شراء مقترح (1/${groups.length}) — ${first.supplier_name || "بدون مورد"}`
                            : `أمر شراء مقترح — ${first.supplier_name || "بدون مورد"}`,
                          lines: first.lines,
                        },
                        remainingGroups: groups.slice(1),
                      }
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2 text-[12px] font-black text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98]"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  إنشاء أمر شراء مقترح
                </button>
              )}
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
              {lowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 h-full text-center bg-white rounded-[16px] border border-slate-100">
                   <div className="w-12 h-12 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-500 mb-3">
                     <Sparkles className="w-5 h-5" />
                   </div>
                   <span className="text-[14px] font-black text-slate-800">مخزونك في أمان تام</span>
                   <span className="text-2sm font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للطلب.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[16px] border border-slate-100 bg-white p-3 hover:border-orange-200 transition-all hover:shadow-sm group">
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                        {item.item_code ? (
                          <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums" dir="ltr">SKU: {item.item_code}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">رصيد</span>
                        <span className="inline-flex items-center justify-center h-7 px-3 bg-red-50 text-red-600 rounded-full text-[11px] font-black ring-1 ring-red-100 group-hover:scale-105 transition-transform">
                          {Number(item.quantity || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {lowStock.length === 5 && (
                     <Link to="/stock/levels" className="block w-full py-2 mt-1 text-center text-[11px] font-black text-indigo-600 bg-indigo-50/50 rounded-[16px] hover:bg-indigo-50 transition-colors">
                       عرض التفاصيل الكاملة ←
                     </Link>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Payment Flow Preview */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-slate-500" />
              <div>
                <h3 className="text-[16px] font-black text-slate-900">تدفقات وسائل الدفع</h3>
                <p className="text-[11px] font-bold text-slate-400">{periodLabel}</p>
              </div>
            </div>
            <Link to={paymentFlowReportHref} className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800">
              فتح التقرير التفصيلي
            </Link>
          </div>
          {!canViewSensitive ? (
            <div className="flex items-center justify-center py-8 text-sm font-bold text-slate-300">بيانات مقيدة</div>
          ) : paymentFlow.length === 0 ? (
            <div className="py-8 text-center text-sm font-bold text-slate-400">لا توجد تدفقات مسجلة في الفترة</div>
          ) : (() => {
            const totalIn = paymentFlow.reduce((s, m) => s + Number(m.total_in || 0), 0);
            const totalOut = paymentFlow.reduce((s, m) => s + Number(m.total_out || 0), 0);
            const net = totalIn - totalOut;
            const top = [...paymentFlow].sort((a, b) => Math.abs(Number(b.net_amount || 0)) - Math.abs(Number(a.net_amount || 0))).slice(0, 5);
            const max = Math.max(1, ...top.map((m) => Math.max(Number(m.total_in || 0), Number(m.total_out || 0))));
            return (
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-emerald-50 p-4 text-center"><div className="text-[11px] font-black text-emerald-700">داخل</div><div className="mt-1 text-lg font-black text-emerald-800"><CurrencyDisplay value={totalIn} /></div></div>
                  <div className="rounded-2xl bg-rose-50 p-4 text-center"><div className="text-[11px] font-black text-rose-700">خارج</div><div className="mt-1 text-lg font-black text-rose-800"><CurrencyDisplay value={totalOut} /></div></div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-center"><div className="text-[11px] font-black text-slate-500">الصافي</div><div className={`mt-1 text-lg font-black ${net < 0 ? "text-rose-700" : "text-slate-900"}`}><CurrencyDisplay value={net} /></div></div>
                </div>
                <div className="space-y-3">
                  {top.map((m) => (
                    <div key={m.method_id || m.method_name}>
                      <div className="mb-1 flex items-center justify-between text-[11px] font-black">
                        <span className="text-slate-700">{m.method_name || "غير محدد"} <span className="text-[10px] text-slate-400">({m.transaction_count || 0})</span></span>
                        <span className={Number(m.net_amount || 0) < 0 ? "text-rose-700" : "text-slate-900"}><CurrencyDisplay value={m.net_amount || 0} /></span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-full bg-slate-100 p-1">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(3, (Number(m.total_in || 0) / max) * 100)}%` }} />
                        <div className="h-2 justify-self-end rounded-full bg-rose-500" style={{ width: `${Math.max(3, (Number(m.total_out || 0) / max) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Payment Mix + Discount Leakage */}
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Payment Mix */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-slate-500" />
                <h3 className="text-[16px] font-black text-slate-900">توزيع طرق الدفع</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">{periodLabel}</span>
            </div>
            {!canViewSensitive ? (
              <div className="flex-1 flex items-center justify-center text-slate-300 font-bold text-sm gap-2 py-8"><span>🔒</span> بيانات مقيدة</div>
            ) : paymentMix.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 font-bold">لا توجد مبيعات في الفترة</div>
            ) : (() => {
              const labels = { cash: "نقدي", card: "بطاقة", credit: "آجل", wallet: "محفظة", installments: "تقسيط", bank_transfer: "تحويل بنكي", multi: "متعدد" };
              const total = paymentMix.reduce((s, p) => s + Number(p.total_sales || 0), 0) || 1;
              const sorted = [...paymentMix].sort((a, b) => Number(b.total_sales || 0) - Number(a.total_sales || 0));
              const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-rose-500", "bg-slate-400"];
              return (
                <div className="flex-1 space-y-3">
                  {sorted.map((p, idx) => {
                    const pct = (Number(p.total_sales || 0) / total) * 100;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-[11px] font-black mb-1 px-1">
                          <span className="text-slate-700">{labels[p.payment_type] || p.payment_type} <span className="text-[10px] font-bold text-slate-400">({Number(p.invoice_count || 0)} فاتورة)</span></span>
                          <span className="text-slate-900"><CurrencyDisplay value={p.total_sales || 0} /> <span className="text-[10px] text-slate-400">{pct.toFixed(0)}%</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[idx % colors.length]}`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Discount Leakage */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-500" />
                <h3 className="text-[16px] font-black text-slate-900">تسرّب الخصومات</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">{periodLabel}</span>
            </div>
            {!canViewSensitive ? (
              <div className="flex-1 flex items-center justify-center text-slate-300 font-bold text-sm gap-2 py-8"><span>🔒</span> بيانات مقيدة</div>
            ) : (
              <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-[34px] font-black text-amber-600 leading-none"><CurrencyDisplay value={periodTotals.discount} /></span>
                  <span className="text-[11px] font-bold text-slate-400 mt-1">إجمالي الخصومات الممنوحة</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[16px] bg-slate-50 p-3 text-center">
                    <div className="text-[18px] font-black text-slate-800">{periodTotals.discountRate.toFixed(1)}%</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">من قيمة البيع</div>
                  </div>
                  <div className={`rounded-[16px] p-3 text-center ${periodTotals.discountVsProfit > 30 ? "bg-rose-50" : "bg-slate-50"}`}>
                    <div className={`text-[18px] font-black ${periodTotals.discountVsProfit > 30 ? "text-rose-600" : "text-slate-800"}`}>{periodTotals.discountVsProfit.toFixed(0)}%</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">من صافي الربح</div>
                  </div>
                </div>
                {periodTotals.discountVsProfit > 30 && (
                  <p className="text-[11px] font-bold text-rose-500 text-center">الخصومات تستهلك نسبة مرتفعة من الأرباح — راجع سياسة الخصم.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dead / Slow-moving Stock */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-slate-100 text-slate-500 flex items-center justify-center"><Package className="w-5 h-5" /></div>
            <div className="flex-1">
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight">مخزون راكد — بدون مبيعات خلال الفترة</h2>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">أصناف عليها رصيد ولم تُباع خلال {periodLabel} — رأس مال مجمّد</p>
            </div>
            <Link to="/reports/center" className="text-[11px] font-black text-indigo-600 hover:underline shrink-0">تقرير كامل ←</Link>
          </div>
          {deadStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-[16px] border border-slate-100">
              <Sparkles className="w-6 h-6 text-emerald-400 mb-2" />
              <span className="text-[13px] font-black text-slate-700">لا يوجد مخزون راكد في هذه الفترة</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                    <th className="py-2 px-2 text-right">الصنف</th>
                    <th className="py-2 px-2 text-right">الفئة</th>
                    <th className="py-2 px-2 text-center">الرصيد</th>
                    {canViewSensitive && <th className="py-2 px-2 text-center">قيمة المخزون</th>}
                    <th className="py-2 px-2 text-center">آخر بيع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {deadStock.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-2 font-bold text-slate-800">{d.item_name}</td>
                      <td className="py-2.5 px-2 text-[12px] font-bold text-slate-500">{d.category_name || "—"}</td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-700 tabular-nums">{Number(d.quantity || 0)}</td>
                      {canViewSensitive && <td className="py-2.5 px-2 text-center font-black text-slate-900 tabular-nums"><CurrencyDisplay value={d.total_value || 0} /></td>}
                      <td className="py-2.5 px-2 text-center text-[11px] font-bold text-slate-400">{d.last_sale_date || d.aging_bucket || "بدون حركة"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Two-period comparison */}
        <PeriodCompareSection
          compareA={compareA} setCompareA={setCompareA}
          compareB={compareB} setCompareB={setCompareB}
          result={compareResult} loading={compareLoading} onRun={runCompare}
          canViewSensitive={canViewSensitive} handleKeyDown={handleKeyDown}
        />

        {/* Margin Health */}
        <div className="rounded-[28px] bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-rose-100/50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-[16px] font-black text-slate-900 tracking-tight">صحة الهوامش</h2>
            <Link to="/reports/margin-health" className="mr-auto text-[11px] font-black text-indigo-600 hover:underline">تقرير كامل ←</Link>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {belowMargin.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 h-full text-center bg-white rounded-[16px] border border-slate-100">
                <div className="w-12 h-12 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-500 mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-[14px] font-black text-slate-800">هوامش الربح سليمة</span>
                <span className="text-2sm font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للهامش.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {belowMargin.map((item) => (
                  <div key={item.item_id || item.id} className="flex items-center justify-between rounded-[16px] border border-rose-100 bg-rose-50/40 p-3">
                    <div className="flex flex-col min-w-0">
                      {(item.item_code || item.code) && <span className="font-mono text-[11px] text-slate-400">{item.item_code || item.code}</span>}
                      <span className="font-bold text-slate-800 text-sm">{item.item_name || item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">هامش</span>
                      <span className="inline-flex items-center justify-center h-7 px-3 bg-rose-100 text-rose-700 rounded-full text-[11px] font-black ring-1 ring-rose-200">
                        <SensitiveValue canView={canViewSensitive}>{Number(item.current_margin_percent ?? 0).toFixed(1)}%</SensitiveValue>
                      </span>
                    </div>
                  </div>
                ))}
                {belowMargin.length === 5 && (
                  <Link to="/reports/margin-health" className="block w-full py-2 mt-1 text-center text-[11px] font-black text-rose-600 bg-rose-50/50 rounded-[16px] hover:bg-rose-50 transition-colors">
                    عرض التفاصيل الكاملة ←
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expiry Tracking Dashboard */}
        {expiryEnabled && (
        <div className="rounded-[28px] bg-white/70 backdrop-blur-xl border border-amber-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[16px] bg-amber-100/50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight">
                تتبع تواريخ الانتهاء
                {expiryStats?.tracked_items > 0 && (
                  <span className="mr-2 text-[13px] font-bold text-slate-400">· {expiryStats.tracked_items} صنف مُفعّل</span>
                )}
              </h2>
              <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                رصد شامل لصلاحية الأصناف — منتهية، حرجة، وتحذيرية
              </p>
            </div>
            <Link to="/reports/expiry-report" className="text-[11px] font-black text-indigo-600 hover:underline shrink-0">
              تقرير انتهاء الصلاحية ←
            </Link>
          </div>

          {expiryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-[16px] bg-red-50/70 border border-red-200/50 p-3 flex flex-col items-center">
                <span className="text-[22px] font-black text-red-700 leading-none">{expiryStats.expired}</span>
                <span className="text-[10px] font-bold text-red-500 mt-1">منتهية</span>
                {expiryStats.expired_qty > 0 && (
                  <span className="text-[9px] font-bold text-red-400">{expiryStats.expired_qty} وحدة</span>
                )}
              </div>
              <div className="rounded-[16px] bg-orange-50/70 border border-orange-200/50 p-3 flex flex-col items-center">
                <span className="text-[22px] font-black text-orange-700 leading-none">{expiryStats.critical}</span>
                <span className="text-[10px] font-bold text-orange-500 mt-1">حرجة (≤٧ أيام)</span>
                {expiryStats.critical_qty > 0 && (
                  <span className="text-[9px] font-bold text-orange-400">{expiryStats.critical_qty} وحدة</span>
                )}
              </div>
              <div className="rounded-[16px] bg-amber-50/70 border border-amber-200/50 p-3 flex flex-col items-center">
                <span className="text-[22px] font-black text-amber-700 leading-none">{expiryStats.warning}</span>
                <span className="text-[10px] font-bold text-amber-500 mt-1">تحذير (١٤ يوم)</span>
              </div>
              <div className="rounded-[16px] bg-emerald-50/70 border border-emerald-200/50 p-3 flex flex-col items-center">
                <span className="text-[22px] font-black text-emerald-700 leading-none">{expiryStats.valid}</span>
                <span className="text-[10px] font-bold text-emerald-500 mt-1">ساري</span>
                <span className="text-[9px] font-bold text-emerald-400">{expiryStats.total_quantity} إجمالي الوحدات</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex p-0.5 bg-slate-100 rounded-[12px] gap-0.5">
              {[
                { key: "all", label: "الكل" },
                { key: "expired", label: "منتهي" },
                { key: "critical", label: "حرج" },
                { key: "warning", label: "تحذير" },
                { key: "valid", label: "ساري" },
              ].map(tab => (
                <button key={tab.key}
                  onClick={() => setExpiryStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-[10px] text-[11px] font-black transition-all ${
                    expiryStatusFilter === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <select ref={expiryWhRef} value={expiryWarehouseId}
              onChange={e => setExpiryWarehouseId(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, { nextRef: expirySearchRef })}
              className="text-[11px] font-bold bg-white border border-slate-200 rounded-[10px] px-2 py-1.5 outline-none text-slate-600 cursor-pointer">
              <option value="">كل المخازن</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            <div className="flex-1 min-w-[150px]">
              <input ref={expirySearchRef} type="text" value={expirySearch}
                onChange={e => setExpirySearch(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, { nextRef: expiryWhRef, prevRef: expiryWhRef })}
                placeholder="بحث بالاسم أو الكود أو الدفعة..."
                className="w-full text-[11px] bg-white border border-slate-200 rounded-[10px] px-3 py-1.5 outline-none text-slate-700 placeholder:text-slate-300 font-bold" />
            </div>

            {(expiryStatusFilter !== "all" || expiryWarehouseId || expirySearch) && (
              <button onClick={() => { setExpiryStatusFilter("all"); setExpiryWarehouseId(""); setExpirySearch(""); }}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 px-2 py-1">
                إعادة تعيين
              </button>
            )}
          </div>

          {expiringSoon.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-[16px] border border-dashed border-amber-200 bg-amber-50/30">
              <Package className="w-8 h-8 text-amber-300 mb-3" />
              <span className="text-sm font-black text-slate-500">
                {expiryStatusFilter !== "all"
                  ? "لا توجد دفعات في هذا التصنيف"
                  : expiryStats?.tracked_items > 0
                    ? `${expiryStats.tracked_items} صنف مفعّل عليه التتبع — ولا توجد دفعات منتهية قريباً`
                    : "لا توجد دفعات مسجلة"}
              </span>
              <span className="text-[11px] font-bold text-slate-400 mt-1 text-center max-w-xs">
                {expiryStatusFilter !== "all"
                  ? "حاول تغيير الفلتر أو المخزن"
                  : expiryStats?.tracked_without_batches > 0
                    ? `${expiryStats.tracked_without_batches} صنف مفعّل عليها التتبع ولكن لم تسجّل مشترياتها بعد مع تواريخ الانتهاء — اشترِ هذه الأصناف وحدّد تاريخ الصلاحية`
                    : "فعّل تتبع الانتهاء على أصناف التاريخ الحساسة ثم سجّل مشترياتها مع تاريخ الانتهاء"}
              </span>
              {expiryStats?.tracked_without_batches > 0 && (
                <Link to="/reports/expiry-report" className="mt-4 text-[11px] font-black text-indigo-600 hover:underline">
                  فتح تقرير انتهاء الصلاحية ←
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
              {expiringSoon.map((b) => {
                const dr = Number(b.days_remaining);
                const pct = dr < 0 ? 100 : Math.max(2, Math.min(100, ((30 - dr) / 30) * 100));
                const statusBg = b.batch_status === "expired" ? "bg-red-50/60 border-red-200" :
                  b.batch_status === "critical" ? "bg-orange-50/60 border-orange-200" :
                  b.batch_status === "warning" ? "bg-amber-50/60 border-amber-200" :
                  "bg-emerald-50/30 border-emerald-100";
                const barColor = b.batch_status === "expired" ? "bg-red-400" :
                  b.batch_status === "critical" ? "bg-orange-400" :
                  b.batch_status === "warning" ? "bg-amber-400" :
                  "bg-emerald-400";
                const badgeCls = b.batch_status === "expired" ? "bg-red-100 text-red-700 ring-red-200" :
                  b.batch_status === "critical" ? "bg-orange-100 text-orange-700 ring-orange-200" :
                  b.batch_status === "warning" ? "bg-amber-100 text-amber-700 ring-amber-200" :
                  "bg-emerald-100 text-emerald-700 ring-emerald-200";

                return (
                  <div key={b.id} className={`flex flex-col gap-1.5 rounded-[16px] border p-3 ${statusBg} transition-all hover:shadow-sm`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/items?search=${encodeURIComponent(b.item_name)}`}
                            className="font-bold text-slate-800 text-sm hover:text-indigo-600 transition-colors truncate">
                            {b.item_name}
                          </Link>
                          {b.batch_no && (
                            <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              {b.batch_no}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {b.item_code && (
                            <span className="font-mono text-[10px] text-slate-400">{b.item_code}</span>
                          )}
                          {b.warehouse_name && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{b.warehouse_name}</span>
                          )}
                          <span className="text-[10px] font-bold text-slate-500">{b.quantity} وحدة</span>
                          <span className="text-[10px] font-bold text-slate-400">{b.expiry_date}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-[11px] font-black ring-1 ${badgeCls}`}>
                          {dr < 0 ? `منذ ${Math.abs(dr)} يوم` : `${Math.round(dr)} يوم`}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expiryStats?.tracked_without_batches > 0 && (
            <div className="rounded-[14px] bg-indigo-50/60 border border-indigo-200/50 p-3 flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-500 shrink-0">ℹ</span>
              <span className="text-[11px] font-bold text-indigo-700">
                {expiryStats.tracked_without_batches} صنف مفعّل عليها تتبع الصلاحية ولكن لا توجد مشتريات مسجّلة لها مع تواريخ انتهاء.
              </span>
            </div>
          )}

          {expiryStats && expiringSoon.length > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400">
                إجمالي {expiryStats.total_batches} دفعة — {expiryStats.total_quantity} وحدة
              </span>
              <span className="text-[10px] font-bold text-slate-300">
                {expiringSoon.length} معروض
              </span>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TOP ITEMS DEEP MODAL
// -------------------------------------------------------------

function TopItemsModal({ items, onClose, dateLabel }) {
  const handleKeyDown = useFieldNavigation();
  const searchRef = useRef(null);
  const [sort, setSort] = useState({ key: "revenue", dir: "desc" });
  const [metric, setMetric] = useState("revenue");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    let list = items.filter(i =>
      !search || i.item_name?.includes(search) || i.item_code?.includes(search) || i.category_name?.includes(search)
    );
    list = [...list].sort((a, b) => {
      const av = Number(a[sort.key] ?? 0);
      const bv = Number(b[sort.key] ?? 0);
      return sort.dir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [items, sort, search]);

  const totals = useMemo(() => ({
    revenue: items.reduce((s, i) => s + Number(i.revenue || 0), 0),
    gross_profit: items.reduce((s, i) => s + Number(i.gross_profit || 0), 0),
    cost: items.reduce((s, i) => s + Number(i.cost || 0), 0),
    quantity_sold: items.reduce((s, i) => s + Number(i.quantity_sold || 0), 0),
    returns_amount: items.reduce((s, i) => s + Number(i.returns_amount || 0), 0),
    total_discount: items.reduce((s, i) => s + Number(i.total_discount || 0), 0),
  }), [items]);

  const chartTop = useMemo(() => [...items].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).slice(0, 15), [items, metric]);
  const chartMax = useMemo(() => Math.max(...chartTop.map(i => Number(i[metric] || 0)), 1), [chartTop, metric]);

  const SortTh = ({ label, k }) => (
    <th onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
      className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-700 select-none whitespace-nowrap">
      <span className="flex items-center gap-1">
        {label}
        {sort.key === k ? (sort.dir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
      </span>
    </th>
  );

  const metricLabel = { revenue: "الإيراد", gross_profit: "الربح", quantity_sold: "الكمية" };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-[28px] bg-white shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-[20px] font-black text-slate-900">تحليل الأصناف الأكثر مبيعاً</h2>
            <p className="text-[12px] font-bold text-slate-400 mt-0.5">{dateLabel} · {items.length} صنف</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-slate-100 border-b border-slate-100">
            {[
              { label: "إجمالي الإيراد", val: totals.revenue, currency: true, color: "text-emerald-700 bg-emerald-50" },
              { label: "إجمالي الربح", val: totals.gross_profit, currency: true, color: "text-indigo-700 bg-indigo-50" },
              { label: "إجمالي التكلفة", val: totals.cost, currency: true, color: "text-slate-700 bg-slate-50" },
              { label: "إجمالي الكميات", val: totals.quantity_sold, currency: false, color: "text-sky-700 bg-sky-50", suffix: " وحدة" },
              { label: "المرتجعات", val: totals.returns_amount, currency: true, color: "text-rose-700 bg-rose-50" },
              { label: "إجمالي الخصومات", val: totals.total_discount, currency: true, color: "text-amber-700 bg-amber-50" },
            ].map(({ label, val, currency, color, suffix }) => (
              <div key={label} className={`flex flex-col gap-1 px-5 py-4 ${color}`}>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
                <span className="text-[18px] font-black tabular-nums leading-none">
                  {currency ? <CurrencyDisplay value={val} /> : `${Number(val).toLocaleString()}${suffix || ""}`}
                </span>
              </div>
            ))}
          </div>

          <div className="px-8 py-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">المحور:</span>
              {[["revenue", "الإيراد"], ["gross_profit", "الربح الصافي"], ["quantity_sold", "الكمية"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setMetric(k)}
                  className={`px-3 py-1 rounded-full text-[11px] font-black transition-all ${metric === k ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              {chartTop.map((item, idx) => {
                const val = Number(item[metric] || 0);
                const pct = Math.round((val / chartMax) * 100);
                const margin = Number(item.margin_percent || 0);
                const barColor = metric === "gross_profit"
                  ? (margin >= 20 ? "bg-emerald-500" : margin >= 10 ? "bg-amber-400" : "bg-rose-500")
                  : metric === "quantity_sold" ? "bg-sky-500" : "bg-indigo-500";
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-5 text-[10px] font-black text-slate-400 text-left shrink-0">{idx + 1}</span>
                    <span className="w-36 text-[11px] font-bold text-slate-700 truncate shrink-0">
                      {item.item_code && <span className="font-mono text-[10px] font-black text-slate-400" dir="ltr">{item.item_code} · </span>}
                      {item.item_name}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-black text-slate-800 tabular-nums w-24 text-left shrink-0">
                      {metric === "quantity_sold" ? `${Number(val).toLocaleString()} و` : <CurrencyDisplay value={val} />}
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full w-14 text-center shrink-0 ${margin >= 20 ? "bg-emerald-50 text-emerald-700" : margin >= 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-8 py-5">
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef })}
              placeholder="بحث بالاسم أو الكود أو الفئة..."
              className="w-full max-w-sm rounded-[12px] border border-slate-200 px-4 py-2 text-sm font-bold outline-none focus:border-indigo-400 mb-4" />

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-slate-200">
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 w-8">#</th>
                    <SortTh label="الصنف" k="item_name" />
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">الفئة</th>
                    <SortTh label="الكمية" k="quantity_sold" />
                    <SortTh label="متوسط سعر البيع" k="avg_unit_price" />
                    <SortTh label="الإيراد" k="revenue" />
                    <SortTh label="الخصومات" k="total_discount" />
                    <SortTh label="التكلفة" k="cost" />
                    <SortTh label="الربح الصافي" k="gross_profit" />
                    <SortTh label="الهامش%" k="margin_percent" />
                    <SortTh label="المرتجعات" k="returns_amount" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sorted.map((item, idx) => {
                    const margin = Number(item.margin_percent || 0);
                    const profit = Number(item.gross_profit || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2.5 text-[11px] font-black text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            {item.item_code && <span className="font-mono text-[10px] font-black text-slate-400" dir="ltr">{item.item_code}</span>}
                            <span className="font-bold text-slate-800 text-sm">{item.item_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] font-bold text-slate-500">{item.category_name || "—"}</td>
                        <td className="px-3 py-2.5 font-black text-slate-700 tabular-nums">{Number(item.quantity_sold || 0).toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-600 tabular-nums"><CurrencyDisplay value={item.avg_unit_price} /></td>
                        <td className="px-3 py-2.5 font-black text-slate-900 tabular-nums"><CurrencyDisplay value={item.revenue} /></td>
                        <td className="px-3 py-2.5 font-bold text-amber-700 tabular-nums">{Number(item.total_discount || 0) > 0 ? <CurrencyDisplay value={item.total_discount} /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-600 tabular-nums"><CurrencyDisplay value={item.cost} /></td>
                        <td className="px-3 py-2.5 tabular-nums">
                          <span className={`font-black ${profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            <CurrencyDisplay value={profit} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${margin >= 20 ? "bg-emerald-50 text-emerald-700" : margin >= 10 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-rose-600 tabular-nums">
                          {Number(item.returns_amount || 0) > 0 ? <CurrencyDisplay value={item.returns_amount} /> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sorted.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-bold">لا توجد نتائج</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TWO-PERIOD COMPARISON
// -------------------------------------------------------------

function pctChange(a, b) {
  if (a == null || b == null) return null;
  if (a === 0) return b > 0 ? 100 : b < 0 ? -100 : 0;
  return ((b - a) / Math.abs(a)) * 100;
}

function CompareDelta({ a, b, inverse = false, points = false }) {
  if (a == null || b == null) return null;
  const diff = points ? (b - a) : pctChange(a, b);
  if (diff == null) return null;
  const isUp = diff > 0;
  const good = inverse ? diff < 0 : diff > 0;
  const flat = Math.abs(diff) < (points ? 0.1 : 0.5);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
      flat ? "bg-slate-100 text-slate-500" : good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
    }`}>
      {flat ? "—" : isUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(diff).toFixed(1)}{points ? " ن" : "%"}
    </span>
  );
}

function CompareMetricRow({ label, aVal, bVal, fmt = "currency", inverse = false, points = false }) {
  const render = (v) => {
    if (v == null) return <span className="text-slate-300">🔒</span>;
    if (fmt === "currency") return <CurrencyDisplay value={v} />;
    if (fmt === "percent") return `${Number(v).toFixed(1)}%`;
    return Number(v).toLocaleString();
  };
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="text-[12px] font-bold text-slate-500 w-28 shrink-0">{label}</span>
      <span className="flex-1 text-center text-[13px] font-black text-slate-700 tabular-nums">{render(aVal)}</span>
      <span className="flex-1 text-center text-[13px] font-black text-slate-900 tabular-nums">{render(bVal)}</span>
      <span className="w-20 text-left shrink-0"><CompareDelta a={aVal} b={bVal} inverse={inverse} points={points} /></span>
    </div>
  );
}

function PeriodCompareSection({ compareA, setCompareA, compareB, setCompareB, result, loading, onRun, canViewSensitive }) {
  const ready = compareA.start && compareA.end && compareB.start && compareB.end;
  const a = result?.a, b = result?.b;
  return (
    <div className="rounded-[28px] border border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 to-white p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[16px] bg-indigo-100/60 text-indigo-600 flex items-center justify-center border border-indigo-100"><ArrowLeftRight className="w-5 h-5" /></div>
        <div>
          <h2 className="text-[16px] font-black text-slate-900 tracking-tight">مقارنة فترتين</h2>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">اختر فترتين لمقارنة أهم المؤشرات جنباً إلى جنب</p>
        </div>
      </div>

      {/* Pickers */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[16px] bg-white border border-slate-200 p-3 flex flex-col gap-2">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الفترة الأولى</span>
          <div className="flex items-center gap-2">
            <input type="date" value={compareA.start} onChange={e => setCompareA(c => ({ ...c, start: e.target.value }))} className="flex-1 text-[11px] bg-slate-50 rounded-[8px] px-2 py-1.5 outline-none border border-slate-200 font-mono" />
            <span className="text-[10px] font-black text-slate-400">الي</span>
            <input type="date" value={compareA.end} onChange={e => setCompareA(c => ({ ...c, end: e.target.value }))} className="flex-1 text-[11px] bg-slate-50 rounded-[8px] px-2 py-1.5 outline-none border border-slate-200 font-mono" />
          </div>
        </div>
        <div className="rounded-[16px] bg-white border border-slate-200 p-3 flex flex-col gap-2">
          <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">الفترة الثانية</span>
          <div className="flex items-center gap-2">
            <input type="date" value={compareB.start} onChange={e => setCompareB(c => ({ ...c, start: e.target.value }))} className="flex-1 text-[11px] bg-slate-50 rounded-[8px] px-2 py-1.5 outline-none border border-slate-200 font-mono" />
            <span className="text-[10px] font-black text-slate-400">الي</span>
            <input type="date" value={compareB.end} onChange={e => setCompareB(c => ({ ...c, end: e.target.value }))} className="flex-1 text-[11px] bg-slate-50 rounded-[8px] px-2 py-1.5 outline-none border border-slate-200 font-mono" />
          </div>
        </div>
      </div>
      <button onClick={onRun} disabled={!ready || loading}
        className="self-start flex items-center gap-2 rounded-[14px] bg-indigo-600 px-5 py-2.5 text-[12px] font-black text-white hover:bg-indigo-700 transition-all active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
        <ArrowLeftRight className="w-4 h-4" /> {loading ? "جاري المقارنة..." : "قارن الفترتين"}
      </button>

      {result && a && b && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Column headers */}
          <div className="lg:col-span-2 flex items-center justify-between gap-2 px-1 -mb-1">
            <span className="text-[11px] font-bold text-slate-400 w-28 shrink-0">المؤشر</span>
            <span className="flex-1 text-center text-[11px] font-black text-slate-500">الأولى</span>
            <span className="flex-1 text-center text-[11px] font-black text-indigo-600">الثانية</span>
            <span className="w-20 text-left shrink-0 text-[11px] font-bold text-slate-400">التغير</span>
          </div>

          {/* Sales & profit */}
          <div className="rounded-[16px] bg-white border border-slate-200 p-4">
            <h4 className="text-[12px] font-black text-slate-700 mb-2">المبيعات والربح</h4>
            <CompareMetricRow label="صافي المبيعات" aVal={a.net_sales} bVal={b.net_sales} fmt="currency" />
            <CompareMetricRow label="إجمالي الربح" aVal={a.gross_profit} bVal={b.gross_profit} fmt="currency" />
            <CompareMetricRow label="هامش الربح" aVal={a.margin_percent} bVal={b.margin_percent} fmt="percent" points />
          </div>

          {/* Volume & basket */}
          <div className="rounded-[16px] bg-white border border-slate-200 p-4">
            <h4 className="text-[12px] font-black text-slate-700 mb-2">الحجم ومتوسط الفاتورة</h4>
            <CompareMetricRow label="عدد الفواتير" aVal={a.invoice_count} bVal={b.invoice_count} fmt="number" />
            <CompareMetricRow label="الوحدات المباعة" aVal={a.items_sold} bVal={b.items_sold} fmt="number" />
            <CompareMetricRow label="متوسط الفاتورة" aVal={a.avg_basket} bVal={b.avg_basket} fmt="currency" />
          </div>

          {/* Returns & discounts */}
          <div className="rounded-[16px] bg-white border border-slate-200 p-4">
            <h4 className="text-[12px] font-black text-slate-700 mb-2">المرتجعات والخصومات</h4>
            <CompareMetricRow label="نسبة المرتجعات" aVal={a.return_rate} bVal={b.return_rate} fmt="percent" inverse points />
            <CompareMetricRow label="قيمة المرتجعات" aVal={a.returns_total} bVal={b.returns_total} fmt="currency" inverse />
            <CompareMetricRow label="إجمالي الخصومات" aVal={a.total_discount} bVal={b.total_discount} fmt="currency" inverse />
          </div>

          {/* Top mover */}
          <div className="rounded-[16px] bg-white border border-slate-200 p-4">
            <h4 className="text-[12px] font-black text-slate-700 mb-2">الأبرز في كل فترة</h4>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <div className="text-[10px] font-bold text-slate-400 mb-1">الأولى</div>
                <div className="text-[13px] font-black text-slate-800 truncate">{a.top_item?.name || "—"}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">أعلى فئة: {a.top_category?.name || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-indigo-500 mb-1">الثانية</div>
                <div className="text-[13px] font-black text-slate-900 truncate">{b.top_item?.name || "—"}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">أعلى فئة: {b.top_category?.name || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------

function BentoMetric({ title, value, icon: Icon, theme = "default", trend, hint }) {
  const THEMES = {
    default: "bg-white border-white text-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.03)]",
    dark: "bg-slate-900 border-slate-800 text-white shadow-[0_8px_30px_rgba(15,23,42,0.6)]",
    alert: "bg-red-50 border-red-100 text-red-900 shadow-[0_4px_20px_rgba(0,0,0,0.02)]",
  };

  const currentTheme = THEMES[theme] || THEMES.default;
  const isDark = theme === "dark";

  return (
    <div className={`relative overflow-hidden rounded-[24px] border p-5 transition-all hover:scale-[1.02] hover:shadow-lg duration-300 group cursor-default ${currentTheme}`}>
      {hint && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden w-56 rounded-lg bg-slate-800 p-3 text-[11px] font-bold text-white shadow-xl leading-relaxed group-hover:block pointer-events-none">
          {hint}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 h-2 w-2 rotate-45 bg-slate-800" />
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10 text-white' : theme === 'alert' ? 'bg-red-100/50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
           <Icon className="w-5 h-5" />
        </div>
        <div>
           <div className={`flex items-center gap-1.5 text-2sm font-bold mb-1 ${isDark ? 'text-slate-400' : theme === 'alert' ? 'text-red-700/70' : 'text-slate-500'}`}>
             {title}
             {hint && <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
           </div>
           <div className={`text-[20px] lg:text-[22px] font-black tracking-tight leading-none ${isDark ? 'text-white' : theme === 'alert' ? 'text-red-900' : 'text-slate-900'}`}>
             {value}
           </div>
        </div>
      </div>
      {trend && (
         <div className={`absolute top-5 left-5 w-2 h-2 rounded-full ${trend === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`} />
      )}
    </div>
  );
}
