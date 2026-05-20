import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Play, Settings2, Filter, Trash2, CalendarDays, LayoutTemplate, Percent } from "lucide-react";
import { useReportsStore, buildPrefKey } from "../../stores/reportsStore";
import { CATEGORIES, SOURCES, SCOPE_OPTIONS, COST_METHODS, fmtDate, FORMAT_ICONS, FILTER_DIMENSIONS, CLASSIFICATIONS } from "./reportsCenterConfig";
import { RSelect, RDate, DatePresets, ScopeSelector, ColumnPreviewStrip, GhostPreviewRows, ColumnToggleList, ClassificationSelector, DataModeToggle, DimensionFilter } from "./reportsCenterParts";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";

const SOURCE_CAT_MAP = {
  sales: "sales",
  purchases: "purchases",
  "purchase-returns": "purchases",
  "sales-returns": "sales",
  suppliers: "accounts",
  customers: "accounts",
  employees: "audit",
  installments: "accounts",
  items: "inventory",
  warehouses: "inventory",
  expenses: "treasury",
  revenues: "treasury",
  treasury: "treasury",
  cheques: "treasury",
  "profit-loader": "sales",
  "net-profit": "accounts",
};

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
  "balance": "الرصيد",
  "status": "الحالة",
  "paid": "مدفوع",
  "unpaid": "غير مدفوع",
  "cancelled": "ملغي",
  "cash": "نقداً",
  "card": "بطاقة",
  "credit": "آجل",
  "wallet": "محفظة",
};

function clsLabel(cls) {
  return CLS_ARABIC[cls.label_key] || cls.label_key;
}

function clsOptionLabel(opt) {
  return CLS_ARABIC[opt.label_key] || opt.label_key;
}

