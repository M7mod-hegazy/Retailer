import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Command, ArrowUpRight, ArrowDownCircle, Plus, X, Loader2, Zap, TrendingDown, TrendingUp, Banknote, ShoppingBag, Upload, Download, Package, AlertCircle, Settings2 } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUpdateStore } from "../../stores/updateStore";
import { useInstallmentAlertStore } from "../../stores/installmentAlertStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { PRIMARY_MENU, NAV_MODULES } from "../../constants/navigation";
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useSpring } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import { shortcutLabel } from "../../shortcuts/ShortcutKbd";
import { usePageTour } from "../../hooks/usePageTour";
import { useElectron } from "../../hooks/useElectron";
import CriticalSettingsWarning from "../../components/ui/CriticalSettingsWarning";
import { fieldKeyToTab, findMissingCritical } from "../../utils/fieldMeta";

// ─── Tooltips ────────────────────────────────────────────────────────────────
const TOOLTIPS = {
  sales: "فواتير البيع المكتملة وسجل المعاملات",
  purchases: "إدارة الفواتير والموردين",
  purchase_orders: "طلب البضاعة من الموردين قبل الاستلام ومتابعة أوامر التوريد",
  purchase_returns: "إرجاع البضائع التالفة",
  sales_returns: "استلام المرتجعات وإشعارات الخصم",
  branch_transfer: "نقل المخزون بين الفروع",
  quotations: "إعداد عروض سعر للعملاء وتحويلها لفواتير بيع بعد الموافقة",
  customer_accounts: "الأرصدة والديون المستحقة",
  supplier_accounts: "المستحقات وحركة الحساب",
  installments: "متابعة الأقساط والديون",
  revenues: "الإيرادات الإضافية الأخرى",
  expenses: "المصروفات والتشغيل",
  withdrawals: "مسحوبات الملاك والشركاء",
  payment_methods: "البطاقات البنكية والنقد",
  bank_operations: "إيداع ومراجعة البنوك",
  cheques: "الشيكات الصادرة والواردة",
  items: "تعريف المنتجات والباركود",
  categories: "أقسام المنتجات والمجموعات",
  item_operations: "سجل حركة الأصناف والمخزون — إدخال وإخراج وتحويلات",
  bulk_price_update: "تعديل أسعار المنتجات",
  stock_transfer: "تحويل البضاعة بين المخازن",
  physical_count: "الجرد الفعلي وتسوية الأرصدة",
  promotions: "عروض ترويجية وخصومات",
  branches: "إدارة الفروع",
  customers: "دليل العملاء",
  suppliers: "دليل الموردين",
  warehouses: "تعريف أماكن التخزين",
  banks: "الحسابات البنكية للمنشأة",
  units: "وحدات القياس والأوزان",
  financial_categories: "شجرة الحسابات المالية",
  reports: "مؤشرات وتقارير المبيعات",
  users: "حسابات المستخدمين والصلاحيات",
  employees: "بيانات الموظفين والرواتب",
  settings: "الضرائب والطابعات وإعدادات المنشأة",
  updates: "أحدث نسخ وتحديثات النظام",
  history: "سجل حركات النظام للمراقبة",
};

const PAGE_SHORTCUT_MAP = { pos: "dashboard.gotoPos", analytics: "dashboard.gotoAnalytics", daily_treasury: "dashboard.gotoTreasury" };

// ─── Quick actions map ────────────────────────────────────────────────────────
// path   → navigate to create form
// modal  → open inline quick-entry modal
const QUICK_ACTIONS = {
  sales:            { path: "/pos",                                label: "بيع جديد" },
  purchases:        { path: "/purchases/new",                      label: "فاتورة جديدة" },
  purchase_orders:  { path: "/purchases/orders/new",               label: "طلب توريد جديد" },
  purchase_returns: { path: "/purchases/returns/new",              label: "مرتجع جديد" },
  sales_returns:    { path: "/sales/returns/new",                  label: "مرتجع مبيعات" },
  branch_transfer:  { path: "/operations/branch-transfer/new",     label: "نقل جديد" },
  quotations:       { path: "/operations/quotations/new",          label: "عرض سعر جديد" },
  stock_transfer:   { path: "/stock/transfer",                     label: "تحويل" },
  revenues:         { modal: "revenue",                            label: "إيراد سريع" },
  expenses:         { modal: "expense",                            label: "مصروف سريع" },
  withdrawals:      { modal: "withdrawal",                         label: "مسحوبات" },
};

