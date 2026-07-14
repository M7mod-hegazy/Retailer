import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Wallet, DollarSign, Percent, Gift, FileText, Users,
  Search, X, Loader2, ChevronDown, ArrowLeft, Send,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const ACTIONS = [
  {
    id: "advance",
    label: "إضافة سلفة",
    icon: DollarSign,
    color: "amber",
    desc: "تسجيل سلفة جديدة للموظف",
    inline: true,
  },
  {
    id: "deduction",
    label: "إضافة خصم",
    icon: Percent,
    color: "rose",
    desc: "تسجيل خصم على الموظف",
    inline: true,
  },
  {
    id: "bonus",
    label: "إضافة مكافأة",
    icon: Gift,
    color: "emerald",
    desc: "تسجيل مكافأة للموظف",
    inline: true,
  },
  {
    id: "settle",
    label: "صرف راتب",
    icon: Wallet,
    color: "indigo",
    desc: "حساب وصرف راتب الموظف",
    inline: false,
    route: () => "/definitions/employees",
  },
  {
    id: "history",
    label: "السجل الكامل",
    icon: FileText,
    color: "slate",
    desc: "عرض سجل الموظف الكامل",
    inline: false,
    route: () => "/reports/source/employees/employee-full-history/detailed",
  },
  {
    id: "list",
    label: "قائمة الموظفين",
    icon: Users,
    color: "blue",
    desc: "عرض وتعديل بيانات الموظفين",
    inline: false,
    route: () => "/definitions/employees",
  },
];