export default function ReportsCenter() {
  usePageTour('reports');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const store = useReportsStore();
  const today = useMemo(() => new Date(), []);

  const defaultFrom = useMemo(() => fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultTo = useMemo(() => fmtDate(today), [today]);

  const classificationsBySource = CLASSIFICATIONS;

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  // Configurator State
  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const [scope, setScope] = useState({ type: "all", values: [] });
  const [colVisibility, setColVisibility] = useState({});
  const [presetName, setPresetName] = useState("");

  // Per-source classification/mode state (sidebar only)
  const [sourceState, setSourceState] = useState({});

  // Workspace-style filter state (dimension lookups, cost method)
  const [workspaceFilters, setWorkspaceFilters] = useState({});
  const [costMethod, setCostMethod] = useState("wacc");

  function handleWorkspaceFilter(key, value) {
    setWorkspaceFilters((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (SOURCES.length > 0 && !selectedId) setSelectedId(SOURCES[0].id);
  }, [selectedId]);

  const populatedCatIds = useMemo(() => new Set(SOURCES.map((s) => SOURCE_CAT_MAP[s.id]).filter(Boolean)), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = SOURCES;
    if (activeCat !== "all") rows = rows.filter((s) => SOURCE_CAT_MAP[s.id] === activeCat);
    if (onlyFavs) rows = rows.filter((s) => store.favorites.has(s.id));
    if (q) {
      rows = rows.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
    }
    return rows;
  }, [activeCat, store.favorites, onlyFavs, search]);

  const selectedSource = useMemo(() => filtered.find((s) => s.id === selectedId) || null, [filtered, selectedId]);

  function getDefaultClassification(sourceKey) {
    const classes = classificationsBySource[sourceKey];
    if (!classes || !classes.length) return null;
    return classes[0].id;
  }

  function getDefaultMode(sourceKey, classificationId) {
    const classes = classificationsBySource[sourceKey];
    const cls = classes?.find((c) => c.id === classificationId);
    if (!cls) return "detailed";
    return cls.availableModes.includes("detailed") ? "detailed" : cls.availableModes[0] || "detailed";
  }

  function handleRunSource(source) {
    if (!source) return;
    const state = sourceState[source.id] || {};
    const classification = state.classification || getDefaultClassification(source.id);
    const dataMode = state.dataMode || getDefaultMode(source.id, classification);
    if (!classification) return;
    const prefKey = buildPrefKey(source.id, classification, dataMode);
    store.pushRecent(prefKey);
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (scope.type !== "all" && scope.values?.[0]) {
      params.set("scope_type", scope.type);
      params.set("scope_value", scope.values[0]);
    }
    if (workspaceFilters.q) params.set("q", workspaceFilters.q);
    if (selectedClsDef?.hasProfit) params.set("cost_method", costMethod);
    const dimKeys = ["category_id","item_id","customer_id","supplier_id","user_id","warehouse_id","cashier_id","status","payment_type","movement_type","role"];
    dimKeys.forEach((k) => { if (workspaceFilters[k]) params.set(k, workspaceFilters[k]); });
    const qs = params.toString();
    navigate(`/reports/source/${source.id}/${classification}/${dataMode}${qs ? `?${qs}` : ""}`);
  }

  function toggleFav(e, sourceId) {
    e.stopPropagation();
    store.toggleFavorite(sourceId);
  }

  const selectedCategory = CATEGORIES.find((cat) => cat.id === SOURCE_CAT_MAP[selectedSource?.id]) || null;
  const invalidRange = dateRange.from > dateRange.to;

  const selectedClassifications = selectedSource ? (classificationsBySource[selectedSource.id] || []) : [];
  const selectedClsState = selectedSource ? (sourceState[selectedSource.id] || {}) : {};
  const selectedClassification = selectedClsState.classification || getDefaultClassification(selectedSource?.id) || "";
  const selectedMode = selectedClsState.dataMode || getDefaultMode(selectedSource?.id, selectedClassification);
  const selectedClsDef = selectedClassifications.find((c) => c.id === selectedClassification);
  const sourceCatId = SOURCE_CAT_MAP[selectedSource?.id] || "sales";
  const dimensions = useMemo(() => {
    if (!selectedClsDef?.dimensions || !selectedSource?.id) return [];
    const pool = FILTER_DIMENSIONS[selectedSource.id] || [];
    return selectedClsDef.dimensions.map((key) => pool.find((d) => d.key === key)).filter(Boolean);
  }, [selectedClsDef, selectedSource?.id]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fafafa] text-zinc-900" dir="rtl" style={{ fontFamily: "Satoshi, sans-serif" }}>
      
      {/* MIDDLE & TOP RAIL (Source Master Grid) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
        
        {/* TOP RAIL (Categories) */}
        <div className="shrink-0 border-b border-zinc-200 bg-white flex items-center px-6 py-3 gap-3 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4 mr-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-zinc-900 text-white">
              <LayoutTemplate size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-black text-zinc-900 ml-2">التقارير</span>
          </div>
          <button
            onClick={() => setActiveCat("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all font-bold text-[13px] whitespace-nowrap ${
              activeCat === "all" ? "bg-zinc-100 text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            الكل
          </button>
          {CATEGORIES.filter((cat) => populatedCatIds.has(cat.id)).map((cat) => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all duration-300 font-bold text-[13px] whitespace-nowrap ${
                  active ? "bg-white shadow-sm border border-zinc-200" : "hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700"
                }`}
                style={active ? { color: cat.color } : {}}
              >
                <cat.icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? "" : "group-hover:scale-110 transition-transform"} />
                {cat.label}
                {active && (
                  <motion.div layoutId="activeRailTop" className="absolute bottom-0 left-4 right-4 h-1 rounded-t-full" style={{ backgroundColor: cat.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Header / Search */}
        <div className="shrink-0 px-8 py-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">مركز التقارير</h1>
            <p className="text-sm font-medium text-zinc-500 mt-1">الاستعلامات والتحليلات البيانية الذكية</p>
          </div>
          <div className="flex items-center gap-3">
            <div data-help="search-bar" className="relative flex-1 group">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في مصادر التقارير..."
                className="w-full h-12 rounded-2xl border border-zinc-200 bg-white pl-4 pr-12 text-[14px] font-bold text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
              />
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-emerald-500" />
            </div>
            <button
              data-help="favorite-button"
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`flex h-12 items-center gap-2 rounded-2xl border px-5 text-[13px] font-bold transition-all shadow-sm ${
                onlyFavs ? "border-amber-400 bg-amber-50 text-amber-600" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              <Star size={16} fill={onlyFavs ? "currentColor" : "none"} /> المفضلة
            </button>
          </div>
        </div>

        {/* Grid */}
        <div data-help="main-table" className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-thin scrollbar-thumb-zinc-300">
          <div data-help="report-categories" className="max-w-4xl mx-auto w-full">
            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-4"><Search size={24} /></div>
                <h3 className="text-[16px] font-black text-zinc-900 mb-1">لا توجد مصادر مطابقة</h3>
                <p className="text-[13px] text-zinc-500">جرب البحث بكلمات أخرى أو تغيير الفئة.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-max items-start">
                {filtered.map((source) => {
                  const cat = CATEGORIES.find((c) => c.id === SOURCE_CAT_MAP[source.id]) || CATEGORIES[0];
                  const sel = selectedId === source.id;
                  const fav = store.favorites.has(source.id);
                  const classifications = classificationsBySource[source.id] || [];
                  const state = sourceState[source.id] || {};
                  const classification = state.classification || getDefaultClassification(source.id);
                  const clsDef = classifications.find((c) => c.id === classification);
                  const exportFormats = ["pdf", "excel", "print"];
                  const SourceIcon = source.icon;
                  return (
                    <div
                      key={source.id}
                      onClick={() => setSelectedId(source.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-[24px] p-5 transition-all duration-300 cursor-pointer text-right border ${
                        sel 
                          ? "bg-white border-emerald-500 shadow-[0_8px_30px_rgba(5,150,105,0.12)] ring-1 ring-emerald-500" 
                          : "bg-white border-zinc-200 shadow-sm hover:border-emerald-300 hover:shadow-md"
                      }`}
                    >
                      {/* Top Row: Icon + Title + Fav */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-white transition-colors" style={{ color: source.color }}>
                            <SourceIcon size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-500">{cat.label} · {source.id}</div>
                            <h3 className={`text-[15px] font-black leading-tight transition-colors ${sel ? "text-emerald-600" : "text-zinc-900 group-hover:text-emerald-600"}`}>
                              {source.label}
                            </h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleFav(e, source.id)}
                          className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? "text-amber-500 bg-amber-50" : "text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100"}`}
                        >
                          <Star size={16} fill={fav ? "currentColor" : "none"} strokeWidth={fav ? 0 : 2} />
                        </button>
                      </div>

                      <p className="text-[13px] leading-relaxed text-zinc-500 line-clamp-2 mb-4">
                        {classifications.length} تصنيف · {clsDef ? (clsDef.availableModes || ["detailed"]).map((m) => m === "detailed" ? "تفصيلي" : m === "summary" ? "ملخص" : m).join(" / ") : ""}
                      </p>

                      {/* Embedded Preview */}
                      <div className="mt-auto pt-4 border-t border-zinc-100">
                        <div className="text-[10px] font-bold text-zinc-400 mb-2">أعمدة التقرير ومعاينة:</div>
                        <ColumnPreviewStrip catId={SOURCE_CAT_MAP[source.id] || "sales"} colVisibility={colVisibility} report={null} />
                        <GhostPreviewRows catId={SOURCE_CAT_MAP[source.id] || "sales"} colVisibility={colVisibility} report={null} dateRange={dateRange} scope={scope} />
                      </div>

                      {/* Export Hints */}
                      <div className="absolute bottom-5 left-5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {exportFormats.map(fmt => {
                          const Cfg = FORMAT_ICONS[fmt];
                          if (!Cfg) return null;
                          return <div key={fmt} className="h-6 w-6 rounded flex items-center justify-center bg-zinc-50" style={{color: Cfg.color}} title={Cfg.label}><Cfg.icon size={12} strokeWidth={2.5}/></div>
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIGURATOR SIDEBAR */}
      <AnimatePresence mode="wait">
        {selectedSource && selectedCategory ? (
          <motion.div
            key={selectedSource.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-[420px] shrink-0 border-r border-zinc-200 bg-white flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.04)]"
          >
            {/* Inspector Header */}
            <div className="shrink-0 p-8 border-b border-zinc-100 bg-zinc-50/50">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">إعدادات التقرير</div>
              <h2 className="text-[20px] font-black text-zinc-900 leading-tight">{selectedSource.label}</h2>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-200">
              
              {/* 1. Classification Selector */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-emerald-500"></span> التصنيف
                </h3>
                <select
                  value={selectedClassification}
                  onChange={(e) => {
                    const clsId = e.target.value;
                    setSourceState((prev) => ({
                      ...prev,
                      [selectedSource.id]: { classification: clsId, dataMode: prev[selectedSource.id]?.dataMode || getDefaultMode(selectedSource.id, clsId) },
                    }));
                  }}
                  className="w-full h-12 px-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-[13px] font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                >
                  {selectedClassifications.map((cls) => (
                    <option key={cls.id} value={cls.id}>{clsLabel(cls)}</option>
                  ))}
                </select>
              </div>

              {/* 2. Data Mode Toggle */}
              {selectedClsDef && selectedClsDef.availableModes && selectedClsDef.availableModes.length > 1 && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> وضع البيانات
                  </h3>
                  <DataModeToggle
                    availableModes={selectedClsDef.availableModes}
                    value={selectedMode}
                    onChange={(mode) => {
                      setSourceState((prev) => ({
                        ...prev,
                        [selectedSource.id]: { ...(prev[selectedSource.id] || {}), classification: prev[selectedSource.id]?.classification || getDefaultClassification(selectedSource.id), dataMode: mode },
                      }));
                    }}
                  />
                </div>
              )}

              {/* 3. Scope Selector */}
              {selectedClsDef?.supportsScope && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> النطاق التحليلي
                  </h3>
                  <ScopeSelector
                    scopeOptions={SCOPE_OPTIONS[SOURCE_CAT_MAP[selectedSource.id]] || SCOPE_OPTIONS.sales}
                    scope={scope}
                    onScopeChange={setScope}
                  />
                </div>
              )}

              {/* 4. Date Range */}
              {selectedClsDef?.supportsDates && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> الفترة الزمنية
                  </h3>
                  <DatePresets activeFrom={dateRange.from} activeTo={dateRange.to} onApply={setDateRange} />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">من تاريخ</label>
                      <RDate value={dateRange.from} onChange={(v) => setDateRange({ ...dateRange, from: v })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">إلى تاريخ</label>
                      <RDate value={dateRange.to} onChange={(v) => setDateRange({ ...dateRange, to: v })} />
                    </div>
                  </div>
                  {invalidRange && <div className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg mt-2 border border-red-100">تاريخ البداية يجب أن يكون قبل تاريخ النهاية.</div>}
                </div>
              )}

              {/* 5. Search + Dimension Filters */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-emerald-500"></span> <Search size={13} /> فلاتر التقرير
                </h3>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input type="text" value={workspaceFilters.q || ""}
                      onChange={(e) => handleWorkspaceFilter("q", e.target.value)}
                      placeholder="بحث عام..."
                      className="w-full h-9 pr-9 pl-3 rounded-xl border border-zinc-200 bg-white text-[12px] font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                  {dimensions.map((dim) => (
                    <DimensionFilter key={dim.key} dimension={dim} value={workspaceFilters[dim.key]}
                      onChange={(key, val) => handleWorkspaceFilter(key, val)} formatLabel={(x) => CLS_ARABIC[x] || x}
                    />
                  ))}
                  {selectedClsDef?.hasProfit && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-zinc-500">طريقة التكلفة</label>
                      <select value={costMethod} onChange={(e) => setCostMethod(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-zinc-200 bg-white text-[12px] font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      >
                        {COST_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Column Toggles */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-emerald-500"></span> أعمدة التقرير
                </h3>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
                  <ColumnToggleList catId={SOURCE_CAT_MAP[selectedSource.id] || "sales"} colVisibility={colVisibility} onChange={setColVisibility} report={null} />
                </div>
              </div>

              {/* 7. Multi-select filters */}
              {selectedClsDef?.multiSelectFilters?.map((msf) => (
                <div key={msf.key} className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> {CLS_ARABIC[msf.label_key] || msf.label_key}
                  </h3>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-2">
                    {msf.options.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded accent-emerald-500" />
                        <span className="text-[12px] font-bold text-zinc-700">{clsOptionLabel(opt)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

            </div>

            {/* Inspector Footer Action */}
            <div className="shrink-0 p-6 border-t border-zinc-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
              <PermissionGate page="reports" action="print">
              <button
                onClick={() => handleRunSource(selectedSource)}
                disabled={!selectedClassification}
                className="w-full relative flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 py-4 text-[15px] font-black text-white transition-all hover:bg-emerald-600 hover:shadow-lg disabled:opacity-50 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  <Play size={18} fill="currentColor" className="transition-transform group-hover:scale-110" />
                  تشغيل التقرير
                </span>
              </button>
              </PermissionGate>
            </div>

          </motion.div>
        ) : (
          <div className="w-[420px] shrink-0 border-r border-zinc-200 bg-white flex flex-col items-center justify-center text-center p-8">
            <Settings2 size={40} className="text-zinc-200 mb-4" />
            <p className="text-[14px] font-bold text-zinc-400">حدد مصدراً لعرض إعداداته</p>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
