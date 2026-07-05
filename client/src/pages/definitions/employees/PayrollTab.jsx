import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CheckCircle, X, Calculator, DollarSign, Tag } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import PermissionGate from "../../../components/ui/PermissionGate";
import { usePermission } from "../../../hooks/usePermission";

const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "بطاقة" },
  { value: "cheque", label: "شيك" },
];

export default function PayrollTab({ employee }) {
  const canSettle = usePermission("employees", "settle_payroll");

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [settleForm, setSettleForm] = useState(null);
  const [activeAdvances, setActiveAdvances] = useState([]);
  const [advancePayMap, setAdvancePayMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [expenseCategoryId, setExpenseCategoryId] = useState("");

  useEffect(() => {
    if (employee) loadSettlements();
  }, [employee]);

  async function loadSettlements() {
    setLoading(true);
    try {
      const res = await api.get(`/api/employees/${employee.id}/settlements`);
      if (res.data?.success) setSettlements(res.data.data);
    } catch {} finally { setLoading(false); }
  }

  function defaultPeriodStart() {
    const now = new Date();
    if (employee.salary_period === 'daily') return now.toISOString().slice(0, 10);
    if (employee.salary_period === 'weekly') {
      const start = new Date(now);
      const day = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
      const daysFromSat = day === 6 ? 0 : day + 1; // Saturday=0 offset
      start.setDate(now.getDate() - daysFromSat);
      return start.toISOString().slice(0, 10);
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function handleCalculate() {
    setCalculating(true);
    try {
      const [bonusesRes, deductionsRes, advancesRes, categoriesRes] = await Promise.all([
        api.get(`/api/employees/${employee.id}/bonuses`),
        api.get(`/api/employees/${employee.id}/deductions`),
        api.get(`/api/employees/${employee.id}/advances`),
        api.get("/api/expenses/categories"),
      ]);

      const activeBonuses = (bonusesRes.data?.data || []).filter(b => b.status === 'active');
      const recurringDeductions = (deductionsRes.data?.data || []).filter(d => d.status === 'active' && d.is_recurring);
      const oneTimeDeductions = (deductionsRes.data?.data || []).filter(d => d.status === 'active' && !d.is_recurring);
      const advances = (advancesRes.data?.data || []).filter(a => a.status === 'active');

      const baseSalary = Number(employee.salary || 0);
      const totalBonuses = activeBonuses.reduce((s, b) => s + Number(b.amount), 0);
      const totalRecurringDeductions = recurringDeductions.reduce((s, d) => s + Number(d.amount), 0);
      const totalOneTimeDeductions = oneTimeDeductions.reduce((s, d) => s + Number(d.amount), 0);

      const ps = defaultPeriodStart();
      const pe = todayStr();

      const payMap = {};
      advances.forEach(a => { payMap[a.id] = ""; });

      setCategories(categoriesRes.data?.data || []);
      setExpenseCategoryId("");
      setActiveAdvances(advances);
      setAdvancePayMap(payMap);
      setSettleForm({
        period_start: ps,
        period_end: pe,
        base_salary: baseSalary,
        total_bonuses: totalBonuses,
        total_recurring_deductions: totalRecurringDeductions,
        total_one_time_deductions: totalOneTimeDeductions,
        advance_deductions: 0,
        net_salary: Math.max(0, baseSalary + totalBonuses - totalRecurringDeductions - totalOneTimeDeductions),
        payment_method: "cash",
        description: `راتب الموظف: ${employee.name} — عن فترة ${ps} إلى ${pe}`,
      });
      setShowSettle(true);
    } catch { toast.error("فشل حساب الراتب"); }
    finally { setCalculating(false); }
  }

  // حساب إجمالي خصم السلف + صافي الراتب عند تغيير القيم
  function recalcNet() {
    if (!settleForm) return { advanceTotal: 0, netSalary: 0 };
    const advanceTotal = activeAdvances.reduce((s, a) => s + (Number(advancePayMap[a.id]) || 0), 0);
    const base = Number(settleForm.base_salary || 0);
    const bonuses = Number(settleForm.total_bonuses || 0);
    const recurringDed = Number(settleForm.total_recurring_deductions || 0);
    const oneTimeDed = Number(settleForm.total_one_time_deductions || 0);
    const netSalary = Math.max(0, base + bonuses - recurringDed - oneTimeDed - advanceTotal);
    return { advanceTotal, netSalary };
  }

  async function handleConfirmSettle() {
    if (!settleForm) return;
    const { advanceTotal, netSalary } = recalcNet();
    const advance_payments = activeAdvances
      .filter(a => Number(advancePayMap[a.id]) > 0)
      .map(a => ({ advance_id: a.id, amount: Number(advancePayMap[a.id]) }));

    try {
      const res = await api.post(`/api/employees/${employee.id}/settle`, {
        ...settleForm,
        advance_deductions: advanceTotal,
        net_salary: netSalary,
        advance_payments,
        category_id: expenseCategoryId || null,
      });
      if (res.data?.success) {
        toast.success("تم صرف الراتب بنجاح");
        setShowSettle(false);
        setSettleForm(null);
        setActiveAdvances([]);
        setAdvancePayMap({});
        loadSettlements();
      }
    } catch (err) { toast.error(err?.response?.data?.message || "فشل صرف الراتب"); }
  }

  if (!employee) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-800">صرف الرواتب</h3>
          <p className="text-xs text-slate-500 mt-0.5">سجل صرف الرواتب السابقة</p>
        </div>
        {canSettle && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCalculate}
            disabled={calculating}
            className="h-10 px-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            {calculating ? "جاري الحساب..." : "صرف الراتب"}
          </motion.button>
        )}
      </div>

      {/* ملخص الراتب */}
      {employee.salary > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">الراتب الأساسي</p>
              <p className="text-xl font-black text-slate-800 font-mono mt-1">{Number(employee.salary).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">فترة الدفع</p>
              <p className="text-xl font-black text-slate-800 mt-1">
                {employee.salary_period === 'monthly' ? 'شهري' : employee.salary_period === 'weekly' ? 'أسبوعي' : 'يومي'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">آخر صرف</p>
              <p className="text-sm font-bold text-slate-600 mt-1">
                {settlements.length > 0
                  ? new Date(settlements[0].settled_at).toLocaleDateString("ar-EG")
                  : "لم يصرف بعد"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">إجمالي الصرف</p>
              <p className="text-sm font-bold text-slate-600 mt-1">
                {settlements.reduce((s, st) => s + Number(st.net_salary), 0).toLocaleString()} ج.م
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نافذة صرف الراتب */}
      <AnimatePresence>
        {showSettle && settleForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowSettle(false)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800">تأكيد صرف الراتب</h3>
                <button onClick={() => setShowSettle(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* تفاصيل الحساب الأساسية */}
              <div className="space-y-3 bg-slate-50 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">الراتب الأساسي</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{settleForm.base_salary.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">المكافآت</span>
                  <span className="text-sm font-bold text-emerald-600 font-mono">+{settleForm.total_bonuses.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">خصومات متكررة</span>
                  <span className="text-sm font-bold text-rose-600 font-mono">-{settleForm.total_recurring_deductions.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">خصومات لمرة واحدة</span>
                  <span className="text-sm font-bold text-rose-600 font-mono">-{settleForm.total_one_time_deductions.toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* فترة الراتب — قابلة للتعديل */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">بداية الفترة</label>
                  <input
                    type="date"
                    value={settleForm.period_start}
                    onChange={e => setSettleForm({
                      ...settleForm,
                      period_start: e.target.value,
                      description: `راتب الموظف: ${employee.name} — عن فترة ${e.target.value} إلى ${settleForm.period_end}`,
                    })}
                    className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">نهاية الفترة</label>
                  <input
                    type="date"
                    value={settleForm.period_end}
                    onChange={e => setSettleForm({
                      ...settleForm,
                      period_end: e.target.value,
                      description: `راتب الموظف: ${employee.name} — عن فترة ${settleForm.period_start} إلى ${e.target.value}`,
                    })}
                    className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all"
                  />
                </div>
              </div>

              {/* سداد السلف — خيارات مرنة */}
              {activeAdvances.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> سداد السلف (اختياري — أدخل المبلغ الذي تريد سداده)
                  </h4>
                  <div className="space-y-2">
                    {activeAdvances.map(adv => (
                      <div key={adv.id} className="flex items-center gap-3 bg-amber-50/60 border border-amber-200 rounded-xl px-4 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-800 font-mono">{Number(adv.amount).toLocaleString()} ج.م</span>
                            <span className="text-[10px] text-slate-500">المتبقي: {Number(adv.remaining_balance).toLocaleString()} ج.م</span>
                          </div>
                          {adv.notes && <p className="text-[10px] text-slate-400 mt-0.5">{adv.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" max={adv.remaining_balance}
                            value={advancePayMap[adv.id] ?? ""}
                            onChange={e => setAdvancePayMap({ ...advancePayMap, [adv.id]: e.target.value })}
                            className="w-28 h-10 rounded-xl px-3 text-sm font-bold outline-none border border-amber-200 bg-white focus:border-amber-400"
                            placeholder="المبلغ"
                          />
                          <button
                            type="button"
                            onClick={() => setAdvancePayMap({ ...advancePayMap, [adv.id]: String(adv.remaining_balance) })}
                            className="h-10 px-2.5 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black hover:bg-amber-200 transition-all"
                          >
                            الكل
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center bg-amber-100/60 rounded-xl px-4 py-2.5">
                    <span className="text-sm font-bold text-slate-600">إجمالي خصم السلف</span>
                    <span className="text-base font-black text-rose-600 font-mono">-{recalcNet().advanceTotal.toLocaleString()} ج.م</span>
                  </div>
                </div>
              )}

              {/* الصافي */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-base font-black text-slate-800">الصافي</span>
                <span className="text-2xl font-black text-indigo-600 font-mono">{recalcNet().netSalary.toLocaleString()} ج.م</span>
              </div>

              {/* طريقة الدفع */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">طريقة الدفع</label>
                <select
                  value={settleForm.payment_method}
                  onChange={e => setSettleForm({ ...settleForm, payment_method: e.target.value })}
                  className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* تصنيف المصروف */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">تصنيف المصروف</label>
                <div className="relative">
                  <Tag className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={expenseCategoryId}
                    onChange={e => setExpenseCategoryId(e.target.value)}
                    className="w-full h-11 rounded-xl pr-10 px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all appearance-none"
                  >
                    <option value="">اختيار التصنيف (اختياري)...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* الوصف */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">الوصف</label>
                <input
                  value={settleForm.description}
                  onChange={e => setSettleForm({ ...settleForm, description: e.target.value })}
                  className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSettle(false)}
                  className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmSettle}
                  className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle className="h-4 w-4" /> تأكيد الصرف
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* سجل الصرف */}
      <div className="space-y-2">
        {settlements.map(st => (
          <div key={st.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Wallet className="h-4 w-4 text-indigo-400" />
              <div>
                <span className="text-sm font-bold font-mono text-slate-800">{Number(st.net_salary).toLocaleString()} ج.م</span>
                <span className="text-[10px] text-slate-500 mr-3">
                  {st.period_start} ← {st.period_end}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {st.payment_method === 'cash' ? 'نقداً' : st.payment_method === 'bank_transfer' ? 'تحويل' : st.payment_method}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {new Date(st.settled_at).toLocaleDateString("ar-EG")}
            </div>
          </div>
        ))}
        {!loading && settlements.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-400">لم يتم صرف راتب لهذا الموظف بعد</p>
          </div>
        )}
      </div>
    </div>
  );
}
