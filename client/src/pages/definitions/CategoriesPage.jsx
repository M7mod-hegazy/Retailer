import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
  ArrowRight, BarChart3, Box, DollarSign, Pencil, Plus, Tag, Trash2, 
  ChevronLeft, ChevronRight, X, Sparkles, Database, AlertCircle, Info, Lock,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../../services/api";
import ImageUpload from "../../components/ui/ImageUpload";
import PermissionGate from "../../components/ui/PermissionGate";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { usePageTour } from "../../hooks/usePageTour";
import { formatNumber } from "../../utils/currency";
import { resolveImageUrl } from "../../utils/resolveImageUrl";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(v) {
  return formatNumber(v, { decimals: 0 });
}

// ─── Procedural Category Avatar ─────────────────────────────────────────────
function CategoryAvatar({ url, name, skuPrefix }) {
  const src = resolveImageUrl(url);
  if (src) {
    return <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-border-normal/50 shadow-sm" />;
  }

  // Generate a distinct gradient color based on character codes of the name
  const seed = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + (Number(skuPrefix) || 0);
  const gradients = [
    "from-rose-450 to-pink-550 text-rose-50 shadow-rose-500/10",
    "from-amber-400 to-orange-500 text-amber-50 shadow-amber-500/10",
    "from-emerald-400 to-teal-500 text-emerald-50 shadow-emerald-500/10",
    "from-sky-400 to-indigo-500 text-sky-50 shadow-sky-500/10",
    "from-violet-400 to-purple-500 text-violet-50 shadow-purple-500/10",
    "from-cyan-400 to-blue-500 text-cyan-50 shadow-blue-500/10",
  ];
  const grad = gradients[seed % gradients.length];
  const initials = (name || "").trim().slice(0, 2);

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-sm font-black shadow-lg uppercase`}>
      {initials}
    </div>
  );
}

// ─── Spotlight Card Component ───────────────────────────────────────────────
function SpotlightCard({ children, className = "", onClick, isSelected }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`relative overflow-hidden rounded-[24px] border p-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] cursor-default ${
        isSelected ? "ring-2 ring-emerald-500/20 border-emerald-500 bg-emerald-50/10" : "bg-bg-surface border-border-normal/60 hover:border-slate-350"
      } ${className}`}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(200px circle at ${coords.x}px ${coords.y}px, rgba(16, 185, 129, 0.05), transparent 80%)`,
          }}
        />
      )}
      <div className="relative z-10 h-full flex flex-col justify-between">{children}</div>
    </div>
  );
}

// ─── Background Spline Header ───────────────────────────────────────────────
const SplineHeader = () => (
  <div className="absolute top-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none z-0 opacity-45">
    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
      <defs>
        <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path 
        d="M-100,80 C150,130 250,30 450,80 C650,130 750,60 950,100 C1050,120 1150,80 1250,80" 
        fill="none" stroke="url(#emeraldGradient)" strokeWidth="3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
      <motion.path 
        d="M-100,100 C180,150 280,50 480,100 C680,150 780,80 980,120 C1080,140 1180,100 1280,100" 
        fill="none" stroke="#10b981" strokeOpacity="0.08" strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.7, ease: "easeInOut", delay: 0.2 }}
      />
    </svg>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-base)]" />
  </div>
);

// ─── Main Page Component ────────────────────────────────────────────────────

