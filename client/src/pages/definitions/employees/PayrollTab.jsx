import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CheckCircle, X, Calculator, DollarSign, Tag, AlertTriangle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import SmartTooltip from "../../../components/ui/SmartTooltip";
import PermissionGate from "../../../components/ui/PermissionGate";
import { usePermission } from "../../../hooks/usePermission";
import useRecordOnlyMethods from "../../../hooks/useRecordOnlyMethods";

export default function PayrollTab({ employee }) {
  const recordMethods = useRecordOnlyMethods();
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
  const [isPartial, setIsPartial] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [carryForward, setCarryForward] = useState(true);
  const [salaryBalance, setSalaryBalance] = useState(null);
  const [showExpenseConfirm, setShowExpenseConfirm] = useState(false);
  const [recordExpense, setRecordExpense] = useState(true);
  const [consumeOneTime, setConsumeOneTime] = useState(true);
  const [showPayOff, setShowPayOff] = useState(false);
  const [payOffAmount, setPayOffAmount] = useState("");
  const [payOffSubmitting, setPayOffSubmitting] = useState(false);
  const [payOffCategoryId, setPayOffCategoryId] = useState("");

  useEffect(() => {
    if (employee) {
      loadSettlements();
      loadSalaryBalance();
      api.get("/api/expenses/categories").then(r => setCategories(r.data?.data || [])).catch(() => {});
    }
  }, [employee]);

  async function loadSettlements() {
    setLoading(true);
    try {
      const res = await api.get(`/api/employees/${employee.id}/settlements`);
      if (res.data?.success) setSettlements(res.data.data);
    } catch {} finally { setLoading(false); }
  }

  async function loadSalaryBalance() {
    try {
      const res = await api.get(`/api/employees/${employee.id}/salary-balance`);
      if (res.data?.success) setSalaryBalance(res.data.data);
    } catch {}
  }

  function defaultPeriodStart() {
    const now = new Date();
    if (employee.salary_period === 'daily') return now.toISOString().slice(0, 10);
    if (employee.salary_period === 'weekly') {
      const start = new Date(now);
      const day = now.getDay();
      const daysFromSat = day === 6 ? 0 : day + 1;
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
      setIsPartial(false);
      setPaidAmount("");
      setCarryForward(true);
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

  function recalcNet() {
    if (!settleForm) return { advanceTotal: 0, outstandingDeduction: 0, netSalary: 0, finalPaid: 0, remaining: 0 };
    const advanceTotal = activeAdvances.reduce((s, a) => s + (Number(advancePayMap[a.id]) || 0), 0);
    const base = Number(settleForm.base_salary || 0);
    const bonuses = Number(settleForm.total_bonuses || 0);
    const recurringDed = Number(settleForm.total_recurring_deductions || 0);
    const oneTimeDed = Number(settleForm.total_one_time_deductions || 0);
    const outstanding = Number(salaryBalance?.outstanding_balance || 0);
    const netSalary = Math.max(0, base + bonuses - recurringDed - oneTimeDed - advanceTotal - outstanding);
    const finalPaid = isPartial ? Math.min(Number(paidAmount) || 0, netSalary) : netSalary;
    const remaining = Math.max(0, netSalary - finalPaid);
    return { advanceTotal, outstandingDeduction: outstanding, netSalary, finalPaid, remaining };
  }

  async function handlePayOff() {
    if (!payOffAmount || Number(payOffAmount) <= 0) {
      toast.error("أدخل المبلغ");
      return;
    }
    setPayOffSubmitting(true);
    try {
      const res = await api.post(`/api/employees/${employee.id}/pay-outstanding`, {
        paid_amount: Number(payOffAmount),
        category_id: payOffCategoryId || null,
        payment_method: "cash",
      });
      if (res.data?.success) {
        toast.success(`تم سداد ${res.data.data.paid_off.toLocaleString()} ج.م بنجاح`);
        setShowPayOff(false);
        setPayOffAmount("");
        setPayOffCategoryId("");
        loadSalaryBalance();
        loadSettlements();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل السداد");
    } finally {
      setPayOffSubmitting(false);
    }
  }

  function handleOpenExpenseConfirm() {
    if (!settleForm) return;
    if (isPartial && (!paidAmount || Number(paidAmount) <= 0)) {
      toast.error("أدخل مبلغ الصرف الجزئي");
      return;
    }
    setRecordExpense(true);
    setShowExpenseConfirm(true);
  }

  async function handleConfirmSettle() {
    if (!settleForm) return;
    setShowExpenseConfirm(false);
    const { advanceTotal, netSalary, finalPaid } = recalcNet();
    const advance_payments = activeAdvances
      .filter(a => Number(advancePayMap[a.id]) > 0)
      .map(a => ({ advance_id: a.id, amount: Number(advancePayMap[a.id]) }));

    try {
      const res = await api.post(`/api/employees/${employee.id}/settle`, {
        ...settleForm,
        advance_deductions: advanceTotal,
        net_salary: netSalary,
        advance_payments,
        category_id: recordExpense ? (expenseCategoryId || null) : null,
        payment_method: recordExpense ? settleForm.payment_method : undefined,
        paid_amount: isPartial ? finalPaid : undefined,
        carry_forward: isPartial ? carryForward : undefined,
        consume_one_time: isPartial ? consumeOneTime : undefined,
      });
      if (res.data?.success) {
        toast.success(isPartial ? "تم صرف الراتب الجزئي بنجاح" : "تم صرف الراتب بنجاح");
        setShowSettle(false);
        setSettleForm(null);
        setActiveAdvances([]);
        setAdvancePayMap({});
        loadSettlements();
        loadSalaryBalance();
      }
    } catch (err) { toast.error(err?.response?.data?.message || "فشل صرف الراتب"); }
  }

  if (!employee) return null;

  const { advanceTotal, outstandingDeduction, netSalary, finalPaid, remaining } = recalcNet();

  return (
    <div className="p-6">
      {/* Info Panel */}
      {(() => {
        const dismissed = typeof window !== 'undefined' && localStorage.getItem('emp-tab-info-payroll');
        if (dismissed) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex items-start gap-4 relative mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-indigo-800">صرف الرواتب</p>
              <p className="text-xs font-bold text-indigo-600 mt-1 leading-relaxed">
                اضغط "صرف الراتب" لمراجعة الملخص الكامل ثم صرف الراتب. يمكنك الصرف الكامل أو الجزئي — المتبقي من الصرف الجزئي بيتسجل وممكن ينخصم تلقائياً من الفترة القادمة أو يتتتبع يدوي. كل صرف بيسجل كمصروف في الخزينة.
              </p>
            </div>
            <button onClick={() => localStorage.setItem('emp-tab-info-payroll', '1')}
              className="text-indigo-400 hover:text-indigo-600 text-xs font-black shrink-0">فهمت</button>
          </motion.div>
        );
      })()}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-slate-800">صرف الرواتب</h3>
          <p className="text-xs text-slate-500 mt-0.5">سجل صرف الرواتب السابقة</p>
        </div>
        {canSettle && (
          <SmartTooltip content={"افتح نافذة صرف الراتب — هتلاقي ملخص كامل: الراتب الأساسي + المكافآت - الخصومات - السلف. تقدر تصرف كامل أو جزئي."} wide>
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
          </SmartTooltip>
        )}
      </div>

      {/* ملخص الراتب + الرصيد المتبقي */}
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
                {settlements.reduce((s, st) => s + Number(st.paid_amount || st.net_salary), 0).toLocaleString()} ج.م
              </p>
            </div>
          </div>
          {salaryBalance && salaryBalance.outstanding_balance > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-black text-amber-700">مبلغ متبقي من فترات سابقة</p>
                <p className="text-sm font-bold text-amber-800 font-mono">{salaryBalance.outstanding_balance.toLocaleString()} ج.م</p>
              </div>
              {canSettle && (
                <button
                  onClick={() => { setPayOffAmount(String(salaryBalance.outstanding_balance)); setShowPayOff(true); }}
                  className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black transition-all"
                >
                  سداد
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {createPortal(
        <>
          {/* ═══════════ نافذة صرف الراتب — شاشة كاملة ═══════════ */}
          <AnimatePresence>
            {showSettle && settleForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setShowSettle(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 30 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-white rounded-3xl shadow-2xl w-[95vw] h-[90vh] max-w-6xl flex flex-col overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800">تأكيد صرف الراتب</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{employee.name} — الفترة: {settleForm.period_start} إلى {settleForm.period_end}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSettle(false)} className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Body — Two columns */}
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full">
                      {/* Right column — Main form (3/5) */}
                      <div className="lg:col-span-3 space-y-6">
                        {/* تفاصيل الحساب */}
                        <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">تفاصيل الحساب</h4>
                          <div className="space-y-3">
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
                        </div>

                        {/* فترة الراتب */}
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

                        {/* سداد السلف */}
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
                              <span className="text-base font-black text-rose-600 font-mono">-{advanceTotal.toLocaleString()} ج.م</span>
                            </div>
                          </div>
                        )}

                        {/* الدفع الجزئي */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider">خيارات الدفع</h4>
                            <button
                              type="button"
                              onClick={() => { setIsPartial(!isPartial); setPaidAmount(""); }}
                              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isPartial ? 'bg-indigo-500' : 'bg-slate-300'}`}
                            >
                              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isPartial ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500">
                            {isPartial ? "صرف جزئي — أدخل المبلغ المدفوع وسيتم تتبع المتبقي" : "صرف كامل — سيتم دفع صافي الراتب بالكامل"}
                          </p>

                          {isPartial && (
                            <div className="space-y-4 pt-2 border-t border-indigo-100">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">المبلغ المدفوع</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={netSalary}
                                  value={paidAmount}
                                  onChange={e => setPaidAmount(e.target.value)}
                                  placeholder="0"
                                  className="w-full h-12 rounded-xl px-4 text-lg font-black font-mono outline-none border border-indigo-200 bg-white focus:border-indigo-400 transition-all text-center"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                                  <span>الصافي: {netSalary.toLocaleString()} ج.م</span>
                                  <button
                                    type="button"
                                    onClick={() => setPaidAmount(String(netSalary))}
                                    className="text-indigo-600 hover:text-indigo-800"
                                  >
                                    الدفع الكامل
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">مصير المتبقي ({remaining.toLocaleString()} ج.م)</label>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setCarryForward(true)}
                                    className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${carryForward ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                  >
                                    خصم تلقائي من الفترة القادمة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCarryForward(false)}
                                    className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${!carryForward ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                  >
                                    تتبع يدوي فقط
                                  </button>
                                </div>
                              </div>

                              {settleForm.total_one_time_deductions > 0 && (
                                <div className="space-y-2">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">الخصومات لمرة واحدة ({settleForm.total_one_time_deductions.toLocaleString()} ج.م)</label>
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setConsumeOneTime(true)}
                                      className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${consumeOneTime ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                      تسجيل كمطبَّق (خصم مرة واحدة)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConsumeOneTime(false)}
                                      className={`flex-1 h-11 rounded-xl text-xs font-black border transition-all ${!consumeOneTime ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                    >
                                      الاحتفاظ بها (تُعاد الفترة القادمة)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ملاحظة */}
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">ملاحظة (اختياري)</label>
                          <input
                            value={settleForm.description}
                            onChange={e => setSettleForm({ ...settleForm, description: e.target.value })}
                            className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all"
                            placeholder="أضف ملاحظة..."
                          />
                        </div>
                      </div>

                      {/* Left column — Summary (2/5) */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6 space-y-4 sticky top-0">
                          <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">ملخص الصرف</h4>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">الراتب الأساسي</span>
                              <span className="text-sm font-bold font-mono">{settleForm.base_salary.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">+ المكافآت</span>
                              <span className="text-sm font-bold text-emerald-600 font-mono">+{settleForm.total_bonuses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">- خصومات</span>
                              <span className="text-sm font-bold text-rose-600 font-mono">-{(settleForm.total_recurring_deductions + settleForm.total_one_time_deductions).toLocaleString()}</span>
                            </div>
                            {advanceTotal > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">- سلف</span>
                                <span className="text-sm font-bold text-rose-600 font-mono">-{advanceTotal.toLocaleString()}</span>
                              </div>
                            )}
                            {outstandingDeduction > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">- رصيد سابق</span>
                                <span className="text-sm font-bold text-amber-600 font-mono">-{outstandingDeduction.toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-indigo-200 pt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-base font-black text-slate-800">صافي الراتب</span>
                              <span className="text-2xl font-black text-indigo-600 font-mono">{netSalary.toLocaleString()} ج.م</span>
                            </div>
                          </div>

                          {isPartial && (
                            <div className="border-t border-indigo-200 pt-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-600">المبلغ المدفوع</span>
                                <span className="text-lg font-black text-emerald-600 font-mono">{finalPaid.toLocaleString()} ج.م</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-600">المتبقي</span>
                                <span className="text-lg font-black text-amber-600 font-mono">{remaining.toLocaleString()} ج.م</span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400">
                                {carryForward ? "سيتم خصم المتبقي من الفترة القادمة" : "تتبع يدوي فقط — لن يُخصم تلقائياً"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex gap-3 px-8 py-5 border-t border-slate-100 shrink-0">
                    <button
                      onClick={() => setShowSettle(false)}
                      className="flex-1 h-12 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleOpenExpenseConfirm}
                      className="flex-[2] h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <CheckCircle className="h-4 w-4" /> تأكيد الصرف
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════ نافذة تأكيد تسجيل المصروف ═══════════ */}
          <AnimatePresence>
            {showExpenseConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => setShowExpenseConfirm(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">تأكيد صرف الراتب</h3>
                      <p className="text-xs text-slate-500 mt-0.5">المبلغ: {finalPaid.toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  {/* ملخص */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">صافي الراتب</span>
                      <span className="font-black font-mono text-slate-800">{netSalary.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">المبلغ المدفوع</span>
                      <span className="font-black font-mono text-indigo-600">{finalPaid.toLocaleString()} ج.م</span>
                    </div>
                    {isPartial && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">المتبقي</span>
                        <span className="font-black font-mono text-amber-600">{remaining.toLocaleString()} ج.م</span>
                      </div>
                    )}
                  </div>

                  {/* تبديل تسجيل المصروف */}
                  <div className="flex items-center justify-between bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">تسجيل كمصروف؟</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">يسجل المبلغ كمصروف في الخزينة (اختياري)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordExpense(!recordExpense)}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${recordExpense ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${recordExpense ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* حقول المصروف — تظهر فقط عند التفعيل */}
                  <AnimatePresence>
                    {recordExpense && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">طريقة الدفع</label>
                          <select
                            value={settleForm?.payment_method || "cash"}
                            onChange={e => setSettleForm({ ...settleForm, payment_method: e.target.value })}
                            className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-indigo-400 transition-all appearance-none"
                          >
                            <option value="cash">💵 نقدي</option>
                            {recordMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
                          </select>
                        </div>
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowExpenseConfirm(false)}
                      className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={() => { setRecordExpense(false); handleConfirmSettle(); }}
                      className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all"
                    >
                      تخطي
                    </button>
                    <button
                      onClick={handleConfirmSettle}
                      className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <CheckCircle className="h-4 w-4" /> تأكيد
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════ نافذة سداد الرصيد المتبقي ═══════════ */}
          <AnimatePresence>
            {showPayOff && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => setShowPayOff(false)}
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
                      <h3 className="text-lg font-black text-slate-800">سداد الرصيد المتبقي</h3>
                      <p className="text-xs text-slate-500 mt-0.5">المتبقي: {salaryBalance?.outstanding_balance?.toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">المبلغ المراد سداده</label>
                      <input
                        type="number"
                        min="1"
                        max={salaryBalance?.outstanding_balance}
                        value={payOffAmount}
                        onChange={e => setPayOffAmount(e.target.value)}
                        className="w-full h-12 rounded-xl px-4 text-lg font-black font-mono outline-none border border-amber-200 bg-white focus:border-amber-400 transition-all text-center"
                      />
                      <button
                        onClick={() => setPayOffAmount(String(salaryBalance?.outstanding_balance || 0))}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800"
                      >
                       سداد الكل
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">تصنيف المصروف (اختياري)</label>
                      <select
                        value={payOffCategoryId}
                        onChange={e => setPayOffCategoryId(e.target.value)}
                        className="w-full h-11 rounded-xl px-4 text-sm font-bold outline-none border border-slate-200 bg-white focus:border-amber-400 transition-all appearance-none"
                      >
                        <option value="">بدون تصنيف</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowPayOff(false)}
                      className="flex-1 h-11 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handlePayOff}
                      disabled={payOffSubmitting || !payOffAmount || Number(payOffAmount) <= 0}
                      className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {payOffSubmitting ? "جاري السداد..." : "سداد"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      {/* ═══════════ سجل الصرف ═══════════ */}
      <div className="space-y-2">
        {settlements.map(st => {
          const isStPartial = st.status === 'partial';
          return (
            <div key={st.id} className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Wallet className="h-4 w-4 text-indigo-400" />
                <div>
                  <span className="text-sm font-bold font-mono text-slate-800">{Number(st.paid_amount || st.net_salary).toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-slate-500 mr-3">
                    {st.period_start} ← {st.period_end}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${isStPartial ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {isStPartial ? 'جزئي' : 'كامل'}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {st.payment_method === 'cash' ? 'نقداً' : st.payment_method === 'bank_transfer' ? 'تحويل' : st.payment_method}
                </span>
                {isStPartial && Number(st.remaining_balance) > 0 && (
                  <span className="text-[10px] font-bold text-amber-600">المتبقي: {Number(st.remaining_balance).toLocaleString()} ج.م</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {new Date(st.settled_at).toLocaleDateString("ar-EG")}
              </div>
            </div>
          );
        })}
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
