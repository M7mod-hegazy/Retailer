import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, Gift } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import { usePermission } from "../../../hooks/usePermission";
import { formatDateTime } from "../../../utils/dateHelpers";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import {
  formatMoney,
  formatSalaryDays,
  getAmountForSalaryDays,
  getDailySalary,
  getDailySalaryBasis,
  getSalaryDaysForAmount,
} from "./salaryUtils";

const BONUS_TYPES = [
  { value: "performance", label: "مكافأة أداء" },
  { value: "holiday", label: "مكافأة مناسبة" },
  { value: "overtime", label: "عمل إضافي" },
  { value: "transportation", label: "بدل انتقال" },
  { value: "other", label: "أخرى" },
];

const STATUS_MAP = {
  active: { label: "نشط", class: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  completed: { label: "مطبق", class: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  cancelled: { label: "ملغي", class: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

export default function BonusesTab({ employee }) {
  const canManage = usePermission("employees", "manage_bonuses");

  const [bonuses, setBonuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bonus_type: "other", amount: "", amount_mode: "amount", days: "", is_recurring: false, notes: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (employee) loadBonuses();
  }, [employee]);

  function getTransactionAmount() {
    return form.amount_mode === "days"
      ? getAmountForSalaryDays(employee, form.days)
      : Math.round(Number(form.amount || 0));
  }

  function resetForm() {
    setForm({ bonus_type: "other", amount: "", amount_mode: "amount", days: "", is_recurring: false, notes: "" });
  }

  async function loadBonuses() {
    setLoading(true);
    try {
      const res = await api.get(`/api/employees/${employee.id}/bonuses`);
      if (res.data?.success) setBonuses(res.data.data);
    } catch {} finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const amount = getTransactionAmount();
    if (amount <= 0) {
      toast.error("يجب إدخال مبلغ صحيح");
      return;
    }
    setSubmitting(true);
    const tempId = Date.now();
    const optimistic = { id: tempId, bonus_type: form.bonus_type, amount, is_recurring: form.is_recurring, notes: form.notes, status: "active", created_at: new Date().toISOString() };
    setBonuses(prev => [optimistic, ...prev]);
    try {
      const res = await api.post(`/api/employees/${employee.id}/bonuses`, {
        bonus_type: form.bonus_type,
        amount,
        is_recurring: form.is_recurring,
        notes: form.notes,
      });
      if (res.data?.success) {
        toast.success("تم إضافة المكافأة");
        setShowForm(false);
        resetForm();
        loadBonuses();
      }
    } catch { 
      toast.error("فشل إضافة المكافأة");
      setBonuses(prev => prev.filter(b => b.id !== tempId));
    } finally { setSubmitting(false); }
  }

  async function handleCancel(id) {
    const removed = bonuses.find(b => b.id === id);
    setBonuses(prev => prev.filter(b => b.id !== id));
    try {
      const res = await api.delete(`/api/employees/${employee.id}/bonuses/${id}`);
      if (res.data?.success) {
        toast.success("تم إلغاء المكافأة");
        loadBonuses();
      }
    } catch {
      toast.error("فشل إلغاء المكافأة");
      if (removed) {
        setBonuses(prev => [...prev, removed]);
      }
    }
  }

  if (!employee) return null;

  const dailySalary = getDailySalary(employee);
  const effectiveAmount = getTransactionAmount();
  const effectiveDays = getSalaryDaysForAmount(employee, effectiveAmount);
  const canUseDayAmount = dailySalary > 0;

  return (
    <div className="p-6">
      {/* Info Panel */}
      {(() => {
        const dismissed = typeof window !== 'undefined' && localStorage.getItem('emp-tab-info-bonuses');
        if (dismissed) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-4 relative mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-emerald-800">المكافئات</p>
              <p className="text-xs font-bold text-emerald-600 mt-1 leading-relaxed">
                سجّل مكافآت الأداء أو الحافز — متكررة (كل فترة) أو لمرة واحدة. يمكنك استخدام "حساب من الأيام" لتحويل أيام العمل لمبلغ. المكافآت المتكررة بتتضاف تلقائياً مع كل صرف راتب.
              </p>
            </div>
            <button onClick={() => localStorage.setItem('emp-tab-info-bonuses', '1')}
              className="text-emerald-400 hover:text-emerald-600 text-xs font-black shrink-0">فهمت</button>
          </motion.div>
        );
      })()}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-800">المكافئات</h3>
          <p className="text-xs text-slate-500 mt-0.5">مكافئات وإضافات على الراتب</p>
        </div>
        {canManage && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" /> إضافة مكافأة
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">مكافأة جديدة</span>
                <button type="button" onClick={() => setShowForm(false)} className="text-emerald-400 hover:text-emerald-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">النوع</label>
                  <select
                    value={form.bonus_type}
                    onChange={e => setForm({ ...form, bonus_type: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-white focus:border-emerald-400"
                  >
                    {BONUS_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">طريقة الحساب</label>
                  <select
                    value={form.amount_mode}
                    onChange={e => setForm({ ...form, amount_mode: e.target.value, amount: "", days: "" })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-white focus:border-emerald-400"
                  >
                    <option value="amount">مبلغ ثابت</option>
                    <option value="days" disabled={!canUseDayAmount}>عدد أيام</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    {form.amount_mode === "days" ? "عدد أيام" : "المبلغ"}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step={form.amount_mode === "days" ? "0.25" : "1"}
                    value={form.amount_mode === "days" ? form.days : form.amount}
                    onChange={e => setForm(form.amount_mode === "days" ? { ...form, days: e.target.value } : { ...form, amount: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-white focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">ملاحظات</label>
                  <input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-white focus:border-emerald-400"
                  />
                </div>
              </div>

              {canUseDayAmount && effectiveAmount > 0 && (() => {
                const label = effectiveDays < 1
                  ? "أقل من يوم عمل"
                  : ["يعادل", formatSalaryDays(effectiveDays), "يوم عمل"].join(" ");
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-emerald-700">
                        الراتب اليومي: <span className="font-mono">{formatMoney(Math.round(dailySalary))} ج.م</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600">
                        {label} ؟ {getDailySalaryBasis(employee)}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 font-mono">
                      +{formatMoney(effectiveAmount)} ج.م
                    </span>
                  </div>
                );
              })()}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={e => setForm({ ...form, is_recurring: e.target.checked })}
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-700">مكافأة متكررة (تضاف كل فترة دفع)</span>
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  تأكيد الإضافة
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {bonuses.map(b => {
          const st = STATUS_MAP[b.status] || STATUS_MAP.active;
          const typeLabel = BONUS_TYPES.find(t => t.value === b.bonus_type)?.label || b.bonus_type;
          return (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${st.class}`}>{st.label}</span>
                  <span className="text-sm font-bold text-emerald-600 font-mono">{Number(b.amount).toLocaleString()} ج.م</span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{typeLabel}</span>
                  {b.is_recurring ? (
                    <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                      <Gift className="h-3 w-3" /> نشط
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">مرة واحدة</span>
                  )}
                </div>
                {b.status === 'active' && canManage && (
                  <button
                    onClick={() => setDeleteTarget(b)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                    title="إلغاء المكافأة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {b.notes && <p className="text-xs text-slate-400">{b.notes}</p>}

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">التسلسل الزمني</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[11px] text-slate-600 font-bold">تم الإنشاء</span>
                    <span className="text-[10px] text-slate-400">{formatDateTime(b.created_at)}</span>
                  </div>
                  {b.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 font-bold">تم التطبيق</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(b.completed_at || b.created_at)}</span>
                    </div>
                  )}
                  {b.status === 'cancelled' && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-600 font-bold">تم الإلغاء</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(b.cancelled_at || b.created_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && bonuses.length === 0 && (
          <div className="text-center py-12">
            <Gift className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">لا توجد مكافئات</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="إلغاء المكافأة"
        message={`هل تريد إلغاء مكافأة "${BONUS_TYPES.find(t => t.value === deleteTarget?.bonus_type)?.label || deleteTarget?.bonus_type}" بقيمة ${Number(deleteTarget?.amount || 0).toLocaleString()} ج.م؟`}
        onConfirm={() => { handleCancel(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
