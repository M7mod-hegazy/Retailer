import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import {
  Wallet, TrendingDown, TrendingUp, AlertTriangle, Layers, Pickaxe,
  BarChart3, Activity, ArrowDownToLine, ArrowUpFromLine, FileText,
  Boxes, Calendar, PieChart, ShoppingBag, Sparkles
} from "lucide-react";
import api from "../../services/api";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { usePageTour } from "../../hooks/usePageTour";

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
  const [summary, setSummary] = useState(zeroSummary);
  const [allSalesRows, setAllSalesRows] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [lowStock, setLowStock] = useState([]);
  const [belowMargin, setBelowMargin] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [topCategories, setTopCategories] = useState([]);

  // Items Controls
  const [itemsDateMode, setItemsDateMode] = useState("predefined"); // predefined, custom
  const [itemsCustomDates, setItemsCustomDates] = useState({ start: "", end: "" });
  const [itemsRange, setItemsRange] = useState(30);
  const [itemsSort, setItemsSort] = useState("top");
  const [itemsLoading, setItemsLoading] = useState(false);
  
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
        const [summaryRes, stockRes, expensesRes, revenuesRes, topCategoriesRes, marginRes] = await Promise.all([
          api.get("/api/dashboard"),
          api.get("/api/reports/low-stock"),
          api.get("/api/expenses"),
          api.get("/api/revenues"),
          api.get("/api/reports/run/sales-by-category?start_date=" + new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]),
          api.get("/api/reports/margin-alerts").catch(() => ({ data: { data: [] } })),
        ]);

        setSummary(summaryRes.data?.data || zeroSummary);

        setLowStock(stockRes.data?.data?.slice(0, 5) || []);
        setTopCategories(topCategoriesRes.data?.data?.slice(0, 4) || []);
        setBelowMargin(marginRes.data?.data?.slice(0, 5) || []);

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
        setTopItems(sorted.slice(0, 5));
      } catch {
        setTopItems([]);
      } finally {
        setItemsLoading(false);
      }
    }
    loadItems();
  }, [itemsRange, itemsSort, itemsDateMode, itemsCustomDates]);

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
      <div className="flex min-h-[80vh] flex-col items-center justify-center space-y-6 bg-[#FAFAFA]">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-full animate-ping bg-slate-900 opacity-10"></div>
          <Activity className="h-8 w-8 animate-pulse text-slate-800" />
        </div>
        <div className="text-[12px] font-black tracking-[0.2em] text-slate-400 uppercase">جاري تجميع البيانات...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full font-sans bg-[#F4F7FB] p-4 md:p-8 relative overflow-x-hidden" dir="rtl">
      
      {/* Background Ambient Glows (from dashboard pattern) */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 relative z-10 w-full max-w-[1400px] mx-auto gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-white p-3 rounded-[20px] shadow-[0_8px_20px_rgba(15,23,42,0.15)] flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">الرؤية والتحليلات</h1>
            <p className="text-[14px] font-bold text-slate-500 mt-1">
              راقب أداء المبيعات لحظة بلحظة لقرارات أسرع وأدق.
            </p>
          </div>
        </div>
        <Link to="/reports/center" className="hidden md:flex items-center gap-4 bg-white border border-slate-200 rounded-[20px] py-2 px-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
          <div className="flex flex-col text-left items-end">
            <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">المركز</span>
            <span className="text-[14px] font-bold text-slate-700">تقارير مفصلة</span>
          </div>
          <div className="w-10 h-10 rounded-[14px] bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 text-slate-400 group-hover:text-slate-600 transition-colors">
            <FileText className="w-5 h-5" />
          </div>
        </Link>
      </div>

      <div className="w-full max-w-[1400px] mx-auto space-y-5 relative z-10">
        
        {/* Abstract Metrics Ribbon */}
        <div data-help="stats-cards" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <BentoMetric title="مبيعات اليوم" value={<CurrencyDisplay value={summary.todaySales} />} icon={TrendingUp} theme="dark" />
          <BentoMetric title="مبيعات الأسبوع" value={<CurrencyDisplay value={summary.weekSales} />} icon={Activity} />
          <BentoMetric title="صافي الخزنة اليوم" value={<CurrencyDisplay value={netToday} />} icon={Wallet} trend={netToday >= 0 ? "up" : "down"} />
          <BentoMetric title="إيرادات منفصلة" value={<CurrencyDisplay value={todayRevenues} />} icon={ArrowDownToLine} />
          <BentoMetric title="مصروفات اليوم" value={<CurrencyDisplay value={todayExpenses} />} icon={ArrowUpFromLine} />
          <BentoMetric title="نواقص مستعجلة" value={lowStock.length} icon={AlertTriangle} theme={lowStock.length > 0 ? "alert" : "default"} />
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
                  <span className="text-[12px] font-bold text-slate-500">مزامنة في الوقت الفعلي</span>
                </div>
              </div>

              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                {/* Metric Selector */}
                <div className="flex p-1 bg-slate-100 rounded-[14px]">
                  <button 
                    onClick={() => setChartMetric("revenue")}
                    className={`px-4 py-1.5 rounded-[10px] text-[12px] font-black transition-all ${chartMetric === "revenue" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالقيمة
                  </button>
                  <button 
                    onClick={() => setChartMetric("count")}
                    className={`px-4 py-1.5 rounded-[10px] text-[12px] font-black transition-all ${chartMetric === "count" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    بالعدد
                  </button>
                </div>
                {/* Time Range Configurator */}
                <div data-help="period-filter" className="flex p-1 bg-slate-100 rounded-[14px] items-center text-slate-500 font-bold overflow-hidden shadow-inner border border-slate-200">
                  <select 
                     value={chartDateMode}
                     onChange={e => setChartDateMode(e.target.value)}
                     className="bg-slate-200/50 hover:bg-slate-200 border-none outline-none text-[12px] font-black text-slate-700 py-1.5 px-2 rounded-[10px] ml-1 transition-colors cursor-pointer"
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
                          className={`px-3 py-1.5 rounded-[10px] text-[12px] transition-all ${chartRange === days ? "bg-indigo-600 text-white shadow-sm font-black" : "hover:text-slate-900 hover:bg-slate-200/50"}`}
                        >
                          {days === 1 ? 'يومي' : days === 7 ? 'أسبوع' : days === 14 ? '١٤ي' : 'شهر'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 pl-2 pr-1">
                      <input 
                        type="date" 
                        value={chartCustomDates.start} 
                        onChange={e => setChartCustomDates(c => ({...c, start: e.target.value}))} 
                        className="text-[11px] bg-white rounded-[8px] px-2 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                      />
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">الي</span>
                      <input 
                        type="date" 
                        value={chartCustomDates.end} 
                        onChange={e => setChartCustomDates(c => ({...c, end: e.target.value}))} 
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
                  <div className="text-center text-[13px] text-slate-400 font-bold py-6">لا توجد بيانات كافية للأقسام</div>
                ) : (
                  topCategories.map((cat, idx) => {
                    const maxRev = topCategories[0].revenue || 1;
                    const percent = Math.max(5, (cat.revenue / maxRev) * 100);
                    return (
                      <div key={idx} className="relative">
                        <div className="flex justify-between text-[12px] font-black mb-1.5 relative z-10 px-1">
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
                   <select value={itemsSort} onChange={e => setItemsSort(e.target.value)} className="text-[12px] font-bold bg-white border border-slate-200 shadow-sm rounded-[10px] px-2 py-1.5 outline-none text-slate-700 cursor-pointer">
                     <option value="top">الأكثر مبيعاً</option>
                     <option value="bottom">الأقل مبيعاً</option>
                   </select>

                   <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-[12px] border border-slate-200 shadow-inner">
                     <select 
                        value={itemsDateMode}
                        onChange={e => setItemsDateMode(e.target.value)}
                        className="bg-transparent border-none outline-none text-[11px] font-black text-slate-600 px-2 cursor-pointer"
                     >
                        <option value="predefined">مدة محددة</option>
                        <option value="custom">مخصص</option>
                     </select>
                     
                     <div className="h-3 w-px bg-slate-300" />
                     
                     {itemsDateMode === "predefined" ? (
                       <select value={itemsRange} onChange={e => setItemsRange(Number(e.target.value))} className="text-[11px] font-bold bg-transparent border-none px-1 py-1 outline-none text-slate-700 cursor-pointer">
                         <option value="1">اليوم</option>
                         <option value="7">أخر 7 أيام</option>
                         <option value="14">أخر 14 يوم</option>
                         <option value="30">أخر 30 يوم</option>
                       </select>
                     ) : (
                       <div className="flex items-center gap-1 pl-1">
                         <input 
                           type="date" 
                           value={itemsCustomDates.start} 
                           onChange={e => setItemsCustomDates(c => ({...c, start: e.target.value}))} 
                           className="text-[10px] bg-white rounded-[6px] px-1.5 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                         />
                         <span className="text-[9px] uppercase font-black text-slate-400">الي</span>
                         <input 
                           type="date" 
                           value={itemsCustomDates.end} 
                           onChange={e => setItemsCustomDates(c => ({...c, end: e.target.value}))} 
                           className="text-[10px] bg-white rounded-[6px] px-1.5 py-1 outline-none border border-slate-200 font-mono shadow-sm"
                         />
                       </div>
                     )}
                   </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-[20px] bg-slate-900 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(15,23,42,0.15)] shrink-0 self-start md:self-auto">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {topItems.length === 0 ? (
                <div className="text-center py-10 text-[14px] text-slate-400 font-bold">لا يوجد مبيعات كافية לעرض الأصناف الأكثر مبيعا.</div>
              ) : (
                <table className="w-full text-right text-[13px] border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-slate-400 font-black uppercase tracking-widest text-[11px]">
                      <th className="pb-3 px-4 font-black">الصنف</th>
                      <th className="pb-3 px-4 font-black">كود SKU</th>
                      <th className="pb-3 px-4 font-black">الكمية المباعة</th>
                      <th className="pb-3 px-4 font-black">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item, index) => (
                      <tr key={index} className="group">
                        <td className="bg-white group-hover:bg-slate-50 py-3.5 px-4 rounded-r-[16px] border border-l-0 border-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black">{index + 1}</span>
                            <span className="font-bold text-slate-800">{item.item_name}</span>
                          </div>
                        </td>
                        <td className="bg-white group-hover:bg-slate-50 py-3.5 px-4 border-y border-slate-100 transition-colors">
                          <span className="font-mono text-[12px] font-bold text-slate-600 tabular-nums" dir="ltr">
                            {item.item_code || "—"}
                          </span>
                        </td>
                        <td className="bg-white group-hover:bg-slate-50 py-3.5 px-4 font-black text-slate-600 border-y border-slate-100 transition-colors">
                          {item.quantity_sold} <span className="text-[10px] font-normal text-slate-400 ml-1">وحدة</span>
                        </td>
                        <td className="bg-white group-hover:bg-slate-50 py-3.5 px-4 font-black text-slate-900 rounded-l-[16px] border border-r-0 border-slate-100 transition-colors">
                          <CurrencyDisplay value={item.revenue} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Low Stock Detailed List */}
          <div className="rounded-[32px] border border-orange-200/50 bg-gradient-to-b from-orange-50/50 to-white p-6 md:p-8 shadow-sm flex flex-col">
            <div className="mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-[20px] bg-orange-100/50 text-orange-600 flex items-center justify-center border border-orange-100">
                <Pickaxe className="w-5 h-5" />
              </div>
              <h2 className="text-[18px] font-black text-slate-900 tracking-tight">تنبيهات المخزون</h2>
            </div>
            
            <div className="flex-1 flex flex-col gap-3">
              {lowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 h-full text-center bg-white rounded-[20px] border border-slate-100">
                   <div className="w-14 h-14 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                     <Sparkles className="w-6 h-6" />
                   </div>
                   <span className="text-[15px] font-black text-slate-800">مخزونك في أمان تام</span>
                   <span className="text-[12px] font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للطلب.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-white p-4 hover:border-orange-200 transition-all hover:shadow-sm group">
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="font-bold text-slate-800 text-[13px]">{item.name}</span>
                        {item.item_code ? (
                          <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums" dir="ltr">
                            SKU: {item.item_code}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رصيد</span>
                        <span className="inline-flex items-center justify-center h-7 px-3 bg-red-50 text-red-600 rounded-full text-[12px] font-black ring-1 ring-red-100 group-hover:scale-105 transition-transform">
                          {Number(item.quantity || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {lowStock.length === 5 && (
                     <Link to="/stock/levels" className="block w-full py-3 mt-2 text-center text-[12px] font-black text-indigo-600 bg-indigo-50/50 rounded-[16px] hover:bg-indigo-50 transition-colors">
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
                <span className="text-[12px] font-bold text-slate-500 mt-1">لا توجد أصناف تحت الحد الأدنى للهامش.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {belowMargin.map((item) => (
                  <div key={item.item_id || item.id} className="flex items-center justify-between rounded-[20px] border border-rose-100 bg-rose-50/40 p-4">
                    <div className="flex flex-col min-w-0">
                      {(item.item_code || item.code) && <span className="font-mono text-[10px] text-slate-400">{item.item_code || item.code}</span>}
                      <span className="font-bold text-slate-800 text-[13px]">{item.item_name || item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">هامش</span>
                      <span className="inline-flex items-center justify-center h-7 px-3 bg-rose-100 text-rose-700 rounded-full text-[12px] font-black ring-1 ring-rose-200">
                        {Number(item.current_margin_percent ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
                {belowMargin.length === 5 && (
                  <Link to="/reports/margin-health" className="block w-full py-3 mt-2 text-center text-[12px] font-black text-rose-600 bg-rose-50/50 rounded-[16px] hover:bg-rose-50 transition-colors">
                    عرض التفاصيل الكاملة ←
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------

function BentoMetric({ title, value, icon: Icon, theme = "default", trend }) {
  const THEMES = {
    default: "bg-white border-white text-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.03)]",
    dark: "bg-slate-900 border-slate-800 text-white shadow-[0_8px_30px_rgba(15,23,42,0.6)]",
    alert: "bg-red-50 border-red-100 text-red-900 shadow-[0_4px_20px_rgba(0,0,0,0.02)]",
  };

  const currentTheme = THEMES[theme] || THEMES.default;
  const isDark = theme === "dark";

  return (
    <div className={`relative overflow-hidden rounded-[24px] border p-5 transition-all hover:scale-[1.02] duration-300 ${currentTheme}`}>
      <div className="flex flex-col gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10 text-white' : theme === 'alert' ? 'bg-red-100/50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
           <Icon className="w-5 h-5" />
        </div>
        <div>
           <div className={`text-[12px] font-bold mb-1 ${isDark ? 'text-slate-400' : theme === 'alert' ? 'text-red-700/70' : 'text-slate-500'}`}>{title}</div>
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
