import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard, Plus, Pencil, Trash2, X, Lock, ArrowUpCircle, ArrowDownCircle,
  BookOpen, RefreshCw, Search, Printer, Settings2, Wallet, Banknote, ShieldCheck,
  Landmark, CalendarClock, Users,
} from "lucide-react";
import MoneyPath from "../../components/ui/MoneyPath";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PaymentMethodsReportTemplate from "../../components/print/templates/PaymentMethodsReportTemplate";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

const fmt = (n) => formatNumber(n);

// "فيزا" is a permanent, record-only system method (category 'card') seeded by
// migration 156 — it shows here read-only alongside نقدي/أجل and is selected from
// POS متعدد. The 'card' category is not offered in the create dialog (system-only).
const CATEGORIES = [
  { value: "cash", label: "نقدي", icon: "💵" },
  { value: "credit", label: "أجل", icon: "📋" },
  { value: "card", label: "فيزا / بطاقة", icon: "💳" },
  { value: "digital_wallet", label: "محفظة رقمية", icon: "📱" },
  { value: "other", label: "أخرى", icon: "🔄" },
];

const CAT_COLORS = {
  cash: "bg-emerald-50 text-emerald-700",
  credit: "bg-amber-50 text-amber-700",
  bank: "bg-blue-50 text-blue-700",
  card: "bg-blue-50 text-blue-700",
  digital_wallet: "bg-violet-50 text-violet-700",
  other: "bg-slate-50 text-slate-600",
};

// Where the money actually lands for each method — shown as a chip on every
// card so the mapping is visible in the list, not buried in behavior.
function methodDestination(m) {
  if (m.category === "credit") return { icon: CalendarClock, label: "على حساب العميل — لا كاش الآن" };
  if (m.category === "card" || m.category === "bank") return { icon: Landmark, label: "حساب البنك (قناة معزولة)" };
  if (m.excludes_from_treasury) return { icon: Wallet, label: "قناة معزولة — خارج درج الكاشير" };
  return { icon: Wallet, label: "خزنة الكاشير" };
}

const DEFAULT_EXTRAS = [
  { name: "InstaPay", category: "digital_wallet", icon: "📲", description: "خدمة إنستاباي", excludes_from_treasury: 1 },
  { name: "Vodafone Cash", category: "digital_wallet", icon: "📱", description: "فودافون كاش", excludes_from_treasury: 1 },
  { name: "Etisalat Cash", category: "digital_wallet", icon: "📱", description: "اتصالات كاش", excludes_from_treasury: 1 },
  { name: "WE Pay", category: "digital_wallet", icon: "📱", description: "اتصالات WE", excludes_from_treasury: 1 },
];