// ─── Modal config ─────────────────────────────────────────────────────────────
const MODAL_CONFIG = {
  expense: {
    title: "تسجيل مصروف سريع",
    endpoint: "/expenses",
    icon: TrendingDown,
    color: "rose",
    amountLabel: "مبلغ المصروف",
    descLabel: "البند / الوصف",
  },
  revenue: {
    title: "تسجيل إيراد سريع",
    endpoint: "/revenues",
    icon: TrendingUp,
    color: "emerald",
    amountLabel: "مبلغ الإيراد",
    descLabel: "المصدر / الوصف",
  },
  withdrawal: {
    title: "تسجيل مسحوبات",
    endpoint: "/withdrawals",
    icon: Banknote,
    color: "amber",
    amountLabel: "مبلغ المسحوبات",
    descLabel: "الغرض / الوصف",
  },
};

const COLOR_MAP = {
  rose:    { ring: "ring-rose-200",    btn: "bg-primary hover:bg-primary-600",    icon: "bg-rose-100 text-rose-600",    badge: "bg-rose-50 text-rose-600 border-rose-200" },
  emerald: { ring: "ring-emerald-200", btn: "bg-primary hover:bg-primary-600", icon: "bg-emerald-100 text-emerald-600", badge: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  amber:   { ring: "ring-amber-200",   btn: "bg-primary hover:bg-primary-600",  icon: "bg-amber-100 text-amber-600",  badge: "bg-amber-50 text-amber-600 border-amber-200" },
};

// ─── Permission hook ──────────────────────────────────────────────────────────
function usePermissionFilter() {
  const { user, permissions } = useAuthStore();
  const settings = useAppSettingsStore((s) => s.settings);
  return (pageKey, featureKey) => {
    // Feature gate applies to everyone, including admin — feature off means the card doesn't exist
    if (featureKey && !settings[featureKey]) return false;
    if (!pageKey) return true;
    if (!user) return false;
    if (user.role === "dev" || user.role === "admin") return true;
    if (pageKey === "updates") return !!user.can_view_updates;
    return Array.isArray(permissions?.[pageKey]) && permissions[pageKey].includes("view");
  };
}

// ─── Animation variants ───────────────────────────────────────────────────────
const STAGGER = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const FADE_UP = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 120, damping: 20 } },
  exit: { opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.15 } },
};

