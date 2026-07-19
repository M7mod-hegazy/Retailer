import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, CheckCircle, X, Calculator, DollarSign, Tag, AlertTriangle, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../services/api";
import SmartTooltip from "../../../components/ui/SmartTooltip";
import { usePermission } from "../../../hooks/usePermission";
import useRecordOnlyMethods from "../../../hooks/useRecordOnlyMethods";

function toLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SETTLEMENT_STATUS = {
  full: { label: "كامل", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  settled: { label: "مُسدَّد", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "جزئي", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  carried: { label: "مُرحَّل", cls: "bg-sky-50 text-sky-700 border-sky-200" },
};

export default function PayrollTab({ employee }) {
  const recordMethods = useRecordOnlyMethods();
  const canSettle = usePermission("employees", "settle_payroll");

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  useEffect(() => {
    if (!showSettle) return;
    const h = (e) => { if (e.key === "Escape") setShowSettle(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showSettle]);
  const [calculating, setCalculating] = useState(false);
  const [settleForm, setSettleForm] = useState(null);
  const [activeAdvances, setActiveAdvances] = useState([]);
  const [advancePayMap, setAdvancePayMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [carryForward, setCarryForward] = useState(true);
  const [consumeOneTime, setConsumeOneTime] = useState(true);
  const [salaryBalance, setSalaryBalance] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  useEffect(() => {
    if (!showConfirm) return;
    const h = (e) => { if (e.key === "Escape") setShowConfirm(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showConfirm]);
  const [submitting, setSubmitting] = useState(false);
  const [showPayOff, setShowPayOff] = useState(false);
  useEffect(() => {
    if (!showPayOff) return;
    const h = (e) => { if (e.key === "Escape") setShowPayOff(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showPayOff]);
  const [payOffAmount, setPayOffAmount] = useState("");
  const [payOffSubmitting, setPayOffSubmitting] = useState(false);
  const [payOffCategoryId, setPayOffCategoryId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteExpenseFlag, setDeleteExpenseFlag] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [expandedSection, setExpandedSection] = useState({ advances: false, onetime: false });

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
    if (employee.salary_period === 'daily') return toLocalDateStr(now);
    if (employee.salary_period === 'weekly') {
      const start = new Date(now);
      const day = now.getDay();
      const daysFromSat = day === 6 ? 0 : day + 1;
      start.setDate(now.getDate() - daysFromSat);
      return toLocalDateStr(start);
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
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
      await loadSalaryBalance();

      const activeBonuses = (bonusesRes.data?.data || []).filter(b => b.status === 'active');
      const recurringDeductions = (deductionsRes.data?.data || []).filter(d => d.status === 'active' && d.is_recurring);
      const oneTimeDeductions = (deductionsRes.data?.data || []).filter(d => d.status === 'active' && !d.is_recurring);
      const advances = (advancesRes.data?.data || []).filter(a => a.status === 'active');

      const ps = defaultPeriodStart();
      const pe = toLocalDateStr();

      const payMap = {};
      advances.forEach(a => { payMap[a.id] = ""; });

      setCategories(categoriesRes.data?.data || []);
      setExpenseCategoryId("");
      setActiveAdvances(advances);
      setAdvancePayMap(payMap);
      setIsPartial(false);
      setPaidAmount("");
      setCarryForward(true);
      setConsumeOneTime(true);
      setExpandedSection({ advances: advances.length > 0, onetime: oneTimeDeductions.length > 0 });
      setSettleForm({
        period_start: ps,
        period_end: pe,
        base_salary: Number(employee.salary || 0),
        recurring_bonuses: activeBonuses.filter(b => b.is_recurring).reduce((s, b) => s + Number(b.amount), 0),
        one_time_bonuses: activeBonuses.filter(b => !b.is_recurring).reduce((s, b) => s + Number(b.amount), 0),
        total_recurring_deductions: recurringDeductions.reduce((s, d) => s + Number(d.amount), 0),
        total_one_time_deductions: oneTimeDeductions.reduce((s, d) => s + Number(d.amount), 0),
        payment_method: "cash",
        description: `راتب ${employee.name} — من ${ps} لـ ${pe}`,
      });
      setShowSettle(true);
    } catch { toast.error("مفيش حساب حصل — جرب تاني"); }
    finally { setCalculating(false); }
  }

  function computeSummary() {
    if (!settleForm) return { advanceTotal: 0, totalBonuses: 0, oneTimeDed: 0, periodNet: 0, previousOwed: 0, totalDue: 0, finalPaid: 0, remaining: 0, overdrawn: false };
    const advanceTotal = activeAdvances.reduce(
      (s, a) => s + Math.min(Number(advancePayMap[a.id]) || 0, Number(a.remaining_balance) || 0), 0
    );
    const base = Number(settleForm.base_salary || 0);
    const totalBonuses = Number(settleForm.recurring_bonuses || 0) + Number(settleForm.one_time_bonuses || 0);
    const recurringDed = Number(settleForm.total_recurring_deductions || 0);
    const oneTimeDed = consumeOneTime ? Number(settleForm.total_one_time_deductions || 0) : 0;
    const periodNet = base + totalBonuses - recurringDed - oneTimeDed - advanceTotal;
    const previousOwed = Number(salaryBalance?.carry_forward_balance || 0);
    const totalDue = Math.max(0, periodNet) + previousOwed;
    const finalPaid = isPartial ? Math.min(Number(paidAmount) || 0, totalDue) : totalDue;
    const remaining = Math.max(0, totalDue - finalPaid);
    return { advanceTotal, totalBonuses, oneTimeDed, periodNet, previousOwed, totalDue, finalPaid, remaining, overdrawn: periodNet < 0 };
  }

  async function handlePayOff() {
    if (!payOffAmount || Number(payOffAmount) <= 0) {
      toast.error("ادخل المبلغ");
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
        toast.success(`اتسدد ${res.data.data.paid_off.toLocaleString()} ج.م بنجاح`);
        setShowPayOff(false);
        setPayOffAmount("");
        setPayOffCategoryId("");
        loadSalaryBalance();
        loadSettlements();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "السداد مفيش حصل");
    } finally {
      setPayOffSubmitting(false);
    }
  }

  function handleOpenConfirm() {
    if (!settleForm) return;
    const { overdrawn, totalDue } = computeSummary();
    if (overdrawn) {
      toast.error("الخصومات والسلف أكبر من الراتب — قلّل مبلغ السداد أو أجّل الخصومات");
      return;
    }
    if (isPartial && (!paidAmount || Number(paidAmount) <= 0)) {
      toast.error("ادخل المبلغ اللي عايز تصرفه");
      return;
    }
    if (isPartial && Number(paidAmount) >= totalDue) {
      setIsPartial(false);
      setPaidAmount("");
    }
    setShowConfirm(true);
  }

  async function handleDeleteSettlement() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/api/employees/${employee.id}/settlements/${deleteTarget.id}?delete_expense=${deleteExpenseFlag}`);
      if (res.data?.success) {
        const data = res.data.data || {};
        const msgs = [];
        if (data.reversed_advances?.length) msgs.push(`رجع ${data.reversed_advances.length} قسط سلفة`);
        if (data.expense_deleted) msgs.push("اتمسح المصروف");
        toast.success(msgs.length ? `تم الإلغاء — ${msgs.join(" و ")}` : "تم إلغاء الصرف");
        setDeleteTarget(null);
        setDeleteExpenseFlag(true);
        loadSettlements();
        loadSalaryBalance();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "الإلغاء مفيش حصل");
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmSettle() {
    if (!settleForm || submitting) return;
    const advance_payments = activeAdvances
      .filter(a => Number(advancePayMap[a.id]) > 0)
      .map(a => ({ advance_id: a.id, amount: Number(advancePayMap[a.id]) }));

    setSubmitting(true);
    try {
      const { finalPaid } = computeSummary();
      const res = await api.post(`/api/employees/${employee.id}/settle`, {
        period_start: settleForm.period_start,
        period_end: settleForm.period_end,
        description: settleForm.description,
        payment_method: settleForm.payment_method,
        category_id: expenseCategoryId || null,
        advance_payments,
        consume_one_time: consumeOneTime,
        paid_amount: isPartial ? finalPaid : undefined,
        carry_forward: isPartial ? carryForward : undefined,
      });
      if (res.data?.success) {
        toast.success(isPartial ? "اتصرف جزئي — الباقي متسجل حق الموظف" : "تم صرف الراتب بنجاح");
        setShowConfirm(false);
        setShowSettle(false);
        setSettleForm(null);
        setActiveAdvances([]);
        setAdvancePayMap({});
        loadSettlements();
        loadSalaryBalance();
      }
    } catch (err) { toast.error(err?.response?.data?.message || "الصرف مفيش حصل"); }
    finally { setSubmitting(false); }
  }

  if (!employee) return null;

  const { advanceTotal, totalBonuses, oneTimeDed, periodNet, previousOwed, totalDue, finalPaid, remaining, overdrawn } = computeSummary();
  const outstandingTotal = Number(salaryBalance?.outstanding_balance || 0);

  return (
    <div className="p-6">
      {(() => {
        const dismissed = typeof window !== 'undefined' && localStorage.getItem('emp-tab-info-payroll');
        if (dismissed) return null;
        return (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 flex items-start gap-4 relative mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <Wallet className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-indigo-800">ازاي بيتصرف الراتب؟</p>
              <p className="text-xs font-bold text-indigo-600 mt-1 leading-relaxed">
                الراتب الأساسي + المكافآت − الخصومات − السلف = <b>الصافي</b>.
                لو عايز تدفع أقل من الكلي، الباقي يفضل حق الموظف وميضيعش — يتنقل على الصرف الجاي أو يتسدد بعدين.
                كل مبلغ بيصرف بيتسجَّل مصروف في الخزينة تلقائياً.
              </p>
            </div>
            <button onClick={() => localStorage.setItem('emp-tab-info-payroll', '1')}
              className="text-indigo-400 hover:text-indigo-600 text-xs font-black shrink-0">فهمت</button>
          </motion.div>
        );
      })()}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-text-primary">صرف الرواتب</h3>
          <p className="text-xs text-text-secondary mt-0.5">سجل الصرفات السابقة</p>
        </div>
        {canSettle && (
          <SmartTooltip content={"افتح نافذة الصرف — كل حاجة بتتحسب تلقائي: الأساسي والمكافآت والخصومات والسلف"} wide>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCalculate}
              disabled={calculating}
              className="h-10 px-5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Calculator className="h-4 w-4" />
              {calculating ? "بيتحسب..." : "صرف الراتب"}
            </motion.button>
          </SmartTooltip>
        )}
      </div>

      {employee.salary > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">الراتب الأساسي</p>
              <p className="text-xl font-black text-text-primary font-mono mt-1">{Number(employee.salary).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">فترة الدفع</p>
              <p className="text-xl font-black text-text-primary mt-1">
                {employee.salary_period === 'monthly' ? 'شهري' : employee.salary_period === 'weekly' ? 'أسبوعي' : 'يومي'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">آخر صرف</p>
              <p className="text-sm font-bold text-text-secondary mt-1">
                {settlements.length > 0
                  ? new Date(settlements[0].settled_at).toLocaleDateString("ar-EG")
                  : "لسه ما اتصرفش"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">المصروف الكلي</p>
              <p className="text-sm font-bold text-text-secondary mt-1">
                {Number(salaryBalance?.total_paid ?? settlements.reduce((s, st) => s + Number(st.paid_amount ?? st.net_salary), 0)).toLocaleString()} ج.م
              </p>
            </div>
          </div>
          {outstandingTotal > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-black text-amber-700">فيه فلوس باقية للموظف من صرف قديم — لسه ما اتدفعتش</p>
                <p className="text-sm font-bold text-amber-800 font-mono">{outstandingTotal.toLocaleString()} ج.م</p>
                {Number(salaryBalance?.carry_forward_balance || 0) > 0 && (
                  <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                    منها {Number(salaryBalance.carry_forward_balance).toLocaleString()} ج.م هتتضاف على الصرف الجاي تلقائي
                  </p>
                )}
              </div>
              {canSettle && (
                <button
                  onClick={() => { setPayOffAmount(String(outstandingTotal)); setShowPayOff(true); }}
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
                  className="bg-bg-surface rounded-3xl shadow-2xl w-[95vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-text-primary">صرف راتب</h2>
                        <p className="text-[11px] text-text-secondary">{employee.name}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSettle(false)} className="h-9 w-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-bg-overlay transition-all">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-text-muted uppercase">من تاريخ</label>
                        <input type="date" value={settleForm.period_start}
                          onChange={e => setSettleForm({ ...settleForm, period_start: e.target.value, description: `راتب ${employee.name} — من ${e.target.value} لـ ${settleForm.period_end}` })}
                          className="w-full h-10 rounded-xl px-3 text-sm font-bold outline-none border border-border-normal focus:border-indigo-400 transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-text-muted uppercase">لحد تاريخ</label>
                        <input type="date" value={settleForm.period_end}
                          onChange={e => setSettleForm({ ...settleForm, period_end: e.target.value, description: `راتب ${employee.name} — من ${settleForm.period_start} لـ ${e.target.value}` })}
                          className="w-full h-10 rounded-xl px-3 text-sm font-bold outline-none border border-border-normal focus:border-indigo-400 transition-all" />
                      </div>
                    </div>

                    {activeAdvances.length > 0 && (
                      <div className="border border-amber-200 rounded-xl overflow-hidden">
                        <button onClick={() => setExpandedSection(s => ({ ...s, advances: !s.advances }))}
                          className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/60 hover:bg-amber-50 transition-all">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-black text-amber-700">سداد السلف ({activeAdvances.length})</span>
                            {advanceTotal > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">-{advanceTotal.toLocaleString()} ج.م</span>}
                          </div>
                          {expandedSection.advances ? <ChevronUp className="h-4 w-4 text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-400" />}
                        </button>
                        <AnimatePresence>
                          {expandedSection.advances && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="p-3 space-y-2 bg-bg-surface">
                                <p className="text-[10px] font-bold text-text-muted px-1">ادخل المبلغ اللي عايز تخصمه من الراتب وتسدد بيه كل سلفة</p>
                                {activeAdvances.map(adv => (
                                  <div key={adv.id} className="flex items-center gap-2 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-text-primary font-mono">{Number(adv.amount).toLocaleString()} ج.م</span>
                                        <span className="text-[10px] text-text-muted">المتبقي: {Number(adv.remaining_balance).toLocaleString()}</span>
                                      </div>
                                      {adv.notes && <p className="text-[10px] text-text-muted truncate">{adv.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <input type="number" min="0" max={adv.remaining_balance}
                                        value={advancePayMap[adv.id] ?? ""}
                                        onChange={e => setAdvancePayMap({ ...advancePayMap, [adv.id]: e.target.value })}
                                        className="w-20 h-8 rounded-lg px-2 text-xs font-bold outline-none border border-amber-200 focus:border-amber-400 text-center" placeholder="0" />
                                      <button type="button"
                                        onClick={() => setAdvancePayMap({ ...advancePayMap, [adv.id]: String(adv.remaining_balance) })}
                                        className="h-8 px-2 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black hover:bg-amber-200 transition-all">
                                        الكل
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {Number(settleForm.total_one_time_deductions) > 0 && (
                      <div className="border border-rose-200 rounded-xl overflow-hidden">
                        <button onClick={() => setExpandedSection(s => ({ ...s, onetime: !s.onetime }))}
                          className="w-full flex items-center justify-between px-4 py-3 bg-rose-50/60 hover:bg-rose-50 transition-all">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                            <span className="text-xs font-black text-rose-700">خصومات لمرة واحدة ({Number(settleForm.total_one_time_deductions).toLocaleString()} ج.م)</span>
                          </div>
                          {expandedSection.onetime ? <ChevronUp className="h-4 w-4 text-rose-400" /> : <ChevronDown className="h-4 w-4 text-rose-400" />}
                        </button>
                        <AnimatePresence>
                          {expandedSection.onetime && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="p-3 space-y-2 bg-bg-surface">
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => setConsumeOneTime(true)}
                                    className={`flex-1 h-9 rounded-lg text-[11px] font-black border transition-all ${consumeOneTime ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                                    خصمها دلوقتي
                                  </button>
                                  <button type="button" onClick={() => setConsumeOneTime(false)}
                                    className={`flex-1 h-9 rounded-lg text-[11px] font-black border transition-all ${!consumeOneTime ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                                    أجّلها للراتب الجاي
                                  </button>
                                </div>
                                <p className="text-[10px] font-bold text-text-muted px-1">
                                  {consumeOneTime ? "هتتخصم دلوقتي وماتتكررش — خلاص مفيش رجوع" : "مش هتدخل في الحساب دلوقتي — هتتخصم في الصرف الجاي"}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="bg-bg-overlay border border-border-normal rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-text-secondary">عايز تصرف كام؟</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setIsPartial(false); setPaidAmount(""); }}
                          className={`flex-1 h-10 rounded-xl text-xs font-black border transition-all ${!isPartial ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                          كله ({totalDue.toLocaleString()} ج.م)
                        </button>
                        <button type="button" onClick={() => setIsPartial(true)}
                          className={`flex-1 h-10 rounded-xl text-xs font-black border transition-all ${isPartial ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                          جزء
                        </button>
                      </div>
                      {isPartial && (
                        <div className="space-y-2 pt-1">
                          <div className="relative">
                            <input type="number" min="1" max={totalDue} value={paidAmount}
                              onChange={e => setPaidAmount(e.target.value)}
                              placeholder="المبلغ"
                              className="w-full h-11 rounded-xl px-4 text-base font-black font-mono outline-none border border-indigo-200 focus:border-indigo-400 transition-all text-center" />
                            <button onClick={() => setPaidAmount(String(totalDue))}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800">
                              دفع الكل
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setCarryForward(true)}
                              className={`flex-1 h-9 rounded-lg text-[10px] font-black border transition-all ${carryForward ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                              يتنقل للصرف الجاي
                            </button>
                            <button type="button" onClick={() => setCarryForward(false)}
                              className={`flex-1 h-9 rounded-lg text-[10px] font-black border transition-all ${!carryForward ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-bg-surface border-border-normal text-text-secondary'}`}>
                              يتسدد بعدين يدوياً
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 space-y-2.5">
                      <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">الحساب</h4>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">الراتب الأساسي</span>
                        <span className="font-bold font-mono">{Number(settleForm.base_salary).toLocaleString()} ج.م</span>
                      </div>
                      {totalBonuses > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-secondary">+ المكافآت</span>
                          <span className="font-bold text-emerald-600 font-mono">+{totalBonuses.toLocaleString()}</span>
                        </div>
                      )}
                      {(Number(settleForm.total_recurring_deductions) > 0 || oneTimeDed > 0) && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-secondary">- الخصومات</span>
                          <span className="font-bold text-rose-600 font-mono">-{(Number(settleForm.total_recurring_deductions) + oneTimeDed).toLocaleString()}</span>
                        </div>
                      )}
                      {advanceTotal > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-secondary">- سداد السلف</span>
                          <span className="font-bold text-rose-600 font-mono">-{advanceTotal.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-indigo-200 pt-2 flex justify-between items-center">
                        <span className="text-sm font-bold text-text-secondary">الصافي</span>
                        <span className={`text-base font-black font-mono ${overdrawn ? 'text-rose-600' : 'text-text-primary'}`}>{periodNet.toLocaleString()} ج.م</span>
                      </div>
                      {previousOwed > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-text-secondary">+ حق قديم للموظف</span>
                          <span className="font-bold text-emerald-600 font-mono">+{previousOwed.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="border-t border-indigo-200 pt-2 flex justify-between items-center">
                        <span className="text-base font-black text-text-primary">الإجمالي المستحق</span>
                        <span className="text-xl font-black text-indigo-600 font-mono">{totalDue.toLocaleString()} ج.م</span>
                      </div>
                      {isPartial && !overdrawn && (
                        <>
                          <div className="flex justify-between items-center text-sm pt-1">
                            <span className="text-text-secondary">هيتدفع دلوقتي</span>
                            <span className="font-black text-emerald-600 font-mono">{finalPaid.toLocaleString()} ج.م</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-text-secondary">الباقي للموظف</span>
                            <span className="font-black text-amber-600 font-mono">{remaining.toLocaleString()} ج.م</span>
                          </div>
                        </>
                      )}
                      {overdrawn && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-start gap-2 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-rose-700">الخصومات والسلف أكبر من الراتب — قلّل مبلغ السداد أو أجّل الخصومات</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-text-muted uppercase">ملاحظة (اختياري)</label>
                      <input value={settleForm.description}
                        onChange={e => setSettleForm({ ...settleForm, description: e.target.value })}
                        className="w-full h-10 rounded-xl px-4 text-xs font-bold outline-none border border-border-normal focus:border-indigo-400 transition-all" placeholder="اضف ملاحظة..." />
                    </div>
                  </div>

                  <div className="flex gap-3 px-6 py-4 border-t border-border-subtle shrink-0">
                    <button onClick={() => setShowSettle(false)}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all hover:bg-bg-overlay">
                      الرجوع
                    </button>
                    <button onClick={handleOpenConfirm} disabled={overdrawn}
                      className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <CheckCircle className="h-4 w-4" /> تأكيد الصرف
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showConfirm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => setShowConfirm(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-primary">تأكد صرف الراتب</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{employee.name}</p>
                    </div>
                  </div>

                  <div className="bg-bg-overlay rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">الإجمالي المستحق</span>
                      <span className="font-black font-mono text-text-primary">{totalDue.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">هيتدفع دلوقتي</span>
                      <span className="font-black font-mono text-indigo-600">{finalPaid.toLocaleString()} ج.م</span>
                    </div>
                    {isPartial && remaining > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">الباقي حق الموظف</span>
                        <span className="font-black font-mono text-amber-600">{remaining.toLocaleString()} ج.م</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-text-muted uppercase">طريقة الدفع</label>
                      <select value={settleForm?.payment_method || "cash"}
                        onChange={e => setSettleForm({ ...settleForm, payment_method: e.target.value })}
                        className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal focus:border-indigo-400 transition-all appearance-none">
                        <option value="cash">💵 نقدي</option>
                        {recordMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-text-muted uppercase">تصنيف المصروف (اختياري)</label>
                      <select value={expenseCategoryId} onChange={e => setExpenseCategoryId(e.target.value)}
                        className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal focus:border-indigo-400 transition-all appearance-none">
                        <option value="">بدون تصنيف...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] font-bold text-text-muted">المبلغ بيتسجَّل تلقائياً كمصروف رواتب في الخزينة</p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setShowConfirm(false)}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all">
                      رجوع
                    </button>
                    <button onClick={handleConfirmSettle} disabled={submitting}
                      className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                      <CheckCircle className="h-4 w-4" /> {submitting ? "بيتصرف..." : `صرف ${finalPaid.toLocaleString()} ج.م`}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPayOff && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => setShowPayOff(false)}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-primary">سداد باقي الموظف</h3>
                      <p className="text-xs text-text-secondary mt-0.5">المتبقي له: {outstandingTotal.toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-text-muted uppercase">المبلغ</label>
                      <input type="number" min="1" max={outstandingTotal} value={payOffAmount}
                        onChange={e => setPayOffAmount(e.target.value)}
                        className="w-full h-12 rounded-xl px-4 text-lg font-black font-mono outline-none border border-amber-200 focus:border-amber-400 transition-all text-center" />
                      <button onClick={() => setPayOffAmount(String(outstandingTotal))}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800">
                        سداد الكل
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-text-muted uppercase">تصنيف المصروف (اختياري)</label>
                      <select value={payOffCategoryId} onChange={e => setPayOffCategoryId(e.target.value)}
                        className="w-full h-10 rounded-xl px-4 text-sm font-bold outline-none border border-border-normal focus:border-amber-400 transition-all appearance-none">
                        <option value="">بدون تصنيف</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <p className="text-[10px] font-bold text-text-muted">المبلغ بيتسجَّل مصروف ويتنقص من المستحق</p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setShowPayOff(false)}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all">
                      إلغاء
                    </button>
                    <button onClick={handlePayOff} disabled={payOffSubmitting || !payOffAmount || Number(payOffAmount) <= 0}
                      className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                      {payOffSubmitting ? "بيتسدد..." : "سداد"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {deleteTarget && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => { setDeleteTarget(null); setDeleteExpenseFlag(true); }}>
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-bg-surface rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-text-primary">تأكيد إلغاء الصرف؟</h3>
                      <p className="text-xs text-text-secondary mt-0.5">ده هيّرجع كل حاجة لورا</p>
                    </div>
                  </div>

                  <div className="bg-bg-overlay rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">الفترة</span>
                      <span className="font-bold font-mono text-text-primary text-xs">{deleteTarget?.period_start} ← {deleteTarget?.period_end}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">المبلغ المدفوع</span>
                      <span className="font-black font-mono text-text-primary">{Number(deleteTarget?.paid_amount ?? deleteTarget?.net_salary ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    {Number(deleteTarget?.previous_owed) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">حق قديم اتحسب</span>
                        <span className="font-bold text-amber-600 font-mono text-xs">+{Number(deleteTarget.previous_owed).toLocaleString()} ج.م هتتمسح</span>
                      </div>
                    )}
                    {Number(deleteTarget?.advance_deductions) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">سداد سلف</span>
                        <span className="font-bold text-amber-600 font-mono text-xs">هيرجع {Number(deleteTarget.advance_deductions).toLocaleString()} ج.م للسلف</span>
                      </div>
                    )}
                    {(deleteTarget?.status === 'partial' || deleteTarget?.status === 'carried') && Number(deleteTarget?.remaining_balance) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">المتبقي المستحق</span>
                        <span className="font-bold text-sky-600 font-mono text-xs">{Number(deleteTarget.remaining_balance).toLocaleString()} ج.م هتتمسح من الحساب</span>
                      </div>
                    )}
                    {deleteTarget?.expense_id && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">المصروف المرتبط</span>
                        <span className="font-bold text-rose-600 font-mono text-xs">{Number(deleteTarget?.paid_amount ?? deleteTarget?.net_salary ?? 0).toLocaleString()} ج.م</span>
                      </div>
                    )}
                  </div>

                  {deleteTarget?.expense_id && (
                    <label className="flex items-center gap-3 bg-rose-50/60 border border-rose-200 rounded-xl px-4 py-3 cursor-pointer">
                      <input type="checkbox" checked={deleteExpenseFlag} onChange={e => setDeleteExpenseFlag(e.target.checked)}
                        className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                      <span className="text-sm font-bold text-text-primary">امسح المصروف المرتبط برضو</span>
                    </label>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setDeleteTarget(null); setDeleteExpenseFlag(true); }}
                      className="flex-1 h-11 bg-bg-surface border border-border-normal text-text-secondary rounded-xl text-sm font-black transition-all">
                      لا، سيبه
                    </button>
                    <button onClick={handleDeleteSettlement} disabled={deleting}
                      className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                      {deleting ? "بيتلغى..." : "أيوه، ألغّيه"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}

      <div className="space-y-2">
        {settlements.map(st => {
          const statusInfo = SETTLEMENT_STATUS[st.status] || SETTLEMENT_STATUS.full;
          const paid = Number(st.paid_amount ?? st.net_salary);
          return (
            <div key={st.id} className="bg-bg-surface border border-border-normal rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Wallet className="h-4 w-4 text-indigo-400" />
                <div>
                  <span className="text-sm font-bold font-mono text-text-primary">{paid.toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-text-secondary mr-3">
                    {st.period_start} ← {st.period_end}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                  {Number(st.previous_owed) > 0 && (
                    <span className="text-[10px] text-text-muted">شامل حق قديم: {Number(st.previous_owed).toLocaleString()} ج.م</span>
                  )}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bg-overlay text-text-secondary">
                  {st.payment_method === 'cash' ? 'نقداً' : st.payment_method === 'bank_transfer' ? 'تحويل' : st.payment_method}
                </span>
                {st.status === 'partial' && Number(st.remaining_balance) > 0 && (
                  <span className="text-[10px] font-bold text-amber-600">المتبقي: {Number(st.remaining_balance).toLocaleString()} ج.م</span>
                )}
                {st.status === 'carried' && Number(st.remaining_balance) > 0 && (
                  <span className="text-[10px] font-bold text-sky-600">اتنقل ({Number(st.remaining_balance).toLocaleString()} ج.م) لصرف لاحق</span>
                )}
              </div>
              <div className="text-[11px] text-text-muted font-mono flex items-center gap-2">
                {new Date(st.settled_at).toLocaleDateString("ar-EG")}
                {canSettle && (
                  <button onClick={() => { setDeleteTarget(st); setDeleteExpenseFlag(true); }}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-text-muted hover:bg-rose-50 hover:text-rose-500 transition-all" title="إلغاء">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && settlements.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm font-bold text-text-muted">لسه ما اتصرفش راتب للموظف ده</p>
          </div>
        )}
      </div>
    </div>
  );
}
