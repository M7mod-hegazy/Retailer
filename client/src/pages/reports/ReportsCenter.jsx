import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Play, Settings2, Filter, Trash2, CalendarDays, LayoutTemplate, Percent } from "lucide-react";
import { useReportsStore, buildPrefKey } from "../../stores/reportsStore";
import { useReportsConfig, fmtDate, getReportDescription } from "../../hooks/useReportsConfig";
import { RSelect, RDate, DatePresets, ScopeSelector, ColumnPreviewStrip, ColumnToggleList, ClassificationSelector, DataModeToggle, DimensionFilter } from "./reportsCenterParts";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { useAuthStore } from "../../stores/authStore";

const SOURCE_CAT_MAP = {
  sales: "sales",
  purchases: "purchases",
  "purchase-returns": "purchases",
  "sales-returns": "sales",
  suppliers: "accounts",
  customers: "accounts",
  employees: "individuals",
  users: "individuals",
  installments: "accounts",
  items: "inventory",
  warehouses: "inventory",
  expenses: "treasury",
  revenues: "treasury",
  treasury: "treasury",
  "payment-flow": "treasury",
  "owner-statement": "accounts",
  "profit-loader": "profitability",
  "net-profit": "profitability",
  expiry: "inventory",
  tax: "tax",
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
  "cls_supplier_balance_list": "قائمة أرصدة الموردين",
  "cls_supplier_statement": "كشف حساب المورد",
  "cls_supplier_aging": "تقادم ذمم الموردين",
  "cls_supplier_purchases": "سجل المشتريات",
  "cls_supplier_returns": "سجل المرتجعات",
  "cls_supplier_reliability": "موثوقية الموردين",
  "cls_customer_balance_list": "قائمة أرصدة العملاء",
  "cls_customer_statement": "كشف حساب العميل",
  "cls_customer_aging": "تقادم ذمم العملاء",
  "cls_top_customers": "أفضل العملاء",
  "cls_collection_efficiency": "كفاءة التحصيل",
  "cls_customer_loyalty": "ولاء العملاء",
  "cls_emp_list": "قائمة الموظفين",
  "cls_emp_deductions": "خصومات الموظفين",
  "cls_emp_bonuses": "مكافآت الموظفين",
  "cls_emp_advances": "سلف الموظفين",
  "cls_emp_payroll": "كشوف الرواتب",
  "cls_emp_full_history": "السجل الكامل للموظف",
  "cls_emp_adjustments": "تسويات الموظفين",
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
  "cls_trs_payment_flow_summary": "ملخص تدفقات وسائل الدفع",
  "cls_trs_payment_flow_ledger": "سجل التدفقات التفصيلي",
  "cls_trs_payment_flow_by_doc_type": "حسب نوع المستند",
  "cls_trs_payment_flow_by_direction": "حسب الاتجاه",
  "cls_trs_payment_flow_running": "الرصيد التراكمي",
  "direction": "الاتجاه",
  "doc_type": "نوع المستند",
  "party_type": "نوع الطرف",
  "amount_min": "أقل مبلغ",
  "amount_max": "أكبر مبلغ",
  "cls_profit_by_item": "الربح حسب الصنف",
  "cls_profit_by_category": "الربح حسب الفئة",
  "cls_profit_health": "صحة الأرباح",
  "cls_net_income": "قائمة الدخل",
  "cls_net_by_category": "صافي الربح حسب الفئة",
  "cls_net_by_customer": "صافي الربح حسب العميل",
  "cls_net_by_period": "صافي الربح حسب الفترة",
  "cls_owner_statement": "لوحة صاحب المحل",
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
  // Tax classification labels
  "cls_tax_vat": "ضريبة القيمة المضافة",
  "cls_tax_output_vat": "ضريبة المبيعات (خرج)",
  "cls_tax_input_vat": "ضريبة المشتريات (دخل)",
  "cls_tax_vat_filing": "ملخص إقرار الضريبة",
  "cls_tax_returns_effect": "أثر المرتجعات على الضريبة",
};