function MethodsTab() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "digital_wallet", icon: "💳", description: "", excludes_from_treasury: true });
  const [saving, setSaving] = useState(false);
  const handleKeyDown = useFieldNavigation();
  const nameRef = useRef(null);
  const iconRef = useRef(null);
  const catRef = useRef(null);
  const descRef = useRef(null);
  const saveBtnRef = useRef(null);

  async function load() {
    setLoading(true);
    try { setMethods((await api.get("/api/payment-methods")).data.data || []); }
    catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const systemMethods = methods.filter(m => m.is_system);
  const userMethods = methods.filter(m => !m.is_system);

  function openCreate() { setEditing(null); setForm({ name: "", category: "digital_wallet", icon: "💳", description: "", excludes_from_treasury: true }); setModalOpen(true); }
  function openEdit(m) { setEditing(m); setForm({ name: m.name, category: m.category || "digital_wallet", icon: m.icon || "💳", description: m.description || "", excludes_from_treasury: Boolean(m.excludes_from_treasury) }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/api/payment-methods/${editing.id}`, { ...form, excludes_from_treasury: form.excludes_from_treasury ? 1 : 0 });
      else await api.post("/api/payment-methods", { ...form, excludes_from_treasury: form.excludes_from_treasury ? 1 : 0 });
      setModalOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id, name) {
    if (!confirm(`حذف "${name}"؟`)) return;
    try { await api.delete(`/api/payment-methods/${id}`); load(); }
    catch (e) { toast.error(e.response?.data?.message || "لا يمكن الحذف"); }
  }

  async function seedDefaults() {
    for (const m of DEFAULT_EXTRAS) {
      try { await api.post("/api/payment-methods", m); } catch {}
    }
    load();
  }

  const MethodCard = ({ m, isSystem, idx }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05, type: "spring", stiffness: 100, damping: 20 }}
      className={`relative flex flex-col justify-between bg-white rounded-[2rem] p-8 overflow-hidden group hover:scale-[1.02] transition-transform duration-500 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] border ${isSystem ? 'border-slate-200' : 'border-slate-100 hover:border-indigo-100'}`}
    >
      {isSystem && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none" />
      )}

      <div className="relative z-10 flex items-start justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-[1.25rem] bg-slate-50 border border-slate-100 text-3xl shadow-sm">
            {m.icon || "💳"}
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{m.name}</h3>
            <span className={`inline-flex mt-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${CAT_COLORS[m.category] || CAT_COLORS.other}`}>
              {CATEGORIES.find(c => c.value === m.category)?.label || "أخرى"}
            </span>
          </div>
        </div>
        
        {isSystem && (
           <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400" title="وسيلة نظامية">
             <ShieldCheck size={16} />
           </div>
        )}
      </div>
      
      {m.description && <p className="text-sm text-slate-500 font-bold mb-6 line-clamp-2 leading-relaxed">{m.description}</p>}

      <MoneyPath
        compact
        className="relative z-10 mb-4"
        from={{ icon: Users, label: "العميل يدفع" }}
        to={methodDestination(m)}
      />

      <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-100 relative z-10">
        {!isSystem && m.excludes_from_treasury ? (
          <div className="flex items-center gap-2 text-[11px] font-black tracking-widest uppercase text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            خارج الخزينة
          </div>
        ) : (
          <div className="text-[11px] font-black tracking-widest uppercase text-slate-400">
            تداولات الشهر <span className="text-sm number-fmt text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg ml-2">{m.monthly_count || 0}</span>
          </div>
        )}

        {!isSystem && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <PermissionGate page="payment_methods" action="edit">
              <button onClick={() => openEdit(m)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Pencil size={16} /></button>
            </PermissionGate>
            <PermissionGate page="payment_methods" action="delete">
              <button onClick={() => handleDelete(m.id, m.name)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button>
            </PermissionGate>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-16 pb-32">

      <div className="max-w-7xl mx-auto w-full px-6 space-y-16">
        {/* System Methods */}
        <section>
          <div className="flex items-center gap-3 mb-8 px-2">
            <Settings2 size={24} className="text-slate-900" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">النظام الأساسي</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemMethods.map((m, idx) => <MethodCard key={m.id} m={m} isSystem idx={idx} />)}
          </div>
        </section>

        <div className="w-full h-px bg-slate-200"></div>

        {/* User Methods */}
        <section>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <Wallet size={24} className="text-slate-900" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">المحافظ والبوابات الرقمية</h2>
            </div>
            
            <div className="flex items-center gap-4">
              {userMethods.length === 0 && (
                <PermissionGate page="payment_methods" action="add">
                  <button onClick={seedDefaults} className="text-2sm font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors">إدراج الافتراضيات</button>
                </PermissionGate>
              )}
              <PermissionGate page="payment_methods" action="add">
                <button data-help="add-button" onClick={openCreate} className="flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-white hover:bg-primary-600 transition-all shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] active:scale-95 uppercase tracking-widest">
                  <Plus size={16} /> وسيلة جديدة
                </button>
              </PermissionGate>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 font-black text-sm uppercase tracking-widest animate-pulse">جاري فحص الوسائل...</div>
          ) : (
            <div data-help="main-table" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userMethods.map((m, idx) => <MethodCard key={m.id} m={m} isSystem={false} idx={idx} />)}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
              
              <div className="flex items-center justify-between px-10 py-8 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-2xl">{form.icon || "💳"}</div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editing ? "تعديل الوسيلة" : "وسيلة جديدة"}</h2>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>

              <div className="p-10 space-y-8">
                <div className="grid grid-cols-4 gap-6">
                  <div className="col-span-3">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">اسم الوسيلة</label>
                    <input ref={nameRef} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus onKeyDown={(e) => handleKeyDown(e, { nextRef: iconRef })}
                      className="w-full text-2xl font-black text-slate-900 placeholder:text-slate-300 outline-none border-b-2 border-slate-100 focus:border-slate-900 pb-3 transition-colors bg-transparent" placeholder="مثال: فودافون كاش" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">الرمز</label>
                    <input ref={iconRef} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: catRef, prevRef: nameRef })}
                      className="w-full text-2xl text-center outline-none border-b-2 border-slate-100 focus:border-slate-900 pb-3 transition-colors bg-transparent" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">التصنيف المحاسبي</label>
                  <select ref={catRef} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: descRef, prevRef: iconRef })}
                    className="w-full text-xl font-bold text-slate-900 outline-none border-b-2 border-slate-100 focus:border-slate-900 pb-3 transition-colors bg-transparent appearance-none cursor-pointer">
                    {CATEGORIES.filter(c => c.value !== "cash" && c.value !== "credit" && c.value !== "card").map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">وصف إضافي (اختياري)</label>
                  <input ref={descRef} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: saveBtnRef, prevRef: catRef })}
                    className="w-full text-lg font-bold text-slate-900 placeholder:text-slate-300 outline-none border-b border-slate-100 focus:border-slate-900 pb-3 transition-colors bg-transparent" placeholder="ملاحظات..." />
                </div>

                <label className="flex items-start gap-5 cursor-pointer rounded-[2rem] border border-slate-200 p-6 hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center justify-center w-6 h-6 mt-1">
                    <input type="checkbox" checked={form.excludes_from_treasury} onChange={e => setForm(f => ({ ...f, excludes_from_treasury: e.target.checked }))} className="peer sr-only" />
                    <div className="w-6 h-6 rounded-md border-2 border-slate-300 peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-colors" />
                    <svg className="absolute w-4 h-4 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-black text-slate-900 mb-1">عزل عن الخزينة اليومية</div>
                    <div className="text-2sm font-bold text-slate-500 leading-relaxed max-w-sm">تفعيل هذا الخيار سيمنع ظهور معاملات هذه الوسيلة في إجمالي السيولة النقدية لدرج الكاشير.</div>
                  </div>
                </label>
              </div>

              <div className="p-8 border-t border-slate-100 flex gap-4">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-full bg-slate-100 py-4 text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-widest">إلغاء</button>
                <button ref={saveBtnRef} onClick={handleSave} disabled={!form.name.trim() || saving} onKeyDown={(e) => handleKeyDown(e, { nextRef: nameRef, onEnter: handleSave })}
                  className="flex-[2] rounded-full bg-primary py-4 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-50 transition-all shadow-lg active:scale-95 uppercase tracking-widest">
                  {saving ? "جاري التسجيل..." : "حفظ الوسيلة"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransactionsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState([]);
  const [filters, setFilters] = useState({ search: "", from: "", to: "", method: "", type: "" });
  const handleKeyDown = useFieldNavigation();
  const searchRef = useRef(null);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const methodRef = useRef(null);
  const typeRef = useRef(null);
  const refreshBtnRef = useRef(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [flowSummary, setFlowSummary] = useState({ totals: null, by_method: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.method) params.set("method_id", filters.method);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      const [txR, mR] = await Promise.all([
        api.get(`/api/payment-methods/transactions?${params}`),
        api.get("/api/payment-methods"),
      ]);
      setRows(txR.data.data || []);
      setFlowSummary({ totals: txR.data.totals || null, by_method: txR.data.by_method || [] });
      setMethods(mR.data.data || []);
    } catch { setRows([]); setFlowSummary({ totals: null, by_method: [] }); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const visibleTotalIn = rows.filter(r => r.direction !== "out").reduce((s, r) => s + Number(r.amount || 0), 0);
  const visibleTotalOut = rows.filter(r => r.direction === "out").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalIn = Number(flowSummary.totals?.total_in ?? visibleTotalIn);
  const totalOut = Number(flowSummary.totals?.total_out ?? visibleTotalOut);
  const netTotal = Number(flowSummary.totals?.net_amount ?? (totalIn - totalOut));
  const topMethods = useMemo(() => [...(flowSummary.by_method || [])].sort((a, b) => Math.abs(Number(b.net_amount || 0)) - Math.abs(Number(a.net_amount || 0))).slice(0, 6), [flowSummary.by_method]);
  const reportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set("start_date", filters.from);
    if (filters.to) params.set("end_date", filters.to);
    if (filters.method) params.set("method_id", filters.method);
    if (filters.type) params.set("direction", filters.type);
    if (filters.search) params.set("q", filters.search);
    const qs = params.toString();
    return `/reports/source/treasury/payment-flow-ledger/detailed${qs ? `?${qs}` : ""}`;
  }, [filters]);
  const isFiltered = filters.search || filters.from || filters.to || filters.method || filters.type;

  return (
    <div className="flex flex-col flex-1 bg-[var(--bg-base)]">

      {/* Summary Chips */}
      <div className="flex items-center gap-6 px-8 py-6 border-b border-slate-200 bg-white flex-wrap">
        {[
          { label: "المقبوضات", val: totalIn, color: "text-emerald-600", dot: "bg-emerald-400" },
          { label: "المدفوعات", val: totalOut, color: "text-rose-600", dot: "bg-rose-400" },
          { label: "الصافي", val: netTotal, color: netTotal < 0 ? "text-rose-700" : "text-slate-900", dot: "bg-slate-400" },
        ].map(({ label, val, color, dot }) => (
          <div key={label} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-full px-5 py-2.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            <span className={`number-fmt-primary text-[15px] ${color}`}>{fmt(val)}</span>
            <span className="text-[11px] text-slate-400 font-bold">ج.م</span>
          </div>
        ))}
      </div>

      <div className="mx-auto w-full px-6 py-8 flex flex-col gap-8 flex-1">
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-6 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div data-help="search-bar" className="relative w-full max-w-[300px]">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <input ref={searchRef} value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: fromRef, onEnter: load })} placeholder="بحث برقم المستند، البيان..."
                className="w-full h-14 rounded-full bg-slate-50 pr-14 pl-6 text-sm font-black text-slate-900 outline-none focus:bg-slate-100 transition-colors" />
            </div>
            
            <div className="flex items-center bg-slate-50 rounded-full h-14 px-4 overflow-hidden border border-slate-100">
              <input ref={fromRef} type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: toRef, prevRef: searchRef })} className="flex-1 h-full px-2 bg-transparent text-sm font-bold text-slate-600 outline-none font-mono" />
              <div className="w-px h-6 bg-slate-200 mx-2" />
              <input ref={toRef} type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: methodRef, prevRef: fromRef })} className="flex-1 h-full px-2 bg-transparent text-sm font-bold text-slate-600 outline-none font-mono" />
            </div>

            <select ref={methodRef} value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: typeRef, prevRef: toRef })} className="h-14 rounded-full bg-slate-50 px-6 text-sm font-black text-slate-700 outline-none cursor-pointer border border-slate-100">
              <option value="">جميع الوسائل</option>
              {methods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
            </select>
            
            <select ref={typeRef} value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} onKeyDown={(e) => handleKeyDown(e, { nextRef: refreshBtnRef, prevRef: methodRef })} className="h-14 rounded-full bg-slate-50 px-6 text-sm font-black text-slate-700 outline-none cursor-pointer border border-slate-100">
              <option value="">كل الاتجاهات</option>
              <option value="in">عمليات الدخول</option>
              <option value="out">عمليات الخروج</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <button ref={refreshBtnRef} onClick={load} onKeyDown={(e) => handleKeyDown(e, { nextRef: searchRef, onEnter: load })} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-600 transition-colors shadow-md">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <PermissionGate page="payment_methods" action="print">
              <button onClick={() => setPrintOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                <Printer className="h-5 w-5" />
              </button>
            </PermissionGate>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to={reportHref} className="inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-xs font-black text-white shadow-sm transition-colors hover:bg-slate-800">
            <BookOpen className="h-4 w-4" /> التقرير التفصيلي
          </Link>
        </div>

        {topMethods.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topMethods.map((m) => (
              <div key={m.method_id || m.method_name} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-base">{m.method_icon || methods.find(x => x.id === m.method_id)?.icon || "💳"}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{m.method_name || "غير محدد"}</div>
                      <div className="text-[10px] font-bold text-slate-400">{Number(m.transaction_count || 0)} حركة</div>
                    </div>
                  </div>
                  {Number(m.excludes_from_treasury || 0) ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">خارج الخزينة</span> : null}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2"><div className="text-[10px] font-black text-emerald-700">داخل</div><div className="number-fmt text-sm font-black text-emerald-800">{fmt(m.total_in)}</div></div>
                  <div className="rounded-xl bg-rose-50 px-2 py-2"><div className="text-[10px] font-black text-rose-700">خارج</div><div className="number-fmt text-sm font-black text-rose-800">{fmt(m.total_out)}</div></div>
                  <div className="rounded-xl bg-slate-50 px-2 py-2"><div className="text-[10px] font-black text-slate-500">صافي</div><div className={`number-fmt text-sm font-black ${Number(m.net_amount || 0) < 0 ? "text-rose-700" : "text-slate-900"}`}>{fmt(m.net_amount)}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transactions Table */}
        <div className="relative" style={{ minHeight: '400px' }}>
          {loading && rows.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 px-8 py-4 rounded-full bg-white text-slate-900 text-sm font-black shadow-xl uppercase tracking-widest border border-slate-100">
                <RefreshCw className="h-5 w-5 animate-spin" /> جاري سحب البيانات...
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-60">
              <BookOpen className="w-24 h-24 text-slate-300 mb-8" strokeWidth={1} />
              <span className="block text-2xl font-black text-slate-400 mb-2">لا توجد حركات مسجلة</span>
              {isFiltered && (
                 <button onClick={() => { setFilters({ search: "", from: "", to: "", method: "", type: "" }); load(); }} className="mt-4 text-sm font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">إعادة ضبط الفلاتر</button>
              )}
            </div>
          ) : (
            <div className="overflow-auto rounded-[2rem] bg-white border border-slate-200 shadow-sm">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    {["المرجع", "نوع المستند", "المبلغ", "حالة التدفق", "البيان / الطرف", "المحفظة/البنك", "توقيت العملية"].map(h => (
                      <th key={h} className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <motion.tr 
                      key={i} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.5) }}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-slate-400 group-hover:text-slate-900 transition-colors">{r.doc_no || `#${r.id}`}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-sm font-black text-slate-800 tracking-tight">{r.doc_type_label || r.doc_type || "—"}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="number-fmt-primary text-[18px] text-slate-900 tracking-tighter">{fmt(r.amount)}</span>
                        <span className="text-[11px] text-slate-400 font-bold ml-1">ج.م</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-black tracking-widest uppercase ${r.direction === "out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {r.direction === "out" ? <ArrowDownCircle size={14} strokeWidth={2.5} /> : <ArrowUpCircle size={14} strokeWidth={2.5} />}
                          {r.direction === "out" ? "منصرف" : "مقبوض"}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600 max-w-[300px] truncate" title={r.party || r.description}>
                        {r.party || r.description || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm text-[16px]">{r.method_icon || methods.find(m => m.id === r.method_id)?.icon || "💳"}</span>
                          <span className="text-sm font-black text-slate-900">{r.method_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-400 font-mono tracking-tight group-hover:text-slate-600 transition-colors">
                          {r.created_at ? new Date(r.created_at).toLocaleString("en-US", { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12: true }) : "—"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="payment_methods_report"
          renderContent={(settings) => (
            <PaymentMethodsReportTemplate
              rows={rows}
              filters={filters}
              totalIn={totalIn}
              totalOut={totalOut}
              byMethod={flowSummary.by_method || []}
              settings={settings}
            />
          )}
        />
      )}
    </div>
  );
}

export default function PaymentMethodsPage() {
  usePageTour('payment_methods');
  const [tab, setTab] = useState("methods");

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)] font-sans" dir="rtl">
      
      <header className="bg-white border-b border-slate-200 px-10 py-12 shrink-0 flex flex-col gap-12 z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-7xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-4">
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
              الخزينة والمحافظ<br />الرقمية.
            </h1>
            <p className="text-[15px] font-bold text-slate-500 max-w-md leading-relaxed mt-2">
              إدارة احترافية لبوابات الدفع، المحافظ الإلكترونية، الحسابات البنكية، وتتبع سيولة النظام المالية.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Floating Tabs */}
      <div className="sticky top-0 z-20 flex justify-center -mt-8 pointer-events-none px-6">
        <div className="relative z-10 flex p-1.5 bg-slate-900/90 backdrop-blur-xl rounded-[2rem] border border-slate-800 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] w-fit pointer-events-auto">
          {[
            { id: "methods", label: "البوابات والمحافظ", icon: Wallet },
            { id: "transactions", label: "سجل التدفقات المالية", icon: BookOpen }
          ].map((item) => {
            const isActive = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] text-sm font-black tracking-widest uppercase transition-all duration-300 outline-none ${
                  isActive ? "text-slate-900" : "text-slate-400 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="payment_tab_indicator_v2"
                    className="absolute inset-0 bg-white rounded-[1.5rem] shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-slate-900" : "text-slate-400"} />
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "methods" ? <MethodsTab /> : <TransactionsTab />}
    </div>
  );
}
