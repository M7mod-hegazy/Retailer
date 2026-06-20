import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingDown, Plus, Pencil, Trash2, Search, Download, Calendar,
  X, ChevronDown, RefreshCw, AlertTriangle, Filter, Database, Check,
  CreditCard, Banknote, HelpCircle, Command, Info, ArrowLeftRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import { fuzzyFilterRows } from "../../utils/search";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

const fmt = (n) => formatNumber(n);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>;
  const parts = String(text).split(new RegExp(`(${query})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-rose-500/20 text-rose-900 px-0.5 rounded-sm">{part}</mark> 
          : part
      )}
    </span>
  );
}

// ----------------------------------------------------------------------
// Custom Dropdown Component
// ----------------------------------------------------------------------
function CustomSelect({ value, onChange, options, placeholder, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 h-10 px-3 rounded-xl border transition-all outline-none ${
          open 
            ? "bg-white border-rose-300 ring-4 ring-rose-500/10 shadow-sm" 
            : "bg-slate-50/80 border-transparent hover:bg-slate-100 hover:border-slate-200"
        }`}
      >
        {Icon && <Icon className="h-4 w-4 text-slate-400 shrink-0" />}
        <span className={`text-2sm font-bold truncate max-w-[120px] ${selectedOption ? 'text-zinc-800' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+8px)] w-56 max-w-[calc(100vw-2rem)] bg-white/90 backdrop-blur-2xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-1.5 z-[100]"
          >
            <div className="max-h-[250px] overflow-y-auto no-scrollbar flex flex-col gap-0.5">
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full text-right px-3 py-2 rounded-xl text-2sm font-bold transition-colors ${
                  value === "" ? "bg-rose-50 text-rose-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {placeholder}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-right px-3 py-2 rounded-xl text-2sm font-bold transition-colors ${
                    value === opt.value ? "bg-rose-50 text-rose-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// Smart Date Picker Component
// ----------------------------------------------------------------------
function SmartDatePicker({ dateFrom, dateTo, setDateFrom, setDateTo }) {
  // Modes: today, single, range
  const [mode, setMode] = useState(() => {
    if (dateFrom === dateTo && dateFrom === today()) return "today";
    if (dateFrom === dateTo) return "single";
    return "range";
  });

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === "today") {
      setDateFrom(today());
      setDateTo(today());
    }
  };

  const handleSingleDate = (e) => {
    const val = e.target.value;
    setDateFrom(val);
    setDateTo(val);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100">
      {/* Pills */}
      <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl shrink-0">
        <button 
          onClick={() => handleModeChange("today")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "today" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          اليوم
        </button>
        <button 
          onClick={() => handleModeChange("single")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "single" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          يوم محدد
        </button>
        <button 
          onClick={() => handleModeChange("range")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === "range" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          فترة
        </button>
      </div>

      {/* Dynamic Inputs based on Mode */}
      <AnimatePresence mode="wait">
        {mode === "single" && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center">
            <input 
              type="date" value={dateFrom} onChange={handleSingleDate} 
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer" 
            />
          </motion.div>
        )}
        {mode === "range" && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center gap-1 overflow-hidden">
            <input 
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} 
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer w-[110px]" 
            />
            <ArrowLeftRight className="h-3 w-3 text-slate-300 shrink-0" />
            <input 
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} 
              className="h-8 bg-transparent text-2sm font-bold text-zinc-700 outline-none px-2 cursor-pointer w-[110px]" 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// Raycast-style Command Palette Overlay
// ----------------------------------------------------------------------
function CommandPalette({ isOpen, onClose, initialData, categories, onSubmit, saving }) {
  const [form, setForm] = useState(initialData || {
    amount: "", category_id: "", description: "", notes: "",
    payment_method: "cash", is_recurring: false, recurring_frequency: "monthly"
  });

  const inputRef = useRef(null);
  const categoryRef = useRef(null);
  const methodRef = useRef(null);
  const descRef = useRef(null);
  const notesRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => {
    if (isOpen) {
      if (initialData) setForm(initialData);
      else setForm({ amount: "", category_id: "", description: "", notes: "", payment_method: "cash", is_recurring: false, recurring_frequency: "monthly" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      // cmd+enter or ctrl+enter to submit
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (form.amount && form.category_id && !saving) onSubmit(form);
      }
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, form, onSubmit, onClose, saving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-[var(--bg-surface)] rounded-3xl shadow-2xl border border-white overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-rose-100 text-rose-600">
              <Command className="h-4 w-4" />
            </div>
            <span className="text-sm font-black text-slate-800 tracking-tight">
              {initialData?.id ? 'تعديل سجل المصروف' : 'تسجيل مصروف جديد'}
            </span>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <div className="relative">
            <input 
              ref={inputRef}
              type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef })}
              className="w-full bg-transparent text-5xl md:text-7xl number-fmt-primary text-zinc-900 placeholder:text-slate-200 outline-none pb-2 border-b-2 border-slate-100 focus:border-rose-500 transition-colors"
            />
            <span className="absolute left-0 bottom-4 text-2xl font-black text-slate-300 pointer-events-none">EGP</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تصنيف المصروف <span className="text-rose-500">*</span></label>
              <select 
                ref={categoryRef}
                value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
                onKeyDown={e => handleKeyDown(e, { nextRef: methodRef, prevRef: inputRef })}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 appearance-none"
              >
                <option value="" disabled>اختر التصنيف...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</label>
              <select 
                ref={methodRef}
                value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}
                onKeyDown={e => handleKeyDown(e, { nextRef: descRef, prevRef: categoryRef })}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 appearance-none"
              >
                <option value="cash">نقدي (Cash)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="InstaPay">إنستا باي</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">البيان / الوصف</label>
            <input 
              ref={descRef}
              placeholder="اكتب وصفاً مختصراً للمصروف..." value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: methodRef })}
              className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ملاحظات إضافية</label>
            <textarea 
              ref={notesRef}
              placeholder="تفاصيل إضافية (اختياري)..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { prevRef: descRef, onEnter: () => { if (form.amount && form.category_id && !saving) onSubmit(form); } })}
              className="w-full h-20 resize-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-2sm font-medium outline-none focus:bg-white focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
            <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">Ctrl</span>
            <span>+</span>
            <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">Enter</span>
            <span className="ml-2">للحفظ السريع</span>
          </div>
          <button 
            onClick={() => onSubmit(form)} disabled={saving || !form.amount || !form.category_id}
            className="h-10 px-6 rounded-xl bg-primary text-white text-2sm font-black hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-lg shadow-zinc-900/20 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            تأكيد العملية
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Background Spline Animation
// ----------------------------------------------------------------------
const SplineHeader = () => (
  <div className="absolute top-0 left-0 right-0 h-[40vh] overflow-hidden pointer-events-none z-0 opacity-40">
    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
      <defs>
        <linearGradient id="roseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
          <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path 
        d="M-100,100 C100,150 200,50 400,100 C600,150 700,80 900,120 C1000,140 1100,100 1200,100" 
        fill="none" stroke="url(#roseGradient)" strokeWidth="3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      <motion.path 
        d="M-100,120 C150,170 250,70 450,120 C650,170 750,100 950,140 C1050,160 1150,120 1250,120" 
        fill="none" stroke="#f43f5e" strokeOpacity="0.1" strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, ease: "easeInOut", delay: 0.2 }}
      />
    </svg>
    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-base)]" />
  </div>
);

// ----------------------------------------------------------------------
// Main Page
// ----------------------------------------------------------------------
export default function ExpensesListPage() {
  usePageTour('expenses');
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [catFilter, setCatFilter] = useState("");
  
  // Command Palette State
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdData, setCmdData] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eR, cR] = await Promise.all([
        api.get(`/api/expenses?date_from=${dateFrom}&date_to=${dateTo}${catFilter ? `&category_id=${catFilter}` : ""}`),
        api.get("/api/expenses/categories"),
      ]);
      setRows(eR.data.data || []);
      setCategories(cR.data.data || []);
    } catch { toast.error("فشل تحميل البيانات"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, catFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => fuzzyFilterRows(rows, query, ["description", "notes", "category_name", "doc_no"]), [rows, query]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const todayAmt = rows.filter(r => r.created_at?.slice(0, 10) === today()).reduce((s, r) => s + Number(r.amount || 0), 0);
    return { total, todayAmt, count: rows.length };
  }, [rows]);

  async function handleSave(formData) {
    setSaving(true);
    try {
      if (formData.id) {
        await api.put(`/api/expenses/${formData.id}`, formData);
        toast.success("تم تعديل المصروف");
      } else {
        await api.post("/api/expenses", formData);
        toast.success("تم تسجيل المصروف");
      }
      setCmdOpen(false);
      setCmdData(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm("تأكيد حذف المصروف نهائياً؟")) return;
    try { 
      await api.delete(`/api/expenses/${id}`); 
      toast.success("تم حذف المصروف"); 
      load(); 
    } catch { toast.error("فشل عملية الحذف"); }
  }

  function openCreate() {
    if (categories.length === 0) {
      toast.error("يجب إنشاء قسم مصروفات أولاً");
      return;
    }
    setCmdData(null);
    setCmdOpen(true);
  }

  function openEdit(row) {
    setCmdData({ 
      id: row.id,
      amount: row.amount, 
      category_id: row.category_id || "", 
      description: row.description || "", 
      notes: row.notes || "", 
      payment_method: row.payment_method || "cash", 
      is_recurring: Boolean(row.is_recurring), 
      recurring_frequency: row.recurring_frequency || "monthly" 
    });
    setCmdOpen(true);
  }

  // Keyboard shortcut listener for opening the command palette
  useEffect(() => {
    const handleKey = (e) => {
      // cmd+k or ctrl+k
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [categories]);

  // Group transactions by date for the Receipt Feed
  const groupedRows = useMemo(() => {
    const groups = {};
    filtered.forEach(row => {
      const date = row.created_at?.slice(0, 10) || "غير محدد";
      if (!groups[date]) groups[date] = [];
      groups[date].push(row);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [filtered]);

  const catOptions = categories.map(c => ({ value: c.id, label: c.name }));

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-base)] flex flex-col font-sans w-full relative" dir="rtl">
      
      <SplineHeader />

      {/* Hero Content */}
      <div className="relative z-30 px-8 pt-12 pb-8 max-w-5xl mx-auto w-full">
        {/* Removed the massive stats header - We will integrate it into the control panel */}
        <div className="flex flex-col items-center text-center gap-4 mb-10">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm border border-rose-200">
            <TrendingDown className="h-6 w-6" />
          </motion.div>
          <motion.h1 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tighter">
            المصروفات
          </motion.h1>
          <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-sm font-medium text-slate-500 max-w-xl mx-auto leading-relaxed">
            دفتر تشغيلي لإدارة وتسجيل كافة النفقات والمدفوعات اليومية. استخدم الفلاتر للبحث وتحديد فترات زمنية، واضغط على <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-500 mx-1 shadow-sm">Ctrl+K</kbd> في أي وقت لتسجيل مصروف جديد بسرعة.
          </motion.p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* NEW SMART COMMAND CENTER (Dynamic Island) */}
        {/* ------------------------------------------------------------- */}
        <div className="sticky top-6 z-40 mx-auto w-full max-w-4xl">
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="flex flex-col gap-2 p-2 rounded-[24px] bg-white/90 backdrop-blur-2xl border border-white shadow-[0_12px_40px_rgb(0,0,0,0.08)] ring-1 ring-slate-900/5"
          >
            {/* Top Row: Mini Analytics & Help */}
            <div className="px-3 pt-1 pb-2 flex items-center justify-between border-b border-slate-100/50">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5 cursor-default" title="إجمالي مصروفات اليوم فقط">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">صرف اليوم:</span>
                  <span className="text-2sm number-fmt-primary text-rose-600">{fmt(stats.todayAmt)} ج.م</span>
                </div>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-1.5 cursor-default" title="إجمالي الفترة المحددة بالفلتر">
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">إجمالي الفترة:</span>
                  <span className="text-2sm number-fmt-primary text-zinc-800">{fmt(stats.total)} ج.م</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Controls */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 w-full">
              
              {/* Add Button */}
              <PermissionGate page="expenses" action="add">
              <button data-help="add-button" onClick={openCreate} title="تسجيل مصروف جديد (Ctrl+K)" className="h-10 px-6 shrink-0 flex items-center justify-center gap-2 rounded-xl text-2sm font-black text-white bg-primary hover:bg-primary-600 transition-colors shadow-lg shadow-zinc-900/20 active:scale-95 w-full sm:w-auto">
                <Command className="h-3.5 w-3.5 text-zinc-400" /> تسجيل مصروف
              </button>
              </PermissionGate>

              <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1" />

              {/* Search */}
              <div data-help="search-bar" className="relative flex-1 w-full sm:min-w-[150px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="ابحث في البيان والملاحظات..."
                  className="w-full h-10 rounded-xl bg-slate-50/80 border border-transparent pr-9 pl-4 text-2sm font-bold text-zinc-800 outline-none hover:bg-slate-100 focus:bg-white focus:border-rose-300 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Custom Date Picker */}
              <SmartDatePicker 
                dateFrom={dateFrom} dateTo={dateTo}
                setDateFrom={setDateFrom} setDateTo={setDateTo}
              />

              {/* Custom Dropdown */}
              <CustomSelect 
                value={catFilter} onChange={setCatFilter}
                options={catOptions} placeholder="جميع التصنيفات"
                icon={Filter}
              />

            </div>
          </motion.div>
        </div>
      </div>

      {/* The Receipt Feed */}
      <main data-help="main-table" className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-6 pb-32 flex flex-col gap-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
            <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
            <span className="text-[11px] font-black tracking-widest uppercase">جاري المزامنة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
            <Database className="h-12 w-12 stroke-[1]" />
            <span className="text-sm font-black">لا توجد سجلات تطابق بحثك</span>
          </div>
        ) : (
          groupedRows.map(([date, dateRows]) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
              key={date} className="flex flex-col gap-3"
            >
              <div className="sticky top-32 z-30 flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-500 font-mono tracking-widest shadow-sm">
                  {date}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              
              <div className="flex flex-col gap-2">
                {dateRows.map(row => (
                  <motion.div 
                    layoutId={`row-${row.id}`}
                    key={row.id} 
                    className="group relative bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left Side: Avatar + Details */}
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 shrink-0">
                        {row.payment_method === 'cash' ? <Banknote className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-black text-zinc-900 leading-none">
                            <Highlight text={row.description || "مصروف عام"} query={query} />
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-black text-slate-500 tracking-wider">
                            <Highlight text={row.category_name || "غير مصنف"} query={query} />
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 font-mono">
                          <span>{row.doc_no || `EXP-${String(row.id).padStart(5, "0")}`}</span>
                          {row.notes && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="truncate max-w-[200px] text-slate-500 font-sans"><Highlight text={row.notes} query={query} /></span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Amount & Hover Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full sm:pl-2">
                      <div className="flex flex-col sm:items-end">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl number-fmt-primary text-rose-600 tracking-tighter">
                            -{fmt(row.amount)}
                          </span>
                          <span className="text-[11px] font-black text-slate-300">EGP</span>
                        </div>
                      </div>
                      
                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <PermissionGate page="expenses" action="edit">
                        <button onClick={() => openEdit(row)} title="تعديل" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900 hover:bg-slate-100 transition-all">
                          <Pencil className="h-4 w-4" />
                        </button>
                        </PermissionGate>
                        <PermissionGate page="expenses" action="delete">
                        <button onClick={() => handleDelete(row.id)} title="حذف" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        </PermissionGate>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </main>

      {/* Render the overlay */}
      <AnimatePresence>
        {cmdOpen && (
          <CommandPalette 
            isOpen={cmdOpen} 
            onClose={() => setCmdOpen(false)} 
            initialData={cmdData} 
            categories={categories} 
            onSubmit={handleSave} 
            saving={saving} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}