function clsLabel(cls) {
  return CLS_ARABIC[cls.label_key] || cls.label_key;
}

function clsOptionLabel(opt) {
  return CLS_ARABIC[opt.label_key] || opt.label_key;
}

function previewKeyForSource(sourceId) {
  return sourceId === "owner-statement" ? "owner-statement" : sourceId === "payment-flow" ? "payment-flow" : (SOURCE_CAT_MAP[sourceId] || "sales");
}

export default function ReportsCenter() {
  usePageTour('reports');
  const expiryEnabled = useFeatureEnabled("feature_expiry");
  const taxEnabled = useFeatureEnabled("feature_tax");
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: config } = useReportsConfig();
  const store = useReportsStore();
  const today = useMemo(() => new Date(), []);

  const defaultFrom = useMemo(() => fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultTo = useMemo(() => fmtDate(today), [today]);

  const classificationsBySource = config?.classifications || {};

  const currentUser = useAuthStore((s) => s.user);
  const userPermissions = useAuthStore((s) => s.permissions);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "dev";

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

  const searchRef = useRef(null);
  const costMethodRef = useRef(null);
  const submitRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  function handleWorkspaceFilter(key, value) {
    setWorkspaceFilters((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if ((config?.sources || []).length > 0 && !selectedId) setSelectedId((config?.sources || [])[0].id);
  }, [config, selectedId]);

  const populatedCatIds = useMemo(() => new Set((config?.sources || []).map((s) => SOURCE_CAT_MAP[s.id]).filter(Boolean)), [config?.sources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = config?.sources || [];
    if (!expiryEnabled) rows = rows.filter((s) => s.id !== "expiry");
    if (!taxEnabled) rows = rows.filter((s) => s.id !== "tax");
    if (activeCat !== "all") rows = rows.filter((s) => SOURCE_CAT_MAP[s.id] === activeCat);
    if (onlyFavs) rows = rows.filter((s) => store.favorites.has(s.id));
    if (q) {
      rows = rows.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
    }
    if (!isAdmin) {
      rows = rows.filter((s) => {
        const key = "report_" + s.id;
        return Array.isArray(userPermissions?.[key]) && userPermissions[key].includes("view");
      });
    }
    return rows;
  }, [config, activeCat, store.favorites, onlyFavs, search, expiryEnabled, isAdmin, userPermissions]);

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
  function getClassificationColumns(sourceKey, classificationId, mode) {
    if (!sourceKey || !classificationId || !mode) return [];
    return (config?.classificationColumns || {})[`${sourceKey}.${classificationId}.${mode}`] || [];
  }

  function makeColumnReport(columns) {
    return { columns: Array.isArray(columns) ? columns : [] };
  }
  function handleRunSource(source) {
    if (!source) return;
    // Special sources with dedicated pages (no standard classification flow)
    if (source.id === "owner-statement") {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      params.set("cost_method", costMethod);
      const qs = params.toString();
      navigate(`/reports/owner-statement${qs ? `?${qs}` : ""}`);
      return;
    }
    if (source.id === "expiry") {
      const params = new URLSearchParams();
      if (workspaceFilters.warehouse_id) params.set("warehouse_id", workspaceFilters.warehouse_id);
      if (workspaceFilters.item_id) params.set("item_id", workspaceFilters.item_id);
      const qs = params.toString();
      navigate(`/reports/expiry-report${qs ? `?${qs}` : ""}`);
      return;
    }
    const state = sourceState[source.id] || {};
    const classification = state.classification || getDefaultClassification(source.id);
    const dataMode = state.dataMode || getDefaultMode(source.id, classification);
    const runClsDef = (classificationsBySource[source.id] || []).find((c) => c.id === classification);
    if (!classification || !runClsDef) return;
    const prefKey = buildPrefKey(source.id, classification, dataMode);
    store.setColumnVisibility(prefKey, colVisibility);
    store.pushRecent(prefKey);
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (scope.type !== "all" && scope.values?.[0]) {
      params.set("scope_type", scope.type);
      params.set("scope_value", scope.values[0]);
    }
    if (workspaceFilters.q) params.set("q", workspaceFilters.q);
    if (runClsDef?.hasProfit) params.set("cost_method", costMethod);
    const filterKeys = new Set([
      ...(runClsDef?.dimensions || []),
      ...((runClsDef?.filters || []).map((filter) => filter.key)),
    ]);
    filterKeys.forEach((key) => {
      if (workspaceFilters[key]) params.set(key, workspaceFilters[key]);
    });
    (runClsDef?.multiSelectFilters || []).forEach((filter) => {
      const values = workspaceFilters[filter.key];
      if (Array.isArray(values) && values.length) params.set(filter.key, values.join(","));
    });
    const qs = params.toString();
    navigate(`/reports/source/${source.id}/${classification}/${dataMode}${qs ? `?${qs}` : ""}`);
  }

  function toggleFav(e, sourceId) {
    e.stopPropagation();
    store.toggleFavorite(sourceId);
  }

  const selectedCategory = (config?.categories || []).find((cat) => cat.id === SOURCE_CAT_MAP[selectedSource?.id]) || null;
  const invalidRange = dateRange.from > dateRange.to;

  const selectedClassifications = selectedSource ? (classificationsBySource[selectedSource.id] || []) : [];
  const selectedClsState = selectedSource ? (sourceState[selectedSource.id] || {}) : {};
  const selectedClassification = selectedClsState.classification || getDefaultClassification(selectedSource?.id) || "";
  const selectedMode = selectedClsState.dataMode || getDefaultMode(selectedSource?.id, selectedClassification);
  const selectedClsDef = selectedClassifications.find((c) => c.id === selectedClassification);
  const sourceCatId = SOURCE_CAT_MAP[selectedSource?.id] || "sales";
  const dimensions = useMemo(() => {
    if (!selectedClsDef?.dimensions || !selectedSource?.id) return [];
    const pool = (config?.filterDimensions || {})[selectedSource.id] || [];
    return selectedClsDef.dimensions.map((key) => pool.find((d) => d.key === key)).filter(Boolean);
  }, [selectedClsDef, selectedSource?.id]);
  const selectedPrefKey = selectedSource && selectedClassification
    ? buildPrefKey(selectedSource.id, selectedClassification, selectedMode)
    : "";
  const selectedColumns = useMemo(
    () => getClassificationColumns(selectedSource?.id, selectedClassification, selectedMode),
    [config?.classificationColumns, selectedSource?.id, selectedClassification, selectedMode]
  );
  const selectedColumnReport = useMemo(() => makeColumnReport(selectedColumns), [selectedColumns]);

  useEffect(() => {
    if (!selectedPrefKey) return;
    setColVisibility(store.getPreference(selectedPrefKey, "columnVisibility", {}) || {});
  }, [selectedPrefKey]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-base)] text-text-primary" dir="rtl" style={{ fontFamily: "Satoshi, sans-serif" }}>

      {/* MIDDLE & TOP RAIL (Source Master Grid) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-base)]">

        {/* TOP RAIL (Categories + Search) */}
        <div className="shrink-0 border-b border-border-normal bg-bg-surface flex items-center px-4 py-1.5 gap-1 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 border-l border-border-normal pl-2.5 ml-1.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white">
              <LayoutTemplate size={14} strokeWidth={2.5} />
            </div>
            <span className="text-[11px] font-black text-text-primary">التقارير</span>
          </div>
          <button
            onClick={() => setActiveCat("all")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-bold text-[11px] whitespace-nowrap shrink-0 ${
              activeCat === "all" ? "bg-bg-overlay text-text-primary shadow-sm border border-border-normal" : "text-text-muted hover:bg-bg-base hover:text-text-primary"
            }`}
          >
            الكل
          </button>
          {(config?.categories || []).filter((cat) => populatedCatIds.has(cat.id)).map((cat) => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`group relative flex items-center gap-1 px-2.5 py-1 rounded-md transition-all duration-300 font-bold text-[11px] whitespace-nowrap shrink-0 ${
                  active ? "bg-bg-surface shadow-sm border border-border-normal" : "hover:bg-bg-base text-text-muted hover:text-text-primary"
                }`}
                style={active ? { color: cat.color } : {}}
              >
                <cat.icon size={13} strokeWidth={active ? 2.5 : 2} className={active ? "" : "group-hover:scale-110 transition-transform"} />
                {cat.label}
                {active && (
                  <motion.div layoutId="activeRailTop" className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full" style={{ backgroundColor: cat.color }} />
                )}
              </button>
            );
          })}

          <div className="mr-auto flex items-center gap-1.5 shrink-0">
            <div data-help="search-bar" className="relative group">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="w-36 h-7 rounded-md border border-border-normal bg-bg-surface pl-2 pr-7 text-[11px] font-bold text-text-primary placeholder:text-text-muted shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              />
              <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary" />
            </div>
            <button
              data-help="favorite-button"
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all shadow-sm ${
                onlyFavs ? "border-warning-border bg-warning-bg text-warning-text" : "border-border-normal bg-bg-surface text-text-secondary hover:border-border-strong"
              }`}
              title="المفضلة"
            >
              <Star size={12} fill={onlyFavs ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div data-help="main-table" className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-thin scrollbar-thumb-zinc-300">
          <div data-help="report-categories" className="max-w-4xl mx-auto w-full">
            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-overlay text-text-muted mb-4"><Search size={24} /></div>
                <h3 className="text-[16px] font-black text-text-primary mb-1">لا توجد مصادر مطابقة</h3>
                <p className="text-sm text-text-muted">جرب البحث بكلمات أخرى أو تغيير الفئة.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-max items-start">
                {filtered.map((source) => {
                  const cat = (config?.categories || []).find((c) => c.id === SOURCE_CAT_MAP[source.id]) || (config?.categories || [])[0] || {};
                  const sel = selectedId === source.id;
                  const fav = store.favorites.has(source.id);
                  const classifications = classificationsBySource[source.id] || [];
                  const state = sourceState[source.id] || {};
                  const classification = state.classification || getDefaultClassification(source.id);
                  const clsDef = classifications.find((c) => c.id === classification);
                  const exportFormats = ["pdf", "excel", "csv", "print"];
                  const SourceIcon = source.icon;
                  return (
                    <div
                      key={source.id}
                      onClick={() => setSelectedId(source.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-[24px] p-5 transition-all duration-300 cursor-pointer text-right border ${
                        sel
                          ? "bg-bg-surface border-primary shadow-[0_8px_30px_rgba(5,150,105,0.12)] ring-1 ring-primary"
                          : "bg-bg-surface border-border-normal shadow-sm hover:border-primary hover:shadow-md"
                      }`}
                    >
                      {/* Top Row: Icon + Title + Fav */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-base group-hover:bg-bg-surface transition-colors" style={{ color: source.color }}>
                            <SourceIcon size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="text-[11px] font-black uppercase tracking-widest mb-1 text-text-muted">{cat.label} · {source.id}</div>
                            <h3 className={`text-[15px] font-black leading-tight transition-colors ${sel ? "text-primary" : "text-text-primary group-hover:text-primary"}`}>
                              {source.label}
                            </h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleFav(e, source.id)}
                          className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? "text-warning-text bg-warning-bg" : "text-text-muted hover:text-text-secondary hover:bg-bg-overlay"}`}
                        >
                          <Star size={16} fill={fav ? "currentColor" : "none"} strokeWidth={fav ? 0 : 2} />
                        </button>
                      </div>

                      <div className="mb-4 space-y-1.5">
                        <p className="text-xs font-medium text-text-secondary line-clamp-2 leading-relaxed">
                          {getReportDescription(source.id, classification || clsDef?.label_key)}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted">
                          <span>{classifications.length} تصنيفات</span>
                          <span>•</span>
                          <span>{clsDef ? (clsDef.availableModes || ["detailed"]).map((m) => m === "detailed" ? "تفصيلي" : m === "summary" ? "ملخص" : m).join(" / ") : ""}</span>
                        </div>
                      </div>

                      {/* Embedded Preview */}
                      <div className="mt-auto pt-4 border-t border-border-subtle">
                        <div className="text-[11px] font-bold text-text-muted mb-2">أعمدة التقرير:</div>
                        <ColumnPreviewStrip catId={previewKeyForSource(source.id)} colVisibility={colVisibility} report={makeColumnReport(getClassificationColumns(source.id, classification, state.dataMode || getDefaultMode(source.id, classification)))} />
                      </div>

                      {/* Export Hints */}
                      <div className="absolute bottom-5 left-5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {exportFormats.map(fmt => {
                          const Cfg = (config?.formatIcons || {})[fmt];
                          if (!Cfg) return null;
                          return <div key={fmt} className="h-6 w-6 rounded flex items-center justify-center bg-bg-base" style={{color: Cfg.color}} title={Cfg.label}><Cfg.icon size={12} strokeWidth={2.5}/></div>
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
            className="w-[420px] shrink-0 border-r border-border-normal bg-bg-surface flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.04)]"
          >
            {/* Inspector Header */}
            <div className="shrink-0 p-8 border-b border-border-subtle bg-bg-base/50">
              <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">إعدادات التقرير</div>
              <h2 className="text-[20px] font-black text-text-primary leading-tight">{selectedSource.label}</h2>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-200">

              {/* 1. Classification Selector */}
              <div className="space-y-3">
                <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-primary"></span> التصنيف
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
                  className="w-full h-12 px-4 rounded-2xl border border-border-normal bg-bg-base text-sm font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                >
                  {selectedClassifications.map((cls) => (
                    <option key={cls.id} value={cls.id}>{clsLabel(cls)}</option>
                  ))}
                </select>
              </div>

              {/* 2. Data Mode Toggle */}
              {selectedClsDef && selectedClsDef.availableModes && selectedClsDef.availableModes.length > 1 && (
                <div className="space-y-3">
                  <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary"></span> وضع البيانات
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
                  <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary"></span> النطاق التحليلي
                  </h3>
                  <ScopeSelector
                    scopeOptions={config?.scopeOptions?.[SOURCE_CAT_MAP[selectedSource.id]] || config?.scopeOptions?.sales || []}
                    scope={scope}
                    onScopeChange={setScope}
                  />
                </div>
              )}

              {/* 4. Date Range */}
              {selectedClsDef?.supportsDates && (
                <div className="space-y-3">
                  <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary"></span> الفترة الزمنية
                  </h3>
                  <DatePresets activeFrom={dateRange.from} activeTo={dateRange.to} onApply={setDateRange} />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[11px] font-bold text-text-muted mb-1.5">من تاريخ</label>
                      <RDate value={dateRange.from} onChange={(v) => setDateRange({ ...dateRange, from: v })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-muted mb-1.5">إلى تاريخ</label>
                      <RDate value={dateRange.to} onChange={(v) => setDateRange({ ...dateRange, to: v })} />
                    </div>
                  </div>
                  {invalidRange && <div className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg mt-2 border border-red-100">تاريخ البداية يجب أن يكون قبل تاريخ النهاية.</div>}
                </div>
              )}

              {/* 5. Search + Dimension Filters */}
              <div className="space-y-3">
                <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-primary"></span> <Search size={13} /> فلاتر التقرير
                </h3>
                <div className="rounded-2xl border border-border-normal bg-bg-base/50 p-3 space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input ref={searchRef} type="text" value={workspaceFilters.q || ""}
                      onChange={(e) => handleWorkspaceFilter("q", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: costMethodRef })}
                      placeholder="بحث عام..."
                      className="w-full h-9 pr-9 pl-3 rounded-xl border border-border-normal bg-bg-surface text-2sm font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
                    />
                  </div>
                  {dimensions.map((dim) => (
                    <DimensionFilter key={dim.key} dimension={dim} value={workspaceFilters[dim.key]}
                      onChange={(key, val) => handleWorkspaceFilter(key, val)} formatLabel={(x) => CLS_ARABIC[x] || x}
                    />
                  ))}
                  {selectedClsDef?.hasProfit && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-text-muted">طريقة التكلفة</label>
                      <select ref={costMethodRef} value={costMethod} onChange={(e) => setCostMethod(e.target.value)}
                        onKeyDown={e => handleKeyDown(e, { nextRef: submitRef, prevRef: searchRef })}
                        className="w-full h-9 px-3 rounded-xl border border-border-normal bg-bg-surface text-2sm font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      >
                        {(config?.costMethods || [{ value: "wacc", label: "متوسط التكلفة (WACC)" }]).map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Column Toggles */}
              <div className="space-y-3">
                <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-primary"></span> أعمدة التقرير
                </h3>
                <div className="rounded-2xl border border-border-normal bg-bg-base/50 p-4">
                  {selectedColumns.length ? (
                    <ColumnToggleList catId={previewKeyForSource(selectedSource.id)} colVisibility={colVisibility} onChange={setColVisibility} report={selectedColumnReport} />
                  ) : (
                    <p className="text-2sm font-bold text-text-muted">لا توجد أعمدة معرفة لهذا التقرير.</p>
                  )}
                </div>
              </div>

              {/* 7. Multi-select filters */}
              {selectedClsDef?.multiSelectFilters?.map((msf) => (
                <div key={msf.key} className="space-y-3">
                  <h3 className="text-2sm font-black text-text-primary flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary"></span> {CLS_ARABIC[msf.label_key] || msf.label_key}
                  </h3>
                  <div className="rounded-2xl border border-border-normal bg-bg-base/50 p-3 space-y-2">
                    {msf.options.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={(workspaceFilters[msf.key] || []).includes(opt.value)} onChange={(e) => {
                          const current = workspaceFilters[msf.key] || [];
                          const next = e.target.checked ? [...current, opt.value] : current.filter((v) => v !== opt.value);
                          handleWorkspaceFilter(msf.key, next);
                        }} />
                        <span className="text-2sm font-bold text-text-primary">{clsOptionLabel(opt)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

            </div>

            {/* Inspector Footer Action */}
            <div className="shrink-0 p-6 border-t border-border-normal bg-bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
              <PermissionGate page="reports" action="view">
              <button
                ref={submitRef}
                onClick={() => handleRunSource(selectedSource)}
                disabled={!selectedClassification && selectedSource?.id !== "owner-statement" && selectedSource?.id !== "expiry"}
                onKeyDown={e => handleKeyDown(e, { prevRef: costMethodRef, onEnter: () => submitRef.current?.click() })}
                className="w-full relative flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-[15px] font-black text-white transition-all hover:bg-primary-600 hover:shadow-lg disabled:opacity-50 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-bg-surface/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  <Play size={18} fill="currentColor" className="transition-transform group-hover:scale-110" />
                  تشغيل التقرير
                </span>
              </button>
              </PermissionGate>
            </div>

          </motion.div>
        ) : (
          <div className="w-[420px] shrink-0 border-r border-border-normal bg-bg-surface flex flex-col items-center justify-center text-center p-8">
            <Settings2 size={40} className="text-text-muted mb-4" />
            <p className="text-sm font-bold text-text-muted">حدد مصدراً لعرض إعداداته</p>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
