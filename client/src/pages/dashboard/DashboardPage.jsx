import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Command, ArrowUpRight, ArrowDownCircle, Plus, X, Loader2, Zap, TrendingDown, TrendingUp, Banknote, ShoppingBag, Upload, Download, Package, AlertCircle, Settings2, Wifi, WifiOff, RefreshCw, ShoppingCart, HardDrive, Wifi as WifiIcon, WifiOff as WifiOffIcon, PlayCircle, CloudUpload, ShieldCheck, Database, ImageIcon } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUpdateStore } from "../../stores/updateStore";
import { useInstallmentAlertStore } from "../../stores/installmentAlertStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useSyncStore } from "../../stores/syncStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { PRIMARY_MENU, NAV_MODULES } from "../../constants/navigation";
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useSpring } from "framer-motion";
import api from "../../services/api";
import { createDisconnectTracker } from "../../services/connection";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useShortcut } from "../../shortcuts/useShortcut";
import { shortcutLabel } from "../../shortcuts/ShortcutKbd";
import { usePageTour } from "../../hooks/usePageTour";
import { useElectron } from "../../hooks/useElectron";
import { useServerClock } from "../../hooks/useServerClock";
import CriticalSettingsWarning from "../../components/ui/CriticalSettingsWarning";
import AnnouncementBanner from "../../components/assistant/AnnouncementBanner";
import SectionErrorBoundary from "../../components/ui/SectionErrorBoundary";
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
  whatsapp_crm: "إدارة رسائل واتساب، SMS، وتيليجرام وحملات التسويق",
  sync: "مزامنة المنتجات والمخزون والطلبات مع المتجر الإلكتروني",
  history: "سجل حركات النظام للمراقبة",
};

const PAGE_SHORTCUT_MAP = { pos: "dashboard.gotoPos", analytics: "dashboard.gotoAnalytics", daily_treasury: "dashboard.gotoTreasury" };

