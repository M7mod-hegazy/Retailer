import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, DollarSign, CheckCircle, AlertTriangle, Tag, FileText } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import PermissionGate from "../../../components/ui/PermissionGate";
import { usePermission } from "../../../hooks/usePermission";
import { formatDateTime } from "../../../utils/dateHelpers";

const STATUS_MAP = {
  active: { label: "نشط", class: "bg-amber-50 text-amber-700 border-amber-200" },
  fully_repaid: { label: "مسدد بالكامل", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", class: "bg-slate-50 text-slate-500 border-slate-200" },
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
  const [categories, setCategories] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ create_expense: false, description: "", category_id: "" });

  useEffect(() => {
    if (employee) loadAdvances();
  }, [employee]);

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
        toast.success("تم إضافة السلفة");
        setShowForm(false);
        setForm({ amount: "", installment_count: "0", notes: "" });
        loadAdvances();
      }
    } catch { toast.error("فشل إضافة السلفة"); }
  }

  async function handlePay(advanceId) {
    try {
      const res = await api.post(`/api/employees/${employee.id}/advances/${advanceId}/pay`, { amount: Number(payAmount) });
      if (res.data?.success) {
        toast.success("تم التسديد");
        setPaying(null);
        setPayAmount("");
        loadAdvances();
      }
    } catch (err) { toast.error(err?.response?.data?.message || "فشل التسديد"); }
  }

  if (!employee) return null;

  const installmentsHelp = (() => {
    const count = Number(form.installment_count);
    if (count === 0) return "بدون أقساط محددة — يمكن السداد بأي مبلغ في أي وقت";
    if (count === 1) return "تُسدَّدف مرة واحدة";
    return `قسط كل فترة: ${Math.round(Number(form.amount || 0) / count).toLocaleString()} ج.م`;
  })();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-800">السلفيات</h3>
          <p className="text-xs text-slate-500 mt-0.5">إدارة السلف واقساطها</p>
        </div>
        {canManage && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" /> إضافة سلفة
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
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-white focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600">عدد الأقساط (اختياري)</label>
                  <select
                    value={form.installment_count}
                    onChange={e => setForm({ ...form, installment_count: e.target.value })}
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-white focus:border-amber-400"
                  >
                    <option value="0">غير محدد</option>
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
                    className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-amber-200 bg-white focus:border-amber-400"
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
                  className="h-10 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-lg transition-all"
                >
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
            <div key={adv.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black font-mono text-slate-800">{Number(adv.amount).toLocaleString()} ج.م</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${st.class}`}>{st.label}</span>
                </div>
                {adv.status === 'active' && canManage && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setPaying(adv.id)}
                    className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
                  >
                    <DollarSign className="h-3 w-3" /> تسديد
                  </motion.button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {Number(adv.remaining_balance).toLocaleString()} ج.م متبقي
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                {adv.installment_count > 1 && (
                  <span>{adv.installment_count} أقساط × {Number(adv.installment_amount).toLocaleString()} ج.م</span>
                )}
                {adv.installment_count === 0 && <span className="text-amber-600">بدون أقساط محددة</span>}
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
                    <p className="text-sm font-bold text-emerald-700">تسديد سلفة — المتبقي: {Number(adv.remaining_balance).toLocaleString()} ج.م</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="number" min="1" max={adv.remaining_balance}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="المبلغ"
                        className="flex-1 h-10 rounded-xl px-4 text-sm font-bold outline-none border border-emerald-200 bg-white focus:border-emerald-400"
                      />
                      <button
                        onClick={() => setPayAmount(String(adv.remaining_balance))}
                        className="h-10 px-3 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black transition-all hover:bg-emerald-200"
                      >
                        كل المبلغ
                      </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { handlePay(adv.id); }}
                        disabled={!payAmount || Number(payAmount) <= 0}
                        className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50"
                      >
                        <CheckCircle className="h-3 w-3 inline ml-1" />تأكيد
                      </button>
                      <button
                        onClick={() => { setPaying(null); setPayAmount(""); }}
                        className="h-9 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">سجل المدفوعات</h4>
                  {advPayments.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400 mr-auto">إجمالي {advPayments.length} دفعة</span>
                  )}
                </div>
                {advPayments.length === 0 ? (
                  <p className="text-[11px] text-slate-300 font-bold py-1">لا توجد مدفوعات بعد</p>
                ) : (
                  <div className="space-y-1.5">
                    {advPayments.map(pmt => (
                      <div key={pmt.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black font-mono text-emerald-600">{Number(pmt.amount).toLocaleString()} ج.م</span>
                          {pmt.notes && <span className="text-[10px] text-slate-400">{pmt.notes}</span>}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{formatDateTime(pmt.payment_date || pmt.created_at)}</span>
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
            <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">لا توجد سلفيات لهذا الموظف</p>
          </div>
        )}
      </div>

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
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">تسجيل مصروف؟</h3>
                  <p className="text-xs text-slate-500 mt-0.5">هل تريد تسجيل مصروف لهذه السلفة؟</p>
                </div>
              </div>

              <label className="flex items-center gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expenseForm.create_expense}
                  onChange={e => setExpenseForm({ ...expenseForm, create_expense: e.target.checked })}
                  className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-bold text-slate-700">نعم، تسجيل مصروف للسلفة</span>
              </label>

              {expenseForm.create_expense && (
                <div className="space-y-4 pr-2 border-r-2 border-amber-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">الوصف</label>
                    <div className="relative">
                      <FileText className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={expenseForm.description}
                        onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-amber-400 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">تصنيف المصروف</label>
                    <div className="relative">
                      <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={expenseForm.category_id}
                        onChange={e => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                        className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-amber-400 transition-all appearance-none"
                      >
                        <option value="">اختيار التصنيف...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all"
                >
                  إلغاء
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
    </div>
  );
}
