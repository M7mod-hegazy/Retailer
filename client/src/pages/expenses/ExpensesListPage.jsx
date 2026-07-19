import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingDown, Plus, Pencil, Trash2, Search, Download, Calendar,
  X, ChevronDown, RefreshCw, AlertTriangle, Filter, Database, Check,
  CreditCard, Banknote, HelpCircle, Command, Info, ArrowLeftRight, Lock,
  TrendingUp, Wallet
} from "lucide-react";
import ChooserCard from "../../components/ui/ChooserCard";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import toast from "react-hot-toast";
import { fuzzyFilterRows } from "../../utils/search";
import PermissionGate from "../../components/ui/PermissionGate";
import useRecordOnlyMethods from "../../hooks/useRecordOnlyMethods";
import { usePermission } from "../../hooks/usePermission";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatNumber } from "../../utils/currency";
import SmartDatePicker from "../../components/ui/SmartDatePicker";

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
            ? "bg-bg-surface border-rose-300 ring-4 ring-rose-500/10 shadow-sm" 
            : "bg-bg-overlay/80 border-transparent hover:bg-bg-overlay hover:border-border-normal"
        }`}
      >
        {Icon && <Icon className="h-4 w-4 text-text-muted shrink-0" />}
        <span className={`text-2sm font-bold truncate max-w-[120px] ${selectedOption ? 'text-zinc-800' : 'text-text-muted'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+8px)] w-56 max-w-[calc(100vw-2rem)] bg-bg-surface/90 backdrop-blur-2xl rounded-2xl border border-border-normal shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-1.5 z-[100]"
          >
            <div className="max-h-[250px] overflow-y-auto no-scrollbar flex flex-col gap-0.5">
              <button
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full text-right px-3 py-2 rounded-xl text-2sm font-bold transition-colors ${
                  value === "" ? "bg-rose-50 text-rose-700" : "text-text-secondary hover:bg-bg-overlay"
                }`}
              >
                {placeholder}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-right px-3 py-2 rounded-xl text-2sm font-bold transition-colors ${
                    value === opt.value ? "bg-rose-50 text-rose-700" : "text-text-secondary hover:bg-bg-overlay"
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
// Inline Quick-Add Row
// ----------------------------------------------------------------------
function InlineAddForm({ categories, onSubmit, saving, canBackdate, onAddCategoryClick, canAddCategory, lastAddedCategoryId }) {
  const EMPTY = { amount: "", category_id: "", description: "", payment_method: "cash", created_at: today() };
  const [form, setForm] = useState(EMPTY);
  const recordMethods = useRecordOnlyMethods();
  const amountRef = useRef(null);
  const categoryRef = useRef(null);
  const descRef = useRef(null);
  const dateRef = useRef(null);
  const isToday = form.created_at === today();

  useEffect(() => {
    if (lastAddedCategoryId) {
      setForm(f => ({ ...f, category_id: lastAddedCategoryId }));
    }
  }, [lastAddedCategoryId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      amountRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const fieldCls = "h-10 rounded-xl bg-bg-overlay/80 dark:bg-zinc-900/50 hover:bg-bg-overlay/80 dark:hover:bg-zinc-900/80 focus:bg-bg-surface dark:focus:bg-zinc-950 border border-border-normal/60 dark:border-zinc-800/60 focus:border-rose-450 focus:ring-4 focus:ring-rose-500/10 px-3.5 text-sm font-bold text-text-primary dark:text-zinc-200 outline-none placeholder:text-text-muted dark:placeholder:text-zinc-550 transition-all duration-200";

  function handleDateChange(e) {
    const val = e.target.value;
    if (val < today() && !canBackdate) {
      toast.error("لا تملك صلاحية التسجيل بتاريخ سابق");
      return;
    }
    if (val > today()) {
      toast.error("لا يمكن التسجيل بتاريخ مستقبلي");
      return;
    }
    setForm(f => ({ ...f, created_at: val }));
  }

  function handleSubmit() {
    if (!form.amount || !form.category_id) { toast.error("المبلغ والتصنيف مطلوبان"); return; }
    onSubmit(form, () => { setForm(EMPTY); amountRef.current?.focus(); });
  }

  return (
    <PermissionGate page="expenses" action="add">
      <div className="p-1 flex flex-wrap items-end gap-3" dir="rtl">
        {/* Amount */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-wider px-0.5">المبلغ <span className="text-[var(--danger)]">*</span></label>
          <div className="relative">
            <input
              ref={amountRef} type="number" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") categoryRef.current?.focus(); }}
              className={`${fieldCls} w-28 number-fmt-primary pl-8 pr-3`}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-text-muted pointer-events-none">ج.م</span>
          </div>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-wider">التصنيف <span className="text-[var(--danger)]">*</span></label>
            {canAddCategory && (
              <button 
                type="button"
                onClick={onAddCategoryClick}
                title="إضافة قسم جديد"
                className="text-[10px] font-black text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-350 flex items-center gap-0.5 hover:underline transition-all"
              >
                <Plus className="h-2.5 w-2.5" /> جديد
              </button>
            )}
          </div>
          <div className="relative">
            <select
              ref={categoryRef} value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") descRef.current?.focus(); }}
              className={`${fieldCls} appearance-none min-w-[130px] pr-3 pl-8`}
            >
              <option value="" disabled>اختر...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Payment method */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-wider px-0.5">طريقة الدفع</label>
          <div className="relative">
            <select 
              value={form.payment_method} 
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              className={`${fieldCls} appearance-none pr-3 pl-8 min-w-[110px]`}
            >
              <option value="cash">💵 نقدي</option>
              {recordMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
            </select>
            <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Description + Date + Save */}
        <div className="flex-1 min-w-[260px] flex items-end gap-2">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-wider px-0.5">البيان / الوصف</label>
            <input
              ref={descRef} type="text" placeholder="اكتب وصفاً مختصراً للمصروف..." value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              className={`${fieldCls} w-full pr-3 pl-3`}
            />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-[10px] font-black text-slate-450 dark:text-zinc-500 uppercase tracking-wider px-0.5 flex items-center gap-1">
              التاريخ
              {!canBackdate && <Lock className="h-2.5 w-2.5 opacity-50" />}
            </label>
            <div className="relative flex items-center cursor-pointer" onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}>
              <Calendar className="absolute right-3 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              <input
                ref={dateRef}
                type="date" value={form.created_at} max={today()} onChange={handleDateChange}
                className={`${fieldCls} ${!isToday ? "border-rose-400 text-rose-600" : ""} pr-10 pl-10 [&::-webkit-calendar-picker-indicator]:hidden`}
              />
              {isToday && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-text-muted bg-bg-overlay dark:bg-zinc-805 rounded px-1.5 py-0.5 pointer-events-none leading-tight">اليوم</span>
              )}
            </div>
          </div>
          <button
            onClick={handleSubmit} disabled={saving || !form.amount || !form.category_id}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary-600 active:scale-95 text-white text-sm font-black disabled:opacity-40 transition-all flex items-center gap-2 whitespace-nowrap shrink-0 shadow-md shadow-rose-500/10"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ
          </button>
        </div>
      </div>
    </PermissionGate>
  );
}

// ----------------------------------------------------------------------
// Raycast-style Command Palette Overlay
// ----------------------------------------------------------------------
function CommandPalette({ isOpen, onClose, initialData, categories, onSubmit, saving, onAddCategoryClick, canAddCategory }) {
  const [form, setForm] = useState(initialData || {
    amount: "", category_id: "", description: "", notes: "",
    payment_method: "cash", is_recurring: false, recurring_frequency: "monthly"
  });
  const recordMethods = useRecordOnlyMethods();

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
  }, [isOpen]);

  useEffect(() => {
    if (initialData?.category_id) {
      setForm(f => ({ ...f, category_id: initialData.category_id }));
    }
  }, [initialData?.category_id]);

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
        className="relative w-full max-w-2xl bg-[var(--bg-surface)] rounded-3xl shadow-2xl border border-border-normal overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-rose-100 text-rose-600">
              <Command className="h-4 w-4" />
            </div>
            <span className="text-sm font-black text-text-primary tracking-tight">
              {initialData?.id ? 'تعديل سجل المصروف' : 'تسجيل مصروف جديد'}
            </span>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl bg-bg-overlay text-text-muted hover:text-text-primary hover:bg-border-normal transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-8 flex flex-col gap-6">
          <div className="relative">
            <input 
              ref={inputRef}
              type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { nextRef: categoryRef })}
              className="w-full bg-transparent text-5xl md:text-7xl number-fmt-primary text-zinc-900 placeholder:text-slate-200 outline-none pb-2 border-b-2 border-border-subtle focus:border-rose-500 transition-colors"
            />
            <span className="absolute left-0 bottom-4 text-2xl font-black text-text-muted pointer-events-none">EGP</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-text-muted uppercase tracking-widest">تصنيف المصروف <span className="text-rose-500">*</span></label>
                {canAddCategory && (
                  <button
                    type="button"
                    onClick={onAddCategoryClick}
                    className="text-[11px] font-black text-rose-600 dark:text-rose-455 hover:text-rose-700 dark:hover:text-rose-350 flex items-center gap-0.5 hover:underline transition-all"
                  >
                    <Plus className="h-3 w-3" /> جديد
                  </button>
                )}
              </div>
              <select 
                ref={categoryRef}
                value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
                onKeyDown={e => handleKeyDown(e, { nextRef: methodRef, prevRef: inputRef })}
                className="w-full h-12 bg-bg-overlay border border-border-normal rounded-xl px-4 text-sm font-bold outline-none focus:bg-bg-surface focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 appearance-none"
              >
                <option value="" disabled>اختر التصنيف...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-text-muted uppercase tracking-widest">طريقة الدفع</label>
              <select 
                ref={methodRef}
                value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}
                onKeyDown={e => handleKeyDown(e, { nextRef: descRef, prevRef: categoryRef })}
                className="w-full h-12 bg-bg-overlay border border-border-normal rounded-xl px-4 text-sm font-bold outline-none focus:bg-bg-surface focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 appearance-none"
              >
                <option value="cash">💵 نقدي (Cash)</option>
                {recordMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-widest">البيان / الوصف</label>
            <input 
              ref={descRef}
              placeholder="اكتب وصفاً مختصراً للمصروف..." value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { nextRef: notesRef, prevRef: methodRef })}
              className="w-full h-12 bg-bg-overlay border border-border-normal rounded-xl px-4 text-sm font-bold outline-none focus:bg-bg-surface focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-widest">ملاحظات إضافية</label>
            <textarea 
              ref={notesRef}
              placeholder="تفاصيل إضافية (اختياري)..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              onKeyDown={e => handleKeyDown(e, { prevRef: descRef, onEnter: () => { if (form.amount && form.category_id && !saving) onSubmit(form); } })}
              className="w-full h-20 resize-none bg-bg-overlay border border-border-normal rounded-xl px-4 py-3 text-2sm font-medium outline-none focus:bg-bg-surface focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border-subtle bg-bg-overlay flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-bold text-text-muted">
            <span className="px-1.5 py-0.5 rounded border border-border-normal bg-bg-surface">Ctrl</span>
            <span>+</span>
            <span className="px-1.5 py-0.5 rounded border border-border-normal bg-bg-surface">Enter</span>
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
      <path 
        d="M-100,100 C100,150 200,50 400,100 C600,150 700,80 900,120 C1000,140 1100,100 1200,100" 
        fill="none" stroke="url(#roseGradient)" strokeWidth="3"
      />
      <path 
        d="M-100,120 C150,170 250,70 450,120 C650,170 750,100 950,140 C1050,160 1150,120 1250,120" 
        fill="none" stroke="#f43f5e" strokeOpacity="0.1" strokeWidth="1"
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
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [catFilter, setCatFilter] = useState("");
  
  // Command Palette State (edit only)
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdData, setCmdData] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatSaving, setNewCatSaving] = useState(false);
  const [lastAddedCategoryId, setLastAddedCategoryId] = useState(null);
  const canAddCategory = usePermission("financial_categories", "add");

  async function handleAddCategory(name) {
    if (newCatSaving) return;
    setNewCatSaving(true);
    try {
      const response = await api.post("/api/expenses/categories", { name, description: "" });
      const newCat = response.data?.data;
      toast.success(`تمت إضافة القسم "${name}" بنجاح`);
      
      const cR = await api.get("/api/expenses/categories");
      setCategories(cR.data?.data || []);
      
      if (newCat?.id) {
        setLastAddedCategoryId(newCat.id);
        if (cmdOpen) {
          setCmdData(prev => ({ ...prev, category_id: newCat.id }));
        } else {
          setCatFilter(newCat.id);
        }
      }
      setNewCatOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل إضافة القسم");
    } finally {
      setNewCatSaving(false);
    }
  }

  const canBackdate = usePermission("expenses", "backdate_records");

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

  async function handleSave(formData, onSuccess) {
    if (saving) return;
    setSaving(true);
    const isEdit = Boolean(formData.id);
    const tempId = isEdit ? formData.id : Date.now();
    const optimisticRow = { id: tempId, ...formData, category_name: categories.find(c => c.id === Number(formData.category_id))?.name || "", created_at: new Date().toISOString() };
    if (!isEdit) {
      setRows(prev => [optimisticRow, ...prev]);
    } else {
      setRows(prev => prev.map(r => r.id === formData.id ? { ...r, ...formData } : r));
    }
    try {
      if (isEdit) {
        await api.put(`/api/expenses/${formData.id}`, formData);
        toast.success("تم تعديل المصروف");
        setCmdOpen(false);
        setCmdData(null);
      } else {
        await api.post("/api/expenses", formData);
        toast.success("تم تسجيل المصروف");
        onSuccess?.();
      }
      load();
    } catch (err) {
      const msg = err.response?.data?.error === "permission_denied"
        ? "ليس لديك صلاحية التعديل على تواريخ سابقة"
        : err.response?.data?.message || "فشل الحفظ";
      toast.error(msg);
      if (isEdit) {
        load();
      } else {
        setRows(prev => prev.filter(r => r.id !== tempId));
      }
    }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "تأكيد الحذف", message: "تأكيد حذف المصروف نهائياً؟" });
    if (!ok) return;
    const removedRow = rows.find(r => r.id === id);
    setRows(prev => prev.filter(r => r.id !== id));
    try {
      await api.delete(`/api/expenses/${id}`);
      toast.success("تم حذف المصروف");
      load();
    } catch (err) {
      const msg = err.response?.data?.error === "permission_denied"
        ? "ليس لديك صلاحية حذف سجلات من تواريخ سابقة"
        : "فشل عملية الحذف";
      toast.error(msg);
      if (removedRow) {
        setRows(prev => [...prev, removedRow].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
    }
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm border border-rose-200">
            <TrendingDown className="h-6 w-6" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tighter">
            المصروفات
          </h1>
          <p className="text-sm font-medium text-text-secondary max-w-xl mx-auto leading-relaxed">
            دفتر تشغيلي لإدارة وتسجيل كافة النفقات والمدفوعات اليومية. استخدم نموذج الإدخال السريع أعلى القائمة لتسجيل مصروف جديد، أو الفلاتر للبحث وتحديد فترات زمنية.
          </p>
          <ChooserCard
            className="w-full max-w-2xl text-start"
            title="متأكد إن ده مكانه هنا؟"
            options={[
              { icon: TrendingDown, label: "مصروف تشغيل", desc: "إيجار، كهربا، مرتبات، صيانة — بيتخصم من ربح المحل.", current: true },
              { icon: Wallet, label: "مسحوبات شخصية", desc: "سحبت لنفسك أو لبيتك؟ دي مش مصروف — سجلها في المسحوبات.", to: "/withdrawals" },
              { icon: TrendingUp, label: "إيراد جانبي", desc: "فلوس دخلت من غير بيع (إيجار فترينة مثلاً)؟ سجلها في الإيرادات.", to: "/revenues" },
            ]}
          />
        </div>

        {/* ------------------------------------------------------------- */}
        {/* NEW SMART COMMAND CENTER (Dynamic Island) */}
        {/* ------------------------------------------------------------- */}
        <div className="sticky top-6 z-40 mx-auto w-full max-w-4xl">
          <div className="relative group/console">
            {/* Ambient Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/10 to-emerald-500/10 rounded-[28px] blur-xl opacity-75 group-hover/console:opacity-100 transition duration-1000 group-hover/console:duration-200 pointer-events-none" />
            
            <div className="relative flex flex-col rounded-[26px] bg-[var(--bg-surface)]/90 backdrop-blur-xl border border-[var(--border-normal)] shadow-[var(--shadow-elevated)] overflow-visible">
              
              {/* DECK 1: Stats & Overview */}
              <div className="px-5 pt-3 pb-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5 cursor-default text-[12px]" title="إجمالي مصروفات اليوم فقط">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                    <span className="font-black text-text-muted dark:text-zinc-500 uppercase tracking-wider text-[10px]">صرف اليوم:</span>
                    <span className="font-black text-rose-600 font-mono">{fmt(stats.todayAmt)} ج.م</span>
                  </div>
                  <div className="h-3 w-px bg-border-normal dark:bg-zinc-800 hidden sm:block" />
                  <div className="flex items-center gap-1.5 cursor-default text-[12px]" title="إجمالي الفترة المحددة بالفلتر">
                    <Database className="h-3.5 w-3.5 text-text-muted dark:text-zinc-500 shrink-0" />
                    <span className="font-black text-text-muted dark:text-zinc-500 uppercase tracking-wider text-[10px]">إجمالي الفترة:</span>
                    <span className="font-black text-text-primary dark:text-zinc-300 font-mono">{fmt(stats.total)} ج.م</span>
                  </div>
                </div>
                {canAddCategory && (
                  <button
                    type="button"
                    onClick={() => setNewCatOpen(true)}
                    className="px-3 py-1 rounded-xl text-[10.5px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 hover:bg-rose-105 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1 shadow-sm shadow-rose-500/5 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>إضافة قسم جديد</span>
                  </button>
                )}
              </div>

              {/* DECK 2: Filters & Search */}
              <div className="p-3 flex flex-col md:flex-row md:items-center gap-2.5">
                {/* Search */}
                <div className="relative flex-1 w-full min-w-[200px]">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted dark:text-zinc-500" />
                  <input
                    value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="ابحث في البيان أو التصنيف أو الملاحظات..." 
                    className="w-full h-10 rounded-xl bg-bg-overlay/80 dark:bg-zinc-900/50 border border-transparent pr-10 pl-10 text-2sm font-bold text-zinc-800 dark:text-zinc-250 outline-none hover:bg-bg-overlay dark:hover:bg-zinc-900 focus:bg-bg-surface dark:focus:bg-zinc-950 focus:border-rose-450 focus:ring-4 focus:ring-rose-500/10 transition-all placeholder:text-slate-450 dark:placeholder:text-zinc-550" 
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-border-normal dark:hover:bg-zinc-700 text-text-muted hover:text-text-secondary dark:hover:text-zinc-300 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Custom Date Picker */}
                <SmartDatePicker 
                  dateFrom={dateFrom} dateTo={dateTo}
                  setDateFrom={setDateFrom} setDateTo={setDateTo}
                  theme="rose"
                  maxToday={true}
                />

                {/* Custom Dropdown */}
                <CustomSelect 
                  value={catFilter} onChange={setCatFilter}
                  options={catOptions} placeholder="جميع التصنيفات"
                  icon={Filter}
                />
              </div>

            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* QUICK ADD CONTROL PANEL - Standalone Deck */}
        {/* ------------------------------------------------------------- */}
        <div className="mx-auto w-full max-w-4xl mt-6 relative z-20">
          <div className="relative group/addpanel">
            {/* Ambient Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/5 to-orange-500/5 rounded-[28px] blur-lg opacity-70 pointer-events-none" />
            
            <div className="relative flex flex-col rounded-[26px] bg-[var(--bg-surface)] border border-[var(--border-normal)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-5 py-3 bg-bg-overlay/50 dark:bg-zinc-900/30 border-b border-border-subtle dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] font-black text-text-secondary dark:text-zinc-400 tracking-widest uppercase flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-rose-500" />
                  لوحة الإدخال السريع للمصروفات
                </span>
              </div>
              <div className="p-5">
                <InlineAddForm
                  categories={categories}
                  onSubmit={handleSave}
                  saving={saving}
                  canBackdate={canBackdate}
                  onAddCategoryClick={() => setNewCatOpen(true)}
                  canAddCategory={canAddCategory}
                  lastAddedCategoryId={lastAddedCategoryId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Receipt Feed */}
      <main data-help="main-table" className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 pb-32 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-4">
            <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
            <span className="text-[11px] font-black tracking-widest uppercase">جاري المزامنة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-4">
            <Database className="h-12 w-12 stroke-[1]" />
            <span className="text-sm font-black">لا توجد سجلات تطابق بحثك</span>
          </div>
        ) : (
          groupedRows.map(([date, dateRows]) => (
            <div 
              key={date} className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-bg-overlay border border-border-normal text-[11px] font-black text-text-secondary font-mono tracking-widest shadow-sm">
                  {date}
                </span>
                <div className="flex-1 h-px bg-bg-overlay" />
              </div>
              
              <div className="flex flex-col gap-2">
                {dateRows.map(row => (
                  <div 
                    key={row.id} 
                    onClick={() => openEdit(row)}
                    className="group relative bg-bg-surface rounded-3xl p-5 border border-border-subtle shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-border-normal transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    {/* Left Side: Avatar + Details */}
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-bg-overlay text-text-muted border border-border-subtle shrink-0">
                        {row.payment_method === 'cash' ? <Banknote className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-black text-zinc-900 leading-none">
                            <Highlight text={row.category_name || "غير مصنف"} query={query} />
                          </span>
                          {row.description && (
                            <span className="text-sm font-medium text-text-muted">
                              <Highlight text={row.description} query={query} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-text-muted font-mono">
                          <span>{row.doc_no || `EXP-${String(row.id).padStart(5, "0")}`}</span>
                          <span className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
                          <span className="font-sans font-medium">
                            {{ cash: "نقدي", bank_transfer: "تحويل بنكي", InstaPay: "إنستا باي" }[row.payment_method] || row.payment_method}
                          </span>
                          {row.notes && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
                              <span className="truncate max-w-[200px] text-text-secondary font-sans"><Highlight text={row.notes} query={query} /></span>
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
                          <span className="text-[11px] font-black text-text-muted">EGP</span>
                        </div>
                      </div>
                      
                      {/* Actions (visible on hover) */}
                      {(() => {
                        const isPastDay = (row.created_at || "").slice(0, 10) < today();
                        const locked = isPastDay && !canBackdate;
                        return (
                          <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <PermissionGate page="expenses" action="edit">
                              {locked ? (
                                <button disabled title="يحتاج صلاحية تعديل التواريخ السابقة" className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-overlay text-text-muted cursor-not-allowed">
                                  <Lock className="h-4 w-4" />
                                </button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} title="تعديل" className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-overlay text-text-muted hover:text-zinc-900 hover:bg-bg-overlay transition-all">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                            </PermissionGate>
                            <PermissionGate page="expenses" action="delete">
                              {locked ? (
                                <button disabled title="يحتاج صلاحية تعديل التواريخ السابقة" className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-overlay text-text-muted cursor-not-allowed">
                                  <Lock className="h-4 w-4" />
                                </button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} title="حذف" className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-overlay text-text-muted hover:text-rose-600 hover:bg-rose-50 transition-all">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </PermissionGate>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
            onAddCategoryClick={() => setNewCatOpen(true)}
            canAddCategory={canAddCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newCatOpen && (
          <QuickCategoryModal
            isOpen={newCatOpen}
            onClose={() => setNewCatOpen(false)}
            onSubmit={handleAddCategory}
            saving={newCatSaving}
            title="إضافة قسم مصروفات جديد"
            colorTheme="rose"
          />
        )}
      </AnimatePresence>

      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />

    </div>
  );
}

// ----------------------------------------------------------------------
// Quick Add Category Modal
// ----------------------------------------------------------------------
function QuickCategoryModal({ isOpen, onClose, onSubmit, saving, title, colorTheme }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const colorClasses = {
    rose: {
      btn: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/20",
      border: "focus:border-rose-400 focus:ring-rose-500/10",
      accent: "text-rose-600 bg-rose-50"
    },
    emerald: {
      btn: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20",
      border: "focus:border-emerald-400 focus:ring-emerald-500/10",
      accent: "text-emerald-600 bg-emerald-50"
    },
    amber: {
      btn: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20",
      border: "focus:border-amber-400 focus:ring-amber-500/10",
      accent: "text-amber-600 bg-amber-50"
    }
  }[colorTheme || "rose"];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-3xl shadow-2xl border border-border-normal p-6 overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <h3 className="text-md font-black text-text-primary">
            {title}
          </h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl bg-bg-overlay text-text-muted hover:text-text-primary hover:bg-border-normal transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-text-muted uppercase tracking-widest">اسم القسم الجديد</label>
            <input 
              ref={inputRef}
              type="text"
              required
              placeholder="مثلاً: صيانة، كهرباء، رواتب..."
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full h-11 bg-bg-overlay border border-border-normal rounded-xl px-4 text-sm font-bold outline-none focus:bg-bg-surface transition-all ${colorClasses.border}`}
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-normal px-4 h-10 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`rounded-xl text-white font-black text-sm px-6 h-10 transition-colors shadow-md flex items-center gap-1.5 disabled:opacity-50 ${colorClasses.btn}`}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>حفظ القسم</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
