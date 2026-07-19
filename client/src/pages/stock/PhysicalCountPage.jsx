import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
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
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import ConsequencePreview from "../../components/ui/ConsequencePreview";
import PermissionGate from "../../components/ui/PermissionGate";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    in_progress: { label: "جارٍ", cls: "bg-indigo-600 text-white" },
    completed: { label: "مكتمل", cls: "bg-emerald-500 text-text-primary" },
    cancelled: { label: "ملغى", cls: "bg-border-normal text-text-secondary" },
  };
  const { label, cls } = map[status] || { label: status, cls: "bg-border-normal text-text-secondary" };
  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${cls}`}>{label}</span>;
}

function ScopeBadge({ scope, warehouseName, categoryName }) {
  if (scope === "warehouse") return <span>{warehouseName || "مستودع"}</span>;
  if (scope === "category") return <span>{categoryName || "فئة"}</span>;
  return <span>أصناف مخصصة</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhysicalCountPage() {
  usePageTour('physical_count');
  const handleKeyDown = useFieldNavigation();
  const formWarehouseRef = useRef(null);
  const formCategoryRef = useRef(null);
  const formItemSearchRef = useRef(null);
  const formItemCategoryRef = useRef(null);
  const formSubmitRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("dashboard"); // 'dashboard' | 'session'
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Dashboard form
  const [showForm, setShowForm] = useState(false);
  const [formScope, setFormScope] = useState("warehouse");
  const [formName, setFormName] = useState("");
  const [formWarehouse, setFormWarehouse] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItemSearch, setFormItemSearch] = useState("");
  const [formItemCategory, setFormItemCategory] = useState("");
  const [formItems, setFormItems] = useState([]);
  const [formSelectedItems, setFormSelectedItems] = useState([]); // [{ id, name, item_code, barcode }]
  const [formItemsLoading, setFormItemsLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Reference data
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);

  // Session view
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all"); 
  const [savingLines, setSavingLines] = useState({});
  const [localCounts, setLocalCounts] = useState({});
  const [stats, setStats] = useState({ total_lines: 0, counted_lines: 0, variance_count: 0 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Persistence
  useEffect(() => {
    const sid = searchParams.get("session");
    if (sid) loadSession(Number(sid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs
  useEffect(() => {
    api.get("/api/warehouses").then((r) => setWarehouses(r.data?.data || [])).catch(() => {});
    api.get("/api/categories").then((r) => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  // List
  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    api.get("/api/stock/physical-count/sessions")
      .then((r) => setSessions(r.data?.data || []))
      .catch(() => toast.error("تعذّر تحميل قائمة الجرد"))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Items for scope=custom
  useEffect(() => {
    if (formScope !== "custom") return;
    setFormItemsLoading(true);
    const params = { search: formItemSearch };
    if (formItemCategory) params.category_id = formItemCategory;
    api.get("/api/items", { params })
      .then((r) => setFormItems(r.data?.data || []))
      .catch(() => {})
      .finally(() => setFormItemsLoading(false));
  }, [formScope, formItemSearch, formItemCategory]);

  // Load Session
  async function loadSession(sessionId, readOnly = false) {
    try {
      const r = await api.get(`/api/stock/physical-count/sessions/${sessionId}`);
      const session = r.data?.data;
      if (!session) return;

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

  // Create
  async function handleCreateSession() {
    if (!formName.trim()) return toast.error("أدخل اسماً للجرد");
    if (formScope === "warehouse" && !formWarehouse) return toast.error("اختر المستودع");
    if (formScope === "category" && !formCategory) return toast.error("اختر الفئة");
    if (formScope === "custom" && formSelectedItems.length === 0) return toast.error("اختر صنفاً واحداً على الأقل");
    
    setFormSubmitting(true);
    try {
      const body = {
        name: formName.trim(),
        scope: formScope,
        notes: formNotes.trim() || null,
        warehouse_id: formScope === "warehouse" ? Number(formWarehouse) : null,
        category_id: formScope === "category" ? Number(formCategory) : null,
        item_ids: formScope === "custom" ? formSelectedItems.map(s => s.id) : null,
      };
      const r = await api.post("/api/stock/physical-count/sessions", body);
      toast.success("تم إنشاء جلسة الجرد");
      setShowForm(false);
      setFormName(""); setFormWarehouse(""); setFormCategory(""); setFormSelectedItems([]); setFormNotes("");
      loadSession(r.data.data.id);
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إنشاء الجلسة");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Save Line
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
      setTimeout(() => setSavingLines((p) => { const n = { ...p }; delete n[key]; return n; }), 2000);
    } catch {
      setSavingLines((p) => ({ ...p, [key]: "error" }));
    }
  }

  // Confirm/Cancel
  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.post(`/api/stock/physical-count/sessions/${activeSession.id}/confirm`);
      toast.success("تم اعتماد الجرد وتحديث الأرصدة");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر اعتماد الجرد");
    } finally {
      setConfirming(false); setConfirmDialog(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.delete(`/api/stock/physical-count/sessions/${activeSession.id}`);
      toast.success("تم إلغاء الجلسة");
      exitSession();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذّر إلغاء الجرد");
    } finally {
      setCancelling(false); setCancelDialog(false);
    }
  }

  const filteredLines = useMemo(() => {
    if (!activeSession) return [];
    let lines = activeSession.lines;
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      lines = lines.filter((l) => l.item_name?.toLowerCase().includes(q) || l.barcode?.toLowerCase().includes(q));
    }
    if (sessionFilter === "untouched") lines = lines.filter((l) => !l.touched);
    if (sessionFilter === "variance") lines = lines.filter((l) => l.variance !== 0);
    return lines;
  }, [activeSession, sessionSearch, sessionFilter]);

  // ─── RENDER DASHBOARD ──────────────────────────────────────────
  if (view === "dashboard") {
    return (
      <main className="min-h-[100dvh] bg-[var(--bg-base)] text-text-primary w-full overflow-x-hidden font-sans" dir="rtl">
        <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* Left/Right sticky header */}
          <div className="lg:col-span-5 flex flex-col items-start justify-start relative">
            <div className="lg:sticky top-24 w-full">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1] text-slate-950 mb-8 w-full max-w-[20ch]">
                  الجرد<br/>المادي.
                </h1>
                <p className="text-lg text-text-secondary leading-relaxed max-w-[400px] mb-12 font-medium">
                  تسويات المخزون، مراجعات الأرصدة، وإدارة الكميات الفعلية عبر نظام عمليات عالي الكثافة والأداء.
                </p>
                
                <PermissionGate page="physical_count" action="add">
                  <motion.button
                    data-help="add-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center justify-center gap-3 bg-primary text-white rounded-full px-8 py-5 text-[15px] font-black tracking-widest uppercase shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] transition-shadow w-full max-w-[320px]"
                  >
                    {showForm ? "إلغاء البدء" : "جلسة جرد جديدة"}
                    <Plus className={`w-5 h-5 transition-transform duration-500 ${showForm ? "rotate-45" : ""}`} />
                  </motion.button>
                </PermissionGate>
              </motion.div>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-7 flex flex-col gap-12">
            <AnimatePresence mode="popLayout">
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
                  exit={{ opacity: 0, height: 0, filter: "blur(10px)" }}
                  className="bg-bg-surface rounded-[2.5rem] p-10 md:p-12 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-border-normal/50 overflow-hidden"
                >
                  <h2 className="text-3xl font-black text-text-primary mb-10 tracking-tight">إعداد الجلسة</h2>
                  
                  <div className="space-y-10">
                     {/* Name */}
                     <div>
                       <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">اسم الجرد</label>
                       <input 
                         className="w-full text-3xl font-black text-text-primary placeholder:text-slate-200 outline-none border-b border-border-normal focus:border-slate-900 pb-4 transition-colors bg-transparent"
                         placeholder="جرد المستودع الرئيسي..."
                         value={formName}
                         onChange={(e) => setFormName(e.target.value)}
                       />
                     </div>
                     
                     {/* Scope Selection */}
                     <div>
                       <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">النطاق</label>
                       <div className="flex flex-wrap gap-4">
                         {["warehouse", "category", "custom"].map((opt) => (
                           <button
                             key={opt}
                             onClick={() => setFormScope(opt)}
                             className={`px-8 py-4 rounded-full text-sm font-black uppercase tracking-widest transition-all ${
                               formScope === opt ? "bg-primary text-white shadow-xl" : "bg-bg-overlay text-text-secondary hover:bg-border-normal"
                             }`}
                           >
                             {opt === "warehouse" ? "مستودع كامل" : opt === "category" ? "فئة محددة" : "أصناف مخصصة"}
                           </button>
                         ))}
                       </div>
                     </div>

                     {/* Dynamic Selects */}
                      {formScope === "warehouse" && (
                         <div>
                           <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">المستودع</label>
                           <select ref={formWarehouseRef} className="w-full text-2xl font-bold text-text-primary outline-none border-b border-border-normal focus:border-slate-900 pb-4 transition-colors bg-transparent appearance-none cursor-pointer" value={formWarehouse} onChange={(e)=>setFormWarehouse(e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: formSubmitRef })}>
                            <option value="" disabled>اختر مستودعاً...</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                     )}

                      {formScope === "category" && (
                         <div>
                           <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-4">الفئة</label>
                           <select ref={formCategoryRef} className="w-full text-2xl font-bold text-text-primary outline-none border-b border-border-normal focus:border-slate-900 pb-4 transition-colors bg-transparent appearance-none cursor-pointer" value={formCategory} onChange={(e)=>setFormCategory(e.target.value)} onKeyDown={e => handleKeyDown(e, { nextRef: formSubmitRef })}>
                            <option value="" disabled>اختر فئة...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                     )}

                      {formScope === "custom" && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 relative">
                              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
                              <input
                                ref={formItemSearchRef}
                                className="w-full text-lg font-bold text-text-primary outline-none border-b border-border-normal focus:border-slate-900 pb-4 pr-12 transition-colors bg-transparent placeholder:text-slate-200"
                                placeholder="ابحث بالاسم أو الكود..."
                                value={formItemSearch}
                                onChange={(e) => setFormItemSearch(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, { nextRef: formItemCategoryRef })}
                              />
                              {formItemSearch && (
                                <button type="button" onClick={() => setFormItemSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                                  <X className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                            <div className="relative shrink-0">
                              <select
                                ref={formItemCategoryRef}
                                value={formItemCategory}
                                onChange={(e) => setFormItemCategory(e.target.value)}
                                onKeyDown={e => handleKeyDown(e, { nextRef: formSubmitRef, prevRef: formItemSearchRef })}
                                className="appearance-none bg-bg-overlay text-text-secondary font-bold text-[13px] rounded-full px-6 py-3 pr-10 border-0 cursor-pointer hover:bg-border-normal transition-colors outline-none"
                              >
                                <option value="">كل الفئات</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            </div>
                          </div>

                         <div>
                           <div className="flex items-center justify-between mb-4">
                             <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted">الأصناف</label>
                             <span className="text-xs font-bold text-text-muted">{formSelectedItems.length} مختار</span>
                           </div>

                           {formItemsLoading ? (
                             <div className="space-y-3">
                               {[1,2,3].map(i => <div key={i} className="h-16 bg-bg-overlay rounded-2xl animate-pulse" />)}
                             </div>
                           ) : formItems.length === 0 ? (
                             <p className="text-sm text-text-muted py-8 text-center font-bold">
                               {formItemSearch || formItemCategory ? "لا توجد نتائج" : "ابدأ بالبحث لإضافة أصناف"}
                             </p>
                           ) : (
                             <div className="max-h-[300px] overflow-y-auto space-y-2 pl-1">
                               {formItems.map((item) => {
                                 const selected = formSelectedItems.some(s => s.id === item.id);
                                 return (
                                   <button
                                     key={item.id}
                                     type="button"
                                     onClick={() => setFormSelectedItems(prev =>
                                       selected
                                         ? prev.filter(s => s.id !== item.id)
                                         : [...prev, { id: item.id, name: item.name, item_code: item.item_code, barcode: item.barcode }]
                                     )}
                                     className={`w-full flex items-center gap-4 p-4 rounded-2xl text-right transition-all border ${
                                       selected
                                         ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                         : "bg-bg-overlay border-transparent hover:border-border-normal text-text-primary"
                                     }`}
                                   >
                                     <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                                       selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-border-strong"
                                     }`}>
                                       {selected && <Check className="w-4 h-4" />}
                                     </div>
                                     <div className="flex-1 min-w-0 text-right">
                                       <p className="text-sm font-black text-text-primary truncate">{item.name || "—"}</p>
                                        <p className="text-[11px] font-mono text-text-muted">{item.item_code || "—"}</p>
                                     </div>
                                     {item.category_name && (
                                       <span className="text-[10px] font-bold text-text-muted bg-bg-surface px-3 py-1 rounded-full border border-border-subtle shrink-0">
                                         {item.category_name}
                                       </span>
                                     )}
                                   </button>
                                 );
                               })}
                             </div>
                           )}
                         </div>

                          {formSelectedItems.length > 0 && (
                            <div>
                              <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-3">الأصناف المختارة</label>
                              <div className="flex flex-wrap gap-2">
                                {formSelectedItems.map(item => (
                                  <span key={item.id} className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold border border-indigo-100">
                                    {item.name}
                                    <button type="button" onClick={() => setFormSelectedItems(prev => prev.filter(s => s.id !== item.id))} className="hover:text-red-500 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                    </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setFormSelectedItems([])}
                                  className="text-xs font-bold text-text-muted hover:text-red-500 transition-colors px-3 py-1"
                                >
                                  إزالة الكل
                                </button>
                              </div>
                            </div>
                          )}
                       </div>
                     )}

                     {/* Action */}
                      <div className="pt-6">
                        <button ref={formSubmitRef} onClick={handleCreateSession} className="bg-indigo-600 text-white rounded-full px-8 h-16 text-[15px] font-black tracking-widest uppercase hover:bg-indigo-700 transition-colors shadow-xl w-full">
                         {formSubmitting ? "جاري الإنشاء..." : "اعتماد وبدء الجرد"}
                       </button>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sessions List */}
            <div className="space-y-6 pt-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-8 pl-4 border-l-2 border-border-normal">الجلسات السابقة</h3>
              {loadingSessions ? (
                 <div className="animate-pulse space-y-6">
                   <div className="h-32 bg-border-normal/50 rounded-[2rem]"></div>
                   <div className="h-32 bg-border-normal/50 rounded-[2rem]"></div>
                 </div>
              ) : sessions.length === 0 ? (
                 <div className="py-32 text-center opacity-50">
                    <Package className="w-16 h-16 mx-auto mb-6 text-text-muted" />
                    <p className="text-text-muted font-black tracking-widest uppercase text-sm">لا توجد جلسات مسجلة</p>
                 </div>
              ) : (
                <div data-help="main-table" className="grid gap-6">
                  {sessions.map((s, idx) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, type: "spring", stiffness: 100, damping: 20 }}
                      onClick={() => loadSession(s.id, s.status !== "in_progress")}
                      className="group bg-bg-surface p-8 rounded-[2rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] border border-border-subtle hover:border-indigo-100 cursor-pointer transition-all hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_rgba(79,70,229,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-8"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <StatusBadge status={s.status} />
                          <span className="text-2sm font-mono font-bold text-text-muted">{timeAgo(s.updated_at || s.created_at)}</span>
                        </div>
                        <h4 className="text-2xl font-black text-text-primary group-hover:text-indigo-600 transition-colors tracking-tight">{s.name || `جرد #${s.id}`}</h4>
                        <p className="text-sm font-bold text-text-secondary mt-2 flex items-center gap-2">
                           <Warehouse className="w-4 h-4" /> 
                           <ScopeBadge scope={s.scope} warehouseName={s.warehouse_name} categoryName={s.category_name} />
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-10 bg-bg-overlay/50 px-8 py-5 rounded-3xl border border-border-subtle shrink-0">
                        <div className="text-center">
                          <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">التقدم</p>
                          <p className="text-2xl number-fmt text-text-primary">{s.counted_lines}<span className="text-text-muted text-lg">/{s.total_lines}</span></p>
                        </div>
                        <div className="w-px h-12 bg-border-normal"></div>
                        <div className="text-center">
                          <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">الفروقات</p>
                          <p className={`text-2xl number-fmt ${s.variance_count > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{s.variance_count}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── RENDER SESSION ────────────────────────────────────────────
  return (
    <main className="min-h-[100dvh] bg-bg-surface text-text-primary flex flex-col w-full overflow-hidden font-sans" dir="rtl">
      {/* Absolute Progress Line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-bg-overlay z-50">
         <motion.div 
           initial={{ width: 0 }} 
           animate={{ width: `${stats.total_lines > 0 ? (stats.counted_lines / stats.total_lines) * 100 : 0}%` }} 
           className="h-full bg-indigo-500" 
         />
      </div>

      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <button onClick={exitSession} className="w-12 h-12 flex items-center justify-center rounded-full bg-bg-overlay text-text-secondary hover:bg-border-normal transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-text-primary tracking-tight flex items-center gap-4">
              {activeSession?.name || `جرد #${activeSession?.id}`}
              {activeSession?.readOnly && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black uppercase tracking-widest">قراءة فقط</span>
              )}
            </h1>
            <p className="text-sm font-bold text-text-secondary mt-1 flex items-center gap-2">
              <ScopeBadge scope={activeSession?.scope} warehouseName={activeSession?.warehouse_name} categoryName={activeSession?.category_name} />
              <span className="w-1 h-1 rounded-full bg-border-strong"></span>
              {stats.counted_lines} من {stats.total_lines}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 bg-bg-overlay p-1.5 rounded-full border border-border-normal/60">
           {["all", "untouched", "variance"].map((f) => (
             <button
               key={f}
               onClick={() => setSessionFilter(f)}
               className={`px-6 py-2.5 rounded-full text-2sm font-black tracking-widest uppercase transition-all ${
                 sessionFilter === f ? "bg-bg-surface text-indigo-700 shadow-sm" : "text-text-secondary hover:text-text-primary"
               }`}
             >
               {f === "all" ? "الكل" : f === "untouched" ? "لم يُعد" : "فروقات"}
             </button>
           ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-48">
        <div className="max-w-6xl mx-auto px-6 py-12">
           <div data-help="search-bar" className="relative mb-12">
             <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-text-muted" />
             <input
               className="w-full text-2xl font-black text-text-primary outline-none border-b border-border-normal focus:border-indigo-500 bg-transparent pb-4 pl-6 pr-16 transition-colors placeholder:text-slate-200"
               placeholder="ابحث عن صنف أو باركود..."
               value={sessionSearch}
               onChange={(e) => setSessionSearch(e.target.value)}
             />
           </div>

           {/* Custom Gapless Grid/List */}
           <div className="flex flex-col border-t border-border-subtle">
             {filteredLines.length === 0 && (
               <div className="py-32 text-center text-text-muted font-bold uppercase tracking-widest text-sm">
                 لا توجد أصناف مطابقة للبحث
               </div>
             )}
             {filteredLines.map((line, idx) => {
               const key = `${line.item_id}_${line.warehouse_id ?? "null"}`;
               const localVal = localCounts[key] ?? line.counted_quantity;
               const variance = localVal - line.system_quantity;
               const touched = line.touched || localVal !== line.system_quantity;

               return (
                 <div key={key} className="group flex items-center justify-between py-6 border-b border-border-subtle hover:bg-bg-overlay/50 transition-colors px-4 -mx-4 rounded-3xl">
                   <div className="flex-1 min-w-0 pr-4">
                      <p className="text-[11px] font-mono text-text-muted mb-1">{line.item_code || "—"}</p>
                     <h3 className="text-xl font-black text-text-primary truncate tracking-tight">{line.item_name}</h3>
                     <p className="text-sm font-bold text-text-secondary mt-1">{line.category_name || "—"}</p>
                   </div>

                   <div className="flex items-center gap-12 shrink-0">
                     <div className="text-center w-24">
                       <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">النظام</p>
                       <p className="text-xl number-fmt text-text-muted">{line.system_quantity}</p>
                     </div>

                     <div className="w-px h-12 bg-bg-overlay"></div>

                     <div className="text-center relative">
                       <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">الفعلي</p>
                       <div className="relative">
                         <input
                           type="number"
                           disabled={activeSession?.readOnly}
                          className={`w-28 text-center text-2xl number-fmt py-2 rounded-2xl outline-none transition-all ${
                            touched ? "bg-indigo-50 text-indigo-700" : "bg-bg-overlay text-text-primary focus:bg-indigo-50 focus:text-indigo-900"
                          }`}
                           value={localVal}
                           onChange={(e) => {
                             const v = Number(e.target.value);
                             setLocalCounts((p) => ({ ...p, [key]: v }));
                           }}
                           onBlur={() => {
                             if (localVal !== line.counted_quantity) {
                               saveLine(line.item_id, line.warehouse_id, localVal);
                             }
                           }}
                         />
                         {savingLines[key] === "saving" && <Loader2 className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-indigo-500" />}
                         {savingLines[key] === "ok" && <CheckCircle2 className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
                       </div>
                     </div>

                     <div className="w-px h-12 bg-bg-overlay"></div>

                     <div className="text-center w-24">
                       <p className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">الفرق</p>
                       <p className={`text-xl number-fmt ${
                         !touched ? "text-slate-200" : variance > 0 ? "text-emerald-500" : variance < 0 ? "text-rose-500" : "text-text-primary"
                       }`}>
                         {touched ? (variance > 0 ? `+${variance}` : variance) : "—"}
                       </p>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
        </div>
      </div>

      {/* Dynamic Island Action Bar */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-4xl px-6">
        <motion.div
          data-help="differences-section"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-slate-950/90 backdrop-blur-xl border border-border-normal/10 rounded-[2rem] p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex items-center justify-between pointer-events-auto"
        >
          <div className="flex items-center gap-6 px-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${stats.variance_count > 0 ? "bg-amber-400 animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.5)]" : "bg-emerald-400"}`}></div>
              <span className="text-sm font-black tracking-widest uppercase text-white">{stats.variance_count} فروقات</span>
            </div>
            <div className="w-px h-6 bg-slate-900"></div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-black tracking-widest text-text-muted">{stats.total_lines - stats.counted_lines} متبقي</span>
            </div>
          </div>

          {activeSession?.readOnly ? (
            <div className="px-8 py-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-black uppercase tracking-widest text-white">الجرد معتمد</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <PermissionGate page="physical_count" action="delete">
                <button onClick={() => setCancelDialog(true)} className="px-6 h-14 rounded-full text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 transition-colors">إلغاء</button>
              </PermissionGate>
              <PermissionGate page="physical_count" action="edit">
                <button data-help="apply-button" onClick={() => setConfirmDialog(true)} className="px-8 h-14 rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-sm font-black uppercase tracking-widest shadow-[0_0_20px_var(--primary-glow)] transition-all flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  اعتماد التسوية
                </button>
              </PermissionGate>
            </div>
          )}
        </motion.div>
      </div>

      {/* Confirm Dialog — plain-language preview of exactly what the commit will do */}
      {confirmDialog && (() => {
        const lines = activeSession?.lines || [];
        const touchedLines = lines.filter((l) => l.touched);
        const up = touchedLines.filter((l) => l.variance > 0);
        const down = touchedLines.filter((l) => l.variance < 0);
        const upQty = up.reduce((s, l) => s + l.variance, 0);
        const downQty = down.reduce((s, l) => s + Math.abs(l.variance), 0);
        const uncounted = stats.total_lines - stats.counted_lines;
        return (
          <ConsequencePreview
            open
            title="اعتماد الجرد — سيحدث الآتي:"
            consequences={[
              up.length > 0 && { tone: "success", text: `${up.length} صنف هيزيد رصيده بإجمالي +${upQty} قطعة (لقيت على الرف أكتر من الشاشة).` },
              down.length > 0 && { tone: "danger", text: `${down.length} صنف هينقص رصيده بإجمالي −${downQty} قطعة — ده عجز هيتسجل بتاريخ اليوم.` },
              uncounted > 0 && { tone: "warning", text: `${uncounted} صنف ماتعدّش — رصيده هيفضل زي ما هو ومش هيتلمس.` },
              { tone: "info", text: "بعد الاعتماد الجلسة بتتقفل للقراءة فقط، والفروقات بتظهر في حركات المخزون بنوع «جرد»." },
            ].filter(Boolean)}
            confirmLabel={confirming ? "جاري الاعتماد..." : "تأكيد واعتماد الجرد"}
            loading={confirming}
            onConfirm={handleConfirm}
            onClose={() => setConfirmDialog(null)}
          />
        );
      })()}

      {/* Cancel Dialog */}
      {cancelDialog && (
        <ConfirmDialog
          open
          title="إلغاء جلسة الجرد"
          message="سيتم حذف مسودة الجرد بالكامل ولن تتأثر أرصدة النظام الحالية."
          confirmLabel={cancelling ? "جاري الإلغاء..." : "نعم، إلغاء الجرد"}
          onConfirm={handleCancel}
          onCancel={() => setCancelDialog(false)}
          variant="danger"
        />
      )}
    </main>
  );
}
