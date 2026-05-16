import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Plus, Pencil, Trash2, X, Lock, ArrowUpCircle, ArrowDownCircle,
  BookOpen, RefreshCw, Search, Calendar, Printer, Settings2, Wallet, Banknote
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PaymentMethodsReportTemplate from "../../components/print/templates/PaymentMethodsReportTemplate";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
  { value: "cash", label: "نقدي", icon: "💵" },
  { value: "credit", label: "أجل", icon: "📋" },
  { value: "bank", label: "تحويل بنكي", icon: "🏦" },
  { value: "digital_wallet", label: "محفظة رقمية", icon: "📱" },
  { value: "other", label: "أخرى", icon: "🔄" },
];

const CAT_COLORS = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  credit: "bg-amber-50 text-amber-700 border-amber-200/50",
  bank: "bg-blue-50 text-blue-700 border-blue-200/50",
  digital_wallet: "bg-violet-50 text-violet-700 border-violet-200/50",
  other: "bg-slate-50 text-slate-600 border-slate-200/50",
};

const DEFAULT_EXTRAS = [
  { name: "InstaPay", category: "digital_wallet", icon: "📲", description: "خدمة إنستاباي", excludes_from_treasury: 1 },
  { name: "Vodafone Cash", category: "digital_wallet", icon: "📱", description: "فودافون كاش", excludes_from_treasury: 1 },
  { name: "Etisalat Cash", category: "digital_wallet", icon: "📱", description: "اتصالات كاش", excludes_from_treasury: 1 },
  { name: "WE Pay", category: "digital_wallet", icon: "📱", description: "اتصالات WE", excludes_from_treasury: 1 },
  { name: "تحويل بنكي", category: "bank", icon: "🏦", description: "حوالة بنكية", excludes_from_treasury: 1 },
];

