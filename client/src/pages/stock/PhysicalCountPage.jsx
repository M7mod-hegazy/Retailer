import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Filter,
  Loader2,
  Package,
  Plus,
  Search,
  Warehouse,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { usePageTour } from "../../hooks/usePageTour";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Input from "../../components/ui/Input";
import PageWrapper from "../../components/ui/PageWrapper";
import Select from "../../components/ui/Select";
import DataGrid from "../../components/ui/DataGrid";
import PermissionGate from "../../components/ui/PermissionGate";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "منذ لحظات";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function StatusBadge({ status }) {
  const map = {
    in_progress: { label: "جارٍ", cls: "bg-blue-100 text-blue-700" },
    completed: { label: "مكتمل", cls: "bg-emerald-100 text-emerald-700" },
    cancelled: { label: "ملغى", cls: "bg-gray-100 text-gray-500" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

function ScopeBadge({ scope, warehouseName, categoryName }) {
  if (scope === "warehouse") return <span className="text-sm text-slate-600">{warehouseName || "مستودع"}</span>;
  if (scope === "category") return <span className="text-sm text-slate-600">{categoryName || "فئة"}</span>;
  return <span className="text-sm text-slate-600">أصناف مخصصة</span>;
}

function VarianceBadge({ variance, touched }) {
  if (!touched) return <span className="text-slate-400 text-sm">—</span>;
  if (variance > 0) return <span className="text-emerald-600 font-bold text-sm">+{variance}</span>;
  if (variance < 0) return <span className="text-red-600 font-bold text-sm">{variance}</span>;
  return <span className="text-slate-500 text-sm">0</span>;
}

function ProgressBar({ counted, total }) {
  const pct = total > 0 ? Math.round((counted / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{counted}/{total} ({pct}%)</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhysicalCountPage() {
  usePageTour('physical_count');
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("dashboard"); // 'dashboard' | 'session'
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Dashboard: new session form
  const [showForm, setShowForm] = useState(false);
  const [formScope, setFormScope] = useState("warehouse");
  const [formName, setFormName] = useState("");
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItemSearch, setFormItemSearch] = useState("");
  const [formItems, setFormItems] = useState([]);
  const [formSelectedItems, setFormSelectedItems] = useState([]);
  const [formItemsLoading, setFormItemsLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({}); // { fieldName: "error message" }

  // Reference data
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);

  // Session view
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all"); // 'all' | 'untouched' | 'variance'
  const [sessionSort, setSessionSort] = useState("name"); // 'name' | 'variance'
  const [sessionWHFilter, setSessionWHFilter] = useState("");
  const [savingLines, setSavingLines] = useState({}); // { "itemId_whId": 'saving'|'ok'|'error' }
  const [localCounts, setLocalCounts] = useState({}); // { "itemId_whId": number }
  const [stats, setStats] = useState({ total_lines: 0, counted_lines: 0, variance_count: 0 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── URL persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid) loadSession(Number(sid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load reference data ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/api/warehouses").then((r) => setWarehouses(r.data?.data || [])).catch(() => {});
    api.get("/api/categories").then((r) => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  // ── Load sessions list ───────────────────────────────────────────────────────
  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    api
      .get("/api/stock/physical-count/sessions")
      .then((r) => setSessions(r.data?.data || []))
      .catch(() => toast.error("تعذّر تحميل قائمة الجرد"))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Load session items for custom scope form ─────────────────────────────────
  useEffect(() => {
    if (formScope !== "custom") return;
    setFormItemsLoading(true);
    api
      .get("/api/stock/levels", { params: { search: formItemSearch } })
      .then((r) => {
        // Deduplicate by item_id for the picker
        const seen = new Set();
        const unique = (r.data?.data || []).filter((row) => {
          if (seen.has(row.item_id)) return false;
          seen.add(row.item_id);
          return true;
        });
        setFormItems(unique);
      })
      .catch(() => {})
      .finally(() => setFormItemsLoading(false));
  }, [formScope, formItemSearch]);

  // ── Load a session into counting view ────────────────────────────────────────
  async function loadSession(sessionId, readOnly = false) {
    try {
      const r = await api.get(`/api/stock/physical-count/sessions/${sessionId}`);
      const session = r.data?.data;
      if (!session) return;

      // Initialise local counts from existing lines
      const counts = {};
      const initStats = { total_lines: session.lines.length, counted_lines: 0, variance_count: 0 };
      for (const line of session.lines) {
        const key = `${line.item_id}_${line.warehouse_id || "null"}`;
        counts[key] = line.counted_quantity;
        if (line.touched) initStats.counted_lines++;
        if (line.variance !== 0) initStats.variance_count++;
      }
      setLocalCounts(counts);
      setStats(initStats);
      setActiveSession({ ...session, readOnly: readOnly || session.status !== "in_progress" });
      setView("session");
      setSearchParams({ session: String(sessionId) });
    } catch {
      toast.error("تعذّر تحميل بيانات الجرد");
    }
  }

  function exitSession() {
    setView("dashboard");
    setActiveSession(null);
    setLocalCounts({});
    setSavingLines({});
    setStats({ total_lines: 0, counted_lines: 0, variance_count: 0 });
    setSessionSearch("");
    setSessionFilter("all");
    setSearchParams({});
    loadSessions();
  }

  // ── Create session ────────────────────────────────────────────────────────────
  async function handleCreateSession() {
    // Clear previous errors
    setFormErrors({});
    
    // Validate and collect errors
    const errors = {};
    if (!formName.trim()) errors.formName = "أدخل اسماً للجرد";
    if (formScope === "warehouse" && !formWarehouse) errors.formWarehouse = "اختر المستودع";
    if (formScope === "category" && !formCategory) errors.formCategory = "اختر الفئة";
    if (formScope === "custom" && formSelectedItems.length === 0) errors.formItems = "اختر صنفاً واحداً على الأقل";
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error(Object.values(errors)[0]);
      return;
    }

    setFormSubmitting(true);
    try {
      const body = {
        name: formName.trim(),
        scope: formScope,
        notes: formNotes.trim() || null,
        warehouse_id: formScope === "warehouse" ? Number(formWarehouse) : null,
        category_id: formScope === "category" ? Number(formCategory) : null,
        item_ids: formScope === "custom" ? formSelectedItems : null,
      };
      const r = await api.post("/api/stock/physical-count/sessions", body);
      toast.success("تم إنشاء جلسة الجرد");
      setShowForm(false);
      resetForm();
      loadSession(r.data.data.id);
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إنشاء الجلسة");
    } finally {
      setFormSubmitting(false);
    }
  }

  function resetForm() {
    setFormName(""); setFormScope("warehouse"); setFormWarehouse(""); setFormCategory("");
    setFormNotes(""); setFormItemSearch(""); setFormSelectedItems([]);
    setFormErrors({});
  }

  // ── Auto-save a line ──────────────────────────────────────────────────────────
  async function saveLine(itemId, warehouseId, countedQty) {
    if (!activeSession || activeSession.readOnly) return;
    const key = `${itemId}_${warehouseId ?? "null"}`;
    setSavingLines((p) => ({ ...p, [key]: "saving" }));
    try {
      const r = await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/lines`, {
        item_id: itemId,
        warehouse_id: warehouseId || null,
        counted_quantity: countedQty,
      });
      setSavingLines((p) => ({ ...p, [key]: "ok" }));
      const d = r.data?.data || {};
      setStats({ total_lines: d.total_lines, counted_lines: d.counted_lines, variance_count: d.variance_count });

      // Update activeSession lines locally for filter/variance display
      setActiveSession((prev) => {
        if (!prev) return prev;
        const variance = countedQty - (prev.lines.find((l) => l.item_id === itemId && (l.warehouse_id ?? null) === (warehouseId ?? null))?.system_quantity ?? 0);
        const lines = prev.lines.map((l) =>
          l.item_id === itemId && (l.warehouse_id ?? null) === (warehouseId ?? null)
            ? { ...l, counted_quantity: countedQty, variance, touched: 1 }
            : l,
        );
        return { ...prev, lines, updated_at: new Date().toISOString() };
      });

      // Clear tick after 2s
      setTimeout(() => setSavingLines((p) => { const n = { ...p }; delete n[key]; return n; }), 2000);
    } catch {
      setSavingLines((p) => ({ ...p, [key]: "error" }));
    }
  }

  // ── Confirm session ───────────────────────────────────────────────────────────
  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/confirm`);
      toast.success("تم اعتماد الجرد وتحديث الأرصدة");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر اعتماد الجرد");
    } finally {
      setConfirming(false);
      setConfirmDialog(null);
    }
  }

  // ── Cancel session ────────────────────────────────────────────────────────────
  async function handleCancel() {
    setCancelling(true);
    try {
      await api.delete(`/api/stock/physical-count/sessions/${activeSession.id}`);
      toast.success("تم إلغاء جلسة الجرد");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إلغاء الجرد");
    } finally {
      setCancelling(false);
      setCancelDialog(false);
    }
  }

  // ── Filtered / sorted lines ───────────────────────────────────────────────────
  const filteredLines = useMemo(() => {
    if (!activeSession) return [];
    let lines = activeSession.lines;

    if (sessionWHFilter) lines = lines.filter((l) => String(l.warehouse_id) === sessionWHFilter);
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      lines = lines.filter((l) => l.item_name?.toLowerCase().includes(q) || l.barcode?.toLowerCase().includes(q));
    }
    if (sessionFilter === "untouched") lines = lines.filter((l) => !l.touched);
    if (sessionFilter === "variance") lines = lines.filter((l) => l.variance !== 0);

    return [...lines].sort((a, b) => {
      if (sessionSort === "variance") return Math.abs(b.variance) - Math.abs(a.variance);
      return (a.item_name || "").localeCompare(b.item_name || "", "ar");
    });
  }, [activeSession, sessionSearch, sessionFilter, sessionSort, sessionWHFilter]);

  const sessionWarehouses = useMemo(() => {
    if (!activeSession) return [];
    const map = new Map();
    for (const l of activeSession.lines) {
      if (l.warehouse_id && !map.has(l.warehouse_id)) map.set(l.warehouse_id, l.warehouse_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [activeSession]);

  const isMultiWarehouse = sessionWarehouses.length > 1;

  // ─── Render: Dashboard ────────────────────────────────────────────────────────
  if (view === "dashboard") {
    return (
      <div className="flex flex-col h-full" dir="rtl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-slate-900 border border-slate-800 shadow-md">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 drop-shadow-sm">الجرد المادي</h1>
                <p className="text-[13px] font-bold text-slate-500 mt-0.5 max-w-sm leading-relaxed">
                  جرد وتسوية فعلية لمخزونك — يمكن استئناف الجرد في أي وقت.
                </p>
              </div>
            </div>
            <PermissionGate page="physical_count" action="add">
            <button
              data-help="add-button"
              onClick={() => setShowForm((p) => !p)}
              className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-[13px] font-black text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              بدء جرد جديد
              <ChevronDown className={`w-4 h-4 transition-transform ${showForm ? "rotate-180" : ""}`} />
            </button>
            </PermissionGate>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {showForm && (
              <div className="rounded border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-[14px] font-black text-slate-800 mb-5 border-b border-slate-100 pb-2">إعداد جلسة الجرد</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-1.5">اسم الجرد *</label>
                    <input
                      className={`w-full rounded border py-2.5 px-3 text-[13px] font-bold outline-none transition-all placeholder:font-medium ${
                        formErrors.formName 
                          ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                          : "border-slate-200 bg-slate-50/50 focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                      }`}
                      value={formName}
                      onChange={(e) => { setFormName(e.target.value); if (formErrors.formName) setFormErrors((p) => ({ ...p, formName: null })); }}
                      placeholder="مثال: جرد أبريل 2026"
                    />
                    {formErrors.formName && <p className="mt-1 text-[12px] font-bold text-red-500">{formErrors.formName}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-2">نطاق الجرد</label>
                    <div className="flex gap-2">
                      {[
                        { value: "warehouse", label: "مستودع كامل" },
                        { value: "category", label: "فئة محددة" },
                        { value: "custom", label: "أصناف مخصصة" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFormScope(opt.value)}
                          className={`rounded px-4 py-2.5 text-[13px] font-black border transition-colors ${
                            formScope === opt.value
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formScope === "warehouse" && (
                    <div>
                      <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-1.5">المستودع *</label>
                      <div className="relative">
                        <select
                          value={formWarehouse}
                          onChange={(e) => { setFormWarehouse(e.target.value); if (formErrors.formWarehouse) setFormErrors((p) => ({ ...p, formWarehouse: null })); }}
                          className={`w-full appearance-none rounded border py-2.5 pl-8 pr-3 text-[13px] font-bold text-slate-700 outline-none ${
                            formErrors.formWarehouse
                              ? "border-red-400 bg-red-50/50 focus:border-red-500"
                              : "border-slate-200 bg-slate-50/50 focus:border-slate-800"
                          }`}
                        >
                          <option value="">اختر المستودع...</option>
                          {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {formErrors.formWarehouse && <p className="mt-1 text-[12px] font-bold text-red-500">{formErrors.formWarehouse}</p>}
                    </div>
                  )}

                  {formScope === "category" && (
                    <div>
                      <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-1.5">الفئة *</label>
                      <div className="relative">
                        <select
                          value={formCategory}
                          onChange={(e) => { setFormCategory(e.target.value); if (formErrors.formCategory) setFormErrors((p) => ({ ...p, formCategory: null })); }}
                          className={`w-full appearance-none rounded border py-2.5 pl-8 pr-3 text-[13px] font-bold text-slate-700 outline-none ${
                            formErrors.formCategory
                              ? "border-red-400 bg-red-50/50 focus:border-red-500"
                              : "border-slate-200 bg-slate-50/50 focus:border-slate-800"
                          }`}
                        >
                          <option value="">اختر الفئة...</option>
                          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.sku_prefix ? `${c.sku_prefix} — ` : ""}{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {formErrors.formCategory && <p className="mt-1 text-[12px] font-bold text-red-500">{formErrors.formCategory}</p>}
                    </div>
                  )}

                  {formScope === "custom" && (
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-1.5">اختر الأصناف *</label>
                      <div className="relative mb-2 group">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                        <input
                          className={`w-full rounded border py-2.5 pl-3 pr-10 text-[13px] font-bold outline-none transition-all shadow-sm ${
                            formErrors.formItems
                              ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              : "border-slate-200 bg-white focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                          }`}
                          placeholder="بحث عن صنف..."
                          value={formItemSearch}
                          onChange={(e) => setFormItemSearch(e.target.value)}
                        />
                      </div>
                      <div className={`max-h-[250px] overflow-y-auto rounded border bg-white divide-y divide-slate-100 scrollbar-thin ${
                        formErrors.formItems ? "border-red-400" : "border-slate-200"
                      }`}>
                        {formItemsLoading && (
                          <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                        )}
                        {!formItemsLoading && formItems.length === 0 && (
                          <div className="py-6 text-center text-[13px] font-bold text-slate-400">لا توجد أصناف</div>
                        )}
                        {!formItemsLoading && formItems.map((item) => {
                          const checked = formSelectedItems.includes(item.item_id);
                          return (
                            <label key={item.item_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setFormSelectedItems((p) => checked ? p.filter((id) => id !== item.item_id) : [...p, item.item_id]);
                                  if (formErrors.formItems) setFormErrors((p) => ({ ...p, formItems: null }));
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                              <div className="flex-1">
                                <span className="block text-[13px] font-black text-slate-800 group-hover:text-slate-900">{item.item_name}</span>
                                {item.barcode && <span className="block text-[10px] font-mono text-slate-400 mt-0.5">{item.barcode}</span>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {formErrors.formItems && <p className="mt-1 text-[12px] font-bold text-red-500">{formErrors.formItems}</p>}
                      {formSelectedItems.length > 0 && (
                        <p className="mt-2 text-[11px] font-black text-slate-600 bg-white inline-block px-2 py-0.5 rounded border border-slate-200">{formSelectedItems.length} صنف محدد</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-black uppercase tracking-wider text-slate-500 mb-1.5">ملاحظات (اختياري)</label>
                    <input
                      className="w-full rounded border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-[13px] font-bold outline-none focus:border-slate-800 transition-all placeholder:font-medium"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="أي ملاحظات..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                  <PermissionGate page="physical_count" action="add">
                  <button onClick={handleCreateSession} disabled={formSubmitting} className="flex items-center justify-center gap-2 rounded bg-slate-900 px-5 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 disabled:opacity-50 transition-colors min-w-[120px]">
                    {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    بدء الجرد
                  </button>
                  </PermissionGate>
                  <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded px-5 py-2.5 text-[13px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            <div className="rounded border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                <h2 className="text-[14px] font-black text-slate-800 uppercase tracking-wide">سجل جلسات الجرد</h2>
              </div>
              <div className="flex flex-col flex-1">
                <DataGrid
                  data={sessions}
                  rowKey="id"
                  loading={loadingSessions}
                  emptyMessage="لا توجد جلسات جرد مسجلة"
                  className="border-0"
                  containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                  columns={[
                    {
                      id: "name", header: "الاسم", width: 200, sortable: true,
                      headerClass: "text-right px-4", cellClass: "px-4 font-bold text-[13px] text-slate-800 border-l border-slate-100 truncate",
                      render: (s) => s.name || `جرد #${s.id}`
                    },
                    {
                      id: "scope", header: "النطاق", width: 140, sortable: true,
                      headerClass: "text-right px-4", cellClass: "px-4 text-[12px] border-l border-slate-100 truncate",
                      render: (s) => <ScopeBadge scope={s.scope} warehouseName={s.warehouse_name} categoryName={s.category_name} />
                    },
                    {
                      id: "status", header: "الحالة", width: 100, sortable: true,
                      headerClass: "text-center px-4", cellClass: "px-4 text-center border-l border-slate-100",
                      render: (s) => <StatusBadge status={s.status} />
                    },
                    {
                      id: "lines", header: "الأصناف", width: 90, sortable: true,
                      headerClass: "text-center px-4", cellClass: "px-4 text-center font-mono text-[13px] text-slate-700 border-l border-slate-100",
                      render: (s) => s.total_lines || 0
                    },
                    {
                      id: "counted", header: "المعدود", width: 90, sortable: false,
                      headerClass: "text-center px-4", cellClass: "px-4 text-center border-l border-slate-100",
                      render: (s) => (
                        <span className={s.counted_lines > 0 ? "text-slate-900 font-mono font-bold text-[13px]" : "text-slate-400 font-mono text-[13px]"}>{s.counted_lines || 0}</span>
                      )
                    },
                    {
                      id: "variance", header: "فروقات", width: 90, sortable: false,
                      headerClass: "text-center px-4", cellClass: "px-4 text-center border-l border-slate-100",
                      render: (s) => (
                        s.variance_count > 0 ? (
                          <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold">{s.variance_count}</span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )
                      )
                    },
                    {
                      id: "updated_at", header: "آخر تحديث", width: 140, sortable: true,
                      headerClass: "text-right px-4", cellClass: "px-4 text-[11px] font-bold text-slate-500 border-l border-slate-100 truncate",
                      render: (s) => timeAgo(s.updated_at || s.created_at)
                    },
                    {
                      id: "actions", header: "إجراء", width: 160, sortable: false,
                      headerClass: "text-center px-4", cellClass: "px-4 text-center relative pointer-events-auto",
                      render: (s) => (
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {s.status === "in_progress" && (
                            <>
                              <PermissionGate page="physical_count" action="edit">
                              <button onClick={() => loadSession(s.id)} className="rounded bg-slate-100 border border-slate-200 text-slate-700 hover:border-slate-800 hover:text-slate-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all">استئناف</button>
                              </PermissionGate>
                              <PermissionGate page="physical_count" action="delete">
                              <button onClick={async () => {
                                  if (!window.confirm("هل تريد إلغاء هذه الجلسة؟")) return;
                                  try {
                                    await api.delete(`/api/stock/physical-count/sessions/${s.id}`);
                                    import("react-hot-toast").then((module) => module.default.success("تم إلغاء الجلسة"));
                                    loadSessions();
                                  } catch (e) {
                                    import("react-hot-toast").then((module) => module.default.error(e.response?.data?.message || "تعذّر الإلغاء"));
                                  }
                                }}
                                className="rounded bg-rose-50 border border-rose-200 text-rose-600 hover:border-rose-400 hover:text-rose-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all"
                              >
                                إلغاء
                              </button>
                              </PermissionGate>
                            </>
                          )}
                          {(s.status === "completed" || s.status === "cancelled") && (
                            <button onClick={() => loadSession(s.id, true)} className="rounded bg-slate-100 border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all">
                              عرض التفاصيل
                            </button>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Session / Counting view ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={exitSession}
              className="flex items-center justify-center w-8 h-8 rounded border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              {activeSession?.name || `جرد #${activeSession?.id}`}
              {activeSession?.readOnly && (
                <span className="rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] uppercase font-black tracking-widest border border-slate-200">قراءة فقط</span>
              )}
            </h1>
            <StatusBadge status={activeSession?.status} />
          </div>

          <div className="flex items-center gap-4 text-[12px] text-slate-500 font-bold">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded">
              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
              <ScopeBadge scope={activeSession?.scope} warehouseName={activeSession?.warehouse_name} categoryName={activeSession?.category_name} />
            </span>
            {activeSession?.updated_at && (
              <span className="flex items-center gap-1">
                آخر حفظ: {timeAgo(activeSession.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar counted={stats.counted_lines} total={stats.total_lines} />
      </div>

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
        
        {/* Toolbar */}
        <div className="flex items-center px-6 py-3 border-b border-slate-200 bg-white justify-between shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div data-help="search-bar" className="relative w-64 group">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
              <input
                className="w-full rounded border border-slate-200 py-1.5 pl-3 pr-9 text-[13px] font-bold outline-none focus:border-slate-800 transition-all shadow-sm"
                placeholder="بحث عن طريق الاسم أو الباركود..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
              />
            </div>

            {/* Filter tabs */}
            <div className="flex rounded border border-slate-200 overflow-hidden shadow-sm h-[34px]">
              {[
                { value: "all", label: "الكل" },
                { value: "untouched", label: "لم يُعد" },
                { value: "variance", label: "بفروقات" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setSessionFilter(f.value)}
                  className={`px-4 text-[12px] font-black tracking-wide transition-colors ${
                    sessionFilter === f.value ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              onClick={() => setSessionSort((p) => (p === "name" ? "variance" : "name"))}
              className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 h-[34px] text-[12px] font-black tracking-wide text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              {sessionSort === "name" ? "ترتيب بالاسم" : "ترتيب بالفروقات"}
            </button>

            {/* Warehouse filter */}
            {isMultiWarehouse && (
              <div className="relative">
                <select
                  value={sessionWHFilter}
                  onChange={(e) => setSessionWHFilter(e.target.value)}
                  className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[12px] font-black text-slate-600 focus:outline-none focus:border-slate-800 shadow-sm h-[34px]"
                >
                  <option value="">كل المستودعات</option>
                  {sessionWarehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>{w.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        <div data-help="main-table" className="flex flex-col flex-1 min-h-0">
          <DataGrid
            data={filteredLines}
            rowKey={(r) => `${r.item_id}_${r.warehouse_id ?? "null"}`}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-10 opacity-60">
                <Package className="w-8 h-8 opacity-40 mb-3" />
                <span className="text-[13px] font-black tracking-widest uppercase">لا توجد أصناف مطابقة</span>
              </div>
            }
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0 pb-16"
            rowClass={(line) => {
              const key = `${line.item_id}_${line.warehouse_id ?? "null"}`;
              const localVal = localCounts[key] ?? line.counted_quantity;
              const variance = localVal - line.system_quantity;
              let rowBg = "";
              if (line.touched && variance > 0) rowBg = "!bg-emerald-50/50";
              else if (line.touched && variance < 0) rowBg = "!bg-rose-50/50";
              else if (!line.touched) rowBg = "hover:!bg-slate-50/50";
              return rowBg;
            }}
            columns={[
              {
                id: "index", header: "#", width: 50, sortable: false,
                headerClass: "text-right px-3", cellClass: "px-3 text-slate-400 font-mono text-[11px] border-l border-slate-100",
                render: (_, idx) => idx + 1
              },
              {
                id: "code", header: "الكود", width: 120, sortable: true,
                headerClass: "text-right px-4", cellClass: "px-4 text-slate-500 font-mono text-[11px] tracking-wider border-l border-slate-100",
                render: (line) => line.item_code || line.barcode || "—"
              },
              {
                id: "item_name", header: "الصنف", width: 200, sortable: true,
                headerClass: "text-right px-4", cellClass: "px-4 font-black text-[13px] text-slate-800 border-l border-slate-100 truncate",
                render: (line) => line.item_name
              },
              {
                id: "category_name", header: "الفئة", width: 120, sortable: true,
                headerClass: "text-right px-4", cellClass: "px-4 text-slate-500 text-[11px] font-bold border-l border-slate-100 truncate",
                render: (line) => line.category_name || "—"
              },
              ...(isMultiWarehouse ? [{
                id: "warehouse_name", header: "المستودع", width: 120, sortable: true,
                headerClass: "text-right px-4", cellClass: "px-4 text-slate-600 text-[11px] font-bold border-l border-slate-100 truncate",
                render: (line) => line.warehouse_name || "—"
              }] : []),
              {
                id: "system_quantity", header: "كمية النظام", width: 120, sortable: true,
                headerClass: "text-center px-4", cellClass: "px-4 text-center font-mono font-bold text-[13px] text-slate-700 border-l border-slate-100 bg-slate-50/30",
                render: (line) => line.system_quantity
              },
              {
                id: "counted_quantity", header: "الكمية الفعلية", width: 140, sortable: false,
                headerClass: "text-center px-4", cellClass: "px-4 py-1.5 text-center border-l border-slate-100 bg-white",
                render: (line) => {
                  const key = `${line.item_id}_${line.warehouse_id ?? "null"}`;
                  const localVal = localCounts[key] ?? line.counted_quantity;
                  const saveState = savingLines[key];
                  return (
                    <div className="flex items-center justify-center gap-2 relative">
                      <input
                        type="number"
                        min="0"
                        disabled={activeSession?.readOnly}
                        value={localVal}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLocalCounts((p) => ({ ...p, [key]: v }));
                        }}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== line.counted_quantity || !line.touched) {
                            saveLine(line.item_id, line.warehouse_id ?? null, v);
                          }
                        }}
                        className={`w-20 rounded border border-slate-300 py-1 text-center font-mono text-[13px] font-bold focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-50 disabled:text-slate-400 transition-colors ${line.touched ? 'bg-slate-50' : 'bg-white'}`}
                      />
                      <div className="absolute left-2 top-1/2 -translate-y-1/2">
                        {saveState === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                        {saveState === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {saveState === "error" && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" title="تعذّر الحفظ" />}
                      </div>
                    </div>
                  );
                }
              },
              {
                id: "variance", header: "الفروقات", width: 100, sortable: false,
                headerClass: "text-center px-4", cellClass: "px-4 text-center",
                render: (line) => {
                  const key = `${line.item_id}_${line.warehouse_id ?? "null"}`;
                  const localVal = localCounts[key] ?? line.counted_quantity;
                  const variance = localVal - line.system_quantity;
                  return <VarianceBadge variance={line.touched ? variance : line.variance} touched={line.touched || localVal !== line.system_quantity} />;
                }
              }
            ]}
          />
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div data-help="differences-section" className="fixed bottom-0 right-0 left-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] px-6 py-3" dir="rtl">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4 text-[13px] font-black text-slate-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span>{stats.variance_count} صنف بفروقات</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              <span className="text-slate-500">{stats.total_lines - stats.counted_lines} أصناف متبقية للإحصاء</span>
            </div>
          </div>

          {activeSession?.readOnly ? (
            <span className="flex items-center gap-2 rounded bg-slate-100 text-slate-500 px-5 py-2 text-[13px] font-black uppercase tracking-widest border border-slate-200">
              <CheckCircle2 className="w-4 h-4" />
              الجرد معتمد ومغلق
            </span>
          ) : (
            <div className="flex items-center gap-3">
              <PermissionGate page="physical_count" action="delete">
              <button
                onClick={() => setCancelDialog(true)}
                className="rounded border border-rose-200 text-rose-600 px-5 py-2 text-[13px] font-black hover:bg-rose-50 hover:border-rose-300 transition-colors uppercase tracking-widest"
              >
                إلغاء الجرد
              </button>
              </PermissionGate>
              <PermissionGate page="physical_count" action="edit">
              <button
                data-help="apply-button"
                onClick={() => setConfirmDialog(true)}
                className="rounded bg-emerald-600 text-white px-8 py-2 text-[13px] font-black hover:bg-emerald-700 transition-colors shadow-sm uppercase tracking-widest flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                اعتماد الجرد وتسوية الأرصدة
              </button>
              </PermissionGate>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          open
          title="تأكيد تسوية الأرصدة"
          message={`سيتم تحديث أرصدة المخازن آليًا لتعكس الكميات الفعلية المُدخلة لـ ${stats.variance_count} صنف يوجد بها فروقات. هذه العملية نهائية ولا يمكن التراجع عنها.`}
          confirmLabel={confirming ? "جاري الاعتماد وتسوية الأرصدة..." : "تأكيد واعتماد جرد المخزون"}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
          variant="primary"
        />
      )}

      {/* Cancel dialog */}
      {cancelDialog && (
        <ConfirmDialog
          open
          title="إلغاء جلسة الجرد"
          message="سيتم حذف مسودة الجرد بالكامل ولن تتأثر أرصدة النظام الحالية. هل أنت متأكد من إلغاء الإجراء؟"
          confirmLabel={cancelling ? "جاري الإلغاء..." : "نعم، إلغاء الجرد"}
          onConfirm={handleCancel}
          onCancel={() => setCancelDialog(false)}
          variant="danger"
        />
      )}
    </div>
  );
}
