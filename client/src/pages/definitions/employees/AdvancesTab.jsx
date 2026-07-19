import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, DollarSign, CheckCircle, AlertTriangle, Tag, FileText, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import PermissionGate from "../../../components/ui/PermissionGate";
import { usePermission } from "../../../hooks/usePermission";
import { formatDateTime } from "../../../utils/dateHelpers";
import SmartTooltip from "../../../components/ui/SmartTooltip";

const STATUS_MAP = {
  active: { label: "شغّالة", class: "bg-amber-50 text-amber-700 border-amber-200" },
  fully_repaid: { label: "اتسدّدت كلها", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "اتمسحت", class: "bg-bg-overlay text-text-secondary border-border-normal" },
};

export default function AdvancesTab({ employee }) {
  const canManage = usePermission("employees", "manage_advances");

  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", installment_count: "0", notes: "" });
  const [paying, setPaying] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payments, setPayments] = useState({});
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  useEffect(() => {
    if (!showExpenseModal) return;
    const h = (e) => { if (e.key === "Escape") setShowExpenseModal(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showExpenseModal]);
  const [categories, setCategories] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ create_expense: false, description: "", category_id: "" });
  const [showRepayExpenseConfirm, setShowRepayExpenseConfirm] = useState(false);
  useEffect(() => {
    if (!showRepayExpenseConfirm) return;
    const h = (e) => { if (e.key === "Escape") setShowRepayExpenseConfirm(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showRepayExpenseConfirm]);
  const [repayAdvanceId, setRepayAdvanceId] = useState(null);
  const [repayExpenseForm, setRepayExpenseForm] = useState({ create_expense: false, description: "", category_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linkedExpense, setLinkedExpense] = useState(null);
  const [deleteExpenseFlag, setDeleteExpenseFlag] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (employee) loadAdvances();
  }, [employee]);

  useEffect(() => {
    if (!deleteTarget) { setLinkedExpense(null); return; }
    api.get(`/api/employees/${employee.id}/advances/${deleteTarget.id}/linked-expense`)
      .then(r => setLinkedExpense(r.data?.data || null))
      .catch(() => setLinkedExpense(null));
  }, [deleteTarget, employee]);

  async function loadAdvances() {
    setLoading(true);
    try {
      const res = await api.get(`/api/employees/${employee.id}/advances`);
      if (res.data?.success) {
        const data = res.data.data;
        setAdvances(data);
        const paymentPromises = data
          .filter(a => a.status === 'active' || a.status === 'fully_repaid')
          .map(a => loadPayments(a.id));
        Promise.all(paymentPromises);
      }
    } catch {} finally { setLoading(false); }
  }

  async function loadPayments(advanceId) {
    try {
      const res = await api.get(`/api/employees/${employee.id}/advances/${advanceId}/payments`);
      if (res.data?.success) setPayments(prev => ({ ...prev, [advanceId]: res.data.data }));
    } catch {}
  }

  async function loadCategories() {
    try {
      const res = await api.get("/api/expenses/categories");
      if (res.data?.data) setCategories(res.data.data);
    } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault();
    setExpenseForm({
      create_expense: false,
      description: `سلفة للموظف: ${employee.name} — بمبلغ ${Number(form.amount).toLocaleString()} ج.م`,
      category_id: "",
    });
    await loadCategories();
    setShowExpenseModal(true);
  }

  async function handleConfirmAdvance() {
    setShowExpenseModal(false);
    setSubmitting(true);
    const tempId = Date.now();
    const optimistic = {
      id: tempId,
      amount: Number(form.amount),
      remaining_balance: Number(form.amount),
      installment_count: Number(form.installment_count),
      installment_amount: Number(form.installment_count) > 0 ? Math.round(Number(form.amount) / Number(form.installment_count)) : Number(form.amount),
      notes: form.notes,
      status: "active",
      created_at: new Date().toISOString(),
    };
    setAdvances(prev => [optimistic, ...prev]);
    try {
      const res = await api.post(`/api/employees/${employee.id}/advances`, {
        amount: Number(form.amount),
        installment_count: Number(form.installment_count),
        notes: form.notes,
      });
      if (res.data?.success) {
        if (expenseForm.create_expense && expenseForm.category_id) {
          await api.post("/api/expenses", {
            amount: Number(form.amount),
            category_id: Number(expenseForm.category_id),
            description: expenseForm.description || `سلفة للموظف: ${employee.name} — بمبلغ ${Number(form.amount).toLocaleString()} ج.م`,
            payment_method: "cash",
            employee_id: employee.id,
            notes: form.notes || "سلفة موظف",
          });
        }
        toast.success("السلفة اتضافت بنجاح");
        setShowForm(false);
        setForm({ amount: "", installment_count: "0", notes: "" });
        loadAdvances();
      }
    } catch { 
      toast.error("السلفة ما اتضافتش");
      setAdvances(prev => prev.filter(a => a.id !== tempId));
    } finally { setSubmitting(false); }
  }

  async function handlePay(advanceId) {
    try {
      const res = await api.post(`/api/employees/${employee.id}/advances/${advanceId}/pay`, { amount: Number(payAmount) });
      if (res.data?.success) {
        if (repayExpenseForm.create_expense && repayExpenseForm.category_id) {
          const adv = advances.find(a => a.id === advanceId);
          await api.post("/api/expenses", {
            amount: Number(payAmount),
            category_id: Number(repayExpenseForm.category_id),
            description: repayExpenseForm.description || `تسديد سلفة للموظف: ${employee.name} — بمبلغ ${Number(payAmount).toLocaleString()} ج.م`,
            payment_method: "cash",
            employee_id: employee.id,
            notes: "تسديد سلفة موظف",
          });
        }
        toast.success("السداد اتعمل بنجاح");
        setPaying(null);
        setPayAmount("");
        setShowRepayExpenseConfirm(false);
        setRepayAdvanceId(null);
        setRepayExpenseForm({ create_expense: false, description: "", category_id: "" });
        loadAdvances();
      }
    } catch (err) { toast.error(err?.response?.data?.message || "ال_sdad ما اتعملش"); }
  }

  function openRepayConfirm(advanceId) {
    setRepayAdvanceId(advanceId);
    setRepayExpenseForm({
      create_expense: false,
      description: `تسديد سلفة للموظف: ${employee.name} — بمبلغ ${Number(payAmount).toLocaleString()} ج.م`,
      category_id: "",
    });
    setShowRepayExpenseConfirm(true);
  }

  async function handleDeleteAdvance(id) {
    setDeleteTarget(null);
    setDeleting(true);
    try {
      const res = await api.delete(`/api/employees/${employee.id}/advances/${id}?delete_expense=${deleteExpenseFlag}`);
      if (res.data?.success) {
        const msgs = [];
        if (res.data.hard_deleted) msgs.push("السلفة اتمسحت");
        else msgs.push("السلفة اتلغت");
        if (res.data.expense_deleted) msgs.push("والمصروف المرتبط اتمسح");
        toast.success(msgs.join(" — "));
        loadAdvances();
      }
    } catch {
      toast.error("السلفة ما اتمسحتش");
    } finally {
      setDeleting(false);
    }
  }

  if (!employee) return null;

  const installmentsHelp = (() => {
    const count = Number(form.installment_count);
    if (count === 0) return "مفيش أقساط محددة — تقدر تسدد بأي مبلغ في أي وقت";
    if (count === 1) return "تتسدد مرة واحدة";
    return `القسط كل فترة: ${Math.round(Number(form.amount || 0) / count).toLocaleString()} ج.م`;
  })();

  return (
    <div className="p-6">
      {/* Info Panel */}
      {(() => {
        const dismissed = typeof window !== 'undefined' && localStorage.getItem('emp-tab-info-advances');
        if (dismissed) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-4 relative mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-amber-800">السلفيات</p>
              <p className="text-xs font-bold text-amber-600 mt-1 leading-relaxed">
                سجّل كل سلفة بياخدها الموظف وتابع أقساطها. تحدد عدد الأقساط أو تسيبه من غير أقساط. عند السداد، تقدر تسجل المصروف على طول. السلف النشطة بتظهر في صرف الراتب كخصم اختياري.
              </p>
            </div>
            <button onClick={() => localStorage.setItem('emp-tab-info-advances', '1')}
              className="text-amber-400 hover:text-amber-600 text-xs font-black shrink-0">تمام</button>
          </motion.div>
        );
      })()}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-text-primary">السلفيات</h3>
          <p className="text-xs text-text-secondary mt-0.5">إدارة السلف وأقساطها</p>
        </div>
        {canManage && (
          <SmartTooltip content={"أضف سلفة جديدة للموظف — حدد المبلغ وعدد الأقساط (لو عايز). عند التأكيد، هتختار إذا كنت عايز تسجل مصروف للسلفة دي."} wide>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(true)}
              className="h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all"
            >
              <Plus className="h-4 w-4" /> إضافة سلفة
            </motion.button>
          </SmartTooltip>
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
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-700 uppercase tracking-wider">سلفة جديدة</span>
                <button type="button" onClick={() => setShowForm(false)} className="text-amber-400 hover:text-amber-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">المبلغ</label>
                  <input
                    type="number" required min="1"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-bg-surface focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">عدد الأقساط (لو عايز)</label>
                  <select
                    value={form.installment_count}
                    onChange={e => setForm({ ...form, installment_count: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-bg-surface focus:border-amber-400"
                  >
                    <option value="0">مفيش أقساط</option>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                      <option key={n} value={n}>{n === 1 ? "دفعة واحدة" : `${n} أقساط`}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">ملاحظات</label>
                  <input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-bg-surface focus:border-amber-400"
                  />
                </div>
              </div>
              {Number(form.amount) > 0 && (
                <p className="text-xs font-bold text-amber-600 bg-amber-100/50 rounded-lg px-3 py-1.5 inline-block">
                  {installmentsHelp}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <span className="block h-4 w-4 animate-spin rounded-full border-2 border-border-normal/30 border-t-white" />}
                  تأكيد الإضافة
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {advances.map(adv => {
          const st = STATUS_MAP[adv.status] || STATUS_MAP.active;
          const progress = adv.amount > 0 ? Math.round((1 - adv.remaining_balance / adv.amount) * 100) : 0;
          const advPayments = payments[adv.id] || [];
          return (
            <div key={adv.id} className="bg-bg-surface border border-border-normal rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black font-mono text-text-primary">{Number(adv.amount).toLocaleString()} ج.م</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${st.class}`}>{st.label}</span>
                </div>
                {adv.status === 'active' && canManage && (
                  <div className="flex items-center gap-1">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPaying(adv.id)}
                      className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
                    >
                      <DollarSign className="h-3 w-3" /> تسديد
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteTarget(adv)}
                      className="h-8 w-8 flex items-center justify-center rounded-xl text-text-muted hover:bg-rose-50 hover:text-rose-500 transition-all"
                      title="مسح السلفة"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-bg-overlay rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-text-secondary">
                  {Number(adv.remaining_balance).toLocaleString()} ج.م فاضل
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                {adv.installment_count > 1 && (
                  <span>{adv.installment_count} أقساط × {Number(adv.installment_amount).toLocaleString()} ج.م</span>
                )}
                {adv.installment_count === 0 && <span className="text-amber-600">مفيش أقساط</span>}
                {adv.notes && <span>ملاحظة: {adv.notes}</span>}
                <span>تاريخ: {formatDateTime(adv.created_at)}</span>
              </div>

              <AnimatePresence>
                {paying === adv.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3"
                  >
                    <p className="text-sm font-bold text-emerald-700">تسديد سلفة — الفاضل: {Number(adv.remaining_balance).toLocaleString()} ج.م</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min="1" max={adv.remaining_balance}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="المبلغ"
                        className="flex-1 h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-bg-surface focus:border-emerald-400"
                      />
                      <button
                        onClick={() => setPayAmount(String(adv.remaining_balance))}
                        className="h-10 px-3 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black transition-all hover:bg-emerald-200"
                      >
                        الكل
                      </button>
                    </div>
                      <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openRepayConfirm(adv.id)}
                        disabled={!payAmount || Number(payAmount) <= 0}
                        className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
                      >
                        <CheckCircle className="h-3 w-3 inline ml-1" />تأكيد
                      </button>
                      <button
                        onClick={() => { setPaying(null); setPayAmount(""); }}
                        className="h-9 px-4 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-xs font-black transition-all"
                      >
                        لّي
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="border-t border-border-subtle pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <h4 className="text-[10px] font-black text-text-muted uppercase tracking-wider">الدفعات اللي اتعملت</h4>
                  {advPayments.length > 0 && (
                    <span className="text-[10px] font-bold text-text-muted mr-auto">عدد {advPayments.length} دفعة</span>
                  )}
                </div>
                {advPayments.length === 0 ? (
                  <p className="text-[11px] text-text-muted font-bold py-1">لسه ما اتدفعش</p>
                ) : (
                  <div className="space-y-1.5">
                    {advPayments.map(pmt => (
                      <div key={pmt.id} className="flex items-center justify-between bg-bg-overlay rounded-lg px-3 py-2 border border-border-subtle">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black font-mono text-emerald-600">{Number(pmt.amount).toLocaleString()} ج.م</span>
                          {pmt.notes && <span className="text-[10px] text-text-muted">{pmt.notes}</span>}
                        </div>
                        <span className="text-[10px] font-bold text-text-muted">{formatDateTime(pmt.payment_date || pmt.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!loading && advances.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm font-bold text-text-muted">لسه ما فيه سلفيات للموظف ده</p>
          </div>
        )}
      </div>

      {createPortal(
        <>
          {/* expense warning modal */}
          <AnimatePresence>
            {showExpenseModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={() => setShowExpenseModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-primary">تسجيل مصروف؟</h3>
                      <p className="text-xs text-text-secondary mt-0.5">عايز تسجل مصروف للسلفة دي؟</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenseForm.create_expense}
                      onChange={e => setExpenseForm({ ...expenseForm, create_expense: e.target.checked })}
                      className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-bold text-text-primary">أيوه، سجّل مصروف للسلفة</span>
                  </label>

                  {expenseForm.create_expense && (
                    <div className="space-y-4 pr-2 border-r-2 border-amber-200">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">الوصف</label>
                        <div className="relative">
                          <FileText className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                          <input
                            value={expenseForm.description}
                            onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                            className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-amber-400 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">تصنيف المصروف</label>
                        <div className="relative">
                          <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                          <select
                            value={expenseForm.category_id}
                            onChange={e => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                            className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-amber-400 transition-all appearance-none"
                          >
                            <option value="">اختار التصنيف...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowExpenseModal(false)}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all"
                    >
                      لّي
                    </button>
                    <button
                      onClick={handleConfirmAdvance}
                      className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-black shadow-lg transition-all"
                    >
                      تأكيد
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* expense warning modal — تسجيل مصروف عند التسديد */}
          <AnimatePresence>
            {showRepayExpenseConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                onClick={() => setShowRepayExpenseConfirm(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-primary">عايز تسجل مصروف؟</h3>
                      <p className="text-xs text-text-secondary mt-0.5">تسديد سلفة بمبلغ {Number(payAmount).toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={repayExpenseForm.create_expense}
                      onChange={e => setRepayExpenseForm({ ...repayExpenseForm, create_expense: e.target.checked })}
                      className="w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-bold text-text-primary">أيوه، سجّل مصروف للسداد ده</span>
                  </label>

                  {repayExpenseForm.create_expense && (
                    <div className="space-y-4 pr-2 border-r-2 border-emerald-200">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">الوصف</label>
                        <div className="relative">
                          <FileText className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                          <input
                            value={repayExpenseForm.description}
                            onChange={e => setRepayExpenseForm({ ...repayExpenseForm, description: e.target.value })}
                            className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-emerald-400 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider">تصنيف المصروف</label>
                        <div className="relative">
                          <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                          <select
                            value={repayExpenseForm.category_id}
                            onChange={e => setRepayExpenseForm({ ...repayExpenseForm, category_id: e.target.value })}
                            className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-border-normal bg-bg-surface focus:border-emerald-400 transition-all appearance-none"
                          >
                            <option value="">اختار التصنيف...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowRepayExpenseConfirm(false)}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all"
                    >
                      لّي
                    </button>
                    <button
                      onClick={() => handlePay(repayAdvanceId)}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg transition-all"
                    >
                      تأكيد السداد
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => { setDeleteTarget(null); setLinkedExpense(null); }}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-primary">مسح السلفة</h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {deleteTarget?.status === 'active'
                        ? "السلفة دي فيها مدفوعات — هتتلغي بس ومش هتأثر بالسجلات المالية المرتبطة"
                        : "هل انت متأكد إنك عايز تمسحها؟"}
                    </p>
                  </div>
                </div>

                <div className="bg-bg-overlay rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">المبلغ</span>
                    <span className="font-black font-mono text-text-primary">{Number(deleteTarget?.amount || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">الحالة</span>
                    <span className="font-bold text-xs">{STATUS_MAP[deleteTarget?.status]?.label || deleteTarget?.status}</span>
                  </div>
                  {deleteTarget?.installment_count > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">الأقساط</span>
                      <span className="font-bold text-xs">{deleteTarget.installment_count} × {Number(deleteTarget.installment_amount).toLocaleString()} ج.م</span>
                    </div>
                  )}
                </div>

                {linkedExpense && (
                  <label className="flex items-center gap-3 bg-rose-50/60 border border-rose-200 rounded-xl px-4 py-3 cursor-pointer">
                    <input type="checkbox" checked={deleteExpenseFlag} onChange={e => setDeleteExpenseFlag(e.target.checked)}
                      className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-text-primary">امسح المصروف المرتبط برضو</span>
                      <p className="text-[10px] text-text-muted mt-0.5 truncate">
                        #{linkedExpense.doc_no || linkedExpense.id} — {Number(linkedExpense.amount).toLocaleString()} ج.م
                        {linkedExpense.description && ` — ${linkedExpense.description}`}
                      </p>
                    </div>
                  </label>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setDeleteTarget(null); setLinkedExpense(null); }}
                    className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all">
                    لا، سيبه
                  </button>
                  <button onClick={() => handleDeleteAdvance(deleteTarget?.id)} disabled={deleting}
                    className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {deleting ? "بيتمسح..." : "أيوه، امسحه"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}