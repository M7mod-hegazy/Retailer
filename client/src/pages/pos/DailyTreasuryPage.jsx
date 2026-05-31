import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen, RefreshCw, Plus, Printer, Lock, Wallet,
  AlertCircle, CheckCircle2, X, ArrowDownRight, Calculator,
  Calendar, ChevronRight, Flag, ExternalLink, TrendingUp,
  TrendingDown, Search, Clock, ArrowUpDown, Filter,
  FileText, Coins, Banknote, History,
  Edit3, RotateCcw, Eye, Sparkles,
} from "lucide-react";

import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import SmartTooltip from "../../components/ui/SmartTooltip";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DENOMS = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25];

const PAYMENT_METHOD_AR = {
  cash: "نقداً", card: "بطاقة", bank: "بنك", bank_transfer: "تحويل بنكي",
  credit: "آجل", installments: "تقسيط", wallet: "محفظة", multi: "متعدد",
  digital_wallet: "محفظة إلكترونية",
};
const arMethod = (key) => PAYMENT_METHOD_AR[key] || key;

const DOC_TYPE_LABEL = {
  pos_invoice: "فاتورة POS",
  credit_invoice: "آجل",
  installment_invoice: "تقسيط",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات آجلة",
  supplier_payment: "دفع نقدي لمورد",
  sales_return: "مرتجع مبيعات",
  purchase_return: "مرتجع مشتريات",
  ajal_payment: "حركة آجل",
  customer_payment: "تحصيل نقدي من عميل",
  withdrawal: "مسحوب من الخزنة",
};

const REASON_MAP = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  damaged_shipping: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};

const DOC_TYPE_COLOR = {
  pos_invoice: "text-emerald-700 bg-emerald-50 border-emerald-200",
  credit_invoice: "text-amber-700 bg-amber-50 border-amber-200",
  installment_invoice: "text-violet-700 bg-violet-50 border-violet-200",
  expense: "text-rose-700 bg-rose-50 border-rose-200",
  revenue: "text-blue-700 bg-blue-50 border-blue-200",
  purchase: "text-orange-700 bg-orange-50 border-orange-200",
  supplier_payment: "text-red-700 bg-red-50 border-red-200",
  sales_return: "text-pink-700 bg-pink-50 border-pink-200",
  purchase_return: "text-teal-700 bg-teal-50 border-teal-200",
  ajal_payment: "text-cyan-700 bg-cyan-50 border-cyan-200",
  customer_payment: "text-purple-700 bg-purple-50 border-purple-200",
  withdrawal: "text-slate-700 bg-slate-100 border-slate-200",
};

function getEquationRowAffects(tx) {
  const ce = Number(tx.cash_effect ?? tx.amount ?? 0);
  const total = Number(tx.amount ?? 0);
  const affects = [];

  switch (tx.doc_type) {
    case "pos_invoice":
      if (tx.payment_type === "cash") {
        affects.push({ id: "pos_cash_sales", amount: ce });
      } else if (tx.payment_type === "installments") {
        if (ce > 0) affects.push({ id: "pos_installments", amount: ce });
        const instCreditPart = total - ce;
        if (instCreditPart > 0) affects.push({ id: "pos_credit_sales", amount: instCreditPart });
      } else if (tx.payment_type === "multi") {
        let cashAmt = 0, nonCashAmt = 0, creditAmt = 0;
        if (tx.payment_splits) {
          tx.payment_splits.split("|||").forEach(s => {
            const idx = s.lastIndexOf(":");
            const method = s.slice(0, idx);
            const amt = Number(s.slice(idx + 1));
            if (method === "cash") cashAmt += amt;
            else if (method === "credit") creditAmt += amt;
            else nonCashAmt += amt;
          });
        } else { cashAmt = ce; nonCashAmt = total - ce; }
        if (cashAmt > 0) affects.push({ id: "pos_multi_cash", amount: cashAmt });
        if (nonCashAmt > 0) affects.push({ id: "non_cash_movements", amount: nonCashAmt });
        if (creditAmt > 0) affects.push({ id: "pos_credit_sales", amount: creditAmt });
      } else if (tx.payment_type === "credit") {
        affects.push({ id: "pos_credit_sales", amount: total });
      } else {
        affects.push({ id: "non_cash_movements", amount: total });
      }
      break;
    case "installment_invoice": {
      const cashDown = ce;
      const creditPart = total - cashDown;
      if (cashDown > 0) affects.push({ id: "pos_installments", amount: cashDown });
      if (creditPart > 0) affects.push({ id: "pos_credit_sales", amount: creditPart });
      break;
    }
    case "credit_invoice": affects.push({ id: "pos_credit_sales", amount: total }); break;
    case "expense": affects.push({ id: "expenses_cash", amount: Math.abs(ce) }); break;
    case "revenue": affects.push({ id: "revenues_cash", amount: ce }); break;
    case "purchase": affects.push({ id: "purchases_payable", amount: total }); break;
    case "supplier_payment": affects.push({ id: "supplier_cash_payments", amount: Math.abs(ce) }); break;
    case "sales_return": {
      const creditAmt = Number(tx.credit_amount ?? 0);
      if (ce !== 0) affects.push({ id: "sales_returns_cash", amount: Math.abs(ce) });
      if (creditAmt > 0) affects.push({ id: "sales_returns_account", amount: creditAmt });
      else if (ce === 0) affects.push({ id: "sales_returns_account", amount: total });
      break;
    }
    case "purchase_return": {
      const creditAmt = Number(tx.credit_amount ?? 0);
      if (ce !== 0) affects.push({ id: "purchase_returns_cash", amount: Math.abs(ce) });
      if (creditAmt > 0) affects.push({ id: "purchase_returns_payable", amount: creditAmt });
      else if (ce === 0) affects.push({ id: "purchase_returns_payable", amount: total });
      break;
    }
    case "ajal_payment": affects.push({ id: "customer_collections", amount: Math.abs(ce) }); break;
    case "customer_payment": affects.push({ id: "customer_collections", amount: Math.abs(ce) }); break;
    case "withdrawal": affects.push({ id: "withdrawals", amount: Math.abs(ce) }); break;
    default: break;
  }
  return affects;
}

const TABS = [
  { id: "all", label: "كل الحركات" },
  { id: "pos", label: "فواتير POS" },
  { id: "expenses", label: "مصروفات نقدية" },
  { id: "revenues", label: "إيرادات نقدية" },
  { id: "purchases", label: "مشتريات آجلة" },
  { id: "supplier_payments", label: "مدفوعات موردين" },
  { id: "sales_returns", label: "مرتجعات المبيعات" },
  { id: "purchase_returns", label: "مرتجعات المشتريات" },
  { id: "customer_payments", label: "تحصيلات العملاء" },
  { id: "ajal_payments", label: "حركات الآجل" },
  { id: "withdrawals", label: "المسحوبات" },
];