export default function CategoriesPage() {
  usePageTour('categories');
  const handleKeyDown = useFieldNavigation();
  const skuPrefixRef = useRef(null);
  const nameRef = useRef(null);
  const submitBtnRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catDraft, setCatDraft] = useState({ name: "", sku_prefix: "", image_url: "" });
  const [catModal, setCatModal] = useState(null); // null | {mode:'add'|'edit', data}
  const [deleteModal, setDeleteModal] = useState(null);
  useEffect(() => {
    if (!deleteModal) return;
    const h = (e) => { if (e.key === "Escape") setDeleteModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deleteModal]);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get("/api/categories"),
        api.get("/api/items"),
      ]);
      const cats = Array.isArray(catRes.data?.data) ? catRes.data.data : [];
      const allItems = Array.isArray(itemRes.data?.data) ? itemRes.data.data : [];

      const grouped = {};
      cats.forEach((c) => { grouped[c.id] = []; });
      allItems.forEach((item) => {
        if (item.category_id != null) {
          if (!grouped[item.category_id]) grouped[item.category_id] = [];
          grouped[item.category_id].push(item);
        }
      });

      setCategories(cats);
      setItemsByCategory(grouped);
      setSelectedId((prev) => prev ?? cats[0]?.id ?? null);
    } catch {
      toast.error("تعذر تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const isFirstCategory = categories.length === 0;

  // ── Category CRUD ──
  function openAddCategory() {
    const used = categories.map((cat) => Number(cat.sku_prefix)).filter(Number.isFinite);
    const nextPrefix = String((used.length ? Math.max(...used) : 0) + 1);
    setCatDraft({ name: "", sku_prefix: nextPrefix, image_url: "" });
    setCatModal({ mode: "add", data: null });
  }

  function openEditCategory(cat) {
    setCatDraft({ name: cat.name, sku_prefix: cat.sku_prefix || "", image_url: cat.image_url || "" });
    setCatModal({ mode: "edit", data: cat });
  }

  async function submitCategory(e) {
    e.preventDefault();
    if (!catDraft.name.trim()) return;
    setSaving(true);
    try {
      if (catModal.mode === "add") {
        const res = await api.post("/api/categories", { 
          name: catDraft.name.trim(), 
          sku_prefix: String(catDraft.sku_prefix || "").trim() || undefined, 
          image_url: catDraft.image_url || null 
        });
        const newCat = res.data?.data;
        toast.success("تمت إضافة الفئة.");
        setCatModal(null);
        await loadAll();
        if (newCat?.id) setSelectedId(newCat.id);
      } else {
        await api.put(`/api/categories/${catModal.data.id}`, { 
          name: catDraft.name.trim(), 
          image_url: catDraft.image_url || null 
        });
        toast.success("تم تحديث الفئة.");
        setCatModal(null);
        await loadAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حفظ الفئة.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(cat) {
    const linkedItems = itemsByCategory[cat.id] ?? [];
    if (linkedItems.length) {
      setDeleteModal(cat);
      return;
    }
    setSaving(true);
    try {
      await api.delete(`/api/categories/${cat.id}`);
      toast.success("تم حذف الفئة.");
      if (selectedId === cat.id) setSelectedId(null);
      setDeleteModal(null);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حذف الفئة.");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived Analytics ──
  const categoryStats = useMemo(() => {
    const stats = {};
    for (const cat of categories) {
      const items = itemsByCategory[cat.id] ?? [];
      const totalItems = items.length;
      const activeItems = items.filter(i => i.is_active !== 0).length;
      const totalStock = items.reduce((sum, i) => sum + (i.stock_quantity || 0), 0);
      const totalValue = items.reduce((sum, i) => sum + ((i.stock_quantity || 0) * (i.purchase_price || 0)), 0);
      const avgMargin = items.length > 0
        ? items.reduce((sum, i) => {
            const p = Number(i.purchase_price || 0);
            const s = Number(i.sale_price || 0);
            if (p > 0 && s > 0) return sum + ((s - p) / p) * 100;
            return sum;
          }, 0) / items.length
        : 0;
      stats[cat.id] = { totalItems, activeItems, totalStock, totalValue, avgMargin };
    }
    return stats;
  }, [categories, itemsByCategory]);

  const aggregateStats = useMemo(() => {
    const allItems = Object.values(itemsByCategory).flat();
    const totalCategories = categories.length;
    const totalItems = allItems.length;
    const totalStock = allItems.reduce((sum, i) => sum + (i.stock_quantity || 0), 0);
    const totalValue = allItems.reduce((sum, i) => sum + ((i.stock_quantity || 0) * (i.purchase_price || 0)), 0);
    return { totalCategories, totalItems, totalStock, totalValue };
  }, [categories, itemsByCategory]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-6 md:px-8 py-8 min-h-[100dvh] bg-[var(--bg-base)]" dir="rtl">
        <div className="h-32 rounded-2xl bg-border-normal animate-pulse w-full" />
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-border-normal animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-border-normal rounded animate-pulse" />
            <div className="h-3 w-72 bg-bg-overlay rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border-normal bg-bg-surface p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-bg-overlay animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-bg-overlay rounded animate-pulse w-1/2" />
                  <div className="h-2 bg-bg-overlay rounded animate-pulse w-2/3" />
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                {[...Array(3)].map((_, j) => <div key={j} className="h-2 bg-bg-overlay rounded animate-pulse flex-1" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 md:px-8 py-8 min-h-[100dvh] relative bg-[var(--bg-base)]" dir="rtl">
      
      <SplineHeader />

      {/* Hero Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-250/20 shrink-0">
            <Sparkles className="h-6 w-6 stroke-[1.8]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-zinc-950 tracking-tight leading-none">أقسام الأصناف</h1>
            <p className="text-xs font-bold text-text-secondary mt-2 block tracking-wider leading-none">إدارة تصنيفات المنتجات وتحليلاتها التشغيلية والمالية.</p>
          </div>
        </div>
        <PermissionGate page="categories" action="add">
          <button
            onClick={openAddCategory}
            className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-600 active:scale-95 text-sm font-black text-white px-5 py-2.5 shadow-md shadow-emerald-500/10 transition-all shrink-0 self-start sm:self-center"
          >
            <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
            إضافة قسم جديد
          </button>
        </PermissionGate>
      </div>

      {/* Bento Summary Stats Deck */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-7xl mx-auto w-full">
        {/* Stat Card 1 */}
        <div className="relative group rounded-3xl bg-[var(--bg-surface)] p-5 border border-[var(--border-normal)] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-2">إجمالي الأقسام</p>
              <p className="text-2xl font-black text-zinc-900 leading-none font-mono">{aggregateStats.totalCategories}</p>
            </div>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="relative group rounded-3xl bg-[var(--bg-surface)] p-5 border border-[var(--border-normal)] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100/50">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-2">إجمالي الأصناف</p>
              <p className="text-2xl font-black text-zinc-900 leading-none font-mono">{aggregateStats.totalItems}</p>
            </div>
          </div>
        </div>




      </div>

      {/* Categories Modern Grid */}
      <div data-help="main-table" className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto w-full">
        {categories.map((cat) => {
          const stats = categoryStats[cat.id] || { totalItems: 0, activeItems: 0, totalStock: 0, totalValue: 0, avgMargin: 0 };
          const isSelected = cat.id === selectedId;

          // Margin styling helpers
          const marginColor = stats.avgMargin >= 30 
            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20" 
            : stats.avgMargin >= 15 
            ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20" 
            : "bg-bg-overlay text-text-secondary border-border-normal dark:bg-zinc-800/40";

          return (
            <SpotlightCard
              key={cat.id}
              isSelected={isSelected}
              onClick={() => setSelectedId(cat.id)}
            >
              {/* Category Header */}
              <div className="flex items-start gap-4 mb-5">
                <CategoryAvatar url={cat.image_url} name={cat.name} skuPrefix={cat.sku_prefix} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl px-2.5 py-1 font-mono text-xs font-black border border-emerald-200/80 bg-emerald-50/50 text-emerald-700 shadow-sm leading-tight shrink-0">
                      #{cat.sku_prefix || cat.id}
                    </span>
                    <h3 className="text-base font-black text-zinc-900 truncate leading-none">{cat.name}</h3>
                  </div>
                  <p className="text-[11px] font-bold text-slate-450 mt-2 block tracking-wider leading-none">
                    {stats.totalItems} صنف <span className="text-text-muted font-normal">|</span> {stats.activeItems} نشط
                  </p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 gap-2.5 mb-5">
                <div className="rounded-2xl p-2.5 text-center bg-bg-overlay/50 dark:bg-zinc-900/30 border border-border-subtle/40">
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">متوسط الهامش</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-black leading-none font-mono ${marginColor}`}>
                    {stats.avgMargin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Heatmap Micro Margin bar */}
              <div className="w-full bg-bg-overlay dark:bg-zinc-800 rounded-full h-1.5 mb-5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.avgMargin >= 30 ? "bg-emerald-500" : stats.avgMargin >= 15 ? "bg-amber-500" : "bg-text-muted"
                  }`} 
                  style={{ width: `${Math.min(100, Math.max(5, stats.avgMargin))}%` }} 
                />
              </div>

              {/* Actions & Navigation */}
              <div className="flex items-center justify-between pt-3.5 border-t border-[var(--border-subtle)] relative z-25">
                <Link
                  to={`/definitions/items?category=${cat.id}`}
                  className="group/link flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-850 transition-colors leading-none"
                >
                  <span>عرض الأصناف بالقسم</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:-translate-x-1" />
                </Link>
                
                <div className="flex items-center gap-1.5 transition-all">
                  <PermissionGate page="categories" action="edit">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg-overlay text-slate-505 hover:text-text-primary hover:bg-bg-overlay border border-border-normal/60 shadow-sm transition-all cursor-pointer"
                      title="تعديل"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </PermissionGate>
                  <PermissionGate page="categories" action="delete">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteModal(cat); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50/50 text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 border border-rose-100/55 shadow-sm transition-all cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="relative z-10 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-overlay text-text-muted mb-5 border border-border-normal/50">
            <Tag className="h-7 w-7" />
          </div>
          <h3 className="text-base font-black text-zinc-800">لا توجد أقسام بعد</h3>
          <p className="text-xs font-bold text-slate-450 mt-2 leading-relaxed">أضف الأقسام التشغيلية لتنظيم كتالوج أصنافك وإظهار التحليلات المناسبة.</p>
          <PermissionGate page="categories" action="add">
            <button
              onClick={openAddCategory}
              className="mt-6 flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-600 active:scale-95 text-sm font-black text-white px-5 py-2.5 shadow-md shadow-emerald-500/10 transition-all"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
              {isFirstCategory ? "إنشاء القسم الأول (فئة 1)" : "إضافة قسم جديد"}
            </button>
          </PermissionGate>
        </div>
      )}

      {/* ── Category Delete Dialog ── */}
      <AnimatePresence>
        {deleteModal && (() => {
          const linkedItems = itemsByCategory[deleteModal.id] ?? [];
          const blocked = linkedItems.length > 0;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setDeleteModal(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-bg-surface rounded-3xl p-6 shadow-2xl border border-border-normal overflow-hidden"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${blocked ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                  {blocked ? <AlertCircle className="h-6 w-6" /> : <Trash2 className="h-6 w-6" />}
                </div>
                
                <h3 className="text-lg font-black text-zinc-950">
                  {blocked ? "لا يمكن حذف هذا القسم الآن" : "تأكيد حذف القسم"}
                </h3>
                
                <p className="mt-2 text-xs font-bold text-text-secondary leading-relaxed">
                  {blocked
                    ? `القسم "${deleteModal.name}" مرتبط بعدد ${linkedItems.length} صنف. انقل الأصناف لقسم آخر أو احذفها أولاً، لتتمكن من حذف القسم.`
                    : `سيتم حذف القسم "${deleteModal.name}" نهائياً من قاعدة البيانات لأنه لا يحتوي على أي أصناف مرتبطة.`}
                </p>

                {blocked && (
                  <div className="mt-4 rounded-2xl border border-rose-100/50 bg-rose-50/50 p-4">
                    <div className="text-[11px] font-black text-rose-700 flex items-center gap-1 mb-2">
                      <Info className="h-3 w-3" /> الأصناف المرتبطة بالقسم
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto no-scrollbar">
                      {linkedItems.slice(0, 4).map((item) => (
                        <div key={item.id} className="truncate rounded-xl border border-rose-100/30 bg-bg-surface px-3 py-2 text-2sm font-bold text-text-primary">
                          {item.code ? `${item.code} - ` : ""}{item.name}
                        </div>
                      ))}
                      {linkedItems.length > 4 && (
                        <div className="text-[10px] font-black text-rose-600 text-center mt-1">
                          و {linkedItems.length - 4} أصناف أخرى مرتبطة
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="rounded-xl border border-border-normal px-5 py-2.5 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors"
                  >
                    إغلاق
                  </button>
                  {!blocked && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => deleteCategory(deleteModal)}
                      className="rounded-xl bg-rose-600 text-white font-black text-sm px-5 py-2.5 hover:bg-rose-700 disabled:opacity-50 transition-all shadow-md shadow-rose-500/10"
                    >
                      {saving ? "جاري الحذف..." : "حذف القسم"}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── Category Form Dialog (Add / Edit) ── */}
      <AnimatePresence>
        {catModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setCatModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-bg-surface rounded-3xl p-6 shadow-2xl border border-border-normal overflow-hidden flex flex-col"
            >
              <h3 className="text-lg font-black text-zinc-950 mb-5">
                {catModal.mode === "edit" ? "تعديل القسم" : isFirstCategory ? "إضافة القسم الأول (الفئة 1)" : `إضافة قسم جديد — الفئة ${String(Number(catDraft.sku_prefix) || categories.length + 1)}`}
              </h3>
              
              <form onSubmit={submitCategory} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-black text-text-muted uppercase tracking-widest">كود SKU للفئة</label>
                  <div className="relative">
                    <input
                      ref={skuPrefixRef}
                      readOnly={catModal.mode === "edit"}
                      value={catDraft.sku_prefix}
                      onChange={(e) => setCatDraft((p) => ({ ...p, sku_prefix: e.target.value.replace(/[^\d]/g, "") }))}
                      onKeyDown={e => handleKeyDown(e, { nextRef: nameRef })}
                      className={`w-full h-11 rounded-xl border px-4 font-mono text-sm font-bold outline-none transition-all ${
                        catModal.mode === "edit" 
                          ? "bg-bg-overlay text-text-muted border-slate-205 cursor-not-allowed" 
                          : "bg-bg-overlay/50 border-border-normal/60 focus:bg-bg-surface focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10"
                      }`}
                    />
                    {catModal.mode === "edit" && <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-350" />}
                  </div>
                  {catModal.mode === "add" && (
                    <div className="mt-1 text-[9px] font-black text-text-muted">تم اختيار الرقم التالي تلقائياً، ويمكنك تعديله قبل الحفظ.</div>
                  )}
                </div>

                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <label className="mb-2 block text-[10px] font-black text-slate-455 uppercase tracking-widest">صورة القسم</label>
                    <ImageUpload 
                      size="md"
                      url={catDraft.image_url || null}
                      onUpload={(url) => setCatDraft((p) => ({ ...p, image_url: url }))}
                      onRemove={() => setCatDraft((p) => ({ ...p, image_url: "" }))}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-[10px] font-black text-slate-455 uppercase tracking-widest">اسم القسم <span className="text-rose-500">*</span></label>
                    <input
                      ref={nameRef}
                      autoFocus
                      value={catDraft.name}
                      onChange={(e) => setCatDraft((p) => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: skuPrefixRef })}
                      required
                      placeholder="زيوت، بويات، أدوات صحية..."
                      className="w-full h-11 rounded-xl border border-border-normal/60 bg-bg-overlay/50 px-4 text-sm font-bold outline-none focus:bg-bg-surface focus:border-emerald-450 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-text-muted"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle mt-4">
                  <button
                    type="button"
                    onClick={() => setCatModal(null)}
                    className="rounded-xl border border-border-normal px-5 py-2.5 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    ref={submitBtnRef}
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-primary text-white font-black text-sm px-6 py-2.5 hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-md shadow-emerald-500/10"
                  >
                    {saving ? "جاري الحفظ…" : catModal.mode === "edit" ? "حفظ التعديلات" : isFirstCategory ? "إنشاء القسم الأول" : "إنشاء القسم"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