// ─── Quick-entry modal ────────────────────────────────────────────────────────
function QuickEntryModal({ type, onClose }) {
  const cfg = MODAL_CONFIG[type];
  const colors = COLOR_MAP[cfg.color];
  const Icon = cfg.icon;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const handleKeyDown = useFieldNavigation();
  const amountRef = useRef(null);
  const categoryRef = useRef(null);
  const descriptionRef = useRef(null);
  const submitBtnRef = useRef(null);

  useEffect(() => {
    amountRef.current?.focus();
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    api.get(`/api${cfg.endpoint}/categories`)
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {});
  }, [cfg.endpoint]);

  async function handleSubmit(e) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (!categoryId) { toast.error("يرجى اختيار الفئة أولاً"); return; }
    setSubmitting(true);
    try {
      await api.post(`/api${cfg.endpoint}`, {
        amount: parsed,
        description: description.trim() || undefined,
        category_id: Number(categoryId),
      });
      toast.success("تم الحفظ بنجاح ✓");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل الحفظ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-sm ring-1 ${colors.ring} overflow-hidden`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colors.icon}`}>
            <Icon className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-black text-zinc-900 leading-tight">{cfg.title}</h2>
            <p className="text-[11px] font-bold text-zinc-400 mt-0.5">إدخال سريع — للتفاصيل اذهب للصفحة</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-zinc-100 mx-6" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2">{cfg.amountLabel}</label>
            <div className="relative">
              <input
                ref={amountRef}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef })}
                placeholder="0.00"
                className="w-full text-3xl font-black text-zinc-900 placeholder:text-zinc-200 bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all text-right"
                required
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-400">ج.م</span>
            </div>
          </div>

          {/* Category — required */}
          <div>
            <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2">الفئة <span className="text-rose-500">*</span></label>
            <select
              ref={categoryRef}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: descriptionRef, prevRef: amountRef })}
              className={`w-full text-sm font-bold text-zinc-900 bg-zinc-50 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all appearance-none ${!categoryId ? "border-rose-300" : "border-zinc-200"}`}
              required
            >
              <option value="">— اختر الفئة (مطلوب) —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2">{cfg.descLabel}</label>
            <input
              ref={descriptionRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: categoryRef })}
              placeholder="اكتب وصفاً مختصراً..."
              className="w-full text-sm font-semibold text-zinc-900 placeholder:text-zinc-300 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Submit */}
          <button
            ref={submitBtnRef}
            type="submit"
            disabled={submitting || !amount || !categoryId}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colors.btn}`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? "جاري الحفظ..." : "حفظ الآن"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Magnetic nav card ────────────────────────────────────────────────────────
function MagneticCard({ item, active, updateAvailable, onQuickAction }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const ySpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.1);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.1);
  };
  const handleMouseLeave = () => { x.set(0); y.set(0); };

  const qa = QUICK_ACTIONS[item.pageKey];
  const isBranchTransfer = item.pageKey === 'branch_transfer';

  function handleQuickClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!qa) return;
    if (qa.modal) {
      onQuickAction(qa.modal);
    } else if (qa.path) {
      navigate(qa.path);
    }
  }

  function handleTransferAction(e, type) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/operations/branch-transfer/new?type=${type}`);
  }

  const actionBtnClass = (active) =>
    `opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border ${
      active
        ? "bg-white/10 border-white/20 text-white hover:bg-primary hover:border-primary"
        : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-primary hover:border-primary hover:text-white"
    }`;

  return (
    <motion.div variants={FADE_UP} className="h-full">
      <Link
        ref={ref}
        to={item.path}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group block relative h-full rounded-[2rem] p-6 transition-all duration-500 overflow-hidden ${
          active
            ? "bg-primary text-white shadow-xl shadow-zinc-900/20"
            : item.pageKey === "updates" && updateAvailable
            ? "bg-white border-2 border-emerald-300 shadow-[0_0_30px_-8px_var(--primary-glow)] hover:shadow-[0_0_40px_-8px_var(--primary-glow)] hover:-translate-y-0.5"
            : "bg-white border border-zinc-200/50 hover:border-transparent hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:z-10"
        }`}
      >
        {/* Animated gradient */}
        <motion.div
          style={{ x: xSpring, y: ySpring }}
          className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        >
          <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_center,var(--primary-glow)_0%,transparent_50%)]" />
        </motion.div>

        <div className="relative z-10 flex flex-col h-full justify-between gap-8">
          <div className="flex justify-between items-start">
            <div className={`relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500 ${
              active ? "bg-white/10 text-accent" : "bg-zinc-50 text-zinc-400 group-hover:bg-primary group-hover:text-white group-hover:scale-110"
            }`}>
              <item.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="flex items-start gap-2">
              {item.pageKey === "updates" && updateAvailable && (
                <span className="flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-1.5 rounded-full shadow-lg shadow-emerald-500/20 animate-pulse whitespace-nowrap self-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  تحديث
                </span>
              )}

              {/* Branch-transfer: two stacked action buttons */}
              {isBranchTransfer ? (
                <div className="flex flex-col gap-1">
                  <button onClick={(e) => handleTransferAction(e, 'send')} className={actionBtnClass(active)}>
                    <Upload className="w-3 h-3" />
                    إرسال
                  </button>
                  <button onClick={(e) => handleTransferAction(e, 'receive')} className={actionBtnClass(active)}>
                    <Download className="w-3 h-3" />
                    استلام
                  </button>
                </div>
              ) : qa ? (
                <button
                  onClick={handleQuickClick}
                  title={qa.label}
                   className={`opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black border ${
                    active
                      ? "bg-white/10 border-white/20 text-white hover:bg-primary hover:border-primary"
                      : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-primary hover:border-primary hover:text-white"
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  {qa.label}
                </button>
              ) : null}

              {/* Arrow icon */}
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500 ${
                active ? "border-white/20 text-white" : "border-zinc-200 text-zinc-300 group-hover:border-primary group-hover:bg-primary group-hover:text-white"
              }`}>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div>
            <h3 className={`text-lg font-black tracking-tight mb-2 transition-colors duration-500 ${active ? "text-white" : "text-zinc-900"}`}>
              {item.label}
            </h3>
            <p className={`text-xs font-bold leading-relaxed line-clamp-2 transition-colors duration-500 ${
              active ? "text-zinc-400" : "text-zinc-400 group-hover:text-zinc-500"
            }`}>
              {TOOLTIPS[item.pageKey]}
            </p>
          </div>
        </div>

      </Link>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  usePageTour('dashboard');
  const { getVersion } = useElectron();
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    try {
      const result = getVersion();
      if (result && typeof result.then === 'function') {
        result.then((v) => setAppVersion(v || '')).catch(() => setAppVersion(''));
      } else {
        setAppVersion(result || '');
      }
    } catch {
      setAppVersion('');
    }
  }, []);
  const user = useAuthStore((state) => state.user);
  const updateAvailable = useUpdateStore((state) => state.available);
  const bannerDismissed = useUpdateStore((state) => state.bannerDismissed);
  const dismissBanner = useUpdateStore((state) => state.dismissBanner);
  const installmentAlertDismissed = useInstallmentAlertStore((state) => state.dismissed);
  const dismissInstallmentAlert = useInstallmentAlertStore((state) => state.dismiss);
  const refreshInstallmentAlert = useInstallmentAlertStore((state) => state.refresh);
  const [installmentAlert, setInstallmentAlert] = useState({ overdue: 0, dueToday: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const canView = usePermissionFilter();
  const [quickModal, setQuickModal] = useState(null); // 'expense' | 'revenue' | 'withdrawal'

  const [noItems, setNoItems] = useState(null);
  const [checkingEmpty, setCheckingEmpty] = useState(true);
  const [settings, setSettings] = useState({});
  const missingCritical = findMissingCritical(settings, "ar");
  const showBanner = !checkingEmpty && (missingCritical.length > 0 || noItems);

  const fetchDashboardData = useCallback(() => {
    let cancelled = false;
    setCheckingEmpty(true);
    Promise.all([
      api.get("/api/categories"),
      api.get("/api/items"),
      api.get("/api/settings"),
      api.get("/api/dashboard").catch(() => null),
    ]).then(([catsRes, itemsRes, settingsRes, dashRes]) => {
      if (cancelled) return;
      const cats = Array.isArray(catsRes.data?.data) ? catsRes.data.data : [];
      const items = Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : [];
      setNoItems(cats.length === 0 || items.length === 0);
      const data = settingsRes.data?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setSettings(data);
      }
      const dash = dashRes?.data?.data;
      if (dash) {
        setInstallmentAlert({ overdue: Number(dash.overdueInstallments || 0), dueToday: Number(dash.dueTodayInstallments || 0) });
      }
      refreshInstallmentAlert();
    }).catch(() => {
      if (!cancelled) setNoItems(false);
    }).finally(() => {
      if (!cancelled) setCheckingEmpty(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cancel = fetchDashboardData();
    return cancel;
  }, [fetchDashboardData]);

  useEffect(() => {
    function onFocus() {
      fetchDashboardData();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchDashboardData]);

  const primaryItems = PRIMARY_MENU.filter((item) => item.path !== "/dashboard" && canView(item.pageKey, item.featureKey));
  const visibleModules = NAV_MODULES.map((module) => ({
    ...module,
    items: module.items.filter((item) => canView(item.pageKey, item.featureKey)),
  })).filter((module) => module.items.length > 0);

  const [activeTabId, setActiveTabId] = useState(visibleModules[0]?.id || null);

  useEffect(() => {
    if (visibleModules.length > 0 && !visibleModules.some((m) => m.id === activeTabId)) {
      setActiveTabId(visibleModules[0].id);
    }
  }, [visibleModules, activeTabId]);

  useShortcut("dashboard.gotoPos", () => navigate("/pos"));
  useShortcut("dashboard.gotoAnalytics", () => navigate("/analytics"));
  useShortcut("dashboard.gotoTreasury", () => navigate("/daily-treasury"));
  useEffect(() => {
    function handleEsc(e) { if (e.key === "Escape") setQuickModal(null); }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  function isActive(path) {
    return location.pathname === path || (location.pathname.startsWith(path) && path !== "/");
  }

  const activeModule = visibleModules.find((m) => m.id === activeTabId) || visibleModules[0];
  const closeModal = useCallback(() => setQuickModal(null), []);

  // ─── Live Clock ─────────────────────────────────────────────────────────────
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const clockTime = useMemo(() => clock.toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }), [clock]);
  const clockDate = useMemo(() => clock.toLocaleDateString("ar-EG", { timeZone: "Africa/Cairo", weekday: "long", year: "numeric", month: "long", day: "numeric" }), [clock]);

  return (
    <div className="flex flex-col min-h-full font-sans bg-[var(--bg-base)] overflow-x-hidden selection:bg-primary/30" dir="rtl">

      {/* Feature hero — adaptive dark/elevated surface, correct on every theme */}
      <div className="bg-[var(--surface-feature)] px-6 md:px-12 pt-12 pb-24 rounded-b-[3rem] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary-glow)_0%,transparent_40%)] rounded-b-[3rem] pointer-events-none" />

        <header data-help="dashboard-header" className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 text-[var(--on-feature)] rounded-[1.2rem] flex items-center justify-center shadow-2xl">
              <Command className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-[var(--on-feature)] tracking-tight mb-1">
                مرحباً بك، <span className="text-[var(--on-feature)] underline decoration-primary/60 decoration-2 underline-offset-4">{user?.name?.split(" ")[0] || "مدير"}</span>
              </h1>
              {(() => {
                const safeVal = (v) => (!v || v === "null" || v === "undefined" ? "" : v.trim());
                const cName = safeVal(settings.company_name);
                const bName = safeVal(settings.branch_name);
                return (cName || bName) ? (
                  <p className="text-sm font-bold text-[var(--on-feature-muted)]">
                    {cName}{cName && bName ? " — " : ""}{bName}
                  </p>
                ) : (
                  <Link
                    to="/settings?tab=identity"
                    className="text-sm font-bold text-[var(--on-feature-muted)] hover:text-[var(--on-feature)] underline decoration-dashed underline-offset-2 transition-colors flex items-center gap-1"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    اضغط لتعيين اسم المنشأة والفرع
                  </Link>
                );
              })()}
            </div>
          </div>

          {/* Live Clock + version */}
          <div className="flex items-center gap-3" dir="ltr">
            {appVersion && appVersion !== "web" && (
              <div className="bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5 self-end mb-1 shadow-xl">
                <span className="text-[10px] font-black text-[var(--on-feature-muted)] tracking-widest">{String(appVersion).replace(/^v/i, "")}</span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-[1.2rem] px-5 py-3 shadow-2xl">
              <div className="flex flex-col items-end">
                <span className="text-2xl md:text-3xl font-black tabular-nums text-[var(--on-feature)] leading-none tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {clockTime}
                </span>
                <span className="text-[10px] font-bold text-[var(--on-feature-muted)] tracking-wider mt-0.5">
                  {clockDate}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Primary shortcuts */}
        <motion.div data-help="stats-cards" variants={STAGGER} initial="hidden" animate="visible" className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 relative z-10">
          {primaryItems.map((item) => {
            const isPOS = item.highlight;
            const shortcutId = PAGE_SHORTCUT_MAP[item.pageKey];
            const shortcut = shortcutId ? shortcutLabel(shortcutId) : null;
            return (
              <motion.div key={item.path} variants={FADE_UP}>
                {isPOS ? (
                  <div className={`group relative flex items-stretch rounded-[2rem] transition-all duration-300 overflow-hidden bg-primary shadow-[0_0_40px_var(--primary-glow)] hover:-translate-y-1 hover:shadow-[0_18px_44px_var(--primary-glow)]`}>
                    <Link to={item.path} title={TOOLTIPS[item.pageKey] || item.label} className="flex flex-1 items-center gap-6 p-6 min-w-0">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] bg-[var(--chip-on-primary)] shadow-[var(--chip-on-primary-ring)] text-[var(--on-feature)] transition-transform duration-300 group-hover:scale-105">
                        <item.icon className="h-7 w-7" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 z-10">
                        <div className="text-xl font-black text-[var(--on-feature)] mb-1">{item.label}</div>
                        {shortcut && (
                          <div className="text-xs font-bold flex items-center gap-2 text-[var(--on-feature-muted)]">
                            <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--chip-on-primary)] text-[var(--on-feature)]">{shortcut}</kbd>
                            <span>اختصار لوحة المفاتيح</span>
                          </div>
                        )}
                      </div>
                    </Link>
                    <Link
                      to="/sales"
                      title="سجل المبيعات"
                      className="flex items-center justify-center w-16 shrink-0 border-r border-white/15 bg-[var(--chip-on-primary)] hover:bg-[var(--chip-on-primary-hover)] transition-colors"
                    >
                      <ShoppingBag className="h-6 w-6 text-[var(--on-feature-muted)]" strokeWidth={1.5} />
                    </Link>
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    title={TOOLTIPS[item.pageKey] || item.label}
                    className="group relative flex items-center gap-6 rounded-[2rem] p-6 transition-all duration-300 overflow-hidden bg-primary shadow-[0_0_40px_var(--primary-glow)] hover:-translate-y-1 hover:shadow-[0_18px_44px_var(--primary-glow)]"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] bg-[var(--chip-on-primary)] shadow-[var(--chip-on-primary-ring)] text-[var(--on-feature)] transition-transform duration-300 group-hover:scale-105">
                      <item.icon className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 z-10">
                      <div className="text-xl font-black text-[var(--on-feature)] mb-1">{item.label}</div>
                      {shortcut && (
                        <div className="text-xs font-bold flex items-center gap-2 text-[var(--on-feature-muted)]">
                          <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--chip-on-primary)] text-[var(--on-feature)]">{shortcut}</kbd>
                          <span>اختصار لوحة المفاتيح</span>
                        </div>
                      )}
                    </div>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Update available banner */}
      <AnimatePresence>
        {updateAvailable && !bannerDismissed && (
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20"
          >
            <div className="relative rounded-[2rem] border-2 border-emerald-200 bg-emerald-50/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-emerald-200/20 backdrop-blur-sm">
              <button
                onClick={dismissBanner}
                className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <ArrowDownCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-900">تحديث جديد متاح!</h3>
                  <p className="mt-1 text-sm font-bold text-emerald-700">إصدار جديد من النظام متاح للتحميل. انتقل إلى صفحة التحديثات للتثبيت.</p>
                </div>
              </div>
              <Link
                to="/updates"
                className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-700/20 transition-all duration-200 hover:bg-primary-700 hover:shadow-xl active:scale-95"
              >
                <ArrowUpRight className="h-4.5 w-4.5" />
                الانتقال للتحديثات
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Installments due / overdue — dismissible (reappears daily) */}
      <AnimatePresence>
        {!installmentAlertDismissed && (installmentAlert.overdue > 0 || installmentAlert.dueToday > 0) && (
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20"
          >
            <div className="relative rounded-[2rem] border-2 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg backdrop-blur-sm"
              style={{ backgroundColor: "var(--danger-bg)", borderColor: "var(--danger-border)" }}>
              <button
                onClick={dismissInstallmentAlert}
                className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:opacity-80"
                style={{ backgroundColor: "var(--danger-light)", color: "var(--danger-text)" }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--danger-light)", color: "var(--danger-text)" }}>
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: "var(--danger-text)" }}>تنبيه الأقساط</h3>
                  <p className="mt-1 text-sm font-bold" style={{ color: "var(--danger-text)" }}>
                    {installmentAlert.overdue > 0 && `${installmentAlert.overdue} قسط متأخر السداد`}
                    {installmentAlert.overdue > 0 && installmentAlert.dueToday > 0 && " — "}
                    {installmentAlert.dueToday > 0 && `${installmentAlert.dueToday} قسط مستحق اليوم`}
                  </p>
                </div>
              </div>
              <Link
                to="/accounts/customers?filter=installments"
                className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-700/20 transition-all duration-200 hover:bg-primary-700 hover:shadow-xl active:scale-95"
              >
                <ArrowUpRight className="h-4.5 w-4.5" />
                متابعة الأقساط
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Critical settings warning */}
      {!checkingEmpty && (
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20">
          <CriticalSettingsWarning
            settings={settings}
            onNavigate={(key) => navigate(`/settings?tab=${fieldKeyToTab(key)}&field=${key}`)}
            lang="ar"
          />
        </div>
      )}

      {/* Empty items banner */}
      {!checkingEmpty && noItems && (
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20">
          <div className="rounded-[2rem] border-2 border-dashed border-amber-200 bg-amber-50/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-amber-200/20 backdrop-blur-sm">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-900">لم يتم إضافة أي أصناف بعد</h3>
                <p className="mt-1 text-sm font-bold text-amber-700">ابدأ بتعريف الأصناف والمنتجات لتشغيل المخزون والمبيعات</p>
              </div>
            </div>
            <Link
              to="/definitions/items"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-700/20 transition-all duration-200 hover:bg-primary-700 hover:shadow-xl active:scale-95"
            >
              <Plus className="h-4.5 w-4.5" />
              إضافة الأصناف الآن
            </Link>
          </div>
        </div>
      )}

      {/* Command center */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 relative z-20 pb-20 mt-6">

        {/* Quick-action legend */}
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-bold text-zinc-400">مرّر على الكارت لتظهر أزرار الإجراء السريع</span>
        </div>

        {/* Module tabs */}
        <LayoutGroup>
          <div data-help="module-tabs" className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-zinc-200/60 shadow-lg shadow-zinc-200/20 overflow-x-auto hide-scrollbar mb-8">
            {visibleModules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveTabId(module.id)}
                className="relative px-6 py-4 rounded-3xl flex items-center gap-3 whitespace-nowrap outline-none group transition-colors hover:bg-zinc-100"
              >
                {activeTabId === module.id && (
                  <motion.div layoutId="active-tab" className="absolute inset-0 bg-primary rounded-3xl" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
                )}
                <module.icon className={`w-5 h-5 relative z-10 transition-colors duration-300 ${activeTabId === module.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-900"}`} strokeWidth={2} />
                <span className={`text-sm font-black tracking-wide relative z-10 transition-colors duration-300 ${activeTabId === module.id ? "text-white" : "text-zinc-500 group-hover:text-zinc-900"}`}>
                  {module.title}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          {activeModule && (
            <motion.div
              key={activeModule.id}
              variants={STAGGER}
              initial="hidden"
              animate="visible"
              exit="hidden"
              data-help="sales-chart"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {(() => {
                const hasFamilies = activeModule.items.some(item => item.family);
                if (!hasFamilies) {
                  return activeModule.items.map((item) => (
                    <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} onQuickAction={setQuickModal} />
                  ));
                }
                const groups = {};
                activeModule.items.forEach(item => {
                  const f = item.family || "_";
                  if (!groups[f]) groups[f] = [];
                  groups[f].push(item);
                });

                const hasSalesOther = groups["sales"] && groups["other"];

                if (hasSalesOther) {
                  const salesItems = groups["sales"];
                  const otherItems = groups["other"];
                  const purchasesItems = groups["purchases"];
                  return [
                    <div key="sec-sales-other" className="col-span-full">
                      {/* xl: header mirrors the 4-col cards grid so labels sit above their own columns */}
                      <div className="hidden xl:grid xl:grid-cols-4 xl:gap-5 items-center mb-3">
                        <div className="xl:col-span-3 flex items-center">
                          <span className="text-[11px] font-black text-zinc-500 tracking-wide">المبيعات</span>
                        </div>
                        <div className="relative ltr:pl-5 rtl:pr-5 flex items-center">
                          <div className="absolute ltr:left-0 rtl:right-0 inset-y-0 w-px bg-zinc-300" />
                          <span className="text-[11px] font-black text-zinc-500 tracking-wide">أخرى</span>
                        </div>
                      </div>
                      {/* <xl: simple header */}
                      <div className="xl:hidden flex items-center mb-3">
                        <span className="text-[11px] font-black text-zinc-500 tracking-wide">المبيعات</span>
                      </div>
                      <div className="h-px w-full bg-zinc-200/70" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                        {salesItems.map(item => (
                          <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} onQuickAction={setQuickModal} />
                        ))}
                        <div className="relative ltr:pl-5 rtl:pr-5">
                          <div className="hidden xl:block absolute ltr:left-0 rtl:right-0 top-0 bottom-0 w-px bg-zinc-200/70" />
                          {otherItems.map(item => (
                            <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} onQuickAction={setQuickModal} />
                          ))}
                        </div>
                      </div>
                    </div>,
                    <div key="sec-purchases" className="col-span-full pt-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black text-zinc-500 tracking-wide">المشتريات</span>
                      </div>
                      <div className="h-px w-full bg-zinc-200/70" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                        {purchasesItems.map(item => (
                          <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} onQuickAction={setQuickModal} />
                        ))}
                      </div>
                    </div>,
                  ];
                }

                return Object.entries(groups).flatMap(([family, items]) => [
                  <div key={`hdr-${family}`} className="col-span-full pt-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-black text-zinc-500 tracking-wide">{family === "purchases" ? "المشتريات" : family}</span>
                    </div>
                    <div className="h-px w-full bg-zinc-200/70" />
                  </div>,
                  ...items.map(item => (
                    <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} onQuickAction={setQuickModal} />
                  )),
                ]);
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick-entry modal */}
      <AnimatePresence>
        {quickModal && (
          <QuickEntryModal type={quickModal} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
}