// ─── Quick actions map ────────────────────────────────────────────────────────
// path   → navigate to create form
// modal  → open inline quick-entry modal
const QUICK_ACTIONS = {
  sales: { path: "/pos", label: "بيع جديد" },
  purchases: { path: "/purchases/new", label: "فاتورة جديدة" },
  purchase_orders: { path: "/purchases/orders/new", label: "طلب توريد جديد" },
  purchase_returns: { path: "/purchases/returns/new", label: "مرتجع جديد" },
  sales_returns: { path: "/sales/returns/new", label: "مرتجع مبيعات" },
  branch_transfer: { path: "/operations/branch-transfer/new", label: "نقل جديد" },
  quotations: { path: "/operations/quotations/new", label: "عرض سعر جديد" },
  stock_transfer: { path: "/stock/transfer", label: "تحويل" },
  revenues: { modal: "revenue", label: "إيراد سريع" },
  expenses: { modal: "expense", label: "مصروف سريع" },
  withdrawals: { modal: "withdrawal", label: "مسحوبات" },
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
  rose: { ring: "ring-[var(--danger-border)]", btn: "bg-primary hover:bg-primary-600", icon: "bg-[var(--danger-light)] text-[var(--danger-text)]", badge: "bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger-border)]" },
  emerald: { ring: "ring-[var(--success-border)]", btn: "bg-primary hover:bg-primary-600", icon: "bg-[var(--success-light)] text-[var(--success-text)]", badge: "bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]" },
  amber: { ring: "ring-[var(--warning-border)]", btn: "bg-primary hover:bg-primary-600", icon: "bg-[var(--warning-light)] text-[var(--warning-text)]", badge: "bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]" },
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
      .catch(() => { });
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`relative bg-[var(--bg-surface)] rounded-3xl shadow-[var(--shadow-modal)] w-full max-w-sm ring-1 ${colors.ring} overflow-hidden`}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${colors.icon}`}>
            <Icon className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-black text-[var(--text-primary)] leading-tight">{cfg.title}</h2>
            <p className="text-[11px] font-bold text-[var(--text-muted)] mt-0.5">إدخال سريع — للتفاصيل اذهب للصفحة</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-[var(--border-subtle)] mx-6" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">{cfg.amountLabel}</label>
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
                className="w-full text-3xl font-black text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border-normal)] rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)] focus:border-transparent transition-all text-right"
                required
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--text-muted)]">ج.م</span>
            </div>
          </div>

          {/* Category — required */}
          <div>
            <label className="block text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">الفئة <span className="text-[var(--danger-text)]">*</span></label>
            <select
              ref={categoryRef}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: descriptionRef, prevRef: amountRef })}
              className={`w-full text-sm font-bold text-[var(--text-primary)] bg-[var(--bg-input)] border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)] focus:border-transparent transition-all appearance-none ${!categoryId ? "border-[var(--danger-border)]" : "border-[var(--border-normal)]"}`}
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
            <label className="block text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-2">{cfg.descLabel}</label>
            <input
              ref={descriptionRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: categoryRef })}
              placeholder="اكتب وصفاً مختصراً..."
              className="w-full text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border-normal)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--text-primary)] focus:border-transparent transition-all"
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
// ─── Channel status (WhatsApp / SMS / Telegram) ────────────────────────────
function ChannelStatusDots({ status, className = "", layout = "vertical" }) {
  if (!status) return null;
  const channels = [
    { key: "whatsapp", label: "واتساب", on: !!status.whatsapp?.connected, color: "var(--success-text)", bg: "var(--success-bg)" },
    { key: "sms", label: "SMS", on: !!status.sms?.connected, color: "var(--info-text)", bg: "var(--info-bg)" },
    { key: "telegram", label: "تيليجرام", on: !!status.telegram?.connected, color: "var(--info-text)", bg: "var(--info-bg)" },
    { key: "email", label: "البريد", on: !!status.email?.connected, color: "var(--danger-text)", bg: "var(--danger-bg)" },
    { key: "meta", label: "Meta", on: !!status.meta?.connected, color: "var(--primary)", bg: "var(--primary-50, var(--primary-glow))" },
  ];
  const onCount = channels.filter(c => c.on).length;
  if (layout === "horizontal") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`} title={channels.map((d) => `${d.label}: ${d.on ? "متصل" : "غير متصل"}`).join(" · ")}>
        {channels.map((d) => (
          <span
            key={d.key}
            className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none border ${d.on
              ? `border-current/20`
              : "bg-[var(--bg-overlay)] text-[var(--text-muted)] border-transparent opacity-40"
              }`}
            style={d.on ? { color: d.color, backgroundColor: d.bg } : undefined}
          >
            <span className="w-1 h-1 rounded-full shrink-0" style={d.on ? { backgroundColor: d.color } : { backgroundColor: "var(--text-muted)" }} />
            {d.label}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-1.5 ${className}`} title={channels.map((d) => `${d.label}: ${d.on ? "متصل" : "غير متصل"}`).join(" · ")}>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black text-[var(--on-feature-muted)] leading-none">مركز الرسائل</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none" style={{ backgroundColor: onCount > 0 ? "var(--success-bg)" : "var(--bg-overlay)", color: onCount > 0 ? "var(--success-text)" : "var(--text-muted)" }}>
          {onCount}/{channels.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {channels.map((d) => (
          <span key={d.key} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border transition-all" style={d.on ? { color: d.color, backgroundColor: d.bg, borderColor: `${d.color}30` } : { color: "var(--text-muted)", backgroundColor: "var(--bg-overlay)", borderColor: "transparent", opacity: 0.4 }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.on ? d.color : "var(--text-muted)" }} />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MagneticCard({ item, active, updateAvailable, channelsStatus, onQuickAction }) {
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
    `opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border ${active
      ? "bg-white/10 border-white/20 text-white hover:bg-primary hover:border-primary"
      : "bg-[var(--bg-input)] border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-primary hover:border-primary hover:text-white"
    }`;

  return (
    <motion.div variants={FADE_UP} className="h-full">
      <Link
        ref={ref}
        to={item.path}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group block relative h-full rounded-[2rem] p-6 transition-all duration-500 overflow-hidden ${active
          ? "bg-primary text-white shadow-[var(--shadow-elevated)]"
          : item.pageKey === "updates" && updateAvailable
            ? "bg-[var(--bg-surface)] border-2 border-[var(--success-border)] shadow-[var(--shadow-elevated),0_0_30px_-8px_var(--primary-glow)] hover:shadow-[var(--shadow-modal),0_0_40px_-8px_var(--primary-glow)] hover:-translate-y-1"
            : "bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-modal)] hover:-translate-y-1 hover:border-[var(--border-accent)]"
          }`}
        style={{ backgroundImage: "linear-gradient(180deg, var(--bg-surface) 55%, var(--accent-soft))" }}
      >
        {/* Accent bar — slides in from the start edge on hover */}
        <div className="absolute top-3 bottom-3 w-[3px] rounded-full bg-[var(--primary)] opacity-0 group-hover:opacity-100 transition-all duration-500 -translate-x-2 group-hover:translate-x-0" style={{ insetInlineStart: "0.75rem" }} />

        {/* Animated gradient */}
        <motion.div
          style={{ x: xSpring, y: ySpring }}
          className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        >
          <div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_center,var(--primary-glow)_0%,transparent_50%)]" />
        </motion.div>

        <div className="relative z-10 flex flex-col h-full justify-between gap-8">
          <div className="flex justify-between items-start">
            <div className={`relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500 ${active ? "bg-[var(--chip-on-primary)] text-[var(--on-feature)]" : "bg-[var(--bg-input)] text-[var(--text-muted)] group-hover:bg-primary group-hover:text-white group-hover:scale-110"
              }`}>
              <item.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="flex items-start gap-2">
              {item.pageKey === "updates" && updateAvailable && (
                <span className="flex items-center gap-1 bg-[var(--success-text)] text-white text-[9px] font-black px-1.5 py-1.5 rounded-full shadow-[var(--shadow-glow-green)] animate-pulse whitespace-nowrap self-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  تحديث
                </span>
              )}

              {item.pageKey === "whatsapp_crm" && channelsStatus && (
                <ChannelStatusDots
                  status={channelsStatus}
                  layout="horizontal"
                  className="self-center"
                />
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
                  className={`opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black border ${active
                    ? "bg-white/10 border-white/20 text-white hover:bg-primary hover:border-primary"
                    : "bg-[var(--bg-input)] border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-primary hover:border-primary hover:text-white"
                    }`}
                >
                  <Zap className="w-3 h-3" />
                  {qa.label}
                </button>
              ) : null}

              {/* Arrow icon */}
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500 ${active ? "border-white/20 text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] group-hover:border-primary group-hover:bg-primary group-hover:text-white"
                }`}>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div>
            <h3 className={`text-lg font-black tracking-tight mb-2 transition-colors duration-500 ${active ? "text-white" : "text-[var(--text-primary)]"}`}>
              {item.label}
            </h3>
            <p className={`text-xs font-bold leading-relaxed line-clamp-2 transition-colors duration-500 ${active ? "text-[var(--on-feature-muted)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
              }`}>
              {TOOLTIPS[item.pageKey]}
            </p>
          </div>
        </div>

      </Link>
    </motion.div>
  );
}

// ─── Sync Dashboard Widget ────────────────────────────────────────────────────
function SyncDashboardWidget() {
  const navigate = useNavigate();
  const { status, connected, pendingChanges, configured, setStatus } = useSyncStore();
  const { items: notifications, fetchNotifications } = useNotificationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { getSyncStatus } = await import("../../services/syncService");
        const [statusRes] = await Promise.all([
          getSyncStatus().catch(() => null),
          fetchNotifications(),
        ]);
        if (!cancelled && statusRes) setStatus(statusRes);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!configured) return null;

  const recentOrders = (notifications || [])
    .filter((n) => n.type === "order" || n.type === "Order")
    .slice(0, 3);

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `${mins} د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} س`;
    const days = Math.floor(hrs / 24);
    return `${days} ي`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20"
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? "bg-[var(--success-light)] text-[var(--success-text)]" : "bg-[var(--danger-light)] text-[var(--danger-text)]"
              }`}>
              {connected ? <WifiIcon className="h-5 w-5" /> : <WifiOffIcon className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--text-primary)]">المزامنة مع المتجر الإلكتروني</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${connected ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[var(--success-text)] animate-pulse" : "bg-[var(--danger-text)]"
                    }`} />
                  {connected ? "متصل" : "غير متصل"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  آخر مزامنة: {status?.lastSyncAt ? timeAgo(status.lastSyncAt) : "لم تتم بعد"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/sync")}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:opacity-90 transition-all active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              مزامنة الآن
            </button>
            <button
              onClick={() => navigate("/sync/config")}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--border-normal)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-primary transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
              إعدادات ←
            </button>
          </div>
        </div>

        {/* Pending changes */}
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold mb-4 ${(pendingChanges?.length || 0) > 0
          ? "bg-[var(--warning-bg)] text-[var(--warning-text)]"
          : "bg-[var(--bg-base)] text-[var(--text-muted)]"
          }`}>
          <AlertCircle className="h-3.5 w-3.5" />
          {(pendingChanges?.length || 0) > 0
            ? `${pendingChanges.length} تغييرات معلقة تحتاج إلى المراجعة`
            : "لا توجد تغييرات معلقة"}
        </div>

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              آخر الطلبات من المتجر
            </div>
            <div className="space-y-1.5 mb-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-base)] hover:bg-[var(--bg-overlay)] transition-colors cursor-pointer">
                  <ShoppingCart className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                  <span className="text-xs font-bold text-[var(--text-primary)] flex-1 truncate">
                    {order.data?.customer_name || order.title || "طلب جديد"}
                  </span>
                  {order.data?.total && (
                    <span className="text-xs font-bold text-[var(--text-secondary)] shrink-0">
                      {Number(order.data.total).toLocaleString()} ر.س
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                    {timeAgo(order.created_at || order.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
  const initialLoadDone = useRef(false);

  const [settingsWarningDismissed, setSettingsWarningDismissed] = useState(() => {
    try { return localStorage.getItem('retailer:settings-warning-dismissed') === 'true'; } catch { return false; }
  });
  const [noItemsDismissed, setNoItemsDismissed] = useState(() => {
    try { return localStorage.getItem('retailer:no-items-dismissed') === 'true'; } catch { return false; }
  });

  const fetchDashboardData = useCallback(() => {
    let cancelled = false;
    if (!initialLoadDone.current) {
      setCheckingEmpty(true);
    }
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
      if (!cancelled) {
        initialLoadDone.current = true;
        setCheckingEmpty(false);
      }
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

  // ── Server connectivity health check ──────────────────────────────────
  const [isServerOnline, setIsServerOnline] = useState(true);
  const wasOfflineRef = useRef(false);
  const [showReconnectedMsg, setShowReconnectedMsg] = useState(false);

  useEffect(() => {
    const tracker = createDisconnectTracker({ threshold: 2 });
    let mounted = true;

    const check = async () => {
      try {
        await api.get("/api/health", { timeout: 8000 });
        const result = tracker.success();
        if (!mounted) return;
        setIsServerOnline(true);
        if (wasOfflineRef.current) {
          setShowReconnectedMsg(true);
          wasOfflineRef.current = false;
        }
      } catch (err) {
        const result = tracker.record(err);
        if (!mounted) return;
        const offline = result.offline;
        setIsServerOnline(!offline);
        if (offline) wasOfflineRef.current = true;
      }
    };

    check();
    const id = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // ── Messaging channels status (WhatsApp / SMS / Telegram) ────────────────
  const [channelsStatus, setChannelsStatus] = useState(null);
  const canViewChannels = canView("whatsapp_crm") || canView("settings");

  useEffect(() => {
    if (!canViewChannels) return;
    let cancelled = false;
    function load() {
      api.get("/api/whatsapp/channels-status")
        .then((res) => { if (!cancelled) setChannelsStatus(res.data?.data || null); })
        .catch(() => { if (!cancelled) setChannelsStatus(null); });
    }
    load();
    window.addEventListener("focus", load);
    const id = setInterval(load, 30000);
    return () => { cancelled = true; window.removeEventListener("focus", load); clearInterval(id); };
  }, [canViewChannels]);

  // ── Latest backup info ────────────────────────────────────────────────────
  const [backupInfo, setBackupInfo] = useState(null);
  const [backupPreview, setBackupPreview] = useState(null);
  const [backupTooltipOpen, setBackupTooltipOpen] = useState(false);
  const [backupTriggering, setBackupTriggering] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  useEffect(() => {
    if (!backupModalOpen) return;
    const h = (e) => { if (e.key === "Escape") setBackupModalOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [backupModalOpen]);
  const [backupToggling, setBackupToggling] = useState(false);
  const [backupLoading, setBackupLoading] = useState(true);
  const canViewBackup = canView("settings");

  const refreshBackupInfo = useCallback(() => {
    api.get("/api/backup/settings")
      .then((res) => setBackupInfo(res.data?.data || null))
      .catch(() => setBackupInfo(null));
  }, []);

  useEffect(() => {
    if (!canViewBackup) { setBackupLoading(false); return; }
    let cancelled = false;
    Promise.all([
      api.get("/api/backup/settings"),
      api.get("/api/backup/preview").catch(() => null),
    ]).then(([settingsRes, previewRes]) => {
      if (cancelled) return;
      setBackupInfo(settingsRes.data?.data || null);
      setBackupPreview(previewRes?.data?.data || null);
    }).catch(() => {
      if (!cancelled) setBackupInfo(null);
    }).finally(() => {
      if (!cancelled) setBackupLoading(false);
    });
    return () => { cancelled = true; };
  }, [canViewBackup]);

  const handleBackupNow = useCallback(async (e) => {
    e.stopPropagation();
    if (backupTriggering) return;
    setBackupTriggering(true);
    try {
      await api.post("/api/backup/trigger", { label: "من لوحة التحكم" });
      toast.success("✅ تم إنشاء نسخة احتياطية بنجاح");
      refreshBackupInfo();
      // Also refresh the backup preview sizes & count
      api.get("/api/backup/preview")
        .then((res) => setBackupPreview(res.data?.data || null))
        .catch(() => { });
    } catch {
      toast.error("فشل إنشاء النسخة الاحتياطية");
    } finally {
      setBackupTriggering(false);
    }
  }, [backupTriggering, refreshBackupInfo]);

  const handleToggleAutoBackup = useCallback(async () => {
    if (backupToggling) return;
    setBackupToggling(true);
    try {
      const res = await api.put("/api/backup/settings", { auto_backup_enabled: 1, auto_backup_interval_hours: 24 });
      setBackupInfo(res.data?.data || null);
      toast.success("✅ تم تفعيل النسخ الاحتياطي التلقائي");
    } catch {
      toast.error("فشل تفعيل النسخ الاحتياطي");
    } finally {
      setBackupToggling(false);
    }
  }, [backupToggling]);

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

  // ─── Live Clock (server-authoritative, DST-aware) ───────────────────────────
  const { clockTime, clockDate } = useServerClock();

  return (
    <div className="flex flex-col min-h-full font-sans bg-[var(--bg-base)] overflow-x-hidden selection:bg-primary/30" dir="rtl" style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 0%, var(--accent-soft) 0%, transparent 60%)" }}>

      {/* Feature hero — adaptive dark/elevated surface, correct on every theme */}
      <div className="bg-[var(--surface-feature)] px-6 md:px-12 pt-12 pb-24 rounded-b-[3rem] relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary-glow)_0%,transparent_40%)] rounded-b-[3rem] pointer-events-none hero-glow-anim" />
        <div className="dash-grain opacity-[0.03]" />
        <div className="dash-mesh opacity-[0.05]" />

        <header data-help="dashboard-header" className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-30 max-w-7xl mx-auto">
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

          {/* Live Clock + badges */}
          <div className="flex items-center gap-3" dir="ltr">
            {/* Clock — on the left (first in LTR) */}
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

            {/* Messaging channels */}
            {canViewChannels && !channelsStatus && (
              <div className="self-end mb-1 bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-xl animate-pulse">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-1.5 rounded bg-white/20" />
                  <div className="flex gap-1">
                    <div className="w-6 h-1.5 rounded bg-white/10" />
                    <div className="w-6 h-1.5 rounded bg-white/10" />
                    <div className="w-6 h-1.5 rounded bg-white/10" />
                  </div>
                </div>
              </div>
            )}
            {channelsStatus && (
              <Link
                to="/whatsapp-crm"
                title={`مركز الرسائل — واتساب: ${channelsStatus.whatsapp?.connected ? "متصل" : "غير متصل"} · SMS: ${channelsStatus.sms?.connected ? "مفعّلة" : "غير مفعّلة"} · تيليجرام: ${channelsStatus.telegram?.connected ? "مفعّل" : "غير مفعّل"} · البريد: ${channelsStatus.email?.connected ? "مفعّل" : "غير مفعّل"} · Meta: ${channelsStatus.meta?.connected ? "مربوط" : "غير مربوط"}`}
                className="bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 self-end mb-1 shadow-xl hover:bg-[var(--chip-on-primary-hover)] transition-colors"
              >
                <ChannelStatusDots status={channelsStatus} />
              </Link>
            )}

            {/* ── Backup Badge ─────────────────────────────────────────── */}
            {canViewBackup && backupLoading && (
              <div className="self-end mb-1 bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-xl animate-pulse">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-white/20" />
                  <div className="w-16 h-1.5 rounded bg-white/20" />
                  <div className="w-12 h-1 rounded bg-white/10" />
                </div>
              </div>
            )}
            {canViewBackup && !backupLoading && backupInfo !== null && (
              backupInfo.auto_backup_enabled ? (
                /* AUTO-BACKUP IS ON → show last backup time + backup-now button */
                <div className="relative self-end mb-1 z-50">
                  <button
                    type="button"
                    onClick={() => setBackupTooltipOpen((v) => !v)}
                    title={backupInfo.last_auto_backup_at
                      ? `آخر نسخة احتياطية: ${new Date(backupInfo.last_auto_backup_at).toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true })}`
                      : "أخر النسخ التلقائي مفعّل — لم تتم نسخة بعد"}
                    className="flex items-center gap-1.5 bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-xl hover:bg-[var(--chip-on-primary-hover)] transition-all group"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      </div>
                      <span className="text-[9px] font-black text-[var(--on-feature-muted)] group-hover:text-[var(--on-feature)] leading-none">أخر نسخه احتياطي</span>
                      <span className="text-[9px] font-bold text-[var(--on-feature-muted)] opacity-80 group-hover:opacity-100 leading-none">
                        {backupInfo.last_auto_backup_at
                          ? new Date(backupInfo.last_auto_backup_at).toLocaleString("ar-EG", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "لم تتم بعد"}
                      </span>
                    </div>
                  </button>

                  {/* Coverage popover */}
                  <AnimatePresence>
                    {backupTooltipOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setBackupTooltipOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="absolute top-full mt-2 right-0 z-50 w-72 rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)] overflow-hidden"
                          dir="rtl"
                        >
                          {/* Header */}
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-black text-[var(--text-primary)]">تغطية النسخة الاحتياطية</span>
                          </div>

                          {/* Coverage items */}
                          <div className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                              <Database className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                              <span className="flex-1 font-bold">قاعدة البيانات الكاملة</span>
                              <span className="text-[10px] font-bold text-[var(--text-muted)]">
                                {backupPreview?.db?.sizeBytes
                                  ? `${(backupPreview.db.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                                  : "محفوظة"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                              <ImageIcon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                              <span className="flex-1 font-bold">الصور والمرفقات</span>
                              <span className="text-[10px] font-bold text-[var(--text-muted)]">
                                {backupPreview?.images != null
                                  ? `${backupPreview.images.total} ملف`
                                  : "محفوظة"}
                              </span>
                            </div>
                            {/* Record counts */}
                            {backupPreview?.recordCounts && (
                              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-x-4 gap-y-1">
                                {Object.entries(backupPreview.recordCounts)
                                  .filter(([, v]) => v > 0)
                                  .slice(0, 6)
                                  .map(([table, count]) => (
                                    <div key={table} className="flex items-center justify-between text-[10px]">
                                      <span className="text-[var(--text-muted)] truncate">{{
                                        items: "أصناف", customers: "عملاء", suppliers: "موردون",
                                        invoices: "فواتير", purchases: "مشتريات", payments: "مدفوعات",
                                        shifts: "ورديات", stock_movements: "حركات مخزون",
                                        expenses: "مصروفات", revenues: "إيرادات", quotations: "عروض أسعار",
                                        invoice_lines: "بنود فواتير", purchase_orders: "أوامر شراء",
                                      }[table] || table}</span>
                                      <span className="font-black text-[var(--text-primary)] tabular-nums">{count.toLocaleString()}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 px-4 pb-4">
                            <button
                              type="button"
                              onClick={handleBackupNow}
                              disabled={backupTriggering}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-black hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                            >
                              {backupTriggering
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CloudUpload className="w-3.5 h-3.5" />}
                              {backupTriggering ? "جارٍ النسخ..." : "نسخ احتياطي الآن"}
                            </button>
                            <Link
                              to="/settings?tab=maintenance"
                              onClick={() => setBackupTooltipOpen(false)}
                              className="flex items-center justify-center gap-1 px-3 py-2 border border-[var(--border-normal)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:border-primary hover:text-primary transition-all"
                            >
                              <Settings2 className="w-3 h-3" />
                              إعدادات
                            </Link>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* AUTO-BACKUP IS OFF → activate CTA */
                <div className="relative self-end mb-1 z-50">
                  <button
                    type="button"
                    onClick={() => setBackupModalOpen(true)}
                    title="النسخ التلقائي غير مفعّل — اضغط لتفعيله"
                    className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 rounded-xl px-3 py-2 shadow-xl hover:bg-amber-500/30 hover:border-amber-400/70 transition-all group"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-amber-400 shrink-0" />
                        <PlayCircle className="w-3 h-3 text-amber-400 shrink-0" />
                      </div>
                      <span className="text-[9px] font-black text-amber-300 leading-none">أخر النسخ التلقائي</span>
                      <span className="text-[9px] font-bold text-amber-400/80 group-hover:text-amber-300 leading-none">غير مفعّل — فعّله</span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {backupModalOpen && (
                      <>
                        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setBackupModalOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)] overflow-hidden"
                          dir="rtl"
                        >
                          {/* Header */}
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)] bg-amber-500/10">
                            <HardDrive className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-black text-[var(--text-primary)]">تفعيل النسخ الاحتياطي التلقائي</span>
                            <button type="button" onClick={() => setBackupModalOpen(false)} className="mr-auto p-1 rounded-lg hover:bg-[var(--bg-overlay)]">
                              <X className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                          </div>

                          {/* Body */}
                          <div className="p-5 space-y-4">
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                              النسخ الاحتياطي التلقائي يحتفظ بنسخ احتياطية من قاعدة البيانات بشكل دوري، لحماية بياناتك من الفقدان.
                            </p>

                            {/* Info cards */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-center">
                                <Database className="w-6 h-6 mx-auto mb-1.5 text-amber-400" />
                                <span className="text-[10px] font-black text-[var(--text-primary)] block">قاعدة البيانات</span>
                                <span className="text-[9px] font-bold text-[var(--text-secondary)]">نسخ كامل ودوري</span>
                              </div>
                              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-center">
                                <CloudUpload className="w-6 h-6 mx-auto mb-1.5 text-amber-400" />
                                <span className="text-[10px] font-black text-[var(--text-primary)] block">كل 24 ساعة</span>
                                <span className="text-[9px] font-bold text-[var(--text-secondary)]">تلقائي بدون تدخل</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer actions */}
                          <div className="flex items-center gap-2 px-4 pb-4">
                            <button
                              type="button"
                              onClick={handleBackupNow}
                              disabled={backupTriggering}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary text-white rounded-xl text-xs font-black hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
                            >
                              {backupTriggering
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CloudUpload className="w-3.5 h-3.5" />}
                              {backupTriggering ? "جارٍ النسخ..." : "نسخ احتياطي الآن"}
                            </button>
                            <button
                              type="button"
                              onClick={handleToggleAutoBackup}
                              disabled={backupToggling}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-60"
                            >
                              {backupToggling
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <PlayCircle className="w-3.5 h-3.5" />}
                              {backupToggling ? "جارٍ التفعيل..." : "تفعيل التلقائي"}
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )
            )}

            {/* Version / connection status — always last */}
            {appVersion && appVersion !== "web" && (
              <div className="bg-[var(--chip-on-primary)] backdrop-blur-xl border border-white/10 rounded-xl px-3 py-1.5 self-end mb-1 shadow-xl flex items-center gap-2">
                {isServerOnline ? (
                  <Wifi className="w-3 h-3 text-[var(--success-border)]" />
                ) : (
                  <WifiOff className="w-3 h-3 text-[var(--danger-text)]" />
                )}
                <span className={`text-[10px] font-black tracking-widest ${isServerOnline ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}>
                  {isServerOnline ? 'متصل' : 'غير متصل'}
                </span>
                <span className="text-[10px] font-black text-[var(--on-feature-muted)] tracking-widest">{String(appVersion).replace(/^v/i, "")}</span>
              </div>
            )}
          </div>
        </header>

        {/* Primary shortcuts */}
        <SectionErrorBoundary>
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
        </SectionErrorBoundary>
      </div>

      {/* Reconnected banner */}
      <AnimatePresence>
        {showReconnectedMsg && (
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20"
          >
            <div className="relative rounded-[2rem] border-2 border-[var(--success-border)] bg-[var(--success-bg)]/80 p-4 md:p-5 flex items-center justify-between gap-4 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success-light)] text-[var(--success-text)]">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--success-text)]">تمت استعادة الاتصال بالخادم</p>
                  <p className="text-[11px] font-bold text-[var(--success-text)]">النظام متصل ويعمل بشكل طبيعي</p>
                </div>
              </div>
              <button
                onClick={() => setShowReconnectedMsg(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--success-light)] text-[var(--success-text)] hover:bg-[var(--success-bg)] transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="relative rounded-[2rem] border-2 border-[var(--success-border)] bg-[var(--success-bg)]/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
              <button
                onClick={dismissBanner}
                className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--success-light)] text-[var(--success-text)] hover:bg-[var(--success-bg)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--success-light)] text-[var(--success-text)]">
                  <ArrowDownCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[var(--success-text)]">تحديث جديد متاح!</h3>
                  <p className="mt-1 text-sm font-bold text-[var(--success-text)]">إصدار جديد من النظام متاح للتحميل. انتقل إلى صفحة التحديثات للتثبيت.</p>
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

      {/* Critical settings warning — dismissible */}
      {(initialLoadDone.current || !checkingEmpty) && missingCritical.length > 0 && !settingsWarningDismissed && (
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20">
          <div className="relative">
            <button
              onClick={() => {
                try { localStorage.setItem('retailer:settings-warning-dismissed', 'true'); } catch { }
                setSettingsWarningDismissed(true);
              }}
              className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--warning-light)] text-[var(--warning-text)] hover:bg-[var(--warning-bg)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <CriticalSettingsWarning
              settings={settings}
              onNavigate={(key) => navigate(`/settings?tab=${fieldKeyToTab(key)}&field=${key}`)}
              lang="ar"
            />
          </div>
        </div>
      )}

      {/* Empty items banner — dismissible */}
      {(initialLoadDone.current || !checkingEmpty) && noItems && !noItemsDismissed && (
        <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mt-6 relative z-20">
          <div className="relative rounded-[2rem] border-2 border-dashed border-[var(--warning-border)] bg-[var(--warning-bg)]/80 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
            <button
              onClick={() => {
                try { localStorage.setItem('retailer:no-items-dismissed', 'true'); } catch { }
                setNoItemsDismissed(true);
              }}
              className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--warning-light)] text-[var(--warning-text)] hover:bg-[var(--warning-bg)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--warning-light)] text-[var(--warning-text)]">
                <Package className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[var(--warning-text)]">لم يتم إضافة أي أصناف بعد</h3>
                <p className="mt-1 text-sm font-bold text-[var(--warning-text)]">ابدأ بتعريف الأصناف والمنتجات لتشغيل المخزون والمبيعات</p>
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

      <AnnouncementBanner />

      {/* ⚡ Sync Dashboard Widget */}
      <SyncDashboardWidget />

      {/* Command center */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 relative z-20 pb-20 mt-6">

        {/* Quick-action legend */}
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-[11px] font-bold text-[var(--text-muted)]">مرّر على الكارت لتظهر أزرار الإجراء السريع</span>
        </div>

        {/* Module tabs */}
        <LayoutGroup>
          <div data-help="module-tabs" className="flex items-center gap-2 p-2 bg-[var(--bg-elevated)]/80 backdrop-blur-xl rounded-[2rem] border border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] overflow-x-auto hide-scrollbar mb-8">
            {visibleModules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveTabId(module.id)}
                className="relative px-6 py-4 rounded-3xl flex items-center gap-3 whitespace-nowrap outline-none group transition-colors hover:bg-[var(--bg-input)]"
              >
                {activeTabId === module.id && (
                  <motion.div layoutId="active-tab" className="absolute inset-0 bg-primary rounded-3xl" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
                )}
                <module.icon className={`w-5 h-5 relative z-10 transition-colors duration-300 ${activeTabId === module.id ? "text-white" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}`} strokeWidth={2} />
                <span className={`text-sm font-black tracking-wide relative z-10 transition-colors duration-300 ${activeTabId === module.id ? "text-white" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                  {module.title}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Cards grid */}
        <SectionErrorBoundary>
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
                    <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} channelsStatus={channelsStatus} onQuickAction={setQuickModal} />
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
                        <div className="xl:col-span-3 flex items-center gap-2">
                          <ShoppingBag className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
                          <span className="text-[11px] font-black text-[var(--text-muted)] tracking-wide">المبيعات</span>
                        </div>
                        <div className="relative ltr:pl-5 rtl:pr-5 flex items-center gap-2">
                          <div className="absolute ltr:left-0 rtl:right-0 inset-y-0 w-px bg-[var(--border-accent)]" />
                          <Package className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
                          <span className="text-[11px] font-black text-[var(--text-muted)] tracking-wide">أخرى</span>
                        </div>
                      </div>
                      {/* <xl: simple header */}
                      <div className="xl:hidden flex items-center gap-2 mb-3">
                        <ShoppingBag className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
                        <span className="text-[11px] font-black text-[var(--text-muted)] tracking-wide">المبيعات</span>
                      </div>
                      <div className="h-px w-full bg-[var(--border-subtle)]" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                        {salesItems.map(item => (
                          <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} channelsStatus={channelsStatus} onQuickAction={setQuickModal} />
                        ))}
                        <div className="relative ltr:pl-5 rtl:pr-5">
                          <div className="hidden xl:block absolute ltr:left-0 rtl:right-0 top-0 bottom-0 w-px bg-[var(--border-subtle)]" />
                          {otherItems.map(item => (
                            <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} channelsStatus={channelsStatus} onQuickAction={setQuickModal} />
                          ))}
                        </div>
                      </div>
                    </div>,
                    <div key="sec-purchases" className="col-span-full pt-10">
                      <div className="flex items-center gap-2 mb-3">
                        <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
                        <span className="text-[11px] font-black text-[var(--text-muted)] tracking-wide">المشتريات</span>
                      </div>
                      <div className="h-px w-full bg-[var(--border-subtle)]" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                        {purchasesItems.map(item => (
                          <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} channelsStatus={channelsStatus} onQuickAction={setQuickModal} />
                        ))}
                      </div>
                    </div>,
                  ];
                }

                return Object.entries(groups).flatMap(([family, items]) => [
                  <div key={`hdr-${family}`} className="col-span-full pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-3.5 rounded-full bg-[var(--primary)]" />
                      <span className="text-[11px] font-black text-[var(--text-muted)] tracking-wide">{family === "purchases" ? "المشتريات" : family}</span>
                    </div>
                    <div className="h-px w-full bg-[var(--border-subtle)]" />
                  </div>,
                  ...items.map(item => (
                    <MagneticCard key={item.path} item={item} active={isActive(item.path)} updateAvailable={updateAvailable} channelsStatus={channelsStatus} onQuickAction={setQuickModal} />
                  )),
                ]);
              })()}
            </motion.div>
          )}
        </AnimatePresence>
        </SectionErrorBoundary>
      </div>

      {/* Quick-entry modal */}
      <SectionErrorBoundary>
      <AnimatePresence>
        {quickModal && (
          <QuickEntryModal type={quickModal} onClose={closeModal} />
        )}
      </AnimatePresence>
      </SectionErrorBoundary>
    </div>
  );
}
