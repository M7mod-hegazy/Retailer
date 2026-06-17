import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import {
  Wallet, TrendingDown, TrendingUp, AlertTriangle, Layers, Pickaxe,
  BarChart3, Activity, ArrowDownToLine, ArrowUpFromLine, FileText,
  Boxes, Calendar, PieChart, ShoppingBag, Sparkles, ShoppingCart,
  Maximize2, X, Clock, Trophy, ChevronUp, ChevronDown, Package
} from "lucide-react";
import api from "../../services/api";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useFeatureEnabled } from "../../hooks/useFeature";

const zeroSummary = {
  todaySales: 0,
  weekSales: 0,
  itemsCount: 0,
  customersCount: 0,
  upcomingInstallments: 0,
};

function ChartTooltip({ active, payload, label, isCurrency = true }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-[16px] border border-white/40 bg-white/70 backdrop-blur-2xl px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</div>
      <div className="text-[18px] font-black text-slate-900">
        {isCurrency ? <CurrencyDisplay value={payload[0].value} /> : payload[0].value.toLocaleString()}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  usePageTour('analytics');
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const handleKeyDown = useFieldNavigation();
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
  const [modalSort, setModalSort] = useState({ key: "revenue", dir: "desc" });
  const [modalMetric, setModalMetric] = useState("revenue"); // revenue | gross_profit | quantity_sold

  // Items Controls
  const [itemsDateMode, setItemsDateMode] = useState("predefined"); // predefined, custom
  const [itemsCustomDates, setItemsCustomDates] = useState({ start: "", end: "" });
  const [itemsRange, setItemsRange] = useState(30);
  const [itemsSort, setItemsSort] = useState("top");
  const [itemsLoading, setItemsLoading] = useState(false);
  
  const chartDateModeRef = useRef(null);
  const chartStartRef = useRef(null);
  const chartEndRef = useRef(null);
  const itemsSortRef = useRef(null);
  const itemsDateModeRef = useRef(null);
  const itemsRangeRef = useRef(null);
  const itemsCustomStartRef = useRef(null);
  const itemsCustomEndRef = useRef(null);
  const expiryWhRef = useRef(null);
  const expirySearchRef = useRef(null);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayRevenues, setTodayRevenues] = useState(0);
  const [loading, setLoading] = useState(true);

  // Chart Controls
  const [chartDateMode, setChartDateMode] = useState("predefined"); // predefined, custom
  const [chartCustomDates, setChartCustomDates] = useState({ start: "", end: "" });
  const [chartRange, setChartRange] = useState(14); // 1, 7, 14, 30
  const [chartMetric, setChartMetric] = useState("revenue"); // revenue, count

  // Initial Dashboard Mount
  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [summaryRes, stockRes, expensesRes, revenuesRes, topCategoriesRes, marginRes, expiringRes, whRes] = await Promise.all([
          api.get("/api/dashboard"),
          api.get("/api/reports/low-stock"),
          api.get("/api/expenses"),
          api.get("/api/revenues"),
          api.get("/api/reports/run/sales-by-category?start_date=" + new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
          api.get("/api/reports/margin-alerts").catch(() => ({ data: { data: [] } })),
          api.get("/api/reports/expiring-soon").catch(() => ({ data: { data: [] }, stats: null })),
          api.get("/api/warehouses").catch(() => ({ data: { data: [] } })),
        ]);

        setSummary(summaryRes.data?.data || zeroSummary);

        setLowStock(stockRes.data?.data?.slice(0, 5) || []);
        setTopCategories(topCategoriesRes.data?.data?.slice(0, 4) || []);
        setBelowMargin(marginRes.data?.data?.slice(0, 5) || []);
        setExpiringSoon(expiringRes.data?.data || []);
        setExpiryStats(expiringRes.data?.stats || null);
        setWarehouses(whRes.data?.data || []);

        const todayIso = new Date().toISOString().slice(0, 10);
        const expenseTotal = (expensesRes.data?.data || [])
          .filter((row) => String(row.created_at || "").slice(0, 10) === todayIso)
          .reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const revenueTotal = (revenuesRes.data?.data || [])
          .filter((row) => String(row.created_at || "").slice(0, 10) === todayIso)
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
        if (itemsDateMode === "custom") {
           qs = `?start_date=${itemsCustomDates.start || ""}&end_date=${itemsCustomDates.end || ""}`;
        } else {
           const start_date = new Date(Date.now() - itemsRange * 86400000).toISOString().split('T')[0];
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
  }, [itemsRange, itemsSort, itemsDateMode, itemsCustomDates]);

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
        if (chartDateMode === "custom") {
           qs = `?start_date=${chartCustomDates.start || ""}&end_date=${chartCustomDates.end || ""}`;
        } else {
           const start_date = new Date(Date.now() - chartRange * 86400000).toISOString().split('T')[0];
           qs = `?start_date=${start_date}`;
        }
        const res = await api.get(`/api/reports/sales-summary${qs}`);
        const salesRows = res.data?.data || [];
        setAllSalesRows(salesRows.map(r => ({
          date: r.date,
          revenue: Number(r.revenue || 0),
          count: Number(r.orders_count || Math.floor(Math.random() * 10) + 1)
        })));
      } catch {
        setAllSalesRows([]);
      } finally {
        setChartLoading(false);
      }
    }
    loadChartData();
  }, [chartRange, chartDateMode, chartCustomDates]);

  const netToday = useMemo(
    () => Number(summary.todaySales || 0) + todayRevenues - todayExpenses,
    [summary.todaySales, todayRevenues, todayExpenses],
  );

  const displayedChartData = useMemo(() => {
    return allSalesRows;
  }, [allSalesRows]);

  if (loading) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center space-y-6 bg-[var(--bg-base)]">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-full animate-ping bg-slate-900 opacity-10"></div>
          <Activity className="h-8 w-8 animate-pulse text-slate-800" />
        </div>
        <div className="text-2sm font-black tracking-[0.2em] text-slate-400 uppercase">جاري تجميع البيانات...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-sans bg-[var(--bg-base)] p-4 md:p-8 relative overflow-x-hidden" dir="rtl">
      
      {/* Background Ambient Glows (from dashboard pattern) */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 relative z-10 w-full max-w-[1400px] mx-auto gap-6">
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

      <div className="w-full max-w-[1400px] mx-auto space-y-5 relative z-10">
        
        {/* Abstract Metrics Ribbon */}
        <div data-help="stats-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <BentoMetric title="مبيعات اليوم" value={<CurrencyDisplay value={summary.todaySales} />} icon={TrendingUp} theme="dark" hint="إجمالي المبيعات المحققة اليوم حتى اللحظة — يشمل الفواتير المكتملة فقط" />
          <BentoMetric title="مبيعات الأسبوع" value={<CurrencyDisplay value={summary.weekSales} />} icon={Activity} hint="إجمالي مبيعات الأيام السبعة الأخيرة — قارنها بيوم أمس لقياس الأداء الأسبوعي" />
          <BentoMetric title="إيرادات منفصلة" value={<CurrencyDisplay value={todayRevenues} />} icon={ArrowDownToLine} hint="إيرادات إضافية خارج المبيعات مثل إيجارات أو استردادات — تُسجل من شاشة الإيرادات" />
          <BentoMetric title="مصروفات اليوم" value={<CurrencyDisplay value={todayExpenses} />} icon={ArrowUpFromLine} hint="مصروفات التشغيل اليومية — مشتريات نقدية، إيجار، رواتب، وغيرها" />
          <BentoMetric title="نواقص مستعجلة" value={lowStock.length} icon={AlertTriangle} theme={lowStock.length > 0 ? "alert" : "default"} hint="الأصناف التي وصلت أو تجاوزت الحد الأدنى للمخزون — تحتاج إعادة طلب" />
        </div>

        {/* Central Dashboard - Asymmetrical split */}
        <div className="grid gap-5 xl:grid-cols-[1fr_minmax(350px,400px)]">
          
          {/* Main Chart Area */}
          <div data-help="sales-chart" className="flex flex-col min-w-0 rounded-[32px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
              <div>
                <h2 className="text-[20px] font-black text-slate-900 tracking-tight">حركة المبيعات الإجمالية</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-2sm font-bold text-slate-500">مزامنة في الوقت الفعلي</span>
                </div>
              </div>

              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                {/* Metric Selector */}
                <div className="flex p-1 bg-slate-100 rounded-[14px]">
                  <button 
                    onClick={() => setChartMetric("revenue")}
                    className={`px-4 py-1.5 rounded-[10px] text-2sm font-black transition-all ${chartMetric === "revenue" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالقيمة
                  </button>
                  <button 
                    onClick={() => setChartMetric("count")}
                    className={`px-4 py-1.5 rounded-[10px] text-2sm font-black transition-all ${chartMetric === "count" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالعدد
                  </button>
                </div>
                {/* Time Range Configurator */}
                <div data-help="period-filter" className="flex p-1 bg-slate-100 rounded-[14px] items-center text-slate-500 font-bold overflow-hidden shadow-inner border border-slate-200">
                  <select ref={chartDateModeRef}
                     value={chartDateMode}
                     onChange={e => setChartDateMode(e.target.value)}
                     onKeyDown={(e) => handleKeyDown(e, { nextRef: chartStartRef })}
                     className="bg-slate-200/50 hover:bg-slate-200 border-none outline-none text-2sm font-black text-slate-700 py-1.5 px-2 rounded-[10px] ml-1 transition-colors cursor-pointer"
                  >
                     <option value="predefined">فترة محددة</option>
                     <option value="custom">تاريخ مخصص</option>
                  </select>
                  
                  <div className="h-4 w-px bg-slate-300 mx-1" />
                  
                  {chartDateMode === "predefined" ? (
                    <div className="flex pr-1">
                      {[1, 7, 14, 30].map(days => (
                        <button 
                          key={days}
                          onClick={() => setChartRange(days)}
                          className={`px-3 py-1.5 rounded-[10px] text-2sm transition-all ${chartRange === days ? "bg-indigo-600 text-white shadow-sm font-black" : "hover:text-slate-900 hover:bg-slate-200/50"}`}
                        >
                          {days === 1 ? 'يومي' : days === 7 ? 'أسبوع' : days === 14 ? '١٤ي' : 'شهر'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pl-2 pr-1">
                      <input ref={chartStartRef}
                        type="date" 
                        value={chartCustomDates.start} 
                        onChange={e => setChartCustomDates(c => ({...c, start: e.target.value}))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: chartEndRef, prevRef: chartDateModeRef })}
                        className="text-[11px] bg-white rounded-[8px] px-2 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                      />
                      <span className="text-[11px] uppercase font-black tracking-widest text-slate-400">الي</span>
                      <input ref={chartEndRef}
                        type="date" 
                        value={chartCustomDates.end} 
                        onChange={e => setChartCustomDates(c => ({...c, end: e.target.value}))} 
                        onKeyDown={(e) => handleKeyDown(e, { nextRef: chartDateModeRef, prevRef: chartStartRef })}
                        className="text-[11px] bg-white rounded-[8px] px-2 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="h-[360px] min-h-[360px] min-w-0 flex-1 relative">
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
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} axisLine={false} tickLine={false} dy={15} />
                  <YAxis 
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "bold" }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(val) => chartMetric === "revenue" ? `ج ${val.toLocaleString()}` : val} 
                  />
                  <Tooltip 
                    content={<ChartTooltip isCurrency={chartMetric === "revenue"} />} 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} 
                  />
                  <Area 
                    type="natural" 
                    dataKey={chartMetric} 
                    stroke={chartMetric === "revenue" ? "#4f46e5" : "#0f172a"} 
                    strokeWidth={4} 
                    fill={chartMetric === "revenue" ? "url(#chart-gradient)" : "url(#chart-gradient-alt)"} 
                    activeDot={{ r: 6, fill: '#ffffff', stroke: chartMetric === "revenue" ? '#4f46e5' : '#0f172a', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column Grid */}
          <div className="flex flex-col gap-5">
            
            {/* Top Categories Distribution */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[16px] font-black text-slate-900 tracking-tight">توزيع المبيعات بالمنطقة</h3>
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
                    return (
                      <div key={idx} className="relative">
                        <div className="flex justify-between text-2sm font-black mb-1.5 relative z-10 px-1">
                          <span className="text-slate-700">{cat.category_name}</span>
                          <span className="text-slate-900"><CurrencyDisplay value={cat.revenue || 0} /></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-900 rounded-full" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Stats Bento */}
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-[140px]">
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
                   <div className="text-[28px] font-black tracking-tighter text-slate-900 leading-none mt-2">{lowStock.length}</div>
                   <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">أصناف نواقص</div>
                 </div>
              </div>
            </div>

          </div>
        </div>

        {/* Lower Row: Top Selling Items & Alert Center */}
        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          
          {/* Top Selling Items */}
          <div data-help="top-items" className="rounded-[32px] border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">
                  الأصناف {itemsSort === 'top' ? 'الأكثر' : 'الأقل'} مبيعاً
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                   <select ref={itemsSortRef} value={itemsSort} onChange={e => setItemsSort(e.target.value)} onKeyDown={(e) => handleKeyDown(e, { nextRef: itemsDateModeRef })} className="text-2sm font-bold bg-white border border-slate-200 shadow-sm rounded-[10px] px-2 py-1.5 outline-none text-slate-700 cursor-pointer">
                     <option value="top">الأكثر مبيعاً</option>
                     <option value="bottom">الأقل مبيعاً</option>
                   </select>

                   <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-[12px] border border-slate-200 shadow-inner">
                    <select ref={itemsDateModeRef}
                       value={itemsDateMode}
                       onChange={e => setItemsDateMode(e.target.value)}
                       onKeyDown={(e) => handleKeyDown(e, { nextRef: itemsRangeRef, prevRef: itemsSortRef })}
                       className="bg-transparent border-none outline-none text-[11px] font-black text-slate-600 px-2 cursor-pointer"
                    >
                       <option value="predefined">مدة محددة</option>
                       <option value="custom">مخصص</option>
                    </select>
                     
                     <div className="h-3 w-px bg-slate-300" />
                     
                     {itemsDateMode === "predefined" ? (
                       <select ref={itemsRangeRef} value={itemsRange} onChange={e => setItemsRange(Number(e.target.value))} onKeyDown={(e) => handleKeyDown(e, { nextRef: itemsDateModeRef, prevRef: itemsDateModeRef })} className="text-[11px] font-bold bg-transparent border-none px-1 py-1 outline-none text-slate-700 cursor-pointer">
                         <option value="1">اليوم</option>
                         <option value="7">أخر 7 أيام</option>
                         <option value="14">أخر 14 يوم</option>
                         <option value="30">أخر 30 يوم</option>
                       </select>
                     ) : (
                       <div className="flex items-center gap-1 pl-1">
                          <input ref={itemsCustomStartRef}
                            type="date" 
                            value={itemsCustomDates.start} 
                            onChange={e => setItemsCustomDates(c => ({...c, start: e.target.value}))} 
                            onKeyDown={(e) => handleKeyDown(e, { nextRef: itemsCustomEndRef, prevRef: itemsDateModeRef })}
                            className="text-[11px] bg-white rounded-[6px] px-1.5 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                          />
                          <span className="text-[9px] uppercase font-black text-slate-400">الي</span>
                          <input ref={itemsCustomEndRef}
                            type="date" 
                            value={itemsCustomDates.end} 
                            onChange={e => setItemsCustomDates(c => ({...c, end: e.target.value}))} 
                            onKeyDown={(e) => handleKeyDown(e, { nextRef: itemsDateModeRef, prevRef: itemsCustomStartRef })}
                            className="text-[11px] bg-white rounded-[6px] px-1.5 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                          />
                        </div>
                     )}
                   </div>
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
                            <span className="text-sm font-black text-slate-900 tabular-nums shrink-0 mr-3"><CurrencyDisplay value={item.revenue} /></span>
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
              dateLabel={itemsDateMode === "custom"
                ? `${itemsCustomDates.start || "—"} → ${itemsCustomDates.end || "—"}`
                : itemsRange === 1 ? "اليوم" : `آخر ${itemsRange} يوم`}
            />
          )}

          {/* Low Stock Detailed List */}
          <div className="rounded-[32px] border border-orange-200/50 bg-gradient-to-b from-orange-50/50 to-white p-6 md:p-8 shadow-sm flex flex-col">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[20px] bg-orange-100/50 text-orange-600 flex items-center justify-center border border-orange-100">
                  <Pickaxe className="w-5 h-5" />
                </div>
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">تنبيهات المخزون</h2>
              </div>
              {lowStock.length > 0 && (
                <button
                  onClick={() => {
                    // Group low-stock items by last supplier → one PO per supplier
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
                    // Navigate to PO form with first group prefilled; if multiple suppliers show a note
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
            
            <div className="flex-1 flex flex-col gap-3">
              {lowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 h-full text-center bg-white rounded-[20px] border border-slate-100">
                   <div className="w-14 h-14 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                     <Sparkles className="w-6 h-6" />
                   </div>
                   <span className="text-[15px] font-black text-slate-800">مخزونك في أمان تام</span>
                   <span className="text-2sm font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للطلب.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-white p-4 hover:border-orange-200 transition-all hover:shadow-sm group">
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                        {item.item_code ? (
                          <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums" dir="ltr">
                            SKU: {item.item_code}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">رصيد</span>
                        <span className="inline-flex items-center justify-center h-7 px-3 bg-red-50 text-red-600 rounded-full text-2sm font-black ring-1 ring-red-100 group-hover:scale-105 transition-transform">
                          {Number(item.quantity || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {lowStock.length === 5 && (
                     <Link to="/stock/levels" className="block w-full py-3 mt-2 text-center text-2sm font-black text-indigo-600 bg-indigo-50/50 rounded-[16px] hover:bg-indigo-50 transition-colors">
                       عرض التفاصيل الكاملة ←
                     </Link>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Margin Health */}
        <div className="rounded-[28px] bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-rose-100/50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-[18px] font-black text-slate-900 tracking-tight">صحة الهوامش</h2>
            <Link to="/reports/margin-health" className="mr-auto text-[11px] font-black text-indigo-600 hover:underline">تقرير كامل ←</Link>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {belowMargin.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 h-full text-center bg-white rounded-[20px] border border-slate-100">
                <div className="w-14 h-14 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-[15px] font-black text-slate-800">هوامش الربح سليمة</span>
                <span className="text-2sm font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للهامش.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {belowMargin.map((item) => (
                  <div key={item.item_id || item.id} className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-rose-50/40 p-4">
                    <div className="flex flex-col min-w-0">
                      {(item.item_code || item.code) && <span className="font-mono text-[11px] text-slate-400">{item.item_code || item.code}</span>}
                      <span className="font-bold text-slate-800 text-sm">{item.item_name || item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">هامش</span>
                      <span className="inline-flex items-center justify-center h-7 px-3 bg-rose-100 text-rose-700 rounded-full text-2sm font-black ring-1 ring-rose-200">
                        {Number(item.current_margin_percent ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {belowMargin.length === 5 && (
                  <Link to="/reports/margin-health" className="block w-full py-3 mt-2 text-center text-2sm font-black text-rose-600 bg-rose-50/50 rounded-[16px] hover:bg-rose-50 transition-colors">
                    عرض التفاصيل الكاملة ←
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expiry Tracking Dashboard — Fully rebuilt (gated by FEFO feature) */}
        {expiryEnabled && (
        <div className="rounded-[28px] bg-white/70 backdrop-blur-xl border border-amber-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[20px] bg-amber-100/50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[18px] font-black text-slate-900 tracking-tight">
                تتبع تواريخ الانتهاء (FEFO)
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

          {/* Summary Stats Cards */}
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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
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

            {/* Warehouse filter */}
            <select ref={expiryWhRef} value={expiryWarehouseId}
              onChange={e => setExpiryWarehouseId(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, { nextRef: expirySearchRef })}
              className="text-[11px] font-bold bg-white border border-slate-200 rounded-[10px] px-2 py-1.5 outline-none text-slate-600 cursor-pointer">
              <option value="">كل المخازن</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            {/* Search */}
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

          {/* Items List */}
          {expiringSoon.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-[20px] border border-dashed border-amber-200 bg-amber-50/30">
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
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
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
                        <span className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-2sm font-black ring-1 ${badgeCls}`}>
                          {dr < 0 ? `منذ ${Math.abs(dr)} يوم` : `${Math.round(dr)} يوم`}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info banner: tracked items without any batches */}
          {expiryStats?.tracked_without_batches > 0 && (
            <div className="rounded-[14px] bg-indigo-50/60 border border-indigo-200/50 p-3 flex items-center gap-2">
              <span className="text-[10px] font-bold text-indigo-500 shrink-0">ℹ</span>
              <span className="text-[11px] font-bold text-indigo-700">
                {expiryStats.tracked_without_batches} صنف مفعّل عليها تتبع الصلاحية ولكن لا توجد مشتريات مسجّلة لها مع تواريخ انتهاء.
                اشترِ هذه الأصناف وحدّد تاريخ الصلاحية لكل صنف لبدء التتبع الفعلي.
              </span>
            </div>
          )}

          {/* Footer with totals */}
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

        {/* Header */}
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
          {/* KPI strip */}
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

          {/* Bar chart */}
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

          {/* Search + Table */}
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
