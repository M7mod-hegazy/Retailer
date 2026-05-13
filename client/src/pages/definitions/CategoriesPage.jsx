import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, Box, DollarSign, Pencil, Plus, Tag, Trash2, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import api from "../../services/api";
import ImageUpload from "../../components/ui/ImageUpload";
import PermissionGate from "../../components/ui/PermissionGate";

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

function resolveUrl(u) {
  if (!u) return null;
  return u.startsWith("http") ? u : `${BASE}${u}`;
}

function CatThumb({ url }) {
  const src = resolveUrl(url);
  if (!src) return null;
  return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200" />;
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catDraft, setCatDraft] = useState({ name: "", sku_prefix: "", image_url: "" });
  const [catModal, setCatModal] = useState(null); // null | {mode:'add'|'edit', data}
  const [deleteModal, setDeleteModal] = useState(null);
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

  // ── category CRUD ──
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
        const res = await api.post("/api/categories", { name: catDraft.name.trim(), sku_prefix: String(catDraft.sku_prefix || "").trim() || undefined, image_url: catDraft.image_url || null });
        const newCat = res.data?.data;
        toast.success("تمت إضافة الفئة.");
        setCatModal(null);
        await loadAll();
        if (newCat?.id) setSelectedId(newCat.id);
      } else {
        await api.put(`/api/categories/${catModal.data.id}`, { name: catDraft.name.trim(), image_url: catDraft.image_url || null });
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

  // ── derived ──
  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;
  const selectedItems = selectedId ? (itemsByCategory[selectedId] ?? []) : [];

  // Category analytics
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400" dir="rtl">
        جاري تحميل البيانات…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-slate-900">أقسام الأصناف</h1>
          <p className="text-[13px] font-bold text-slate-400">إدارة تصنيفات المنتجات وتحليلاتها</p>
        </div>
        <PermissionGate page="categories" action="add">
        <button
          onClick={openAddCategory}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-emerald-700 transition-all"
        >
          <Plus className="h-4 w-4" />
          إضافة قسم جديد
        </button>
        </PermissionGate>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase">إجمالي الأقسام</p>
              <p className="text-[20px] font-black text-slate-900">{categories.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase">إجمالي الأصناف</p>
              <p className="text-[20px] font-black text-slate-900">{Object.values(itemsByCategory).flat().length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase">إجمالي المخزون</p>
              <p className="text-[20px] font-black text-slate-900">{formatMoney(Object.values(itemsByCategory).flat().reduce((sum, i) => sum + (i.stock_quantity || 0), 0))}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase">قيمة المخزون</p>
              <p className="text-[20px] font-black text-slate-900">{formatMoney(Object.values(itemsByCategory).flat().reduce((sum, i) => sum + ((i.stock_quantity || 0) * (i.purchase_price || 0)), 0))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const stats = categoryStats[cat.id] || { totalItems: 0, activeItems: 0, totalStock: 0, totalValue: 0, avgMargin: 0 };
          const isSelected = cat.id === selectedId;

          return (
            <div
              key={cat.id}
              className={`group relative rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                isSelected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
              }`}
            >
              {/* Category Header */}
              <div className="flex items-start gap-4 mb-4">
                {cat.image_url ? (
                  <CatThumb url={cat.image_url} />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <Tag className="h-5 w-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-600">
                      {cat.sku_prefix}
                    </span>
                    <h3 className="text-[15px] font-black text-slate-900 truncate">{cat.name}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{stats.totalItems} صنف • {stats.activeItems} نشط</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">المخزون</p>
                  <p className="text-[14px] font-black text-slate-700">{formatMoney(stats.totalStock)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">القيمة</p>
                  <p className="text-[14px] font-black text-slate-700">{formatMoney(stats.totalValue)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase">الهامش</p>
                  <p className={`text-[14px] font-black ${stats.avgMargin >= 10 ? "text-emerald-600" : stats.avgMargin >= 5 ? "text-amber-600" : "text-slate-700"}`}>
                    {stats.avgMargin.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Link
                  to={`/definitions/items?category=${cat.id}`}
                  className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <span>عرض الأصناف</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <PermissionGate page="categories" action="edit">
                  <button
                    onClick={() => openEditCategory(cat)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="تعديل"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  </PermissionGate>
                  <PermissionGate page="categories" action="delete">
                  <button
                    onClick={() => setDeleteModal(cat)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  </PermissionGate>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
            <Tag className="h-8 w-8" />
          </div>
          <h3 className="text-[16px] font-black text-slate-700">لا توجد أقسام بعد</h3>
          <p className="text-[13px] text-slate-400 mt-1">ابدأ بإنشاء قسم جديد لتنظيم أصنافك</p>
          <PermissionGate page="categories" action="add">
          <button
            onClick={openAddCategory}
            className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-emerald-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            إضافة قسم جديد
          </button>
          </PermissionGate>
        </div>
      )}

      {/* ── category modal ── */}
      {deleteModal && (() => {
        const linkedItems = itemsByCategory[deleteModal.id] ?? [];
        const blocked = linkedItems.length > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" dir="rtl">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${blocked ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-[18px] font-black text-slate-900">
                {blocked ? "لا يمكن حذف هذا القسم الآن" : "تأكيد حذف القسم"}
              </h3>
              <p className="mt-2 text-[13px] font-bold leading-6 text-slate-500">
                {blocked
                  ? `القسم "${deleteModal.name}" مرتبط بعدد ${linkedItems.length} صنف. انقل الأصناف لقسم آخر أو احذفها أولا، ثم احذف القسم.`
                  : `سيتم حذف القسم "${deleteModal.name}" نهائيا لأنه لا يحتوي على أصناف.`}
              </p>
              {blocked ? (
                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
                  <div className="text-[11px] font-black text-rose-700">أصناف مرتبطة بالقسم</div>
                  <div className="mt-2 space-y-1">
                    {linkedItems.slice(0, 4).map((item) => (
                      <div key={item.id} className="truncate rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-slate-700">
                        {item.code ? `${item.code} - ` : ""}{item.name}
                      </div>
                    ))}
                    {linkedItems.length > 4 ? (
                      <div className="text-[11px] font-bold text-rose-600">و {linkedItems.length - 4} أصناف أخرى</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  إغلاق
                </button>
                {!blocked ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => deleteCategory(deleteModal)}
                    className="rounded-xl bg-rose-600 px-5 py-2.5 text-[13px] font-black text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {saving ? "جار الحذف..." : "حذف القسم"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-[18px] font-black text-slate-800">
              {catModal.mode === "edit" ? "تعديل القسم" : "إضافة قسم جديد"}
            </h3>
            <form onSubmit={submitCategory} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-black text-slate-400 uppercase">كود SKU للفئة</label>
                <input
                  readOnly={catModal.mode === "edit"}
                  value={catDraft.sku_prefix}
                  onChange={(e) => setCatDraft((p) => ({ ...p, sku_prefix: e.target.value.replace(/[^\d]/g, "") }))}
                  className={`w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm font-bold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 ${catModal.mode === "edit" ? "bg-slate-100 text-slate-500" : "bg-white text-slate-800"}`}
                />
                {catModal.mode === "add" ? (
                  <div className="mt-1 text-[10px] font-bold text-slate-400">تم اختيار الرقم التالي تلقائيا، ويمكنك تغييره قبل الحفظ.</div>
                ) : null}
              </div>
              <div className="flex items-start gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-black text-slate-400 uppercase">صورة القسم</label>
                  <ImageUpload size="md"
                    url={catDraft.image_url || null}
                    onUpload={(url) => setCatDraft((p) => ({ ...p, image_url: url }))}
                    onRemove={() => setCatDraft((p) => ({ ...p, image_url: "" }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[11px] font-black text-slate-500 uppercase">اسم القسم</label>
                  <input
                    autoFocus
                    value={catDraft.name}
                    onChange={(e) => setCatDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                    placeholder="مثال: زيوت، بويات، أدوات صحية..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCatModal(null)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "جاري الحفظ…" : catModal.mode === "edit" ? "حفظ التعديلات" : "إنشاء القسم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