export default function DailyTreasuryPage() {
  usePageTour('daily_treasury');
  const navigate = useNavigate();
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [txSort, setTxSort] = useState("time_desc");
  const [globalAmountSearch, setGlobalAmountSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [activeEquationRowId, setActiveEquationRowId] = useState(null);
  const [clickedTxId, setClickedTxId] = useState(null);
  const [txAffects, setTxAffects] = useState(null);

  // Money count modal
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [counts, setCounts] = useState({});

  // Quick expense/revenue modal
  const [quickModal, setQuickModal] = useState(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickCategoryId, setQuickCategoryId] = useState("");
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [revenueCategories, setRevenueCategories] = useState([]);

  // Withdrawal modal
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalCategoryId, setWithdrawalCategoryId] = useState("");
  const [withdrawalPaymentMethod, setWithdrawalPaymentMethod] = useState("cash");
  const [withdrawalCategories, setWithdrawalCategories] = useState([]);

  // Alerts
  const [yesterdayAlert, setYesterdayAlert] = useState(null);
  const [closingYesterday, setClosingYesterday] = useState(false);

  // Slide-over
  const [slideOver, setSlideOver] = useState(null);
  const [slideOverDetails, setSlideOverDetails] = useState(null);
  const [slideOverLoading, setSlideOverLoading] = useState(false);

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");

  // Compare yesterday
  const [compareYesterday, setCompareYesterday] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  // Calculator
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcPrev, setCalcPrev] = useState(null);
  const [calcOp, setCalcOp] = useState(null);
  const [calcNew, setCalcNew] = useState(true);

  const equationSectionRef = useRef(null);
  const txSectionRef = useRef(null);
  const equationRowRefs = useRef({});
  const clickedTxTimerRef = useRef(null);

  const isToday = date === todayStr();
  const isClosed = summary?.session?.status === "closed";

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      if (isToday) {
        await api.get("/api/daily-sessions/today");
        const r = await api.get("/api/daily-sessions/today/summary");
        setSummary(r.data.data);
      } else {
        const r = await api.get(`/api/daily-sessions/${date}/summary`).catch(() => ({ data: { data: null } }));
        setSummary(r.data.data);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date, isToday]);



  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const searchParam = globalAmountSearch || txSearch;
      const dateParam = isToday ? "" : `&date=${date}`;
      const typeParam = activeTab === "all" ? "all" : activeTab;
      const r = await api.get(
        `/api/daily-sessions/today/transactions?type=${typeParam}&search=${encodeURIComponent(searchParam)}${dateParam}&show_cancelled=${showCancelled ? 1 : 0}`
      );
      let rows = r.data.data || [];
      const cashEff = (r) => Number(r.cash_effect ?? r.amount ?? 0);
      if (txSort === "amount_asc") rows = [...rows].sort((a, b) => cashEff(a) - cashEff(b));
      else if (txSort === "amount_desc") rows = [...rows].sort((a, b) => cashEff(b) - cashEff(a));
      else if (txSort === "time_asc") rows = [...rows].sort((a, b) => a.created_at?.localeCompare(b.created_at));
      else if (txSort === "time_desc") rows = [...rows].sort((a, b) => b.created_at?.localeCompare(a.created_at));
      setTransactions(rows);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [activeTab, txSearch, txSort, globalAmountSearch, date, isToday, showCancelled]);

  async function loadYesterdayAlert() {
    try {
      const r = await api.get("/api/daily-sessions/yesterday/alert");
      setYesterdayAlert(r.data.data);
    } catch {
      setYesterdayAlert(null);
    }
  }

  async function loadPastSessions() {
    try {
      const params = new URLSearchParams();
      if (historySearch) params.set("search", historySearch);
      if (historyStatus) params.set("status", historyStatus);
      const r = await api.get(`/api/daily-sessions/?${params.toString()}`);
      setPastSessions(r.data.data || []);
    } catch {
      setPastSessions([]);
    }
  }

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadYesterdayAlert(); }, []);
  useEffect(() => { if (historyOpen) loadPastSessions(); }, [historyOpen, historySearch, historyStatus]);

  // Load invoice/return details when viewing a transaction
  useEffect(() => {
    if (!slideOver?.id) { setSlideOverDetails(null); return; }
    if (["pos_invoice", "installment_invoice", "credit_invoice"].includes(slideOver.doc_type)) {
      setSlideOverLoading(true);
      setSlideOverDetails(null);
      api.get("/api/invoices/" + slideOver.id)
        .then(r => setSlideOverDetails(r.data.data))
        .catch(() => setSlideOverDetails(null))
        .finally(() => setSlideOverLoading(false));
    } else if (slideOver.doc_type === "sales_return") {
      setSlideOverLoading(true);
      setSlideOverDetails(null);
      api.get("/api/invoices/returns/" + slideOver.id)
        .then(r => setSlideOverDetails(r.data.data))
        .catch(() => setSlideOverDetails(null))
        .finally(() => setSlideOverLoading(false));
    } else if (slideOver.doc_type === "purchase_return") {
      setSlideOverLoading(true);
      setSlideOverDetails(null);
      api.get("/api/purchases/returns/" + slideOver.id)
        .then(r => setSlideOverDetails(r.data.data))
        .catch(() => setSlideOverDetails(null))
        .finally(() => setSlideOverLoading(false));
    } else if (slideOver.doc_type === "purchase") {
      setSlideOverLoading(true);
      setSlideOverDetails(null);
      api.get("/api/purchases/" + slideOver.id)
        .then(r => setSlideOverDetails(r.data.data))
        .catch(() => setSlideOverDetails(null))
        .finally(() => setSlideOverLoading(false));
    } else {
      setSlideOverDetails(null);
    }
  }, [slideOver]);

  useEffect(() => {
    api.get("/api/expenses/categories").then(r => setExpenseCategories(r.data.data || [])).catch(() => { });
    api.get("/api/revenues/categories").then(r => setRevenueCategories(r.data.data || [])).catch(() => { });
    api.get("/api/withdrawals/categories").then(r => setWithdrawalCategories(r.data.data || [])).catch(() => { });
  }, []);

  const moneyTotal = DENOMS.reduce((s, d) => s + Number(counts[d] || 0) * d, 0);
  const sess = summary?.session;
  const expected = summary?.expected_cash ?? 0;
  const discrepancy = summary?.discrepancy;

  async function handleQuickSave() {
    if (!quickAmount) return;
    if (!quickCategoryId) { toast.error("يرجى اختيار الفئة أولاً"); return; }
    try {
      if (quickModal === "expense") {
        await api.post("/api/expenses", {
          amount: Number(quickAmount),
          description: quickNote,
          category_id: Number(quickCategoryId),
          payment_method: "cash",
        });
      } else {
        await api.post("/api/revenues", {
          amount: Number(quickAmount),
          description: quickNote,
          category_id: Number(quickCategoryId),
          payment_method: "cash",
        });
      }
      toast.success(quickModal === "expense" ? "تم تسجيل المصروف بنجاح" : "تم تسجيل الإيراد بنجاح");
      setQuickModal(null);
      setQuickAmount("");
      setQuickNote("");
      setQuickCategoryId("");
      loadSummary();
      loadTransactions();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    }
  }

  async function handleWithdrawalSave() {
    if (!withdrawalAmount) return;
    if (!withdrawalCategoryId) { toast.error("يرجى اختيار التصنيف أولاً"); return; }
    try {
      await api.post("/api/withdrawals", {
        amount: Number(withdrawalAmount),
        note: withdrawalNote,
        category_id: Number(withdrawalCategoryId),
        payment_method: withdrawalPaymentMethod,
      });
      toast.success("تم تسجيل المسحوبات بنجاح");
      setWithdrawalOpen(false);
      setWithdrawalAmount("");
      setWithdrawalNote("");
      setWithdrawalCategoryId("");
      setWithdrawalPaymentMethod("cash");
      loadSummary();
      loadTransactions();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    }
  }

  async function handleForceCloseYesterday() {
    setClosingYesterday(true);
    try {
      await api.post("/api/daily-sessions/yesterday/force-close");
      toast.success("تم إغلاق يوم أمس بالقوة");
      setYesterdayAlert(null);
      loadSummary(); // Refresh today's opening balance
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setClosingYesterday(false);
    }
  }

  function handlePrint() {
    setPrintOpen(true);
  }

  const sortedTransactions = transactions;
  const txTotal = sortedTransactions.reduce((s, t) => s + Number(t.cash_effect ?? t.amount ?? 0), 0);
  const draftDiscrepancy = actualCash !== "" ? Number(actualCash || 0) - Number(expected || 0) : null;
  const cashIn = Number(summary?.cash_in || 0);
  const cashOut = Number(summary?.cash_out || 0);
  const cashInRows = [
    { id: "pos_cash_sales", label: "نقد من مبيعات POS", value: summary?.pos_cash_sales, tab: "pos", matchTx: (t) => t.doc_type === "pos_invoice" && t.payment_type === "cash" },
    { id: "pos_installments", label: "نقد من أقساط (دفعة أولى أو لاحقة)", value: summary?.pos_installment_cash, tab: "pos", matchTx: (t) => t.doc_type === "installment_invoice" || (t.doc_type === "pos_invoice" && t.payment_type === "installments") },
    { id: "pos_multi_cash", label: "نقد من دفع متعدد", value: summary?.pos_multi_cash, tab: "pos", matchTx: (t) => t.doc_type === "pos_invoice" && t.payment_type === "multi" },
    { id: "customer_collections", label: "نقد تم تحصيله من العملاء", value: summary?.customer_cash_collections ?? (Number(summary?.customer_payments || 0) + Number(summary?.ajal_payments || 0)), tab: "customer_cash_collections", matchTx: (t) => ["customer_payment", "ajal_payment"].includes(t.doc_type) },
    { id: "revenues_cash", label: "إيرادات نقدية", value: summary?.revenues_cash, tab: "revenues", matchTx: (t) => t.doc_type === "revenue" },
    { id: "purchase_returns_cash", label: "نقد مسترد من مرتجعات الشراء", value: summary?.purchase_returns_cash, tab: "purchase_returns", matchTx: (t) => t.doc_type === "purchase_return" && Number(t.cash_effect ?? 0) !== 0 },
  ];
  const cashOutRows = [
    { id: "supplier_cash_payments", label: "نقد مدفوع للموردين", value: summary?.supplier_cash_payments ?? (Number(summary?.supplier_payments || 0) + Number(summary?.supplier_ajal_payments || 0)), tab: "supplier_cash_payments", matchTx: (t) => t.doc_type === "supplier_payment" },
    { id: "expenses_cash", label: "مصروفات نقدية", value: summary?.expenses_cash, tab: "expenses", matchTx: (t) => t.doc_type === "expense" },
    { id: "sales_returns_cash", label: "نقد مدفوع لمرتجعات المبيعات", value: summary?.sales_returns_cash, tab: "sales_returns", matchTx: (t) => t.doc_type === "sales_return" && Number(t.cash_effect ?? 0) !== 0 },
    { id: "withdrawals", label: "مسحوبات من الخزنة", value: summary?.withdrawals, tab: "withdrawals", matchTx: (t) => t.doc_type === "withdrawal" },
  ];
  const netCreditSales = (summary?.pos_credit_sales || 0) - (summary?.pos_installment_cash || 0) + (summary?.multi_credit_portion || 0);
  const nonCashRows = [
    { id: "pos_credit_sales", label: "مبيعات آجلة زادت دين العملاء (صافي)", value: netCreditSales, tab: "pos", matchTx: (t) => t.doc_type === "credit_invoice" || t.doc_type === "installment_invoice" || (t.doc_type === "pos_invoice" && (t.payment_type === "credit" || t.payment_type === "installments" || (t.payment_type === "multi" && (t.payment_splits || "").includes("credit:")))) },
    { id: "sales_returns_account", label: "مرتجعات مبيعات زادت دين العملاء", value: summary?.sales_returns_account, tab: "sales_returns", matchTx: (t) => t.doc_type === "sales_return" && (Number(t.cash_effect ?? 0) === 0 || Number(t.credit_amount ?? 0) > 0) },
    { id: "purchases_payable", label: "مشتريات آجلة زادت دين الموردين", value: summary?.purchases_payable_total, tab: "purchases", matchTx: (t) => t.doc_type === "purchase" && t.payment_type !== "cash" && t.payment_type !== "bank_transfer" },
    { id: "purchase_returns_payable", label: "مرتجعات شراء خصمت من دين الموردين", value: summary?.purchase_returns_payable_total, tab: "purchase_returns", matchTx: (t) => t.doc_type === "purchase_return" && (Number(t.cash_effect ?? 0) === 0 || Number(t.credit_amount ?? 0) > 0) },
    { id: "non_cash_movements", label: "مبيعات POS بطرق دفع إلكترونية وبنكية", value: summary?.non_cash_movements_total ?? summary?.pos_bank_sales, tab: "all", matchTx: (t) => t.doc_type === "pos_invoice" && !["cash", "installments", "credit"].includes(t.payment_type) },
  ];
  const allEquationRows = [...cashInRows, ...cashOutRows, ...nonCashRows];
  const activeEquationRow = activeEquationRowId ? allEquationRows.find(r => r.id === activeEquationRowId) : null;
  const discrepancySuggestions = (() => {
    const diff = draftDiscrepancy ?? discrepancy;
    if (diff == null || Math.abs(diff) < 0.01) return ["الرصيد متطابق. راجع آخر حركة فقط قبل الاعتماد."];
    const abs = fmt(Math.abs(diff));
    if (diff < 0) return [
      `يوجد عجز ${abs} ج.م. راجع المصروفات والمسحوبات ومدفوعات الموردين المسجلة اليوم.`,
      "قارن آخر فواتير POS النقدية مع درج النقد، وتأكد من عدم تسجيل تحصيل كاش كبنك أو العكس.",
    ];
    return [
      `يوجد زيادة ${abs} ج.م. ابحث عن إيراد أو تحصيل عميل غير مسجل.`,
      "راجع مرتجعات المبيعات لأن أي رد نقدي ناقص التسجيل يظهر كزيادة في الدرج.",
    ];
  })();

  async function reopenDay() {
    setReopening(true);
    try {
      await api.post(`/api/daily-sessions/${date}/reopen`, { reason: reopenReason });
      toast.success("تمت إعادة فتح اليومية");
      setReopenReason("");
      loadSummary();
      loadPastSessions();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذر إعادة فتح اليومية");
    } finally {
      setReopening(false);
    }
  }

  function refreshAfterFinanceModal() {
    loadSummary();
    loadTransactions();
    loadYesterdayAlert();
  }

  // Calculator functions
  function calcInput(val) {
    if (calcNew) {
      setCalcDisplay(val);
      setCalcNew(false);
    } else {
      setCalcDisplay(calcDisplay === "0" ? val : calcDisplay + val);
    }
  }

  function calcDecimal() {
    if (calcNew) {
      setCalcDisplay("0.");
      setCalcNew(false);
    } else if (!calcDisplay.includes(".")) {
      setCalcDisplay(calcDisplay + ".");
    }
  }

  function calcClear() {
    setCalcDisplay("0");
    setCalcPrev(null);
    setCalcOp(null);
    setCalcNew(true);
  }

  function calcOperator(op) {
    const current = parseFloat(calcDisplay);
    if (calcPrev !== null && calcOp && !calcNew) {
      const result = calcCompute(calcPrev, current, calcOp);
      setCalcDisplay(String(result));
      setCalcPrev(result);
    } else {
      setCalcPrev(current);
    }
    setCalcOp(op);
    setCalcNew(true);
  }

  function calcCompute(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : 0;
      default: return b;
    }
  }

  function calcEquals() {
    if (calcPrev === null || !calcOp) return;
    const current = parseFloat(calcDisplay);
    const result = calcCompute(calcPrev, current, calcOp);
    setCalcDisplay(String(result));
    setCalcPrev(null);
    setCalcOp(null);
    setCalcNew(true);
  }

  function calcPercent() {
    const current = parseFloat(calcDisplay);
    setCalcDisplay(String(current / 100));
    setCalcNew(true);
  }

  function calcNegate() {
    const current = parseFloat(calcDisplay);
    setCalcDisplay(String(-current));
  }

  useEffect(() => {
    return () => { if (clickedTxTimerRef.current) clearTimeout(clickedTxTimerRef.current); };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") { setActiveEquationRowId(null); setTxAffects(null); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleEquationRowClick(row) {
    if (!row) return;
    setActiveTab(row.tab);
    setGlobalAmountSearch("");
    setActiveEquationRowId(row.id);
    setTxAffects(null);
    setTimeout(() => txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function handleTransactionClick(tx) {
    const affects = getEquationRowAffects(tx);
    setActiveEquationRowId(null);
    setTxAffects(affects.length > 0 ? affects : null);
    if (affects.length > 0) {
      setTimeout(() => equationRowRefs.current[affects[0].id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
    setClickedTxId(tx.id);
    if (clickedTxTimerRef.current) clearTimeout(clickedTxTimerRef.current);
    clickedTxTimerRef.current = setTimeout(() => setClickedTxId(null), 1500);
  }

  // Animation variants
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl" onClick={() => { setActiveEquationRowId(null); setTxAffects(null); }}>
      {/* Impeccable Animated Architectural Background */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Base Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        {/* Cinematic Shimmer Sweep */}
        <motion.div
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 mix-blend-overlay"
        />
        {/* Center Spotlight / Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_30%,transparent_0%,rgba(248,250,252,0.95)_100%)]" />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-6 pb-4 px-6 shrink-0">
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex flex-col items-start justify-center">
            <motion.div variants={fadeInUp} className="flex items-center gap-2 text-slate-400 mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] font-mono">المالية // تسوية ومراجعة الحركات</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-3xl md:text-4xl font-black text-zinc-950 tracking-tighter">
              الخزينة اليومية
            </motion.h1>
          </div>

          <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-slate-100/50">
            <div className="relative">
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => { setDate(e.target.value); setActiveTab("all"); }}
                className="h-10 rounded-xl border border-slate-200 bg-white/50 px-3 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
              />
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setDate(todayStr()); setActiveTab("all"); setGlobalAmountSearch(""); }}
              className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-[12px] font-black transition-colors ${isToday ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >
              <Calendar className="h-3.5 w-3.5" /> اليوم
            </motion.button>

            <div className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border ${isClosed ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"}`}>
              {isClosed ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="text-[13px] font-black">{isClosed ? "مغلق" : "مفتوح"}</span>
            </div>

            <label className="flex items-center gap-1.5 h-10 cursor-pointer rounded-xl border border-slate-200 px-3 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors select-none">
              <input
                type="checkbox"
                className="accent-emerald-600 h-3.5 w-3.5 rounded"
                checked={compareYesterday}
                onChange={(e) => setCompareYesterday(e.target.checked)}
              />
              مقارنة بالأمس
            </label>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setHistoryOpen(true); loadPastSessions(); }}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] font-black text-white hover:bg-slate-800 transition-colors shadow-md shadow-slate-900/10"
            >
              <History className="h-3.5 w-3.5 text-emerald-400" /> الأيام السابقة
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadSummary}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePrint}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> طباعة
            </motion.button>
          </motion.div>
        </motion.div>
      </header>

      {/* Main Grid Layout (AIDA: Interest & Action) */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-6 pb-24">
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="flex flex-col gap-3"
        >
          {/* Smart Alerts Banner */}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
                <span className="text-[14px] font-black text-slate-400">جاري تحميل بيانات الخزينة...</span>
              </div>
            </div>
          ) : !sess ? (
            <div className="flex items-center justify-center h-64 rounded-3xl border border-dashed border-slate-300 bg-white/50 backdrop-blur-md">
              <span className="text-[15px] font-black text-slate-400">لا توجد جلسة مفتوحة لهذا اليوم.</span>
            </div>
          ) : (
            <>
              {/* Read-only notice for historical days or closed today */}
              {(isClosed || !isToday) && (
                <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-blue-500" />
                    <span className="text-[13px] font-black text-blue-800">
                      {isToday && isClosed
                        ? "اليومية مغلقة. يمكنك إعادة فتحها إذا أُغلقت بالخطأ."
                        : `عرض يوم ${date} للقراءة والمراجعة.`}
                    </span>
                  </div>
                  {/* Show reopen button for closed today OR for latest closed historical day */}
                  {isClosed && (() => {
                    // Check if this is the latest closed day (no later session exists)
                    const hasLaterSession = pastSessions.some(s => s.date > date);
                    const canReopen = isToday || !hasLaterSession;
                    return canReopen ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="سبب إعادة الفتح"
                          className="h-9 w-48 rounded-xl border border-blue-200 bg-white px-3 text-[11px] font-bold outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={reopenDay}
                          disabled={reopening || !reopenReason.trim()}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-700 px-3 text-[11px] font-black text-white hover:bg-blue-800 disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> إعادة فتح
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-blue-600">لا يمكن إعادة فتح هذا اليوم لأن هناك أيام أحدث موجودة.</span>
                    );
                  })()}
                </motion.div>
              )}

              {/* Quick Actions (If open and today) */}
              {isToday && !isClosed && (
                <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setQuickModal("expense")}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-rose-600 py-4 text-[14px] font-black text-white hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 border border-rose-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><TrendingDown className="h-4 w-4" /></div>
                    تسجيل مصروف سريع
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setQuickModal("revenue")}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-4 text-[14px] font-black text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 border border-emerald-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><TrendingUp className="h-4 w-4" /></div>
                    تسجيل إيراد سريع
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setWithdrawalOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-slate-900 py-4 text-[14px] font-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 border border-slate-800"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Banknote className="h-4 w-4" /></div>
                    تسجيل مسحوبات سريع
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMoneyOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-blue-600 py-4 text-[14px] font-black text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 border border-blue-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Coins className="h-4 w-4" /></div>
                    عد العملة (جرد الخزينة)
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCalcOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-indigo-600 py-4 text-[14px] font-black text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 border border-indigo-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Calculator className="h-4 w-4" /></div>
                    آلة حاسبة
                  </motion.button>
                </motion.div>
              )}

              {/* Calculator button for closed/historical days */}
              {(isClosed || !isToday) && (
                <motion.div variants={fadeInUp} className="flex justify-end">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCalcOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[12px] font-black text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <Calculator className="h-4 w-4" />
                    آلة حاسبة
                  </motion.button>
                </motion.div>
              )}

              {/* KPI Cards */}
              <motion.div data-help="shift-section" variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: "إجمالي المبيعات",
                    value: summary?.pos_all_sales,
                    yesterday: summary?.yesterday?.pos_all_sales,
                    icon: TrendingUp,
                    color: "emerald",
                  },
                  {
                    label: "إجمالي المصروفات",
                    value: summary?.expenses_cash,
                    yesterday: summary?.yesterday?.expenses_cash,
                    icon: TrendingDown,
                    color: "rose",
                  },
                  {
                    label: "صافي اليوم",
                    value: (summary?.cash_in || 0) - (summary?.cash_out || 0),
                    icon: Wallet,
                    color: "blue",
                  },
                  {
                    label: "الفرق (عجز/زيادة)",
                    value: discrepancy,
                    icon: Calculator,
                    color: discrepancy == null ? "slate" : discrepancy >= 0 ? "emerald" : "rose",
                  },
                ].map(({ label, value, yesterday, icon: Icon, color }) => (
                  <div key={label} className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                    <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-${color}-50/50 blur-xl group-hover:bg-${color}-100/50 transition-colors`}></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">{label}</span>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-${color}-50 text-${color}-600 ring-1 ring-inset ring-${color}-100 shadow-sm shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div>
                        <div className={`text-[22px] font-black font-mono tracking-tighter ${value != null && value < 0 ? "text-rose-600" : "text-zinc-900"}`}>
                          {value != null ? fmt(value) : "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">جنيه مصري</div>
                        {compareYesterday && yesterday != null && (
                          <div className="mt-2 text-[10px] text-slate-500 font-bold border-t border-slate-100/80 pt-2 flex items-center justify-between">
                            <span>بالأمس:</span>
                            <span className="font-mono">{fmt(yesterday)} ج.م</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>

              <div className="flex flex-col gap-6">
                {/* ═══════════════════════════════════════ */}
                {/*  معادلة الخزينة  -  MAIN FOCUS         */}
                {/* ═══════════════════════════════════════ */}
                <motion.div data-help="stats-cards" ref={equationSectionRef} variants={fadeInUp} onClick={(e) => e.stopPropagation()}>
                  <div className="rounded-3xl bg-white border border-slate-200/80 shadow-lg overflow-hidden">
                    {/* Prominent Header */}
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center ring-2 ring-inset ring-indigo-200 shadow-sm">
                        <Calculator className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[22px] font-black text-zinc-900 leading-tight">معادلة الخزينة</h3>
                        <p className="text-[13px] font-bold text-slate-500 mt-1">الرصيد المتوقع = الرصيد السابق + الداخل النقدي − الخارج النقدي</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Left: Breakdown (3 cols) */}
                        <div className="lg:col-span-3 space-y-4">
                          {/* Opening Balance */}
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                                <Lock className="h-5 w-5" />
                              </div>
                              <span className="text-[15px] font-black text-slate-700">رصيد سابق</span>
                            </div>
                            <span className="text-[22px] font-black font-mono text-zinc-900">{fmt(summary?.previous_balance ?? summary?.opening_balance)} <span className="text-[12px] text-slate-400">ج.م</span></span>
                          </div>

                          {/* Cash In */}
                          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                                <span className="text-[15px] font-black text-emerald-800">الداخل النقدي</span>
                              </div>
                              <span className="text-[24px] font-black font-mono text-emerald-700">+ {fmt(cashIn)}</span>
                            </div>
                            <div className="space-y-2">
                              {cashInRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActiveRev = !!affect;
                                const isActive = isActiveFwd || isActiveRev;
                                return (
                                  <button
                                    type="button"
                                    key={row.id}
                                    ref={el => { equationRowRefs.current[row.id] = el; }}
                                    onClick={() => handleEquationRowClick(row)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition-all border ${isActive
                                        ? "bg-emerald-100 ring-2 ring-emerald-400 border-emerald-300 scale-[1.01]"
                                        : txAffects ? "bg-white/40 border-emerald-100/30 opacity-40" : "bg-white/60 border-emerald-100/50 hover:bg-emerald-100/60"
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                      <span className="text-[13px] text-slate-700 font-bold">{row.label}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className={`font-black text-[14px] font-mono transition-all ${isActive ? "text-emerald-900 bg-emerald-200 ring-2 ring-emerald-500 rounded-lg px-2 py-0.5" : "text-emerald-700"
                                        }`}>{fmt(row.value)}</span>
                                      {affect && (
                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                          ← هذه الحركة: {fmt(affect.amount)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Cash Out */}
                          <div className="rounded-2xl bg-rose-50/80 border border-rose-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/30" />
                                <span className="text-[15px] font-black text-rose-800">الخارج النقدي</span>
                              </div>
                              <span className="text-[24px] font-black font-mono text-rose-700">− {fmt(cashOut)}</span>
                            </div>
                            <div className="space-y-2">
                              {cashOutRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActive = isActiveFwd || !!affect;
                                return (
                                  <button
                                    type="button"
                                    key={row.id}
                                    ref={el => { equationRowRefs.current[row.id] = el; }}
                                    onClick={() => handleEquationRowClick(row)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition-all border ${isActive
                                        ? "bg-rose-100 ring-2 ring-rose-400 border-rose-300 scale-[1.01]"
                                        : txAffects ? "bg-white/40 border-rose-100/30 opacity-40" : "bg-white/60 border-rose-100/50 hover:bg-rose-100/60"
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-2 rounded-full bg-rose-400" />
                                      <span className="text-[13px] text-slate-700 font-bold">{row.label}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className={`font-black text-[14px] font-mono transition-all ${isActive ? "text-rose-900 bg-rose-200 ring-2 ring-rose-500 rounded-lg px-2 py-0.5" : "text-rose-700"
                                        }`}>{fmt(row.value)}</span>
                                      {affect && (
                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                          ← هذه الحركة: {fmt(affect.amount)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Non-cash */}
                          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                            <div className="mb-2 text-[13px] font-black text-slate-600">حركات لا تؤثر على الخزنة نقدياً</div>
                            <div className="space-y-1">
                              {nonCashRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActive = isActiveFwd || !!affect;
                                return (
                                  <button
                                    type="button"
                                    key={row.id}
                                    ref={el => { equationRowRefs.current[row.id] = el; }}
                                    onClick={() => handleEquationRowClick(row)}
                                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-right transition-all ${isActive
                                        ? "bg-slate-200 ring-2 ring-slate-400 scale-[1.01]"
                                        : txAffects ? "opacity-40" : "hover:bg-white"
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Lock className="h-3.5 w-3.5 text-slate-300" />
                                      <span className="text-[12px] font-bold text-slate-500">{row.label}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span className={`font-black text-[13px] font-mono transition-all ${isActive ? "text-slate-900 bg-slate-300 ring-2 ring-slate-500 rounded-lg px-2 py-0.5" : "text-slate-600"
                                        }`}>{fmt(row.value)}</span>
                                      {affect && (
                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                          ← هذه الحركة: {fmt(affect.amount)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Right: Expected & Close (2 cols) */}
                        <div className="lg:col-span-2 flex flex-col gap-5">
                          {/* Big Expected Amount */}
                          <div className="flex-1 rounded-3xl bg-slate-900 text-white p-8 flex flex-col justify-center items-center text-center shadow-xl shadow-slate-900/20">
                            <div className="text-[14px] font-bold text-slate-400 mb-3 uppercase tracking-widest">المتوقع في الخزنة</div>
                            <div className="text-[40px] font-black font-mono tracking-tighter leading-none">{fmt(expected)}</div>
                            <div className="text-[14px] font-bold text-slate-500 mt-3">جنيه مصري</div>

                            {sess.actual_cash != null && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={"mt-6 w-full rounded-2xl p-4 border text-center " + (discrepancy >= 0 ? "bg-emerald-500/20 border-emerald-500/30" : "bg-rose-500/20 border-rose-500/30")}
                              >
                                <div className="text-[12px] font-bold text-slate-400 mb-1">الرصيد الفعلي المُغلق</div>
                                <div className="text-[24px] font-black font-mono">{fmt(sess.actual_cash)}</div>
                                <div className={"text-[13px] font-black mt-1 " + (discrepancy >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                  الفرق: {discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)} ج.م
                                </div>
                              </motion.div>
                            )}
                          </div>

                          {/* الرصيد الفعلي — always visible, no close action */}
                          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                            <h4 className="text-[16px] font-black text-zinc-900 mb-4 flex items-center gap-2">
                              <Lock className="h-5 w-5 text-slate-600" /> إدخال الرصيد الفعلي
                            </h4>
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-black text-slate-700">الرصيد الفعلي (ج.م)</label>
                                <div className="flex gap-3">
                                  <input
                                    type="number"
                                    value={actualCash}
                                    onChange={(e) => setActualCash(e.target.value)}
                                    className="flex-1 h-14 bg-slate-50 rounded-2xl px-5 text-[20px] font-black text-zinc-900 outline-none transition-all placeholder:text-slate-300 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center font-mono"
                                    placeholder="0.00"
                                  />
                                  <SmartTooltip content="فتح آلة عد العملات">
                                    <motion.button
                                      whileHover={{ y: -1 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => setMoneyOpen(true)}
                                      className="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                                    >
                                      <Coins className="h-5 w-5" />
                                    </motion.button>
                                  </SmartTooltip>
                                </div>
                              </div>
                              {actualCash && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={"text-center rounded-2xl py-3 px-4 text-[14px] font-black border " + (Number(actualCash) - expected >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700")}
                                >
                                  الفرق: {Number(actualCash) - expected >= 0 ? "+" : ""}{fmt(Number(actualCash) - expected)} ج.م
                                </motion.div>
                              )}
                              {actualCash && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="mb-2 flex items-center gap-2 text-[12px] font-black text-slate-700">
                                    <Sparkles className="h-4 w-4 text-amber-500" /> مساعد العجز والزيادة
                                  </div>
                                  <div className="space-y-1">
                                    {discrepancySuggestions.map((tip, idx) => (
                                      <div key={idx} className="text-[12px] font-bold text-slate-500 leading-5">• {tip}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-black uppercase tracking-widest text-slate-500">ملاحظات</label>
                                <textarea
                                  value={closeNotes}
                                  onChange={(e) => setCloseNotes(e.target.value)}
                                  className="w-full h-16 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-[13px] font-bold text-zinc-800 outline-none resize-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 placeholder:text-slate-300 transition-all"
                                  placeholder="ملاحظات حول الرصيد..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ═══════════════════════════════════════ */}
                {/*  حركات اليوم  -  TRANSACTIONS          */}
                {/* ═══════════════════════════════════════ */}
                <motion.div ref={txSectionRef} variants={fadeInUp} className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>

                  {/* Search Bar */}
                  <div data-help="search-bar" className="relative group w-full">
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-zinc-900 transition-colors" />
                    <input
                      value={globalAmountSearch}
                      onChange={(e) => { setGlobalAmountSearch(e.target.value); if (e.target.value) setActiveTab("all"); }}
                      placeholder="البحث الشامل برقم الفاتورة، المبلغ، أو اسم العميل..."
                      className="w-full h-12 bg-white/80 backdrop-blur-xl rounded-2xl pr-12 pl-4 text-[13px] font-bold text-zinc-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-zinc-900/5 shadow-sm border border-slate-200/60 placeholder:text-slate-400"
                    />
                    {globalAmountSearch && (
                      <button onClick={() => setGlobalAmountSearch("")} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 bg-slate-100 rounded-full p-1 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Transaction Explorer */}
                  <div data-help="main-table" className="rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden flex-1">
                    {/* Tab bar */}
                    <div className="flex items-center gap-1.5 border-b border-slate-100/80 px-3 py-2 overflow-x-auto scrollbar-hide">
                      {TABS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTab(t.id); setGlobalAmountSearch(""); setActiveEquationRowId(null); setTxAffects(null); }}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${activeTab === t.id ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20" : "text-slate-500 hover:bg-slate-100"
                            }`}
                        >
                          {t.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 mr-auto shrink-0 pr-3">
                        <button
                          onClick={() => setShowCancelled(v => !v)}
                          className={`h-8 px-3 rounded-lg text-[11px] font-black border transition-colors ${showCancelled ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}
                        >
                          {showCancelled ? "إخفاء الملغيات" : "إظهار الملغيات"}
                        </button>
                        <div className="relative">
                          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                          <select
                            value={txSort}
                            onChange={(e) => setTxSort(e.target.value)}
                            className="h-8 rounded-lg bg-slate-50 border border-slate-200 pl-3 pr-8 text-[11px] font-black outline-none text-slate-600 focus:border-zinc-400 appearance-none cursor-pointer"
                          >
                            <option value="time_desc">الأحدث أولاً</option>
                            <option value="time_asc">الأقدم أولاً</option>
                            <option value="amount_desc">المبلغ (تنازلي)</option>
                            <option value="amount_asc">المبلغ (تصاعدي)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto relative p-2">
                      {txLoading ? (
                        <div className="flex items-center justify-center h-full min-h-[300px]">
                          <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                        </div>
                      ) : sortedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3">
                          <FileText className="h-10 w-10 text-slate-200" />
                          <span className="text-[13px] font-black">لا توجد حركات مسجلة في هذا التبويب</span>
                        </div>
                      ) : (
                        <table className="w-full text-right border-collapse">
                          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl shadow-[0_1px_0_0_#f1f5f9]">
                            <tr>
                              {["الكود", "النوع", "المبلغ", "الطرف / الوصف", "المستخدم", "الوقت", "إجراءات"].map((h, i) => (
                                <th key={h} className={`px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest select-none ${i === 0 ? 'rounded-tr-xl' : ''} ${i === 6 ? 'rounded-tl-xl' : ''}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                              {sortedTransactions.map((t) => (
                                <motion.tr
                                  key={t.id}
                                  layout
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  whileHover={{ x: -2 }}
                                  onClick={() => handleTransactionClick(t)}
                                  className={`group transition-all relative cursor-pointer ${clickedTxId === t.id
                                      ? "bg-blue-50 ring-1 ring-inset ring-blue-300"
                                      : txAffects
                                        ? ""
                                        : activeEquationRow
                                          ? activeEquationRow.matchTx(t)
                                            ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                                            : "opacity-30"
                                          : ""
                                    }`}
                                >
                                  <td className={`px-3 py-3 font-black text-[11px] tracking-wider ${t.is_cancelled ? "text-slate-300 line-through" : "text-slate-500"}`}>{t.doc_no || `#${t.id}`}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className={`inline-flex items-center justify-center rounded-lg border px-2 py-0.5 text-[9px] font-black ${
                                        (t.is_cancelled || t.doc_type === 'cancelled_invoice')
                                          ? "text-rose-700 bg-rose-50 border-rose-200 line-through opacity-60"
                                          : t.doc_type === "purchase"
                                            ? ({ cash: "text-emerald-700 bg-emerald-50 border-emerald-200", credit: "text-amber-700 bg-amber-50 border-amber-200", future_due: "text-amber-700 bg-amber-50 border-amber-200", multi: "text-indigo-700 bg-indigo-50 border-indigo-200", bank_transfer: "text-blue-700 bg-blue-50 border-blue-200" }[t.payment_type] || "text-orange-700 bg-orange-50 border-orange-200")
                                            : (DOC_TYPE_COLOR[t.doc_type] || "text-slate-600 bg-slate-100 border-slate-200")
                                      }`}>
                                        {t.doc_type === "purchase"
                                          ? ({ cash: "مشتريات نقدية", credit: "مشتريات آجلة", future_due: "مشتريات آجلة", multi: "مشتريات متعددة", bank_transfer: "مشتريات تحويل" }[t.payment_type] || "مشتريات")
                                          : (DOC_TYPE_LABEL[t.doc_type] || t.doc_type)}
                                      </span>
                                      {(t.is_cancelled || t.doc_type === 'cancelled_invoice') && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200">ملغي</span>
                                      )}
                                      {t.amended_by && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200" title={`عُدِّلت بواسطة: ${t.amended_by_no || t.amended_by}`}>
                                          مُعدَّلة {t.amended_by_no ? `← ${t.amended_by_no}` : ""}
                                        </span>
                                      )}
                                      {t.amendment_of && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200" title={`تعديل على: ${t.amendment_of_no || t.amendment_of}`}>
                                          تعديل {t.amendment_of_no ? `↑ ${t.amendment_of_no}` : "↑"}
                                        </span>
                                      )}
                                      {t.payment_type === "installments" && !t.is_cancelled && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-100 text-violet-700 border border-violet-200 animate-pulse">مقدم + قسط</span>
                                      )}
                                      {t.payment_type === "credit" && !t.is_cancelled && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200">كامل آجل</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-col gap-0.5">
                                      {/* Payment Cockpit for sales/purchase returns */}
                                      {["sales_return", "purchase_return"].includes(t.doc_type) && (() => {
                                        const cashAmt   = Number(t.cash_amount   || 0);
                                        const creditAmt = Number(t.credit_amount || 0);
                                        const total     = Number(t.amount        || 0);
                                        const isSalesReturn = t.doc_type === "sales_return";
                                        const isFromInvoice = isSalesReturn && !!t.invoice_id;
                                        return (
                                          <div className="flex items-stretch gap-0 bg-slate-50/80 border border-slate-200/80 rounded-xl overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] w-full">
                                            {/* Source badge */}
                                            {isSalesReturn && (
                                              <>
                                                <div className="flex flex-col items-end justify-center px-2.5 py-1.5 flex-1 min-w-0">
                                                  {isFromInvoice ? (
                                                    <>
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black bg-indigo-50 text-indigo-700 border-indigo-200 mb-0.5 whitespace-nowrap">
                                                        <FileText className="w-2.5 h-2.5" /> من فاتورة سابقة
                                                      </span>
                                                      <span className="text-[10px] font-black text-indigo-600 font-mono">{t.original_invoice_no}</span>
                                                    </>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                                                      <RotateCcw className="w-2.5 h-2.5" /> مرتجع مباشر
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="w-px self-stretch bg-slate-200/80" />
                                              </>
                                            )}
                                            {/* Total */}
                                            <div className="flex flex-col items-end justify-center px-2.5 py-1.5 min-w-[80px]">
                                              <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">إجمالي</span>
                                              <div className="text-[13px] font-black text-slate-800 font-mono leading-none">{fmt(total)}</div>
                                            </div>
                                            {cashAmt > 0.005 && (
                                              <>
                                                <div className="w-px self-stretch bg-slate-200/80" />
                                                <div className="flex flex-col items-end justify-center px-2.5 py-1.5 bg-emerald-50/80 min-w-[80px]">
                                                  <span className="text-[7px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                                                    {isSalesReturn ? "نقداً — صندوق" : "نقداً"}
                                                  </span>
                                                  <div className="text-[12px] font-black text-emerald-700 font-mono leading-none">{fmt(cashAmt)}</div>
                                                </div>
                                              </>
                                            )}
                                            {creditAmt > 0.005 && (
                                              <>
                                                <div className="w-px self-stretch bg-slate-200/80" />
                                                <div className="flex flex-col items-end justify-center px-2.5 py-1.5 bg-blue-50/80 min-w-[80px]">
                                                  <span className="text-[7px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-blue-500 inline-block" />
                                                    {isSalesReturn ? "رصيد حساب" : "ذمة مورد"}
                                                  </span>
                                                  <div className="text-[12px] font-black text-blue-700 font-mono leading-none">{fmt(creditAmt)}</div>
                                                </div>
                                              </>
                                            )}
                                            {cashAmt < 0.005 && creditAmt < 0.005 && (
                                              <>
                                                <div className="w-px self-stretch bg-slate-200/80" />
                                                <div className="flex flex-col items-end justify-center px-2.5 py-1.5 bg-slate-100/80 min-w-[80px]">
                                                  <span className="text-[7px] font-black text-slate-400 tracking-wider mb-0.5">صفر نقدي</span>
                                                  <span className="text-[8px] font-black text-slate-500">لا يؤثر على الحساب</span>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        );
                                      })()}
                                      {!["sales_return", "purchase_return"].includes(t.doc_type) && t.payment_type === "installments" && (
                                        <div className="flex flex-col gap-1 rounded-lg bg-violet-50 border border-violet-200 p-2">
                                          {t.payment_splits && t.payment_splits.split("|||").map((split, i) => {
                                            const colonIdx = split.lastIndexOf(":");
                                            const methodKey = split.slice(0, colonIdx);
                                            const amt = split.slice(colonIdx + 1);
                                            const isCash = methodKey === "cash";
                                            const isCredit = methodKey === "credit";
                                            return (
                                              <div key={i} className="flex items-center justify-between gap-2">
                                                <span className={`text-[9px] font-black ${isCash ? "text-emerald-700" : "text-amber-700"}`}>
                                                  {isCash ? "💰 نقداً (دفعة مقدم)" : "📋 آجل (قسط)"}
                                                </span>
                                                <span className={`text-[11px] font-black font-mono ${isCash ? "text-emerald-700" : "text-amber-700"}`}>
                                                  {fmt(Number(amt))}
                                                  {isCash && <span className="text-[8px] mr-1">← الخزنة</span>}
                                                  {isCredit && <span className="text-[8px] mr-1">← ذمة العميل</span>}
                                                </span>
                                              </div>
                                            );
                                          })}
                                          <div className="flex items-center justify-between border-t border-violet-200 pt-1 mt-0.5">
                                            <span className="text-[9px] font-black text-violet-700">إجمالي الفاتورة</span>
                                            <span className="text-[11px] font-black font-mono text-violet-700">{fmt(t.amount)}</span>
                                          </div>
                                        </div>
                                      )}
                                      {!["sales_return", "purchase_return"].includes(t.doc_type) && t.payment_type !== "installments" && (
                                        <>
                                          {(() => {
                                            const ce = Number(t.cash_effect ?? t.amount);
                                            const total = Number(t.amount ?? 0);
                                            const isZeroCash = ce === 0 && total > 0;
                                            return isZeroCash ? (
                                              <div className="flex flex-col gap-0.5">
                                                <span className="font-black font-mono text-[13px] text-slate-600">{fmt(total)}</span>
                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-slate-100 text-slate-400 border-slate-200 whitespace-nowrap self-start">
                                                  صفر نقدي — لا يؤثر على الحساب
                                                </span>
                                              </div>
                                            ) : (
                                              <span className={`font-black font-mono text-[12px] ${ce < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                                {ce > 0 ? "+" : ""}{fmt(ce)}
                                              </span>
                                            );
                                          })()}
                                          {t.payment_type === "multi" && t.amount !== t.cash_effect && Number(t.cash_effect ?? 0) !== 0 && (
                                            <span className="text-[9px] font-bold text-slate-400">إجمالي الفاتورة: {fmt(t.amount)}</span>
                                          )}
                                          {t.payment_splits && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {t.payment_splits.split("|||").map((split, i) => {
                                                const colonIdx = split.lastIndexOf(":");
                                                const methodKey = split.slice(0, colonIdx);
                                                const amt = split.slice(colonIdx + 1);
                                                const isCash = methodKey === "cash";
                                                const isCredit = methodKey === "credit";
                                                const label = isCash ? "نقداً" : isCredit ? "آجل" : (PAYMENT_METHOD_AR[methodKey] || methodKey);
                                                return (
                                                  <span key={i} className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${isCash ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isCredit ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                                    {label}: {fmt(Number(amt))}
                                                    {isCash && <span className="text-[7px] opacity-70 mr-0.5">← خزنة</span>}
                                                    {isCredit && <span className="text-[7px] opacity-70 mr-0.5">← آجل</span>}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                          {t.payment_method === "split" && (Number(t.cash_amount) > 0 || Number(t.credit_amount) > 0) && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {Number(t.cash_amount) > 0 && (
                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">
                                                  نقداً: {fmt(t.cash_amount)} <span className="text-[7px] opacity-70">← خزنة</span>
                                                </span>
                                              )}
                                              {Number(t.credit_amount) > 0 && (
                                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                  رصيد حساب: {fmt(t.credit_amount)} <span className="text-[7px] opacity-70">← حساب</span>
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-slate-600 text-[11px] font-bold max-w-[180px] truncate">
                                    {t.party || t.description || "—"}
                                  </td>
                                  <td className="px-3 py-3 text-slate-500 text-[10px] whitespace-nowrap font-bold">
                                    {t.seller_name || t.cancelled_by_name || "—"}
                                  </td>
                                  <td className="px-3 py-3 text-slate-400 text-[10px] whitespace-nowrap font-medium">
                                    {t.created_at
                                      ? new Date(t.created_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" })
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1.5 opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setSlideOver(t)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-zinc-900 hover:bg-slate-50 shadow-sm transition-all"
                                        title="عرض التفاصيل"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={handlePrint}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all"
                                        title="طباعة"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                          <tfoot className="sticky bottom-0 bg-white/95 backdrop-blur-xl shadow-[0_-1px_0_0_#f1f5f9]">
                            <tr>
                              <td className="px-3 py-3 font-black text-slate-500 uppercase tracking-widest text-[10px]" colSpan={2}>
                                الإجمالي للتبويب الحالي
                              </td>
                              <td className="px-3 py-3 font-black text-zinc-950 font-mono text-[13px]">
                                {fmt(txTotal)} ج.م
                              </td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                </motion.div>

              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* ── Modals & Drawers ── */}

      {/* Detail Modal */}
      <AnimatePresence>
        {slideOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 p-4 overflow-y-auto" dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-2xl bg-white shadow-2xl rounded-[2rem] flex flex-col overflow-hidden my-20 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">
                    {DOC_TYPE_LABEL[slideOver.doc_type] || "مستند مالية"}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold font-mono tracking-wider mt-0.5">{slideOver.doc_no || "#" + slideOver.id}</p>
                </div>
                <button onClick={() => { setSlideOver(null); setSlideOverDetails(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-[#fafafa]">
                {/* Header Summary */}
                <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden mb-4">
                  <div className={"p-4 text-center border-b border-slate-100 " + (DOC_TYPE_COLOR[slideOver.doc_type] || "bg-white")}>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">القيمة</div>
                    <div className="text-[28px] font-black font-mono leading-none tracking-tighter">
                      {fmt(slideOver.amount)}
                    </div>
                    <div className="text-[10px] font-bold mt-1 opacity-70">جنيه مصري</div>
                  </div>
                  <div className="p-2">
                    {[
                      { label: "الطرف ذو الصلة", value: slideOver.party || "—" },
                      { label: "الوصف / البيان", value: slideOver.description || slideOver.notes || "—" },
                      { label: "التصنيف", value: DOC_TYPE_LABEL[slideOver.doc_type] || slideOver.doc_type },
                      { label: "المستخدم", value: slideOver.seller_name || slideOver.cancelled_by_name || "—" },
                      {
                        label: "تاريخ ووقت التسجيل",
                        value: slideOver.created_at
                          ? new Date(slideOver.created_at).toLocaleString("en-US")
                          : "—",
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
                        <span className="text-[12px] font-bold text-zinc-900 text-right truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Cockpit + Lines for Sales/Purchase Return */}
                {["sales_return", "purchase_return"].includes(slideOver.doc_type) && (
                  <div className="flex flex-col gap-3 mb-4">
                    {/* Payment Cockpit Widget */}
                    {(() => {
                      const cashAmt   = Number(slideOver.cash_amount   || 0);
                      const creditAmt = Number(slideOver.credit_amount || 0);
                      const total     = Number(slideOver.amount        || 0);
                      const isSalesReturn = slideOver.doc_type === "sales_return";
                      return (
                        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-[12px] font-black text-slate-700">تفاصيل الاسترداد</span>
                          </div>
                          <div className="p-3 flex flex-wrap items-stretch gap-0 bg-slate-50/80 border-b border-slate-200/80">
                            {/* Total */}
                            <div className="flex flex-col items-end justify-center px-4 py-2.5 min-w-[110px]">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">إجمالي المرتجع</span>
                              <div className="text-[18px] font-black text-slate-800 font-mono leading-none">
                                {fmt(total)} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                              </div>
                            </div>
                            {cashAmt > 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-emerald-50/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    {isSalesReturn ? "نقداً — صندوق" : "نقداً مُستردّ"}
                                  </span>
                                  <div className="text-[16px] font-black text-emerald-700 font-mono leading-none">
                                    {fmt(cashAmt)} <span className="text-[10px] font-bold">ج.م</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {creditAmt > 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-blue-50/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                    {isSalesReturn ? "رصيد حساب العميل" : "خصم من ذمة المورد"}
                                  </span>
                                  <div className="text-[16px] font-black text-blue-700 font-mono leading-none">
                                    {fmt(creditAmt)} <span className="text-[10px] font-bold">ج.م</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {cashAmt < 0.005 && creditAmt < 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-slate-100/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5">صفر نقدي</span>
                                  <span className="text-[11px] font-black text-slate-500">لا يؤثر على الخزنة</span>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Metadata rows */}
                          <div className="divide-y divide-slate-50">
                            {isSalesReturn && slideOverDetails?.invoice_id && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">المصدر</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-200">
                                  <FileText className="w-3 h-3" /> من فاتورة سابقة
                                </span>
                              </div>
                            )}
                            {isSalesReturn && !slideOverDetails?.invoice_id && slideOverDetails && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">المصدر</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-amber-50 text-amber-700 border-amber-200">
                                  <RotateCcw className="w-3 h-3" /> مرتجع مباشر
                                </span>
                              </div>
                            )}
                            {(slideOver.description || slideOverDetails?.reason) && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">السبب</span>
                                <span className="text-[12px] font-bold text-zinc-900 text-right">
                                  {REASON_MAP[slideOver.description || slideOverDetails?.reason] || slideOver.description || slideOverDetails?.reason || "أخرى"}
                                </span>
                              </div>
                            )}
                            {slideOverDetails?.original_invoice_no && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">الفاتورة الأصلية</span>
                                <span className="text-[12px] font-black text-indigo-700 font-mono">{slideOverDetails.original_invoice_no}</span>
                              </div>
                            )}
                            {(slideOverDetails?.notes || slideOver.notes) && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">ملاحظات</span>
                                <span className="text-[12px] font-bold text-zinc-700 text-right truncate">{slideOverDetails?.notes || slideOver.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Return Lines */}
                    <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-[12px] font-black text-slate-700">الأصناف المرتجعة</span>
                      </div>
                      {slideOverLoading ? (
                        <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري تحميل التفاصيل...</div>
                      ) : slideOverDetails?.lines?.length ? (
                        <div className="divide-y divide-slate-100">
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <div className="col-span-5">الصنف</div>
                            <div className="col-span-2 text-center">الكمية</div>
                            <div className="col-span-2 text-center">السعر</div>
                            <div className="col-span-3 text-left">الإجمالي</div>
                          </div>
                          {slideOverDetails.lines.map((line, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50/50 transition-colors">
                              <div className="col-span-5 flex flex-col min-w-0">
                                <span className="text-[11px] font-black text-slate-800 truncate">{line.item_name || line.name}</span>
                                <span className="text-[9px] font-mono text-slate-400 truncate">{line.item_code || "#" + line.item_id}</span>
                              </div>
                              <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{line.quantity}</div>
                              <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{fmt(line.unit_price)}</div>
                              <div className="col-span-3 text-left font-mono text-[11px] font-black text-rose-700">{fmt(line.line_total || line.unit_price * line.quantity)}</div>
                            </div>
                          ))}
                          <div className="bg-slate-900 text-white px-3 py-3 flex justify-between text-[12px] font-black">
                            <span className="text-slate-400">الإجمالي</span>
                            <span className="font-mono">{fmt(slideOver.amount)} ج.م</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-[12px] text-slate-400">لا توجد تفاصيل متاحة</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Lines for POS Invoice */}
                {["pos_invoice", "installment_invoice", "credit_invoice"].includes(slideOver.doc_type) && (
                  <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-[12px] font-black text-slate-700">تفاصيل الفاتورة</span>
                    </div>
                    {slideOverLoading ? (
                      <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري تحميل التفاصيل...</div>
                    ) : slideOverDetails?.lines?.length ? (
                      <div className="divide-y divide-slate-100">
                        {/* Column Headers */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          <div className="col-span-5">الصنف</div>
                          <div className="col-span-2 text-center">الكمية</div>
                          <div className="col-span-2 text-center">السعر</div>
                          <div className="col-span-1 text-center">خصم</div>
                          <div className="col-span-2 text-left">الإجمالي</div>
                        </div>
                        {/* Lines */}
                        {slideOverDetails.lines.map((line, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50/50 transition-colors">
                            <div className="col-span-5 flex flex-col min-w-0">
                              <span className="text-[11px] font-black text-slate-800 truncate">{line.item_name || line.name}</span>
                              <span className="text-[9px] font-mono text-slate-400 truncate">{line.code || line.item_code || "#" + line.item_id}</span>
                            </div>
                            <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{line.quantity}</div>
                            <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{fmt(line.unit_price)}</div>
                            <div className="col-span-1 text-center font-mono text-[10px] font-bold text-amber-600">{line.line_discount || line.discount || "—"}</div>
                            <div className="col-span-2 text-left font-mono text-[11px] font-black text-emerald-700">{fmt((line.unit_price * line.quantity) - (line.line_discount || 0))}</div>
                          </div>
                        ))}
                        {/* Totals */}
                        <div className="bg-slate-900 text-white px-3 py-3">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-400">الفرعي</span>
                            <span className="font-mono">{fmt(slideOverDetails.subtotal)}</span>
                          </div>
                          {Number(slideOverDetails.discount) > 0 && (
                            <div className="flex justify-between text-[10px] font-bold mb-1">
                              <span className="text-slate-400">الخصم</span>
                              <span className="font-mono text-rose-300">- {fmt(slideOverDetails.discount)}</span>
                            </div>
                          )}
                          {Number(slideOverDetails.increase) > 0 && (
                            <div className="flex justify-between text-[10px] font-bold mb-1">
                              <span className="text-slate-400">الإضافة</span>
                              <span className="font-mono text-emerald-300">+ {fmt(slideOverDetails.increase)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[12px] font-black border-t border-slate-700 pt-2 mt-2">
                            <span>الإجمالي</span>
                            <span className="font-mono">{fmt(slideOverDetails.total)} ج.م</span>
                          </div>
                          {["multi", "installments", "credit"].includes(slideOverDetails.payment_type) && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">توزيع طرق الدفع</div>
                              <div className="flex flex-col gap-1.5">
                                {slideOverDetails.payment_type === "multi" && slideOverDetails.payments?.length > 0 && (
                                  slideOverDetails.payments.map((p, i) => {
                                    const isCash = p.method === "cash";
                                    return (
                                      <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${isCash ? "bg-emerald-900/40 border border-emerald-700/40" : "bg-slate-700/40 border border-slate-600/40"}`}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-black text-white">{p.method_name || arMethod(p.method)}</span>
                                          {!isCash && (
                                            <span className="text-[8px] font-bold text-slate-400 bg-slate-600/50 px-1.5 py-0.5 rounded">لا يؤثر على حساب الخزنة</span>
                                          )}
                                        </div>
                                        <span className={`font-mono text-[11px] font-black ${isCash ? "text-emerald-300" : "text-slate-300"}`}>{fmt(p.amount)} ج.م</span>
                                      </div>
                                    );
                                  })
                                )}
                                {slideOverDetails.payment_type === "installments" && (
                                  <>
                                    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-emerald-900/40 border border-emerald-700/40">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-white">💰 نقداً (دفعة مقدم)</span>
                                        <span className="text-[8px] font-bold text-emerald-300 bg-emerald-800/50 px-1.5 py-0.5 rounded">يضاف للخزنة</span>
                                      </div>
                                      <span className="font-mono text-[11px] font-black text-emerald-300">{fmt(Number(slideOverDetails.amount_received || 0))} ج.م</span>
                                    </div>
                                    {Number(slideOverDetails.total) > Number(slideOverDetails.amount_received || 0) && (
                                      <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-violet-900/40 border border-violet-700/40">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-black text-white">📋 آجل (قسط)</span>
                                          <span className="text-[8px] font-bold text-violet-300 bg-violet-800/50 px-1.5 py-0.5 rounded">يضاف لذمة العميل</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-black text-violet-300">{fmt(Number(slideOverDetails.total) - Number(slideOverDetails.amount_received || 0))} ج.م</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {slideOverDetails.payment_type === "credit" && (
                                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-amber-900/40 border border-amber-700/40">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-black text-white">📋 آجل (كامل المبلغ)</span>
                                      <span className="text-[8px] font-bold text-amber-300 bg-amber-800/50 px-1.5 py-0.5 rounded">يضاف لذمة العميل</span>
                                    </div>
                                    <span className="font-mono text-[11px] font-black text-amber-300">{fmt(slideOverDetails.total)} ج.م</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-[12px] text-slate-400">لا توجد تفاصيل متاحة</div>
                    )}
                  </div>
                )}

                {/* Purchase invoice detail */}
                {slideOver.doc_type === "purchase" && (
                  <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-[12px] font-black text-slate-700">تفاصيل فاتورة الشراء</span>
                    </div>
                    {slideOverLoading ? (
                      <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري تحميل التفاصيل...</div>
                    ) : slideOverDetails?.lines?.length ? (
                      <div className="divide-y divide-slate-100">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          <div className="col-span-6">الصنف</div>
                          <div className="col-span-2 text-center">الكمية</div>
                          <div className="col-span-2 text-center">التكلفة</div>
                          <div className="col-span-2 text-left">الإجمالي</div>
                        </div>
                        {slideOverDetails.lines.map((line, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50/50">
                            <div className="col-span-6 flex flex-col min-w-0">
                              <span className="text-[11px] font-black text-slate-800 truncate">{line.item_name_ar || line.item_name || line.name}</span>
                              <span className="text-[9px] font-mono text-slate-400 truncate">{line.item_code || line.code || line.barcode || "#" + line.item_id}</span>
                            </div>
                            <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{line.quantity}</div>
                            <div className="col-span-2 text-center font-mono text-[11px] font-bold text-slate-700">{fmt(line.unit_cost)}</div>
                            <div className="col-span-2 text-left font-mono text-[11px] font-black text-orange-700">{fmt(line.line_total || (line.unit_cost * line.quantity))}</div>
                          </div>
                        ))}
                        <div className="bg-slate-900 text-white px-3 py-3">
                          {Number(slideOverDetails.discount) > 0 && (
                            <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-400">الخصم</span><span className="font-mono text-rose-300">- {fmt(slideOverDetails.discount)}</span></div>
                          )}
                          {Number(slideOverDetails.increase) > 0 && (
                            <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-400">الإضافة</span><span className="font-mono text-emerald-300">+ {fmt(slideOverDetails.increase)}</span></div>
                          )}
                          <div className="flex justify-between text-[12px] font-black border-t border-slate-700 pt-2 mt-1">
                            <span>الإجمالي</span><span className="font-mono">{fmt(slideOverDetails.total)} ج.م</span>
                          </div>
                          {slideOverDetails.payment_method === "multi" && slideOverDetails.payments?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700 flex flex-col gap-1.5">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">توزيع طرق الدفع</div>
                              {slideOverDetails.payments.map((p, i) => {
                                const isCredit = p.method_type === "credit" || p.method_category === "credit";
                                return (
                                  <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${isCredit ? "bg-amber-900/40 border border-amber-700/40" : "bg-emerald-900/40 border border-emerald-700/40"}`}>
                                    <span className="text-[10px] font-black text-white">{p.method_name || arMethod(p.method)} {isCredit && <span className="text-[8px] text-amber-300">(آجل — ذمة المورد)</span>}</span>
                                    <span className={`font-mono text-[11px] font-black ${isCredit ? "text-amber-300" : "text-emerald-300"}`}>{fmt(p.amount)} ج.م</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(slideOverDetails.payment_method === "credit" || slideOverDetails.payment_method === "future_due") && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-amber-900/40 border border-amber-700/40">
                                <span className="text-[10px] font-black text-white">📋 آجل (كامل المبلغ — ذمة المورد)</span>
                                <span className="font-mono text-[11px] font-black text-amber-300">{fmt(slideOverDetails.total)} ج.م</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-[12px] text-slate-400">لا توجد تفاصيل متاحة</div>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 p-3 bg-white flex gap-2">
                {slideOver.doc_type === "purchase" && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSlideOver(null); setSlideOverDetails(null); navigate("/purchases/" + slideOver.id); }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-[12px] font-black text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح / تعديل الفاتورة
                  </motion.button>
                )}
                {["pos_invoice", "installment_invoice", "credit_invoice"].includes(slideOver.doc_type) && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open("/invoices/" + slideOver.id, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[12px] font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح الفاتورة الكاملة
                  </motion.button>
                )}
                {slideOver.doc_type === "sales_return" && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open("/pos/sales-returns/" + slideOver.id, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pink-600 py-2.5 text-[12px] font-black text-white hover:bg-pink-700 shadow-lg shadow-pink-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح المرتجع الكامل
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-950 py-2.5 text-[12px] font-black text-white hover:bg-zinc-800 shadow-lg shadow-zinc-950/20"
                >
                  <Printer className="h-3.5 w-3.5" /> طباعة
                </motion.button>
              </div>
            </motion.div>
            <div
              className="fixed inset-0 -z-10 bg-slate-900/50 backdrop-blur-md"
              onClick={() => { setSlideOver(null); setSlideOverDetails(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* History Modal */}
      <AnimatePresence>
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
            <motion.div variants={modalVariants} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-100 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><History className="h-5 w-5" /></div>
                  <div><h2 className="text-[18px] font-black text-zinc-900">سجل اليوميات السابقة</h2><p className="text-[11px] font-bold text-slate-400">بحث، فلترة، ومعاينة مركزية بدون درج جانبي</p></div>
                </div>
                <button onClick={() => setHistoryOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3">
                <div className="relative flex-1 min-w-[240px]"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="بحث بتاريخ اليوم أو ملاحظات الإغلاق" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-[12px] font-bold outline-none focus:border-indigo-500 focus:bg-white" /></div>
                <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600 outline-none focus:border-indigo-500"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="closed">مغلق</option></select>
                <button onClick={() => { setHistorySearch(""); setHistoryStatus(""); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-500 hover:bg-slate-50">مسح الفلاتر</button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[#fafafa]">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-right">
                  <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">افتتاحي</th><th className="px-3 py-2">فعلي</th><th className="px-3 py-2">ختامي</th><th className="px-3 py-2">عجز / زيادة</th><th className="px-3 py-2">إجراءات</th></tr></thead>
                  <tbody>
                    {pastSessions.map((s) => (
                      <tr key={s.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                        <td className="rounded-r-2xl px-3 py-3 font-black text-zinc-900">{s.date}</td>
                        <td className="px-3 py-3"><span className={"inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-black " + (s.status === "closed" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700")}>{s.status === "closed" ? <Lock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{s.status === "closed" ? "مغلق" : "مفتوح"}</span></td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{fmt(s.opening_balance)}</td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{s.actual_cash == null ? "—" : fmt(s.actual_cash)}</td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{s.closing_balance == null ? "—" : fmt(s.closing_balance)}</td>
                        <td className={"px-3 py-3 font-mono text-[12px] font-black " + (Number(s.discrepancy || 0) < 0 ? "text-rose-600" : "text-emerald-600")}>{s.discrepancy == null ? "—" : fmt(s.discrepancy)}</td>
                        <td className="rounded-l-2xl px-3 py-3"><button onClick={() => { setDate(s.date); setHistoryOpen(false); setActiveTab("all"); }} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] font-black text-white hover:bg-slate-800"><Eye className="h-3.5 w-3.5" /> معاينة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pastSessions.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3"><History className="h-8 w-8 text-slate-200" /><span className="text-[13px] font-black">لا توجد يوميات مطابقة</span></div>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Modal (Expense/Revenue) */}
      <AnimatePresence>
        {quickModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setQuickModal(null)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-white shadow-2xl p-8 border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={"h-12 w-12 rounded-2xl flex items-center justify-center border " + (quickModal === "expense" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                    {quickModal === "expense" ? <TrendingDown className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-zinc-900 leading-tight">
                      {quickModal === "expense" ? "تسجيل مصروف" : "تسجيل إيراد"}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Quick Entry</p>
                  </div>
                </div>
                <button onClick={() => setQuickModal(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900 hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">القيمة (ج.م)</label>
                  <input
                    type="number"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 px-4 text-[20px] font-black font-mono outline-none focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">البيان / الوصف</label>
                  <input
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="سبب المعاملة..."
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 px-4 text-[14px] font-bold text-zinc-800 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">الفئة</label>
                  <select
                    value={quickCategoryId}
                    onChange={(e) => setQuickCategoryId(e.target.value)}
                    className={`w-full h-12 rounded-2xl bg-white border px-4 text-[13px] font-bold text-zinc-800 outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none ${!quickCategoryId ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-zinc-400"}`}
                    required
                  >
                    <option value="">— اختر الفئة (مطلوب) —</option>
                    {(quickModal === "expense" ? expenseCategories : revenueCategories).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleQuickSave}
                    disabled={!quickAmount || !quickCategoryId}
                    className={"w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-black text-white transition-all shadow-xl disabled:opacity-40 " + (quickModal === "expense" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20")}
                  >
                    <CheckCircle2 className="h-5 w-5" /> حفظ واعتماد
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {withdrawalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setWithdrawalOpen(false)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-white shadow-2xl p-8 border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-zinc-900 leading-tight">تسجيل مسحوبات</h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Cash Withdrawal</p>
                  </div>
                </div>
                <button onClick={() => setWithdrawalOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900 hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">القيمة (ج.م)</label>
                  <input
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 px-4 text-[20px] font-black font-mono outline-none focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">البيان / الوصف</label>
                  <input
                    type="text"
                    value={withdrawalNote}
                    onChange={(e) => setWithdrawalNote(e.target.value)}
                    placeholder="سبب المسحوبات..."
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 px-4 text-[14px] font-bold text-zinc-800 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">التصنيف</label>
                  <select
                    value={withdrawalCategoryId}
                    onChange={(e) => setWithdrawalCategoryId(e.target.value)}
                    className={`w-full h-12 rounded-2xl bg-white border px-4 text-[13px] font-bold text-zinc-800 outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none ${!withdrawalCategoryId ? "border-rose-300 focus:border-rose-400" : "border-slate-200 focus:border-zinc-400"}`}
                    required
                  >
                    <option value="">— اختر التصنيف (مطلوب) —</option>
                    {withdrawalCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">طريقة الدفع</label>
                  <select
                    value={withdrawalPaymentMethod}
                    onChange={(e) => setWithdrawalPaymentMethod(e.target.value)}
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 px-4 text-[13px] font-bold text-zinc-800 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none"
                  >
                    <option value="cash">نقدي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="InstaPay">إنستاباي</option>
                  </select>
                </div>
                <div className="pt-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleWithdrawalSave}
                    disabled={!withdrawalAmount || !withdrawalCategoryId}
                    className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-black text-white transition-all shadow-xl disabled:opacity-40 bg-slate-900 hover:bg-slate-800 shadow-slate-900/20"
                  >
                    <CheckCircle2 className="h-5 w-5" /> حفظ واعتماد
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Money Count Modal */}
      <AnimatePresence>
        {moneyOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMoneyOpen(false)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] bg-white shadow-2xl border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100/80 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-black text-zinc-900 leading-tight">آلة الجرد الفعلي</h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Cash Register</p>
                  </div>
                </div>
                <button onClick={() => setMoneyOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="rounded-3xl bg-slate-50 border border-slate-200/60 p-4">
                  <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
                    <span>الفئة النقدية</span>
                    <span className="text-center">العدد</span>
                    <span className="text-left">الإجمالي الفرعي</span>
                  </div>
                  <div className="space-y-2">
                    {DENOMS.map((d) => (
                      <div key={d} className="grid grid-cols-3 items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm transition-colors hover:border-blue-200">
                        <span className="text-[14px] font-black text-slate-800 px-2 flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-emerald-500 opacity-50" />
                          {d >= 1 ? d + " ج" : (d * 100) + " قرش"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={counts[d] || ""}
                          onChange={(e) => setCounts((p) => ({ ...p, [d]: e.target.value }))}
                          className="h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-center text-[15px] font-black font-mono outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                          placeholder="0"
                        />
                        <span className="text-[15px] font-black font-mono text-slate-500 text-left px-2">
                          {fmt(Number(counts[d] || 0) * d)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white shrink-0 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-100 p-5 shadow-inner">
                  <span className="font-black text-emerald-800 text-[14px] uppercase tracking-widest">مجموع الجرد الفعلي</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-black font-mono text-emerald-700 tracking-tighter leading-none">{fmt(moneyTotal)}</span>
                    <span className="text-[12px] font-bold text-emerald-600">ج.م</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setActualCash(String(moneyTotal)); setMoneyOpen(false); }}
                  className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[15px] font-black text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle2 className="h-5 w-5" /> ترحيل الرصيد
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calculator Modal */}
      <AnimatePresence>
        {calcOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setCalcOpen(false)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[340px] rounded-[2rem] bg-white shadow-2xl border border-slate-100 overflow-hidden" dir="rtl"
            >
              {/* Display */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
                <div className="text-right">
                  {calcPrev !== null && calcOp && (
                    <div className="text-[12px] text-slate-400 font-mono mb-1">
                      {fmt(calcPrev)} {calcOp}
                    </div>
                  )}
                  <div className="text-[36px] font-black font-mono text-white tracking-tight truncate">
                    {calcDisplay.length > 12 ? parseFloat(calcDisplay).toExponential(6) : calcDisplay}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="p-4 bg-slate-50 grid grid-cols-4 gap-2">
                {/* Row 1 */}
                <button onClick={calcClear} className="h-14 rounded-2xl bg-slate-200 text-slate-700 text-[18px] font-black hover:bg-slate-300 transition-colors">AC</button>
                <button onClick={calcNegate} className="h-14 rounded-2xl bg-slate-200 text-slate-700 text-[18px] font-black hover:bg-slate-300 transition-colors">±</button>
                <button onClick={calcPercent} className="h-14 rounded-2xl bg-slate-200 text-slate-700 text-[18px] font-black hover:bg-slate-300 transition-colors">%</button>
                <button onClick={() => calcOperator("÷")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "÷" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>÷</button>

                {/* Row 2 */}
                <button onClick={() => calcInput("7")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">7</button>
                <button onClick={() => calcInput("8")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">8</button>
                <button onClick={() => calcInput("9")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">9</button>
                <button onClick={() => calcOperator("×")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "×" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>×</button>

                {/* Row 3 */}
                <button onClick={() => calcInput("4")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">4</button>
                <button onClick={() => calcInput("5")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">5</button>
                <button onClick={() => calcInput("6")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">6</button>
                <button onClick={() => calcOperator("-")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "-" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>−</button>

                {/* Row 4 */}
                <button onClick={() => calcInput("1")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">1</button>
                <button onClick={() => calcInput("2")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">2</button>
                <button onClick={() => calcInput("3")} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">3</button>
                <button onClick={() => calcOperator("+")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "+" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>+</button>

                {/* Row 5 */}
                <button onClick={() => calcInput("0")} className="col-span-2 h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">0</button>
                <button onClick={calcDecimal} className="h-14 rounded-2xl bg-white text-slate-800 text-[20px] font-black hover:bg-slate-100 transition-colors border border-slate-200">.</button>
                <button onClick={calcEquals} className="h-14 rounded-2xl bg-emerald-600 text-white text-[20px] font-black hover:bg-emerald-700 transition-colors">=</button>
              </div>

              {/* Close button */}
              <button
                onClick={() => setCalcOpen(false)}
                className="absolute top-4 left-4 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="daily_treasury"
          renderContent={(settings) => (
            <div style={{ fontFamily: settings.print_font || "Cairo", direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
              <div style={{ borderBottom: "3px solid " + (settings.accent_color || "#0f172a"), paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>تقرير الخزينة اليومية</div>
                <div style={{ color: "#64748b" }}>التاريخ: {date}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>المتوقع</strong><br />{fmt(expected)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>الفعلية</strong><br />{fmt(actualCash || moneyTotal)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>الفروقات</strong><br />{fmt(discrepancy)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>عدد الحركات</strong><br />{sortedTransactions.length}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: settings.accent_color || "#0f172a", color: "white" }}>{["التاريخ", "النوع", "المرجع", "الطرف", "المبلغ"].map((h) => <th key={h} style={{ padding: 8, textAlign: "right" }}>{h}</th>)}</tr></thead>
                <tbody>{sortedTransactions.map((tx, i) => (
                  <tr key={tx.doc_type + "-" + tx.id + "-" + i} style={{ background: i % 2 ? "white" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 8 }}>{tx.created_at?.slice(0, 10) || date}</td>
                    <td style={{ padding: 8 }}>{DOC_TYPE_LABEL[tx.doc_type] || tx.doc_type}</td>
                    <td style={{ padding: 8 }}>{tx.doc_no || "#" + tx.id}</td>
                    <td style={{ padding: 8 }}>{tx.party || tx.description || "—"}</td>
                    <td style={{ padding: 8, fontWeight: 900 }}>{fmt(tx.amount)} ج.م</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        />
      )}
    </div>
  );
}