function MethodsTab() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "digital_wallet", icon: "💳", description: "", excludes_from_treasury: true });
  const [saving, setSaving] = useState(false);

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

  const MethodCard = ({ m, isSystem }) => (
    <div className={`relative flex flex-col bg-white rounded-2xl transition-all duration-300 group hover:-translate-y-1 ${isSystem ? "ring-1 ring-slate-200/80 shadow-sm" : "ring-1 ring-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-xl hover:shadow-slate-200/50 hover:ring-slate-300"} p-5`}>
      {isSystem && (
        <div className="absolute top-4 left-4 flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 ring-1 ring-slate-200/80 text-slate-400">
          <Lock size={12} />
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 text-2xl shadow-sm">
            {m.icon || "💳"}
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight">{m.name}</h3>
            <span className={`inline-block mt-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider border ${CAT_COLORS[m.category] || CAT_COLORS.other}`}>
              {CATEGORIES.find(c => c.value === m.category)?.label || "أخرى"}
            </span>
          </div>
        </div>
      </div>
      
      {m.description && <p className="text-[12px] text-slate-500 font-medium mb-4 line-clamp-2 leading-relaxed">{m.description}</p>}
      
      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
        {!isSystem && m.excludes_from_treasury ? (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-md px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            مستثنى من الخزينة
          </div>
        ) : (
          <div className="text-[10px] font-medium text-slate-400">معاملات الشهر: <span className="font-bold text-slate-600">{m.monthly_count || 0}</span></div>
        )}

        {!isSystem && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <PermissionGate page="payment_methods" action="edit">
              <button onClick={() => openEdit(m)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"><Pencil size={14} /></button>
            </PermissionGate>
            <PermissionGate page="payment_methods" action="delete">
              <button onClick={() => handleDelete(m.id, m.name)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
            </PermissionGate>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-10">
      
      <div className="bg-white rounded-[1.5rem] ring-1 ring-slate-200/80 shadow-sm overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100">
        {methods.slice(0, 4).map((m) => (
          <div key={m.id} className="flex-1 p-6 relative overflow-hidden group hover:bg-slate-50/50 transition-colors duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -mr-10 -mt-10 opacity-30 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white ring-1 ring-slate-200/60 shadow-sm text-lg">{m.icon || "💳"}</span>
                <span className="text-[13px] font-bold text-slate-700">{m.name}</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">إجمالي التداولات</div>
                  <div className="text-[20px] font-black font-mono text-slate-900 tracking-tight leading-none">{fmt(m.monthly_total || 0)} <span className="text-[11px] text-slate-400 font-sans mr-0.5">ج.م</span></div>
                </div>
                <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50/80 px-2 py-1 rounded-md ring-1 ring-emerald-100/50">
                  {m.monthly_count || 0} عملية
                </div>
              </div>
            </div>
          </div>
        ))}
        {methods.length < 4 && Array.from({ length: 4 - methods.slice(0, 4).length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex-1 p-6 flex items-center justify-center opacity-40">
            <div className="w-16 h-2 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-8">
        
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Settings2 size={16} className="text-slate-400" />
            <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">أساسيات النظام</h2>
          </div>
          <div className="flex flex-col gap-4">
            {systemMethods.map(m => <MethodCard key={m.id} m={m} isSystem />)}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-slate-400" />
              <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-widest">المحافظ والبطاقات الإضافية</h2>
            </div>
            <div className="flex items-center gap-3">
              {userMethods.length === 0 && (
                <PermissionGate page="payment_methods" action="add">
                  <button onClick={seedDefaults} className="text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors">إدراج الافتراضيات</button>
                </PermissionGate>
              )}
              <PermissionGate page="payment_methods" action="add">
                <button data-help="add-button" onClick={openCreate} className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-[12px] font-bold text-white hover:bg-slate-800 transition-colors shadow-md active:scale-95">
                  <Plus size={14} /> وسيلة جديدة
                </button>
              </PermissionGate>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-bold text-[13px] animate-pulse">جاري فحص الوسائل...</div>
          ) : (
            <div data-help="main-table" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userMethods.map(m => <MethodCard key={m.id} m={m} isSystem={false} />)}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
              
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm text-lg">{form.icon || "💳"}</div>
                  <h2 className="text-[16px] font-black text-slate-900">{editing ? "تعديل بيانات الوسيلة" : "تسجيل وسيلة جديدة"}</h2>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"><X size={16} /></button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">اسم الوسيلة</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[14px] font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm" placeholder="مثال: فودافون كاش" />
                  </div>
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">رمز</label>
                    <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                      className="w-full h-11 rounded-xl border border-slate-200 px-0 text-center text-[20px] outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">التصنيف المحاسبي</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-900 outline-none bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm cursor-pointer appearance-none">
                    {CATEGORIES.filter(c => c.value !== "cash" && c.value !== "credit").map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">وصف إضافي (اختياري)</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 transition-all shadow-sm" placeholder="ملاحظات حول طريقة الاستخدام..." />
                </div>

                <label className="flex items-start gap-4 cursor-pointer rounded-2xl border border-slate-200 p-5 hover:bg-slate-50 transition-colors group">
                  <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
                    <input type="checkbox" checked={form.excludes_from_treasury} onChange={e => setForm(f => ({ ...f, excludes_from_treasury: e.target.checked }))} className="peer sr-only" />
                    <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-colors" />
                    <svg className="absolute w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-slate-900 mb-0.5">عزل عن الخزينة اليومية</div>
                    <div className="text-[11px] text-slate-500 font-medium leading-relaxed">تفعيل هذا الخيار سيمنع ظهور معاملات هذه الوسيلة في إجمالي السيولة النقدية لدرج الكاشير. (مفيد للمحافظ الإلكترونية والبنك)</div>
                  </div>
                </label>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-xl bg-white border border-slate-200 py-3 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">إلغاء</button>
                <button onClick={handleSave} disabled={!form.name.trim() || saving}
                  className="flex-[2] rounded-xl bg-slate-900 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-md active:scale-95">
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
  const [printOpen, setPrintOpen] = useState(false);

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
      setMethods(mR.data.data || []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalIn = rows.filter(r => r.direction !== "out").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalOut = rows.filter(r => r.direction === "out").reduce((s, r) => s + Number(r.amount || 0), 0);
  const isFiltered = filters.search || filters.from || filters.to || filters.method || filters.type;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#fafafa] p-6 lg:p-8">
      
      <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col mb-6 shrink-0 overflow-hidden">
        
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-100 bg-white border-b border-slate-100">
          {[
            { label: "إجمالي المقبوضات (داخل)", val: totalIn, color: "text-emerald-700", bg: "bg-emerald-50/50", icon: ArrowUpCircle, ring: "ring-emerald-100" },
            { label: "إجمالي المدفوعات (خارج)", val: totalOut, color: "text-rose-700", bg: "bg-rose-50/50", icon: ArrowDownCircle, ring: "ring-rose-100" },
            { label: "الصافي النهائي", val: totalIn - totalOut, color: "text-blue-700", bg: "bg-blue-50/50", icon: Banknote, ring: "ring-blue-100" },
          ].map(({ label, val, color, bg, icon: Icon, ring }) => (
            <div key={label} className="p-7 flex items-center justify-between group hover:bg-slate-50/30 transition-colors">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.05em] mb-2">{label}</div>
                <div className={`text-[24px] font-black font-mono tracking-tight leading-none ${color}`}>{fmt(val)} <span className="text-[11px] font-sans text-slate-400 ml-1">ج.م</span></div>
              </div>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${bg} ${color} ring-1 ${ring} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={20} strokeWidth={2.5} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div data-help="search-bar" className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} placeholder="بحث برقم المستند، البيان..."
                className="w-full h-10 rounded-xl border border-slate-200 pr-9 pl-3 text-[13px] font-medium text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-sm" />
            </div>
            
            <div className="flex items-center w-full sm:w-auto bg-white border border-slate-200 rounded-xl shadow-sm h-10 overflow-hidden focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition-all">
              <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} className="flex-1 h-full px-3 bg-transparent text-[13px] font-medium text-slate-900 outline-none font-mono" />
              <div className="w-px h-6 bg-slate-200" />
              <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") load(); }} className="flex-1 h-full px-3 bg-transparent text-[13px] font-medium text-slate-900 outline-none font-mono" />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 hide-scrollbar">
            <select value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 bg-white outline-none cursor-pointer shadow-sm min-w-[140px]">
              <option value="">جميع الوسائل</option>
              {methods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
            </select>
            
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 bg-white outline-none cursor-pointer shadow-sm min-w-[130px]">
              <option value="">كل الاتجاهات</option>
              <option value="in">عمليات الدخول</option>
              <option value="out">عمليات الخروج</option>
            </select>
            
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

            <button onClick={load} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-[13px] font-bold text-white hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap shrink-0">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تنفيذ
            </button>
            
            <PermissionGate page="payment_methods" action="print">
              <button onClick={() => setPrintOpen(true)} className="flex h-10 items-center justify-center w-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm shrink-0">
                <Printer className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        {loading && rows.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-[12px] font-bold shadow-xl animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin" /> جاري سحب البيانات...
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
              <Search size={24} />
            </div>
            <div className="text-center">
              <span className="block text-[14px] font-bold text-slate-600 mb-1">لا توجد حركات مسجلة</span>
              <span className="block text-[12px] font-medium">حاول تعديل نطاق البحث أو عوامل التصفية لعرض النتائج</span>
            </div>
            {isFiltered && (
               <button onClick={() => { setFilters({ search: "", from: "", to: "", method: "", type: "" }); load(); }} className="mt-2 text-[12px] font-bold text-violet-600 hover:text-violet-800 underline underline-offset-4">إعادة ضبط الفلاتر</button>
            )}
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  {["المرجع", "نوع المستند", "المبلغ", "حالة التدفق", "البيان / الطرف", "المحفظة/البنك", "توقيت العملية"].map(h => (
                    <th key={h} className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.05em] whitespace-nowrap bg-slate-50/50 backdrop-blur-md">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-[12px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">{r.doc_no || `#${r.id}`}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[12px] font-bold text-slate-600">{r.doc_type || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-[13px] font-black text-slate-900 tabular-nums tracking-tight">{fmt(r.amount)}</span>
                      <span className="text-[10px] text-slate-400 font-sans mr-1">ج.م</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ring-1 ${r.direction === "out" ? "bg-rose-50 text-rose-700 ring-rose-200/50" : "bg-emerald-50 text-emerald-700 ring-emerald-200/50"}`}>
                        {r.direction === "out" ? <ArrowDownCircle size={12} strokeWidth={2.5} /> : <ArrowUpCircle size={12} strokeWidth={2.5} />}
                        {r.direction === "out" ? "منصرف" : "مقبوض"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] font-medium text-slate-700 max-w-[200px] truncate" title={r.party || r.description}>
                      {r.party || r.description || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded bg-white ring-1 ring-slate-200 shadow-sm text-[12px]">{methods.find(m => m.id === r.method_id)?.icon || "💳"}</span>
                        <span className="text-[12px] font-bold text-slate-700">{r.method_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[12px] font-medium text-slate-400 font-mono tracking-tight group-hover:text-slate-600 transition-colors">
                        {r.created_at ? new Date(r.created_at).toLocaleString("ar-EG", { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    <div className="flex flex-col h-full bg-[#fafafa] font-sans" dir="rtl">
      
      <header className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10">
        <div className="absolute right-0 top-0 w-[500px] h-full bg-gradient-to-l from-slate-50/80 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-slate-900 blur-lg opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-900 transform group-hover:scale-105 transition-transform duration-500">
              <CreditCard strokeWidth={2} size={28} />
            </div>
          </div>
          <div>
            <h1 className="text-[24px] font-black text-slate-900 tracking-tight leading-none mb-1.5">الخزينة والمحافظ الرقمية</h1>
            <p className="text-[13px] font-medium text-slate-500">إدارة بوابات الدفع، المحافظ الإلكترونية، الحسابات البنكية، وتتبع سيولة النظام</p>
          </div>
        </div>

        <div className="relative z-10 flex p-1 bg-slate-100 rounded-[1.25rem] border border-slate-200/80 shadow-inner w-fit">
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
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 outline-none ${
                  isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="payment_tab_indicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-slate-900" : "text-slate-400"} />
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {tab === "methods" ? <MethodsTab /> : <TransactionsTab />}
    </div>
  );
}