const COLOR_MAP = {
  amber: { iconBg: "bg-amber-100", iconText: "text-amber-600", border: "border-amber-200", bg: "bg-amber-50", accent: "text-amber-700" },
  rose: { iconBg: "bg-rose-100", iconText: "text-rose-600", border: "border-rose-200", bg: "bg-rose-50", accent: "text-rose-700" },
  emerald: { iconBg: "bg-emerald-100", iconText: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50", accent: "text-emerald-700" },
  indigo: { iconBg: "bg-indigo-100", iconText: "text-indigo-600", border: "border-indigo-200", bg: "bg-indigo-50", accent: "text-indigo-700" },
  slate: { iconBg: "bg-slate-100", iconText: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50", accent: "text-slate-700" },
  blue: { iconBg: "bg-blue-100", iconText: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50", accent: "text-blue-700" },
};

const DEDUCTION_TYPES = [
  { value: "other", label: "أخرى" },
  { value: "absence", label: "غياب" },
  { value: "late", label: "تأخير" },
  { value: "damage", label: "تالف" },
  { value: "loan", label: "قرض" },
];

const BONUS_TYPES = [
  { value: "other", label: "أخرى" },
  { value: "performance", label: "أداء" },
  { value: "attendance", label: "حضور" },
  { value: "holiday", label: "عيد" },
  { value: "commission", label: "عمولة" },
];

function EmpPicker({ employees, value, onChange, accentClass, borderClass }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = employees.filter(e =>
    !query || e.name?.includes(query) || e.phone?.includes(query) || e.job_title?.includes(query)
  ).slice(0, 10);

  return (
    <div ref={wrapRef} className="relative">
      {value ? (
        <div className={`flex items-center gap-2 ${accentClass} rounded-xl px-3 py-2 border ${borderClass}`}>
          <div className="w-6 h-6 rounded-lg bg-white/60 flex items-center justify-center text-[10px] font-black shrink-0">
            {value.name?.charAt(0)}
          </div>
          <span className="text-xs font-bold flex-1 truncate">{value.name}</span>
          <button onClick={() => onChange(null)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="اختر موظف..."
            className={`w-full h-10 rounded-xl pr-9 pl-4 text-sm font-bold outline-none border ${borderClass} bg-white/50 focus:bg-white focus:border-current transition-all`}
          />
        </>
      )}

      <AnimatePresence>
        {open && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 w-full bg-[var(--bg-surface)] rounded-xl border border-[var(--border-normal)] shadow-xl z-20 max-h-48 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-[var(--text-muted)] py-4 font-bold">لا يوجد موظفين</p>
            ) : (
              filtered.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => { onChange(emp); setQuery(""); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-[var(--bg-overlay)] transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className={`w-7 h-7 rounded-lg ${COLOR_MAP.amber.iconBg} ${COLOR_MAP.amber.iconText} flex items-center justify-center text-[10px] font-black shrink-0`}>
                    {emp.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{emp.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{emp.job_title || "—"}</p>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InlineAdvanceForm({ employees, onSubmit, onCancel }) {
  const [emp, setEmp] = useState(null);
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("");
  const [notes, setNotes] = useState("");
  const [createExpense, setCreateExpense] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!emp || !amount || Number(amount) <= 0) { toast.error("اختر موظفاً وأدخل المبلغ"); return; }
    setLoading(true);
    try {
      await api.post(`/api/employees/${emp.id}/advances`, {
        amount: Number(amount),
        installment_count: Number(installments) || 0,
        notes: notes || null,
      });
      if (createExpense) {
        await api.post("/api/expenses", {
          amount: Number(amount),
          description: `سلفة - ${emp.name}`,
          notes: notes || null,
          employee_id: emp.id,
          payment_method: "cash",
        });
      }
      toast.success(`تم إضافة سلفة ${Number(amount).toLocaleString()} ج.م لـ ${emp.name}${createExpense ? " مع تسجيل المصروف" : ""}`);
      onSubmit();
    } catch (err) { toast.error(err.response?.data?.message || "خطأ"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-amber-100">
      <EmpPicker employees={employees} value={emp} onChange={setEmp} accentClass="bg-amber-50 text-amber-700" borderClass="border-amber-200" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ"
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-amber-200 bg-amber-50/50 focus:bg-white focus:border-amber-400 transition-all" />
        <input type="number" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="عدد الأقساط"
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-amber-200 bg-amber-50/50 focus:bg-white focus:border-amber-400 transition-all" />
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
        className="w-full h-10 rounded-xl px-3 text-sm font-bold outline-none border border-amber-200 bg-amber-50/50 focus:bg-white focus:border-amber-400 transition-all" />
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={createExpense} onChange={e => setCreateExpense(e.target.checked)}
          className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
        <span className="text-xs font-bold text-slate-600">تسجيل كمصروف نقدي</span>
      </label>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-xs font-black hover:bg-slate-50 transition-colors">إلغاء</button>
        <button onClick={handleSubmit} disabled={loading || !emp || !amount}
          className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-xs font-black hover:bg-amber-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          إضافة سلفة
        </button>
      </div>
    </div>
  );
}

function InlineDeductionForm({ employees, onSubmit, onCancel }) {
  const [emp, setEmp] = useState(null);
  const [amount, setAmount] = useState("");
  const [deductionType, setDeductionType] = useState("other");
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!emp || !amount || Number(amount) <= 0) { toast.error("اختر موظفاً وأدخل المبلغ"); return; }
    setLoading(true);
    try {
      await api.post(`/api/employees/${emp.id}/deductions`, {
        amount: Number(amount), deduction_type: deductionType, is_recurring: isRecurring, notes: notes || null,
      });
      toast.success(`تم خصم ${Number(amount).toLocaleString()} ج.م من ${emp.name}`);
      onSubmit();
    } catch (err) { toast.error(err.response?.data?.message || "خطأ"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-rose-100">
      <EmpPicker employees={employees} value={emp} onChange={setEmp} accentClass="bg-rose-50 text-rose-700" borderClass="border-rose-200" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ"
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-rose-200 bg-rose-50/50 focus:bg-white focus:border-rose-400 transition-all" />
        <select value={deductionType} onChange={e => setDeductionType(e.target.value)}
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-rose-200 bg-rose-50/50 focus:bg-white focus:border-rose-400 transition-all">
          {DEDUCTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
          className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
        <span className="text-xs font-bold text-slate-600">تكرار شهري</span>
      </label>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
        className="w-full h-10 rounded-xl px-3 text-sm font-bold outline-none border border-rose-200 bg-rose-50/50 focus:bg-white focus:border-rose-400 transition-all" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-xs font-black hover:bg-slate-50 transition-colors">إلغاء</button>
        <button onClick={handleSubmit} disabled={loading || !emp || !amount}
          className="flex-1 h-10 rounded-xl bg-rose-500 text-white text-xs font-black hover:bg-rose-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          تسجيل خصم
        </button>
      </div>
    </div>
  );
}

function InlineBonusForm({ employees, onSubmit, onCancel }) {
  const [emp, setEmp] = useState(null);
  const [amount, setAmount] = useState("");
  const [bonusType, setBonusType] = useState("other");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!emp || !amount || Number(amount) <= 0) { toast.error("اختر موظفاً وأدخل المبلغ"); return; }
    setLoading(true);
    try {
      await api.post(`/api/employees/${emp.id}/bonuses`, {
        amount: Number(amount), bonus_type: bonusType, notes: notes || null,
      });
      toast.success(`تمت إضافة مكافأة ${Number(amount).toLocaleString()} ج.م لـ ${emp.name}`);
      onSubmit();
    } catch (err) { toast.error(err.response?.data?.message || "خطأ"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-emerald-100">
      <EmpPicker employees={employees} value={emp} onChange={setEmp} accentClass="bg-emerald-50 text-emerald-700" borderClass="border-emerald-200" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ"
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-emerald-200 bg-emerald-50/50 focus:bg-white focus:border-emerald-400 transition-all" />
        <select value={bonusType} onChange={e => setBonusType(e.target.value)}
          className="h-10 rounded-xl px-3 text-sm font-bold outline-none border border-emerald-200 bg-emerald-50/50 focus:bg-white focus:border-emerald-400 transition-all">
          {BONUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
        className="w-full h-10 rounded-xl px-3 text-sm font-bold outline-none border border-emerald-200 bg-emerald-50/50 focus:bg-white focus:border-emerald-400 transition-all" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-xs font-black hover:bg-slate-50 transition-colors">إلغاء</button>
        <button onClick={handleSubmit} disabled={loading || !emp || !amount}
          className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          إضافة مكافأة
        </button>
      </div>
    </div>
  );
}

export default function EmployeesQuickModal({ open, onClose }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedAction, setExpandedAction] = useState(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get("/api/employees")
        .then(r => setEmployees(r.data?.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setExpandedAction(null);
    }
  }, [open]);

  const handleExpand = useCallback((id) => {
    setExpandedAction(prev => prev === id ? null : id);
  }, []);

  const handleRedirect = useCallback((action) => {
    navigate(action.route());
    onClose();
  }, [navigate, onClose]);

  const handleInlineSubmit = useCallback(() => {
    setExpandedAction(null);
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg rounded-3xl bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-subtle)] max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[var(--text-primary)]">إجراءات الموظفين</h2>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">إجراءات سريعة مع إمكانية التوجيه</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-[var(--text-muted)] animate-spin" />
            </div>
          ) : (
            ACTIONS.map(action => {
              const c = COLOR_MAP[action.color];
              const Icon = action.icon;
              const isExpanded = expandedAction === action.id;

              return (
                <div key={action.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden transition-all">
                  <div className="flex items-stretch">
                    {/* Main clickable area */}
                    <button
                      onClick={() => action.inline ? handleExpand(action.id) : handleRedirect(action)}
                      className="flex-1 flex items-center gap-3 px-4 py-3.5 text-right hover:bg-[var(--bg-overlay)] transition-colors"
                    >
                      <div className={`h-9 w-9 rounded-xl ${c.iconBg} ${c.iconText} flex items-center justify-center shrink-0`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[var(--text-primary)]">{action.label}</p>
                        <p className="text-[10px] font-bold text-[var(--text-muted)]">{action.desc}</p>
                      </div>
                      {action.inline && (
                        <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      )}
                    </button>

                    {/* Redirect button */}
                    <div className="w-px bg-[var(--border-subtle)] self-stretch" />
                    <button
                      onClick={() => handleRedirect(action)}
                      title="فتح الصفحة الكاملة"
                      className="shrink-0 flex items-center justify-center w-10 hover:bg-[var(--bg-overlay)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-link)]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Inline form (accordion) */}
                  <AnimatePresence>
                    {isExpanded && action.inline && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4">
                          {action.id === "advance" && <InlineAdvanceForm employees={employees} onSubmit={handleInlineSubmit} onCancel={() => setExpandedAction(null)} />}
                          {action.id === "deduction" && <InlineDeductionForm employees={employees} onSubmit={handleInlineSubmit} onCancel={() => setExpandedAction(null)} />}
                          {action.id === "bonus" && <InlineBonusForm employees={employees} onSubmit={handleInlineSubmit} onCancel={() => setExpandedAction(null)} />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
