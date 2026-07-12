import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BookOpen, RefreshCw, Plus, Printer, Lock, Wallet,
  CheckCircle2, X, ArrowDownRight, Calculator,
  Calendar, ChevronRight, ChevronDown, ChevronUp, Flag, ExternalLink, TrendingUp,
  TrendingDown, Search, Clock, ArrowUpDown, Filter,
  FileText, Coins, Banknote, History, Info,
  Edit3, RotateCcw, Eye, Sparkles, CreditCard,
  Save, Trash2, Check, StickyNote, BarChart3,
} from "lucide-react";

import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { usePageTour } from "../../hooks/usePageTour";
import useRecordOnlyMethods from "../../hooks/useRecordOnlyMethods";
import SmartTooltip from "../../components/ui/SmartTooltip";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import DailyTreasuryTemplate from "../../components/print/templates/DailyTreasuryTemplate";
import { formatNumber } from "../../utils/currency";
import { todayCairo, formatHHMM } from "../../utils/dateHelpers";
import ReturnsWarningModal from "../../components/ui/ReturnsWarningModal";

const fmt = (n) => formatNumber(n);
const todayStr = () => todayCairo();
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
  withdrawal: "text-[var(--text-secondary)] bg-[var(--bg-overlay)] border-[var(--border-normal)]",
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
      const cashAmt = ce !== 0 ? Math.abs(ce) : 0;
      if (cashAmt > 0) affects.push({ id: "sales_returns_cash", amount: cashAmt });
      if (creditAmt > 0) affects.push({ id: "sales_returns_account", amount: creditAmt });
      else if (ce === 0) affects.push({ id: "sales_returns_account", amount: total });
      break;
    }
    case "purchase_return": {
      const creditAmt = Number(tx.credit_amount ?? 0);
      const cashAmt = ce !== 0 ? Math.abs(ce) : 0;
      if (cashAmt > 0) affects.push({ id: "purchase_returns_cash", amount: cashAmt });
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

function txMatchesMethod(t, methodFilter) {
  if (!methodFilter) return false;
  const { methodName } = methodFilter;
  if (t.payment_splits && t.payment_splits.includes(methodName)) return true;
  if (t.payment_method && t.payment_method === methodName) return true;
  if (t.payment_method_name && t.payment_method_name === methodName) return true;
  return false;
}

function AmountCell({ t }) {
  const ce = Number(t.cash_effect ?? t.amount ?? 0);
  const total = Number(t.amount ?? 0);
  const creditAmt = Number(t.credit_amount || 0);
  const isReturn = ["sales_return", "purchase_return"].includes(t.doc_type);
  const isSalesReturn = t.doc_type === "sales_return";
  const isZeroCash = ce === 0 && total > 0.005;
  const totalDiffers = Math.abs(total - Math.abs(ce)) > 0.01 && Math.abs(ce) > 0.005;
  const isCashIn = ce > 0;

  const splits = t.payment_splits
    ? t.payment_splits.split("|||").map(s => {
        const idx = s.lastIndexOf(":");
        return { key: s.slice(0, idx), amt: Number(s.slice(idx + 1)) };
      })
    : [];
  const splitsTotal = splits.reduce((s, x) => s + x.amt, 0);

  /* ── ZERO CASH — non-cash methods only (card, wallet, etc.) ── */
  if (isZeroCash) {
    return (
      <div className="w-full rounded-xl border border-[var(--border-normal)] overflow-hidden bg-[var(--bg-surface)]">
        {/* Striped header — signals "no flow" */}
        <div className="relative h-1.5 overflow-hidden bg-[var(--bg-overlay)]">
          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(90deg,#cbd5e1 0px,#cbd5e1 4px,#f1f5f9 4px,#f1f5f9 10px)" }} />
        </div>
        <div className="px-3 pt-2 pb-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">الإجمالي</span>
            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              <span className="text-[7px] font-black text-amber-600 tracking-wide">لا يؤثر على الخزنة</span>
            </span>
          </div>
          <span className="number-fmt-primary text-[16px] text-[var(--text-secondary)] leading-none">{fmt(total)}</span>
          <span className="text-[9px] font-bold text-amber-600/70">صفر نقدي — لا يؤثر على الخزنة</span>
          {/* Payment method breakdown */}
          {splits.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {splits.map((s, i) => {
                const label = PAYMENT_METHOD_AR[s.key] || s.key;
                const isCreditSplit = s.key === "credit";
                const pct = splitsTotal > 0 ? Math.round((s.amt / splitsTotal) * 100) : 0;
                return (
                  <span key={i} className={`inline-flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded-md ${isCreditSplit ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                    {label} <span className="font-mono opacity-70">{pct}%</span>
                  </span>
                );
              })}
            </div>
          )}
          {/* Credit portion for zero-cash returns */}
          {isReturn && creditAmt > 0.005 && (
            <div className={`flex items-center justify-between rounded-lg px-2 py-1 border ${isSalesReturn ? "bg-blue-50 border-blue-100" : "bg-amber-50 border-amber-100"}`}>
              <span className={`text-[8px] font-black ${isSalesReturn ? "text-blue-500" : "text-amber-600"}`}>{isSalesReturn ? "رصيد حساب" : "ذمة مورد"}</span>
              <span className={`number-fmt-primary text-[11px] ${isSalesReturn ? "text-blue-700" : "text-amber-700"}`}>{fmt(creditAmt)}</span>
            </div>
          )}
          {isSalesReturn && t.original_invoice_no && (
            <div className="flex items-center gap-1 opacity-60">
              <FileText className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
              <span className="text-[8px] font-black text-indigo-600 font-mono">{t.original_invoice_no}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── CASH IN / OUT ──────────────────────────────────────── */
  if (ce !== 0) {
    return (
      <div className="w-full rounded-xl overflow-hidden border" style={{ borderColor: isCashIn ? "#bbf7d0" : "#fecaca" }}>
        {/* Solid accent bar — full width, thick, unmistakable */}
        <div className="h-1 w-full" style={{ background: isCashIn ? "linear-gradient(90deg,var(--primary),var(--primary-200))" : "linear-gradient(90deg,var(--danger),color-mix(in srgb, var(--danger) 60%, white))" }} />

        <div className={`px-3 pt-2 pb-2.5 flex flex-col gap-1.5 ${isCashIn ? "bg-emerald-50/50" : "bg-rose-50/50"}`}>
          {/* Direction label row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className={`text-[11px] font-black ${isCashIn ? "text-emerald-500" : "text-rose-500"}`}>{isCashIn ? "↑" : "↓"}</span>
              <span className={`text-[8px] font-black uppercase tracking-wider ${isCashIn ? "text-emerald-600" : "text-rose-600"}`}>{isCashIn ? "داخل الخزنة" : "خارج الخزنة"}</span>
            </div>
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border ${isCashIn ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-rose-100 border-rose-200 text-rose-700"}`}>نقداً</span>
          </div>

          {/* Hero number */}
          <span className={`number-fmt-primary text-[18px] leading-none tracking-tight ${isCashIn ? "text-emerald-700" : "text-rose-700"}`}>
            {isCashIn ? "+" : "−"}{fmt(Math.abs(ce))}
          </span>

          {/* Total when partial */}
          {totalDiffers && (
            <div className="flex items-center justify-between border-t pt-1.5 mt-0.5" style={{ borderColor: isCashIn ? "#d1fae5" : "#fee2e2" }}>
              <span className="text-[8px] font-black text-[var(--text-muted)]">إجمالي الحركة</span>
              <span className="number-fmt-primary text-[11px] text-[var(--text-secondary)]">{fmt(total)}</span>
            </div>
          )}

          {/* Proportional split bar + chips */}
          {splits.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-1.5 mt-0.5" style={{ borderColor: isCashIn ? "#d1fae5" : "#fee2e2" }}>
              {/* Bar */}
              <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--bg-overlay)]">
                {splits.map((s, i) => {
                  const pct = splitsTotal > 0 ? (s.amt / splitsTotal) * 100 : 0;
                  const isCashSplit = s.key === "cash";
                  const isCreditSplit = s.key === "credit";
                  return (
                    <div key={i} style={{ width: `${pct}%`, transition: "width 0.3s" }}
                      className={`${isCashSplit ? "bg-emerald-400" : isCreditSplit ? "bg-amber-400" : "bg-blue-400"} ${i > 0 ? "border-r border-white" : ""}`}
                    />
                  );
                })}
              </div>
              {/* Chips */}
              <div className="flex flex-wrap gap-1">
                {splits.map((s, i) => {
                  const isCashSplit = s.key === "cash";
                  const isCreditSplit = s.key === "credit";
                  const label = isCashSplit ? "نقداً" : isCreditSplit ? "آجل" : (PAYMENT_METHOD_AR[s.key] || s.key);
                  return (
                    <span key={i} className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${isCashSplit ? "bg-emerald-100 text-emerald-700" : isCreditSplit ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                      {label}: {fmt(s.amt)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Return credit portion */}
          {isReturn && creditAmt > 0.005 && (
            <div className={`flex items-center justify-between rounded-lg px-2 py-1 border ${isSalesReturn ? "bg-blue-50 border-blue-100" : "bg-amber-50 border-amber-100"}`}>
              <span className={`text-[8px] font-black ${isSalesReturn ? "text-blue-500" : "text-amber-600"}`}>{isSalesReturn ? "رصيد حساب" : "ذمة مورد"}</span>
              <span className={`number-fmt-primary text-[11px] ${isSalesReturn ? "text-blue-700" : "text-amber-700"}`}>{fmt(creditAmt)}</span>
            </div>
          )}

          {/* Invoice reference */}
          {isSalesReturn && t.original_invoice_no && (
            <div className="flex items-center gap-1 opacity-60">
              <FileText className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
              <span className="text-[8px] font-black text-indigo-600 font-mono">{t.original_invoice_no}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── TRULY EMPTY ─────────────────────────────────────────── */
  return <span className="text-[var(--text-muted)] text-sm font-black block text-center">—</span>;
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
  const [methodTotals, setMethodTotals] = useState([]);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState(null);
  const ITEMS_PER_PAGE = 25;

  // Money count modal
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [counts, setCounts] = useState({});

  // Quick expense/revenue modal
  const [quickModal, setQuickModal] = useState(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickCategoryId, setQuickCategoryId] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [revenueCategories, setRevenueCategories] = useState([]);

  // Withdrawal modal
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalCategoryId, setWithdrawalCategoryId] = useState("");
  const [withdrawalPaymentMethod, setWithdrawalPaymentMethod] = useState("cash");
  const recordMethods = useRecordOnlyMethods();
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [withdrawalCategories, setWithdrawalCategories] = useState([]);

  // Slide-over
  const [slideOver, setSlideOver] = useState(null);
  const [slideOverDetails, setSlideOverDetails] = useState(null);
  const [slideOverLoading, setSlideOverLoading] = useState(false);
  const [returnsWarningOpen, setReturnsWarningOpen] = useState(false);

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

  // Cash-count check-ins + day note
  const [cashCounts, setCashCounts] = useState([]);
  const [savingCount, setSavingCount] = useState(false);
  const [editingCountId, setEditingCountId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [dayNoteSaving, setDayNoteSaving] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

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

  // Quick modal refs
  const quickAmountRef = useRef(null);
  const quickNoteRef = useRef(null);
  const quickCategoryRef = useRef(null);
  const quickSubmitRef = useRef(null);

  // Withdrawal modal refs
  const withdrawalAmountRef = useRef(null);
  const withdrawalNoteRef = useRef(null);
  const withdrawalCategoryRef = useRef(null);
  const withdrawalPaymentRef = useRef(null);
  const withdrawalSubmitRef = useRef(null);

  const denomRefs = useRef([]);
  const handleKeyDown = useFieldNavigation();

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
      // txSearch takes priority; globalAmountSearch is used only when txSearch is empty
      const searchParam = txSearch || globalAmountSearch;
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

  const loadMethodTotals = useCallback(async () => {
    try {
      const dateParam = isToday ? "" : `?date=${date}`;
      const r = await api.get(`/api/daily-sessions/today/payment-methods${dateParam}`);
      setMethodTotals(r.data.data || []);
    } catch {
      setMethodTotals([]);
    }
  }, [date, isToday]);

  const loadCashCounts = useCallback(async () => {
    try {
      const r = await api.get(`/api/daily-sessions/${date}/cash-counts`);
      setCashCounts(r.data.data || []);
    } catch {
      setCashCounts([]);
    }
  }, [date]);

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
  useEffect(() => { loadMethodTotals(); }, [loadMethodTotals]);
  useEffect(() => { loadCashCounts(); }, [loadCashCounts]);
  useEffect(() => { if (historyOpen) loadPastSessions(); }, [historyOpen, historySearch, historyStatus]);
  useEffect(() => { setCurrentPage(1); }, [activeTab, globalAmountSearch, txSearch, txSort, showCancelled]);

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

  const allNotes = useMemo(() => {
    const notes = [];
    const dayRaw = summary?.session?.day_notes || '';
    if (dayRaw) {
      dayRaw.split('\n').filter(Boolean).forEach((line, i) => {
        const m = line.match(/^\[(\d{2}:\d{2})\]\s*(.*)/);
        if (m) {
          notes.push({ id: `d-${i}`, time: m[1], text: m[2], type: 'day', source: 'ملاحظة', sortKey: m[1] });
        } else {
          notes.push({ id: `d-${i}`, time: '', text: line, type: 'day', source: 'ملاحظة', sortKey: '' });
        }
      });
    }
    cashCounts.forEach(c => {
      const rawHhmm = (c.created_at || '').slice(11, 16);
      notes.push({ id: `c-${c.id}`, time: formatHHMM(rawHhmm), text: c.note, type: 'count', source: 'عد', sortKey: rawHhmm, amount: c.amount, discrepancy: c.discrepancy, expected_cash: c.expected_cash });
    });
    if (summary?.session?.notes) {
      const closeRaw = (summary.session.closed_at || '').slice(11, 16);
      notes.push({ id: 'close', time: formatHHMM(closeRaw), text: summary.session.notes, type: 'close', source: 'إغلاق', sortKey: closeRaw || '99:99' });
    }
    notes.sort((a, b) => b.sortKey.localeCompare(a.sortKey) || (a.id > b.id ? -1 : 1));
    return notes;
  }, [summary, cashCounts]);

  const moneyTotal = DENOMS.reduce((s, d) => s + Number(counts[d] || 0) * d, 0);
  const sess = summary?.session;
  const expected = summary?.expected_cash ?? 0;
  const discrepancy = summary?.discrepancy;

  async function handleQuickSave() {
    if (!quickAmount || quickSubmitting) return;
    if (!quickCategoryId) { toast.error("يرجى اختيار الفئة أولاً"); return; }
    setQuickSubmitting(true);
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
      loadMethodTotals();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setQuickSubmitting(false);
    }
  }

  async function handleWithdrawalSave() {
    if (!withdrawalAmount || withdrawalSubmitting) return;
    if (!withdrawalCategoryId) { toast.error("يرجى اختيار التصنيف أولاً"); return; }
    setWithdrawalSubmitting(true);
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
      loadMethodTotals();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setWithdrawalSubmitting(false);
    }
  }

  async function handleSaveCount() {
    if (actualCash === "" || !Number.isFinite(Number(actualCash))) {
      toast.error("أدخل الرصيد الفعلي أولاً");
      return;
    }
    setSavingCount(true);
    try {
      await api.post(`/api/daily-sessions/${date}/cash-counts`, {
        amount: Number(actualCash),
        note: closeNotes,
      });
      toast.success("تم حفظ العد");
      setActualCash("");
      setCloseNotes("");
      loadCashCounts();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setSavingCount(false);
    }
  }

  function startEditCount(c) {
    setEditingCountId(c.id);
    setEditAmount(String(c.amount));
    setEditNote(c.note || "");
  }

  function cancelEditCount() {
    setEditingCountId(null);
    setEditAmount("");
    setEditNote("");
  }

  async function handleSaveEditCount(id) {
    if (editAmount === "" || !Number.isFinite(Number(editAmount))) {
      toast.error("قيمة غير صحيحة");
      return;
    }
    try {
      await api.put(`/api/daily-sessions/cash-counts/${id}`, {
        amount: Number(editAmount),
        note: editNote,
      });
      toast.success("تم تعديل العد");
      cancelEditCount();
      loadCashCounts();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    }
  }

  async function handleDeleteCount(id) {
    if (!window.confirm("حذف هذا العد؟")) return;
    try {
      await api.delete(`/api/daily-sessions/cash-counts/${id}`);
      toast.success("تم حذف العد");
      loadCashCounts();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    }
  }

  async function handleSaveDayNote() {
    if (!newNoteText.trim()) return;
    setDayNoteSaving(true);
    try {
      await api.put(`/api/daily-sessions/${date}/day-note`, { note: newNoteText.trim() });
      toast.success("تم حفظ الملاحظة");
      setNewNoteText("");
      loadSummary();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setDayNoteSaving(false);
    }
  }

  function handlePrint() {
    setPrintOpen(true);
  }

  const sortedTransactions = transactions;
  const totalPages = Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = sortedTransactions.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const txTotal = paginatedTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const draftDiscrepancy = actualCash !== "" ? Number(actualCash || 0) - Number(expected || 0) : null;
  const cashIn = Number(summary?.cash_in || 0);
  const cashOut = Number(summary?.cash_out || 0);
  const cashInRows = [
    { id: "pos_cash_sales", label: "نقد من مبيعات POS", tooltip: "فواتير POS استُلم ثمنها كاملاً نقداً.\n\nلزيادة هذا الرقم: أتمم المزيد من فواتير POS بطريقة دفع «نقدي».", value: summary?.pos_cash_sales, tab: "pos", matchTx: (t) => t.doc_type === "pos_invoice" && t.payment_type === "cash" },
    { id: "pos_installments", label: "نقد من أقساط (دفعة أولى أو لاحقة)", tooltip: "الجزء النقدي من فواتير التقسيط فقط — الدفعة المقدمة وأي أقساط دخلت الصندوق اليوم.\n\nلزيادته: سجّل دفعات أقساط نقدية من شاشة تحصيلات العملاء.", value: summary?.pos_installment_cash, tab: "pos", matchTx: (t) => t.doc_type === "installment_invoice" || (t.doc_type === "pos_invoice" && t.payment_type === "installments") },
    { id: "pos_multi_cash", label: "نقد من دفع متعدد", tooltip: "الجزء النقدي من فواتير الدفع المتعدد — باقي المبلغ ذهب لبنك أو محفظة.\n\nلزيادته: في فواتير الدفع المتعدد اجعل الجزء النقدي أكبر.", value: summary?.pos_multi_cash, tab: "pos", matchTx: (t) => t.doc_type === "pos_invoice" && t.payment_type === "multi" },
    { id: "customer_collections", label: "نقد تم تحصيله من العملاء", tooltip: "مدفوعات نقدية من العملاء لتسوية ذمم أو آجل مسجل مسبقاً.\n\nلزيادته: سجّل تحصيلات نقدية من شاشة حسابات العملاء أو حركات الآجل.", value: summary?.customer_cash_collections ?? (Number(summary?.customer_payments || 0) + Number(summary?.ajal_payments || 0)), tab: "customer_cash_collections", matchTx: (t) => ["customer_payment", "ajal_payment"].includes(t.doc_type) },
    { id: "revenues_cash", label: "إيرادات نقدية", tooltip: "إيرادات متنوعة خارج المبيعات قُبضت نقداً (إيجار، خدمة، غيرها).\n\nلزيادته: سجّل إيراداً سريعاً من زر «تسجيل إيراد سريع» أعلى الصفحة.", value: summary?.revenues_cash, tab: "revenues", matchTx: (t) => t.doc_type === "revenue" },
    { id: "purchase_returns_cash", label: "نقد مسترد من مرتجعات الشراء", tooltip: "نقد استُرد فعلياً من المورد عند إرجاع بضاعة كانت مدفوعة نقداً.\n\nيرتفع تلقائياً عند تسجيل مرتجع شراء بطريقة تسوية «نقدي».", value: summary?.purchase_returns_cash, tab: "purchase_returns", matchTx: (t) => t.doc_type === "purchase_return" && Number(t.cash_effect ?? 0) !== 0 },
  ];
  const cashOutRows = [
    { id: "supplier_cash_payments", label: "نقد مدفوع للموردين", tooltip: "نقد خرج من الصندوق لسداد ذمم الموردين أو مشتريات نقدية مباشرة.\n\nلتقليله: فضّل طرق الدفع الآجلة أو البنكية عند الشراء.", value: summary?.supplier_cash_payments ?? (Number(summary?.supplier_payments || 0) + Number(summary?.supplier_ajal_payments || 0)), tab: "supplier_cash_payments", matchTx: (t) => t.doc_type === "supplier_payment" },
    { id: "expenses_cash", label: "مصروفات نقدية", tooltip: "مصروفات تشغيلية متنوعة دُفعت نقداً من الصندوق.\n\nلمراجعتها: انقر على هذا الصف لتصفية قائمة الحركات وعرضها.", value: summary?.expenses_cash, tab: "expenses", matchTx: (t) => t.doc_type === "expense" },
    { id: "sales_returns_cash", label: "نقد مدفوع لمرتجعات المبيعات", tooltip: "نقد أُعيد للعملاء من الصندوق عند قبول مرتجعات مبيعات.\n\nيرتفع عند تسجيل مرتجع بطريقة «استرداد نقدي» — راجع أسباب المرتجعات لو ارتفع كثيراً.", value: summary?.sales_returns_cash, tab: "sales_returns", matchTx: (t) => t.doc_type === "sales_return" && Number(t.cash_effect ?? 0) !== 0 },
    { id: "withdrawals", label: "مسحوبات من الخزنة", tooltip: "نقد أُخرج من الصندوق لأغراض خارج المبيعات والمصروفات اليومية.\n\nسجّل المسحوبات دائماً بزر «تسجيل مسحوبات» حتى لا يظهر عجز وهمي.", value: summary?.withdrawals, tab: "withdrawals", matchTx: (t) => t.doc_type === "withdrawal" },
  ];
  const netCreditSales = (summary?.pos_credit_sales || 0) - (summary?.pos_installment_cash || 0) + (summary?.multi_credit_portion || 0);
  const nonCashRows = [
    { id: "pos_credit_sales", label: "مبيعات آجلة زادت دين العملاء (صافي)", tooltip: "مبيعات لم يُدفع ثمنها نقداً — سُجّلت في ذمة العميل.\n\nلا تؤثر على الصندوق. لتحصيلها: اذهب لحسابات العملاء وسجّل تحصيلاً.", value: netCreditSales, tab: "pos", matchTx: (t) => t.doc_type === "credit_invoice" || t.doc_type === "installment_invoice" || (t.doc_type === "pos_invoice" && (t.payment_type === "credit" || t.payment_type === "installments" || (t.payment_type === "multi" && (t.payment_splits || "").includes("credit:")))) },
    { id: "sales_returns_account", label: "مرتجعات مبيعات زادت دين العملاء", tooltip: "مرتجعات رُدّت كرصيد في حساب العميل بدلاً من نقد.\n\nلا تؤثر على الصندوق — الرصيد يُستخدم في فاتورة مستقبلية للعميل.", value: summary?.sales_returns_account, tab: "sales_returns", matchTx: (t) => t.doc_type === "sales_return" && (Number(t.cash_effect ?? 0) === 0 || Number(t.credit_amount ?? 0) > 0) },
    { id: "purchases_payable", label: "مشتريات آجلة زادت دين الموردين", tooltip: "مشتريات سُجّلت على الذمة ولم يُدفع ثمنها نقداً بعد.\n\nلا تؤثر على الصندوق الآن — ستؤثر لاحقاً عند سداد الدين نقداً.", value: summary?.purchases_payable_total, tab: "purchases", matchTx: (t) => t.doc_type === "purchase" && t.payment_type !== "cash" && t.payment_type !== "bank_transfer" },
    { id: "purchase_returns_payable", label: "مرتجعات شراء خصمت من دين الموردين", tooltip: "مرتجعات شراء خُصمت من ذمة المورد مباشرة بدلاً من استرداد نقدي.\n\nلا تؤثر على الصندوق — تقلل فقط ما تدين به للمورد.", value: summary?.purchase_returns_payable_total, tab: "purchase_returns", matchTx: (t) => t.doc_type === "purchase_return" && (Number(t.cash_effect ?? 0) === 0 || Number(t.credit_amount ?? 0) > 0) },
    { id: "non_cash_movements", label: "مبيعات POS بطرق دفع إلكترونية وبنكية", tooltip: "مبيعات دُفعت بطاقة أو بنك أو محفظة إلكترونية.\n\nلا تدخل الصندوق النقدي — راجع حساباتها في شاشة البنوك والمحافظ.", value: summary?.non_cash_movements_total ?? summary?.pos_bank_sales, tab: "all", matchTx: (t) => t.doc_type === "pos_invoice" && !["cash", "installments", "credit"].includes(t.payment_type) },
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
    loadMethodTotals();
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
      if (e.key === "Escape") { setActiveEquationRowId(null); setTxAffects(null); setMethodFilter(null); }
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

  function handleMethodClick(methodId, methodName, direction) {
    if (methodFilter?.methodId === methodId && methodFilter?.direction === direction) {
      setMethodFilter(null);
      return;
    }
    setMethodFilter({ methodId, methodName, direction });
    setActiveEquationRowId(null);
    setTxAffects(null);
    setActiveTab("all");
    setGlobalAmountSearch("");
    setTimeout(() => txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function handleTransactionClick(tx) {
    const affects = getEquationRowAffects(tx);
    setActiveEquationRowId(null);
    setMethodFilter(null);
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
    <div className="min-h-[100dvh] bg-[var(--bg-base)] flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl" onClick={() => { setActiveEquationRowId(null); setTxAffects(null); setMethodFilter(null); }}>
      {/* Impeccable Animated Architectural Background */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Base Grid */}
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to_right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to_bottom,var(--border-subtle) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        {/* Cinematic Shimmer Sweep */}
        <motion.div
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 mix-blend-overlay"
        />
        {/* Center Spotlight / Vignette */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 40%,transparent 0%,var(--bg-base) 100%)" }} />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-6 pb-4 px-4 md:px-8 shrink-0">
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex flex-col items-start justify-center">
            <motion.div variants={fadeInUp} className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-[11px] font-black uppercase tracking-[0.15em] font-mono">المالية // تسوية ومراجعة الحركات</span>
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tighter">
              الخزينة اليومية
            </motion.h1>
          </div>

          <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-slate-100/50">
            <div className="relative">
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => { setDate(e.target.value); setActiveTab("all"); setMethodFilter(null); }}
                className="h-10 rounded-xl border border-[var(--border-normal)] bg-white/50 px-3 text-2sm font-bold text-[var(--text-secondary)] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
              />
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setDate(todayStr()); setActiveTab("all"); setGlobalAmountSearch(""); }}
              className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-2sm font-black transition-colors ${isToday ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                }`}
            >
              <Calendar className="h-3.5 w-3.5" /> اليوم
            </motion.button>

            <div className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border ${isClosed ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"}`}>
              {isClosed ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="text-sm font-black">{isClosed ? "مغلق" : "مفتوح"}</span>
            </div>

            <label className="flex items-center gap-1.5 h-10 cursor-pointer rounded-xl border border-[var(--border-normal)] px-3 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-colors select-none">
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
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-[11px] font-black text-white hover:bg-primary-600 transition-colors shadow-md shadow-slate-900/10"
            >
              <History className="h-3.5 w-3.5 text-emerald-400" /> الأيام السابقة
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadSummary}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-normal)] hover:bg-[var(--bg-overlay)] text-[var(--text-secondary)] transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/daily-treasury/cashflow?date=${date}`)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-3 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-colors shadow-sm"
              title="كشف الحركات التفصيلي مع الرصيد الجاري"
            >
              <BarChart3 className="h-3.5 w-3.5" /> كشف الحركات
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePrint}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-3 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" /> طباعة
            </motion.button>
          </motion.div>
        </motion.div>
      </header>

      {/* Main Grid Layout (AIDA: Interest & Action) */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 pb-24">
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
                <RefreshCw className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                <span className="text-sm font-black text-[var(--text-muted)]">جاري تحميل بيانات الخزينة...</span>
              </div>
            </div>
          ) : !sess ? (
            <div className="flex items-center justify-center h-64 rounded-3xl border border-dashed border-slate-300 bg-white/50 backdrop-blur-md">
              <span className="text-[15px] font-black text-[var(--text-muted)]">لا توجد جلسة مفتوحة لهذا اليوم.</span>
            </div>
          ) : (
            <>
              {/* Read-only notice for historical days or closed today */}
              {(isClosed || !isToday) && (
                <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-black text-blue-800">
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
                          className="h-9 w-48 rounded-xl border border-blue-200 bg-[var(--bg-surface)] px-3 text-[11px] font-bold outline-none focus:border-blue-500"
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
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex rounded-3xl bg-rose-600 border border-rose-500 shadow-lg shadow-rose-600/20 overflow-hidden"
                  >
                    <button
                      onClick={() => setQuickModal("expense")}
                      className="flex flex-1 items-center justify-center gap-3 py-4 text-sm font-black text-white hover:bg-rose-700 transition-colors"
                    >
                      <div className="bg-white/20 p-1.5 rounded-xl"><TrendingDown className="h-4 w-4" /></div>
                      تسجيل مصروف سريع
                    </button>
                    <div className="w-px bg-rose-500/50 self-stretch" />
                    <button
                      onClick={() => navigate('/expenses')}
                      title="عرض قائمة المصروفات"
                      className="shrink-0 flex items-center justify-center w-11 hover:bg-rose-700 transition-colors text-white/70 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex rounded-3xl bg-emerald-600 border border-emerald-500 shadow-lg shadow-emerald-600/20 overflow-hidden"
                  >
                    <button
                      onClick={() => setQuickModal("revenue")}
                      className="flex flex-1 items-center justify-center gap-3 py-4 text-sm font-black text-white hover:bg-emerald-700 transition-colors"
                    >
                      <div className="bg-white/20 p-1.5 rounded-xl"><TrendingUp className="h-4 w-4" /></div>
                      تسجيل إيراد سريع
                    </button>
                    <div className="w-px bg-emerald-500/50 self-stretch" />
                    <button
                      onClick={() => navigate('/revenues')}
                      title="عرض قائمة الإيرادات"
                      className="shrink-0 flex items-center justify-center w-11 hover:bg-emerald-700 transition-colors text-white/70 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex rounded-3xl bg-primary border border-slate-800 shadow-lg shadow-slate-900/20 overflow-hidden"
                  >
                    <button
                      onClick={() => setWithdrawalOpen(true)}
                      className="flex flex-1 items-center justify-center gap-3 py-4 text-sm font-black text-white hover:bg-primary-600 transition-colors"
                    >
                      <div className="bg-white/20 p-1.5 rounded-xl"><Banknote className="h-4 w-4" /></div>
                      تسجيل مسحوبات سريع
                    </button>
                    <div className="w-px bg-slate-700/50 self-stretch" />
                    <button
                      onClick={() => navigate('/withdrawals')}
                      title="عرض قائمة المسحوبات"
                      className="shrink-0 flex items-center justify-center w-11 hover:bg-primary-600 transition-colors text-white/70 hover:text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMoneyOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-blue-600 py-4 text-sm font-black text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 border border-blue-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Coins className="h-4 w-4" /></div>
                    عد العملة (جرد الخزينة)
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCalcOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-indigo-600 py-4 text-sm font-black text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 border border-indigo-500"
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
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-2sm font-black text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
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
                        <span className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-tight">{label}</span>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-${color}-50 text-${color}-600 ring-1 ring-inset ring-${color}-100 shadow-sm shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div>
                        <div className={`number-fmt-primary text-[22px] tracking-tighter ${value != null && value < 0 ? "text-rose-600" : "text-[var(--text-primary)]"}`}>
                          {value != null ? fmt(value) : "—"}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-bold mt-0.5">جنيه مصري</div>
                        {compareYesterday && yesterday != null && (
                          <div className="mt-2 text-[11px] text-[var(--text-secondary)] font-bold border-t border-slate-100/80 pt-2 flex items-center justify-between">
                            <span>بالأمس:</span>
                            <span className="number-fmt-primary">{fmt(yesterday)} ج.م</span>
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
                  <div className="rounded-3xl bg-[var(--bg-surface)] border border-slate-200/80 shadow-lg overflow-hidden">
                    {/* Prominent Header */}
                    <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-slate-50/80 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center ring-2 ring-inset ring-indigo-200 shadow-sm">
                        <Calculator className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[22px] font-black text-[var(--text-primary)] leading-tight">معادلة الخزينة</h3>
                        <p className="text-sm font-bold text-[var(--text-secondary)] mt-1">الرصيد المتوقع = الرصيد السابق + الداخل النقدي − الخارج النقدي</p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Left: Breakdown (3 cols) */}
                        <div className="lg:col-span-3 space-y-4">
                          {/* Opening Balance */}
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)]">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-200 text-[var(--text-secondary)] flex items-center justify-center">
                                <Lock className="h-5 w-5" />
                              </div>
                              <span className="text-[15px] font-black text-[var(--text-secondary)]">رصيد سابق</span>
                            </div>
                            <span className="number-fmt-primary text-[22px] text-[var(--text-primary)]">{fmt(summary?.previous_balance ?? summary?.opening_balance)} <span className="text-2sm text-[var(--text-muted)]">ج.م</span></span>
                          </div>

                          {/* Cash In */}
                          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                                <span className="text-[15px] font-black text-emerald-800">الداخل النقدي</span>
                              </div>
                              <span className="number-fmt-primary text-[24px] text-emerald-700">+ {fmt(cashIn)}</span>
                            </div>
                            <div className="space-y-2">
                              {cashInRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActiveRev = !!affect;
                                const isActive = isActiveFwd || isActiveRev;
                                return (
                                  <SmartTooltip key={row.id} content={row.tooltip} side="left" fill wide>
                                    <button
                                      type="button"
                                      ref={el => { equationRowRefs.current[row.id] = el; }}
                                      onClick={() => handleEquationRowClick(row)}
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right transition-all border ${isActive
                                          ? "bg-emerald-100 ring-2 ring-emerald-400 border-emerald-300 scale-[1.01]"
                                          : txAffects ? "bg-white/40 border-emerald-100/30 opacity-40" : "bg-white/60 border-emerald-100/50 hover:bg-emerald-100/60"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="text-2sm text-[var(--text-secondary)] font-bold text-right leading-snug">{row.label}</span>
                                        <Info className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0 mr-2">
                                        <span className={`number-fmt-primary text-sm transition-all ${isActive ? "text-emerald-900 bg-emerald-200 ring-2 ring-emerald-500 rounded-lg px-2 py-0.5" : "text-emerald-700"
                                          }`}>{fmt(row.value)}</span>
                                        {affect && (
                                          <span className="text-[11px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                            ← هذه الحركة: {fmt(affect.amount)}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </SmartTooltip>
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
                              <span className="number-fmt-primary text-[24px] text-rose-700">− {fmt(cashOut)}</span>
                            </div>
                            <div className="space-y-2">
                              {cashOutRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActive = isActiveFwd || !!affect;
                                return (
                                  <SmartTooltip key={row.id} content={row.tooltip} side="left" fill wide>
                                    <button
                                      type="button"
                                      ref={el => { equationRowRefs.current[row.id] = el; }}
                                      onClick={() => handleEquationRowClick(row)}
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right transition-all border ${isActive
                                          ? "bg-rose-100 ring-2 ring-rose-400 border-rose-300 scale-[1.01]"
                                          : txAffects ? "bg-white/40 border-rose-100/30 opacity-40" : "bg-white/60 border-rose-100/50 hover:bg-rose-100/60"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                                        <span className="text-2sm text-[var(--text-secondary)] font-bold text-right leading-snug">{row.label}</span>
                                        <Info className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0 mr-2">
                                        <span className={`number-fmt-primary text-sm transition-all ${isActive ? "text-rose-900 bg-rose-200 ring-2 ring-rose-500 rounded-lg px-2 py-0.5" : "text-rose-700"
                                          }`}>{fmt(row.value)}</span>
                                        {affect && (
                                          <span className="text-[11px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                            ← هذه الحركة: {fmt(affect.amount)}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </SmartTooltip>
                                );
                              })}
                            </div>
                          </div>

                          {/* Non-cash */}
                          <div className="rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] p-4">
                            <div className="mb-2 text-sm font-black text-[var(--text-secondary)]">حركات لا تؤثر على الخزنة نقدياً</div>
                            <div className="space-y-1">
                              {nonCashRows.map((row) => {
                                const affect = txAffects?.find(a => a.id === row.id);
                                const isActiveFwd = activeEquationRowId === row.id;
                                const isActive = isActiveFwd || !!affect;
                                return (
                                  <SmartTooltip key={row.id} content={row.tooltip} side="left" fill wide>
                                    <button
                                      type="button"
                                      ref={el => { equationRowRefs.current[row.id] = el; }}
                                      onClick={() => handleEquationRowClick(row)}
                                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right transition-all ${isActive
                                          ? "bg-slate-200 ring-2 ring-slate-400 scale-[1.01]"
                                          : txAffects ? "opacity-40" : "hover:bg-[var(--bg-surface)]"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Lock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                                        <span className="text-[11px] font-bold text-[var(--text-secondary)] text-right leading-snug">{row.label}</span>
                                        <Info className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                                      </div>
                                      <div className="flex flex-col items-end gap-0.5 shrink-0 mr-2">
                                        <span className={`number-fmt-primary text-sm transition-all ${isActive ? "text-[var(--text-primary)] bg-slate-300 ring-2 ring-slate-500 rounded-lg px-2 py-0.5" : "text-[var(--text-secondary)]"
                                          }`}>{fmt(row.value)}</span>
                                        {affect && (
                                          <span className="text-[11px] font-black bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 border border-amber-300 whitespace-nowrap">
                                            ← هذه الحركة: {fmt(affect.amount)}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  </SmartTooltip>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Right: Expected & Close (2 cols) */}
                        <div className="lg:col-span-2 flex flex-col gap-5">
                          {/* Top Half: Expected Safe & Actual Cash */}
                          <div className="flex flex-col gap-5">
                            {/* Compact Expected Amount */}
                            <div className="rounded-3xl bg-primary text-white p-5 shadow-xl shadow-slate-900/20">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-10 w-10 rounded-xl bg-[var(--chip-on-primary)] flex items-center justify-center shrink-0">
                                    <Wallet className="h-5 w-5 text-[var(--on-feature)]" />
                                  </div>
                                  <div className="text-2sm font-bold text-[var(--on-feature-muted)] uppercase tracking-widest leading-tight">المتوقع<br />في الخزنة</div>
                                </div>
                                <div className="text-left">
                                  <div className="number-fmt-primary text-[28px] tracking-tighter leading-none text-[var(--on-feature)]">{fmt(expected)}</div>
                                  <div className="text-[11px] font-bold text-[var(--on-feature-muted)] mt-1">جنيه مصري</div>
                                </div>
                              </div>

                              {sess.actual_cash != null && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={"mt-4 w-full rounded-2xl p-3 border flex items-center justify-between " + (discrepancy >= 0 ? "bg-emerald-500/20 border-emerald-500/30" : "bg-rose-500/20 border-rose-500/30")}
                                >
                                  <div>
                                    <div className="text-[11px] font-bold text-[var(--on-feature-muted)]">الرصيد الفعلي المُغلق</div>
                                    <div className="number-fmt-primary text-[20px] text-[var(--on-feature)]">{fmt(sess.actual_cash)}</div>
                                  </div>
                                  <div className={"text-sm font-black " + (discrepancy >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    الفرق: {discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)} ج.م
                                  </div>
                                </motion.div>
                              )}
                            </div>

                            {/* الرصيد الفعلي — عد الخزنة في أي وقت خلال اليوم */}
                            <div className="rounded-2xl border-2 border-[var(--border-normal)] bg-[var(--bg-surface)] p-6 shadow-sm">
                              <h4 className="text-[16px] font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
                                <Lock className="h-5 w-5 text-[var(--text-secondary)]" /> عدّ الخزنة
                              </h4>
                              <p className="text-[11px] font-bold text-[var(--text-muted)] mb-4">احسب الدرج في أي وقت واحفظه لمتابعة العجز أو الزيادة خلال اليوم.</p>
                              <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                  <label className="text-sm font-black text-[var(--text-secondary)]">الرصيد الفعلي (ج.م)</label>
                                  <div className="flex gap-3">
                                    <input
                                      type="number"
                                      value={actualCash}
                                      onChange={(e) => setActualCash(e.target.value)}
                                      className="flex-1 h-14 bg-[var(--bg-overlay)] rounded-2xl px-5 text-[20px] font-black text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] border border-[var(--border-normal)] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center number-fmt-primary"
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
                                    className={"text-center rounded-2xl py-3 px-4 text-sm font-black border " + (Number(actualCash) - expected >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700")}
                                  >
                                    الفرق: {Number(actualCash) - expected >= 0 ? "+" : ""}{fmt(Number(actualCash) - expected)} ج.م
                                  </motion.div>
                                )}
                                {actualCash && (
                                  <div className="rounded-xl border border-[var(--border-normal)] bg-[var(--bg-overlay)] px-4 py-3">
                                    <div className="mb-2 flex items-center gap-2 text-2sm font-black text-[var(--text-secondary)]">
                                      <Sparkles className="h-4 w-4 text-amber-500" /> مساعد العجز والزيادة
                                    </div>
                                    <div className="space-y-1">
                                      {discrepancySuggestions.map((tip, idx) => (
                                        <div key={idx} className="text-2sm font-bold text-[var(--text-secondary)] leading-5">• {tip}</div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(isToday && !isClosed) && (
                                  <>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-2sm font-black uppercase tracking-widest text-[var(--text-secondary)]">ملاحظة على العد (اختياري)</label>
                                      <textarea
                                        value={closeNotes}
                                        onChange={(e) => setCloseNotes(e.target.value)}
                                        className="w-full h-16 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 placeholder:text-[var(--text-muted)] transition-all"
                                        placeholder="مثال: نقص 100 ج.م — راجع آخر فاتورة"
                                      />
                                    </div>
                                    <motion.button
                                      whileTap={{ scale: 0.98 }}
                                      onClick={handleSaveCount}
                                      disabled={savingCount || actualCash === ""}
                                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-40"
                                    >
                                      <Save className="h-4 w-4" /> {savingCount ? "جارٍ الحفظ..." : "حفظ العد"}
                                    </motion.button>
                                  </>
                                )}

                                {/* ملاحظات اليوم — سجل موحد من ملاحظات اليوم وملاحظات العد */}
                                <div className="flex flex-col gap-2">
                                  {(isToday && !isClosed) && (
                                    <div className="flex flex-col gap-1.5">
                                      <textarea
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        className="w-full h-16 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 placeholder:text-[var(--text-muted)] transition-all"
                                        placeholder="إضافة ملاحظة جديدة..."
                                      />
                                      <button
                                        onClick={handleSaveDayNote}
                                        disabled={dayNoteSaving || !newNoteText.trim()}
                                        className="flex h-9 items-center justify-center gap-2 self-start rounded-xl bg-amber-500 px-4 text-2sm font-black text-white hover:bg-amber-600 disabled:opacity-40 transition-all"
                                      >
                                        <Save className="h-3.5 w-3.5" /> {dayNoteSaving ? "جارٍ الحفظ..." : "إضافة ملاحظة"}
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 text-2sm font-black text-[var(--text-secondary)]">
                                    <History className="h-4 w-4 text-[var(--text-muted)]" /> سجل النشاط
                                    {allNotes.length > 0 && (
                                      <span className="rounded-full bg-[var(--bg-overlay)] px-2 py-0.5 text-[10px] font-black text-[var(--text-muted)]">{allNotes.length}</span>
                                    )}
                                  </div>

                                  {allNotes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[var(--border-normal)] bg-[var(--bg-overlay)] px-4 py-4 text-center text-2sm font-bold text-[var(--text-muted)]">
                                      لا توجد أية أحداث بعد
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
                                      {(showAllNotes ? allNotes : allNotes.slice(0, 2)).map((note) => {
                                        const isCount = note.type === 'count';
                                        const isClose = note.type === 'close';
                                        const ok = isCount && Number(note.discrepancy) >= 0;
                                        return (
                                          <div key={note.id} className={"rounded-xl border px-3.5 py-3 " + (isCount ? (ok ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/60") : isClose ? "border-rose-200 bg-rose-50/60" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]")}>
                                            {isCount ? (
                                              <>
                                                <div className="flex items-center justify-between gap-3">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black text-[var(--text-muted)]">
                                                      <Clock className="h-3 w-3" /> {note.time || '—'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: '#eff6ff', color: '#2563eb' }}>عد</span>
                                                  </div>
                                                  <span className={"number-fmt-primary text-[17px] font-black " + (ok ? "text-emerald-700" : "text-rose-700")}>{fmt(note.amount)} ج.م</span>
                                                </div>
                                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                                  <div className="text-[10px] font-bold text-[var(--text-muted)]">متوقع: <span className="number-fmt-primary">{fmt(note.expected_cash)}</span></div>
                                                  <div className={"text-2sm font-black " + (ok ? "text-emerald-700" : "text-rose-700")}>
                                                    {ok ? '+' : ''}{fmt(note.discrepancy)} ج.م
                                                  </div>
                                                </div>
                                                {note.text && (
                                                  <div className="mt-1.5 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5 text-2sm font-bold text-[var(--text-secondary)]">{note.text}</div>
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-overlay)] px-2 py-0.5 text-[10px] font-black text-[var(--text-muted)]">
                                                    <Clock className="h-3 w-3" /> {note.time || '—'}
                                                  </span>
                                                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black" style={isClose ? { background: '#fef2f2', color: '#dc2626' } : { background: '#fffbeb', color: '#d97706' }}>
                                                    {note.source}
                                                  </span>
                                                </div>
                                                <p className="text-sm font-bold text-[var(--text-primary)] whitespace-pre-wrap leading-snug">{note.text}</p>
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {allNotes.length > 2 && (
                                    <button onClick={() => setShowAllNotes(!showAllNotes)} className="flex items-center justify-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 text-2sm font-black text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-all">
                                      {showAllNotes ? <>إخفاء <ChevronUp className="h-4 w-4" /></> : <>عرض الكل ({allNotes.length - 2} أخرى) <ChevronDown className="h-4 w-4" /></>}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                        {/* Bottom Half: Payment Methods (The Rest) */}
                          <div className="flex flex-col gap-5">
                            {/* Daily movement per payment method (wallets / bank) */}
                            <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-normal)] shadow-sm overflow-hidden flex flex-col">
                              <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-slate-50/80 flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center ring-1 ring-inset ring-violet-200 shrink-0">
                                  <CreditCard className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[15px] font-black text-[var(--text-primary)] leading-tight">حركة الوسائل اليوم</h4>
                                  <p className="text-[11px] font-bold text-[var(--text-secondary)] mt-0.5">المحافظ والبنوك — خارج درج النقد</p>
                                </div>
                              </div>

                              <div className="p-3 flex-1 space-y-2">
                                {methodTotals.length === 0 ? (
                                  <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center px-4 py-6">
                                    <CreditCard className="h-8 w-8 text-slate-200 mb-2" />
                                    <span className="text-2sm font-black text-[var(--text-muted)]">لا توجد وسائل دفع إضافية</span>
                                    <span className="text-[11px] font-bold text-[var(--text-muted)] mt-1">أضف محفظة أو بنك من شاشة وسائل الدفع</span>
                                  </div>
                                ) : (
                                  methodTotals.map((m) => {
                                    const net = Number(m.net || 0);
                                    const hasMovement = Number(m.in || 0) !== 0 || Number(m.out || 0) !== 0;
                                    const isInActive = methodFilter?.methodId === m.id && methodFilter?.direction === "in";
                                    const isOutActive = methodFilter?.methodId === m.id && methodFilter?.direction === "out";
                                    return (
                                      <div
                                        key={m.id}
                                        className={`rounded-2xl border p-3 transition-all ${isInActive || isOutActive ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400" : hasMovement ? "bg-[var(--bg-surface)] border-[var(--border-normal)]" : "bg-slate-50/60 border-[var(--border-subtle)]"}`}
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[18px] leading-none shrink-0">{m.icon || "💳"}</span>
                                             <span className="text-sm font-black text-[var(--text-primary)] whitespace-normal break-words leading-tight">{m.name}</span>
                                          </div>
                                          <div className="flex flex-col items-end shrink-0">
                                            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">الصافي</span>
                                            <span className={`number-fmt-primary text-[15px] leading-none ${net > 0 ? "text-emerald-600" : net < 0 ? "text-rose-600" : "text-[var(--text-muted)]"}`}>
                                              {net > 0 ? "+" : net < 0 ? "−" : ""}{fmt(Math.abs(net))}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleMethodClick(m.id, m.name, "in"); }}
                                            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all w-full ${isInActive ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-400 scale-[1.02]" : "bg-emerald-50 border-emerald-100 hover:bg-emerald-100"}`}
                                          >
                                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600">
                                              <TrendingUp className="h-3 w-3" /> داخل
                                            </span>
                                            <span className="number-fmt-primary text-2sm text-emerald-700">{fmt(m.in)}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleMethodClick(m.id, m.name, "out"); }}
                                            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all w-full ${isOutActive ? "bg-rose-100 border-rose-400 ring-2 ring-rose-400 scale-[1.02]" : "bg-rose-50 border-rose-100 hover:bg-rose-100"}`}
                                          >
                                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-600">
                                              <TrendingDown className="h-3 w-3" /> خارج
                                            </span>
                                            <span className="number-fmt-primary text-2sm text-rose-700">{fmt(m.out)}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
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
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)] group-focus-within:text-[var(--text-primary)] transition-colors" />
                    <input
                      value={globalAmountSearch}
                      onChange={(e) => { setGlobalAmountSearch(e.target.value); if (e.target.value) setActiveTab("all"); }}
                      placeholder="البحث الشامل برقم الفاتورة، المبلغ، أو اسم العميل..."
                      className="w-full h-12 bg-white/80 backdrop-blur-xl rounded-2xl pr-12 pl-4 text-sm font-bold text-[var(--text-primary)] outline-none transition-all focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-zinc-900/5 shadow-sm border border-slate-200/60 placeholder:text-[var(--text-muted)]"
                    />
                    {globalAmountSearch && (
                      <button onClick={() => setGlobalAmountSearch("")} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--bg-overlay)] rounded-full p-1 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {methodFilter && (
                      <div className="flex items-center gap-2 mt-2 px-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 border border-indigo-200 px-3 py-1 text-[11px] font-black text-indigo-700">
                          {methodFilter.methodName} :: {methodFilter.direction === "in" ? "داخل" : "خارج"}
                          <button onClick={() => setMethodFilter(null)} className="mr-1 text-indigo-400 hover:text-indigo-700">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transaction Explorer */}
                  <div data-help="main-table" className="rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden flex-1">
                    {/* Tab bar */}
                    <div className="flex items-center gap-1.5 border-b border-slate-100/80 px-3 py-2 overflow-x-auto scrollbar-hide">
                      {TABS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTab(t.id); setGlobalAmountSearch(""); setActiveEquationRowId(null); setTxAffects(null); setMethodFilter(null); }}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${activeTab === t.id ? "bg-primary text-white shadow-md shadow-zinc-900/20" : "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                            }`}
                        >
                          {t.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 mr-auto shrink-0 pr-3">
                        <button
                          onClick={() => { setShowCancelled(v => !v); setMethodFilter(null); }}
                          className={`h-8 px-3 rounded-lg text-[11px] font-black border transition-colors ${showCancelled ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-[var(--bg-overlay)] border-[var(--border-normal)] text-[var(--text-secondary)] hover:border-slate-300"}`}
                        >
                          {showCancelled ? "إخفاء الملغيات" : "إظهار الملغيات"}
                        </button>
                        <div className="relative">
                          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
                          <select
                            value={txSort}
                            onChange={(e) => { setTxSort(e.target.value); setMethodFilter(null); }}
                            className="h-8 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border-normal)] pl-3 pr-8 text-[11px] font-black outline-none text-[var(--text-secondary)] focus:border-zinc-400 appearance-none cursor-pointer"
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
                          <RefreshCw className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
                        </div>
                      ) : sortedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-[var(--text-muted)] gap-3">
                          <FileText className="h-10 w-10 text-slate-200" />
                          <span className="text-sm font-black">لا توجد حركات مسجلة في هذا التبويب</span>
                        </div>
                      ) : (
                        <>
                        <table className="w-full text-center border-collapse [&_td]:align-middle">
                          <thead className="sticky top-0 z-10 bg-[var(--bg-surface)] backdrop-blur-xl shadow-[0_1px_0_0_#f1f5f9]">
                            <tr className="border-b border-[var(--border-normal)]">
                              {["الكود", "النوع", "المبلغ", "الطرف / الوصف", "المستخدم", "الوقت", "إجراءات"].map((h, i) => (
                                <th key={h} className={`px-3 py-3 text-[11px] font-black uppercase text-[var(--text-muted)] tracking-widest select-none text-center border-r border-slate-200/70 last:border-r-0 ${i === 0 ? 'rounded-tr-xl' : ''} ${i === 6 ? 'rounded-tl-xl' : ''}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70">
                            <AnimatePresence>
                              {paginatedTransactions.map((t) => (
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
                                      : methodFilter
                                        ? txMatchesMethod(t, methodFilter)
                                          ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                                          : "opacity-30"
                                        : txAffects
                                          ? ""
                                          : activeEquationRow
                                            ? activeEquationRow.matchTx(t)
                                              ? "bg-indigo-50 ring-1 ring-inset ring-indigo-300"
                                              : "opacity-30"
                                            : ""
                                    }`}
                                >
                                  <td className={`px-3 py-3.5 font-black text-[11px] tracking-wider text-center border-r border-slate-200/70 ${t.is_cancelled ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]"}`}>{t.doc_no || `#${t.id}`}</td>
                                  <td className="px-3 py-3.5 border-r border-slate-200/70">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      <span className={`inline-flex items-center justify-center rounded-lg border px-2 py-0.5 text-[9px] font-black ${
                                        (t.is_cancelled || t.doc_type === 'cancelled_invoice')
                                          ? "text-rose-700 bg-rose-50 border-rose-200 line-through opacity-60"
                                          : t.doc_type === "purchase"
                                            ? ({ cash: "text-emerald-700 bg-emerald-50 border-emerald-200", credit: "text-amber-700 bg-amber-50 border-amber-200", future_due: "text-amber-700 bg-amber-50 border-amber-200", multi: "text-indigo-700 bg-indigo-50 border-indigo-200", bank_transfer: "text-blue-700 bg-blue-50 border-blue-200" }[t.payment_type] || "text-orange-700 bg-orange-50 border-orange-200")
                                            : (DOC_TYPE_COLOR[t.doc_type] || "text-[var(--text-secondary)] bg-[var(--bg-overlay)] border-[var(--border-normal)]")
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
                                  <td className="px-2 py-2 min-w-[260px] w-[280px] border-r border-slate-200/70">
                                    <div className="flex justify-center">
                                      <div className="w-full max-w-[270px]">
                                        <AmountCell t={t} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3.5 text-[var(--text-secondary)] text-[11px] font-bold text-center max-w-[180px] truncate border-r border-slate-200/70">
                                    {t.party || t.description || "—"}
                                  </td>
                                  <td className="px-3 py-3.5 text-[var(--text-secondary)] text-[11px] whitespace-nowrap text-center font-bold border-r border-slate-200/70">
                                    {t.seller_name || t.cancelled_by_name || "—"}
                                  </td>
                                  <td className="px-3 py-3.5 text-[var(--text-muted)] text-[11px] whitespace-nowrap text-center font-medium border-r border-slate-200/70">
                                    {t.created_at
                                      ? new Date(t.created_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: true })
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5 opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setSlideOver(t)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] shadow-sm transition-all"
                                        title="عرض التفاصيل"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={handlePrint}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-secondary)] hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all"
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
                          <tfoot className="sticky bottom-0 bg-[var(--bg-surface)] backdrop-blur-xl shadow-[0_-1px_0_0_#f1f5f9]">
                            <tr>
                              <td className="px-3 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[11px]" colSpan={2}>
                                الإجمالي للتبويب الحالي
                              </td>
                              <td className="number-fmt-primary text-zinc-950 text-sm">
                                {fmt(txTotal)} ج.م
                              </td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        </table>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-slate-50/50" dir="ltr">
                            <div className="text-[11px] font-bold text-[var(--text-muted)]">
                              {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, sortedTransactions.length)} من {sortedTransactions.length}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-black text-sm hover:bg-[var(--bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >‹</button>
                              {(() => {
                                const pages = [];
                                for (let i = Math.max(1, safePage - 2); i <= Math.min(totalPages, safePage + 2); i++) pages.push(i);
                                return pages.map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-black transition-all ${p === safePage ? "bg-primary text-white shadow-md" : "bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"}`}
                                  >{p}</button>
                                ));
                              })()}
                              <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-black text-sm hover:bg-[var(--bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >›</button>
                            </div>
                          </div>
                        )}
                      </>
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
              className="relative w-full max-w-2xl bg-[var(--bg-surface)] shadow-2xl rounded-[2rem] flex flex-col overflow-hidden my-20 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4 bg-slate-50/50">
                <div>
                  <h2 className="text-[16px] font-black text-[var(--text-primary)]">
                    {DOC_TYPE_LABEL[slideOver.doc_type] || "مستند مالية"}
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)] font-bold font-mono tracking-wider mt-0.5">{slideOver.doc_no || "#" + slideOver.id}</p>
                </div>
                <button onClick={() => { setSlideOver(null); setSlideOverDetails(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors shadow-sm">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-base)]">
                {/* Header Summary */}
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/60 shadow-sm overflow-hidden mb-4">
                  <div className={"p-4 text-center border-b border-[var(--border-subtle)] " + (DOC_TYPE_COLOR[slideOver.doc_type] || "bg-[var(--bg-surface)]")}>
                    <div className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-1">القيمة</div>
                    <div className="number-fmt-primary text-[28px] leading-none tracking-tighter">
                      {fmt(slideOver.amount)}
                    </div>
                    <div className="text-[11px] font-bold mt-1 opacity-70">جنيه مصري</div>
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
                      <div key={label} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                        <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">{label}</span>
                        <span className="text-2sm font-bold text-[var(--text-primary)] text-right truncate">{value}</span>
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
                        <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/60 shadow-sm overflow-hidden">
                          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-slate-50/50 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                            <span className="text-2sm font-black text-[var(--text-secondary)]">تفاصيل الاسترداد</span>
                          </div>
                          <div className="p-3 flex flex-wrap items-stretch gap-0 bg-slate-50/80 border-b border-slate-200/80">
                            {/* Total */}
                            <div className="flex flex-col items-end justify-center px-4 py-2.5 min-w-[110px]">
                              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-0.5">إجمالي المرتجع</span>
                              <div className="number-fmt-primary text-[18px] text-[var(--text-primary)] leading-none">
                                {fmt(total)} <span className="text-[11px] font-bold text-[var(--text-muted)]">ج.م</span>
                              </div>
                            </div>
                            {cashAmt > 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-emerald-50/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-[var(--text-muted)] tracking-wider mb-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                    {isSalesReturn ? "نقداً — صندوق" : "نقداً مُستردّ"}
                                  </span>
                                  <div className="number-fmt-primary text-[16px] text-emerald-700 leading-none">
                                    {fmt(cashAmt)} <span className="text-[11px] font-bold">ج.م</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {creditAmt > 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-blue-50/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-[var(--text-muted)] tracking-wider mb-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                    {isSalesReturn ? "رصيد حساب العميل" : "خصم من ذمة المورد"}
                                  </span>
                                  <div className="number-fmt-primary text-[16px] text-blue-700 leading-none">
                                    {fmt(creditAmt)} <span className="text-[11px] font-bold">ج.م</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {cashAmt < 0.005 && creditAmt < 0.005 && (
                              <>
                                <div className="w-px self-stretch bg-slate-200/80" />
                                <div className="flex flex-col items-end justify-center px-4 py-2.5 bg-slate-100/80 min-w-[110px]">
                                  <span className="text-[8px] font-black text-[var(--text-muted)] tracking-wider mb-0.5">صفر نقدي</span>
                                  <span className="text-[11px] font-black text-[var(--text-secondary)]">لا يؤثر على الخزنة</span>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Metadata rows */}
                          <div className="divide-y divide-slate-50">
                            {isSalesReturn && slideOverDetails?.invoice_id && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">المصدر</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-indigo-50 text-indigo-700 border-indigo-200">
                                  <FileText className="w-3 h-3" /> من فاتورة سابقة
                                </span>
                              </div>
                            )}
                            {isSalesReturn && !slideOverDetails?.invoice_id && slideOverDetails && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">المصدر</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-amber-50 text-amber-700 border-amber-200">
                                  <RotateCcw className="w-3 h-3" /> مرتجع مباشر
                                </span>
                              </div>
                            )}
                            {(slideOver.description || slideOverDetails?.reason) && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">السبب</span>
                                <span className="text-2sm font-bold text-[var(--text-primary)] text-right">
                                  {REASON_MAP[slideOver.description || slideOverDetails?.reason] || slideOver.description || slideOverDetails?.reason || "أخرى"}
                                </span>
                              </div>
                            )}
                            {slideOverDetails?.original_invoice_no && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">الفاتورة الأصلية</span>
                                <span className="text-2sm font-black text-indigo-700 font-mono">{slideOverDetails.original_invoice_no}</span>
                              </div>
                            )}
                            {(slideOverDetails?.notes || slideOver.notes) && (
                              <div className="flex items-center justify-between gap-4 px-3 py-2.5 hover:bg-[var(--bg-overlay)] transition-colors">
                                <span className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest shrink-0">ملاحظات</span>
                                <span className="text-2sm font-bold text-zinc-700 text-right truncate">{slideOverDetails?.notes || slideOver.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Return Lines */}
                    <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/60 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-slate-50/50 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-2sm font-black text-[var(--text-secondary)]">الأصناف المرتجعة</span>
                      </div>
                      {slideOverLoading ? (
                        <div className="p-6 text-center text-2sm text-[var(--text-muted)] animate-pulse">جاري تحميل التفاصيل...</div>
                      ) : slideOverDetails?.lines?.length ? (
                        <div className="divide-y divide-slate-100">
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[var(--bg-overlay)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                            <div className="col-span-5">الصنف</div>
                            <div className="col-span-2 text-center">الكمية</div>
                            <div className="col-span-2 text-center">السعر</div>
                            <div className="col-span-3 text-left">الإجمالي</div>
                          </div>
                          {slideOverDetails.lines.map((line, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50/50 transition-colors">
                              <div className="col-span-5 flex flex-col min-w-0">
                                <span className="text-[11px] font-black text-[var(--text-primary)] whitespace-normal break-words leading-tight">{line.item_name || line.name}</span>
                                <span className="text-[9px] font-mono text-[var(--text-muted)] whitespace-normal break-words leading-tight">{line.item_code || "#" + line.item_id}</span>
                              </div>
                              <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{line.quantity}</div>
                              <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{fmt(line.unit_price)}</div>
                              <div className="col-span-3 text-left number-fmt text-[11px] text-rose-700">{fmt(line.line_total || line.unit_price * line.quantity)}</div>
                            </div>
                          ))}
                          <div className="bg-primary text-white px-3 py-3 flex justify-between text-2sm font-black">
                            <span className="text-[var(--text-muted)]">الإجمالي</span>
                            <span className="number-fmt-primary">{fmt(slideOver.amount)} ج.م</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-2sm text-[var(--text-muted)]">لا توجد تفاصيل متاحة</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Lines for POS Invoice */}
                {["pos_invoice", "installment_invoice", "credit_invoice"].includes(slideOver.doc_type) && (
                  <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-slate-50/50 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                      <span className="text-2sm font-black text-[var(--text-secondary)]">تفاصيل الفاتورة</span>
                    </div>
                    {slideOverLoading ? (
                      <div className="p-6 text-center text-2sm text-[var(--text-muted)] animate-pulse">جاري تحميل التفاصيل...</div>
                    ) : slideOverDetails?.lines?.length ? (
                      <div className="divide-y divide-slate-100">
                        {/* Column Headers */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[var(--bg-overlay)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
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
                              <span className="text-[11px] font-black text-[var(--text-primary)] whitespace-normal break-words leading-tight">{line.item_name || line.name}</span>
                              <span className="text-[9px] font-mono text-[var(--text-muted)] whitespace-normal break-words leading-tight">{line.code || line.item_code || "#" + line.item_id}</span>
                            </div>
                            <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{line.quantity}</div>
                            <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{fmt(line.unit_price)}</div>
                            <div className="col-span-1 text-center number-fmt text-[11px] text-amber-600">{line.line_discount || line.discount || "—"}</div>
                            <div className="col-span-2 text-left number-fmt text-[11px] text-emerald-700">{fmt((line.unit_price * line.quantity) - (line.line_discount || 0))}</div>
                          </div>
                        ))}
                        {/* Totals */}
                        <div className="bg-primary text-white px-3 py-3">
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span className="text-[var(--text-muted)]">الفرعي</span>
                            <span className="number-fmt-primary">{fmt(slideOverDetails.subtotal)}</span>
                          </div>
                          {Number(slideOverDetails.discount) > 0 && (
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span className="text-[var(--text-muted)]">الخصم</span>
                              <span className="number-fmt-primary text-rose-300">- {fmt(slideOverDetails.discount)}</span>
                            </div>
                          )}
                          {Number(slideOverDetails.increase) > 0 && (
                            <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span className="text-[var(--text-muted)]">الإضافة</span>
                              <span className="number-fmt-primary text-emerald-300">+ {fmt(slideOverDetails.increase)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-2sm font-black border-t border-slate-700 pt-2 mt-2">
                            <span>الإجمالي</span>
                            <span className="number-fmt-primary">{fmt(slideOverDetails.total)} ج.م</span>
                          </div>
                          {["multi", "installments", "credit"].includes(slideOverDetails.payment_type) && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">توزيع طرق الدفع</div>
                              <div className="flex flex-col gap-1.5">
                                {slideOverDetails.payment_type === "multi" && slideOverDetails.payments?.length > 0 && (
                                  slideOverDetails.payments.map((p, i) => {
                                    const isCash = p.method === "cash";
                                    return (
                                      <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${isCash ? "bg-emerald-900/40 border border-emerald-700/40" : "bg-slate-700/40 border border-slate-600/40"}`}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-black text-white">{p.method_name || arMethod(p.method)}</span>
                                          {!isCash && (
                                            <span className="text-[8px] font-bold text-[var(--text-muted)] bg-slate-600/50 px-1.5 py-0.5 rounded">لا يؤثر على حساب الخزنة</span>
                                          )}
                                        </div>
                                        <span className={`number-fmt-primary text-[11px] ${isCash ? "text-emerald-300" : "text-[var(--text-muted)]"}`}>{fmt(p.amount)} ج.م</span>
                                      </div>
                                    );
                                  })
                                )}
                                {slideOverDetails.payment_type === "installments" && (
                                  <>
                                    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-emerald-900/40 border border-emerald-700/40">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-black text-white">💰 نقداً (دفعة مقدم)</span>
                                        <span className="text-[8px] font-bold text-emerald-300 bg-emerald-800/50 px-1.5 py-0.5 rounded">يضاف للخزنة</span>
                                      </div>
                                      <span className="number-fmt-primary text-[11px] text-emerald-300">{fmt(Number(slideOverDetails.amount_received || 0))} ج.م</span>
                                    </div>
                                    {Number(slideOverDetails.total) > Number(slideOverDetails.amount_received || 0) && (
                                      <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-violet-900/40 border border-violet-700/40">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-black text-white">📋 آجل (قسط)</span>
                                          <span className="text-[8px] font-bold text-violet-300 bg-violet-800/50 px-1.5 py-0.5 rounded">يضاف لذمة العميل</span>
                                        </div>
                                        <span className="number-fmt-primary text-[11px] text-violet-300">{fmt(Number(slideOverDetails.total) - Number(slideOverDetails.amount_received || 0))} ج.م</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {slideOverDetails.payment_type === "credit" && (
                                  <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-amber-900/40 border border-amber-700/40">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-black text-white">📋 آجل (كامل المبلغ)</span>
                                      <span className="text-[8px] font-bold text-amber-300 bg-amber-800/50 px-1.5 py-0.5 rounded">يضاف لذمة العميل</span>
                                    </div>
                                    <span className="number-fmt-primary text-[11px] text-amber-300">{fmt(slideOverDetails.total)} ج.م</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-2sm text-[var(--text-muted)]">لا توجد تفاصيل متاحة</div>
                    )}
                  </div>
                )}

                {/* Purchase invoice detail */}
                {slideOver.doc_type === "purchase" && (
                  <div className="rounded-2xl bg-[var(--bg-surface)] border border-slate-200/60 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-slate-50/50 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--text-muted)]" />
                      <span className="text-2sm font-black text-[var(--text-secondary)]">تفاصيل فاتورة الشراء</span>
                    </div>
                    {slideOverLoading ? (
                      <div className="p-6 text-center text-2sm text-[var(--text-muted)] animate-pulse">جاري تحميل التفاصيل...</div>
                    ) : slideOverDetails?.lines?.length ? (
                      <div className="divide-y divide-slate-100">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[var(--bg-overlay)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                          <div className="col-span-6">الصنف</div>
                          <div className="col-span-2 text-center">الكمية</div>
                          <div className="col-span-2 text-center">التكلفة</div>
                          <div className="col-span-2 text-left">الإجمالي</div>
                        </div>
                        {slideOverDetails.lines.map((line, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center hover:bg-slate-50/50">
                            <div className="col-span-6 flex flex-col min-w-0">
                              <span className="text-[11px] font-black text-[var(--text-primary)] whitespace-normal break-words leading-tight">{line.item_name_ar || line.item_name || line.name}</span>
                              <span className="text-[9px] font-mono text-[var(--text-muted)] whitespace-normal break-words leading-tight">{line.item_code || line.code || line.barcode || "#" + line.item_id}</span>
                            </div>
                            <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{line.quantity}</div>
                            <div className="col-span-2 text-center number-fmt text-[11px] text-[var(--text-secondary)]">{fmt(line.unit_cost)}</div>
                            <div className="col-span-2 text-left number-fmt text-[11px] text-orange-700">{fmt(line.line_total || (line.unit_cost * line.quantity))}</div>
                          </div>
                        ))}
                        <div className="bg-primary text-white px-3 py-3">
                          {Number(slideOverDetails.discount) > 0 && (
                            <div className="flex justify-between text-[11px] font-bold mb-1"><span className="text-[var(--text-muted)]">الخصم</span><span className="number-fmt-primary text-rose-300">- {fmt(slideOverDetails.discount)}</span></div>
                          )}
                          {Number(slideOverDetails.increase) > 0 && (
                            <div className="flex justify-between text-[11px] font-bold mb-1"><span className="text-[var(--text-muted)]">الإضافة</span><span className="number-fmt-primary text-emerald-300">+ {fmt(slideOverDetails.increase)}</span></div>
                          )}
                          <div className="flex justify-between text-2sm font-black border-t border-slate-700 pt-2 mt-1">
                            <span>الإجمالي</span><span className="number-fmt-primary">{fmt(slideOverDetails.total)} ج.م</span>
                          </div>
                          {slideOverDetails.payment_method === "multi" && slideOverDetails.payments?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700 flex flex-col gap-1.5">
                              <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">توزيع طرق الدفع</div>
                              {slideOverDetails.payments.map((p, i) => {
                                const isCredit = p.method_type === "credit" || p.method_category === "credit";
                                return (
                                  <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${isCredit ? "bg-amber-900/40 border border-amber-700/40" : "bg-emerald-900/40 border border-emerald-700/40"}`}>
                                    <span className="text-[11px] font-black text-white">{p.method_name || arMethod(p.method)} {isCredit && <span className="text-[8px] text-amber-300">(آجل — ذمة المورد)</span>}</span>
                                    <span className={`number-fmt-primary text-[11px] ${isCredit ? "text-amber-300" : "text-emerald-300"}`}>{fmt(p.amount)} ج.م</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(slideOverDetails.payment_method === "credit" || slideOverDetails.payment_method === "future_due") && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-amber-900/40 border border-amber-700/40">
                                <span className="text-[11px] font-black text-white">📋 آجل (كامل المبلغ — ذمة المورد)</span>
                                <span className="number-fmt-primary text-[11px] text-amber-300">{fmt(slideOverDetails.total)} ج.م</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-2sm text-[var(--text-muted)]">لا توجد تفاصيل متاحة</div>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--bg-surface)] flex gap-2">
                {slideOver.doc_type === "purchase" && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (slideOverDetails?.has_returns) { setReturnsWarningOpen(true); return; }
                      setSlideOver(null); setSlideOverDetails(null); navigate("/purchases/" + slideOver.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-2sm font-black text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح / تعديل الفاتورة
                  </motion.button>
                )}
                {["pos_invoice", "installment_invoice", "credit_invoice"].includes(slideOver.doc_type) && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.open("/invoices/" + slideOver.id, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-2sm font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح الفاتورة الكاملة
                  </motion.button>
                )}
                {slideOver.doc_type === "sales_return" && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSlideOver(null); setSlideOverDetails(null); navigate("/pos/sales-returns/" + slideOver.id); }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pink-600 py-2.5 text-2sm font-black text-white hover:bg-pink-700 shadow-lg shadow-pink-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح / تعديل المرتجع
                  </motion.button>
                )}
                {slideOver.doc_type === "purchase_return" && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSlideOver(null); setSlideOverDetails(null); navigate("/purchases/returns/" + slideOver.id); }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-2sm font-black text-white hover:bg-amber-700 shadow-lg shadow-amber-600/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> فتح / تعديل المرتجع
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-2sm font-black text-white hover:bg-primary-600 shadow-lg shadow-zinc-950/20"
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

      <ReturnsWarningModal
        open={returnsWarningOpen}
        onClose={() => setReturnsWarningOpen(false)}
      />

      {/* History Modal */}
      <AnimatePresence>
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
            <motion.div variants={modalVariants} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-[2rem] bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-subtle)] flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-slate-50/70 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><History className="h-5 w-5" /></div>
                  <div><h2 className="text-[18px] font-black text-[var(--text-primary)]">سجل اليوميات السابقة</h2><p className="text-[11px] font-bold text-[var(--text-muted)]">بحث، فلترة، ومعاينة مركزية بدون درج جانبي</p></div>
                </div>
                <button onClick={() => setHistoryOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors shadow-sm"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-3">
                <div className="relative flex-1 min-w-[240px]"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="بحث بتاريخ اليوم أو ملاحظات الإغلاق" className="h-10 w-full rounded-xl border border-[var(--border-normal)] bg-[var(--bg-overlay)] pr-9 pl-3 text-2sm font-bold outline-none focus:border-indigo-500 focus:bg-[var(--bg-surface)]" /></div>
                <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="h-10 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-3 text-2sm font-black text-[var(--text-secondary)] outline-none focus:border-indigo-500"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="closed">مغلق</option></select>
                <button onClick={() => { setHistorySearch(""); setHistoryStatus(""); }} className="h-10 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] px-3 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]">مسح الفلاتر</button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[var(--bg-base)]">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-right">
                  <thead><tr className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest"><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">رصيد سابق</th><th className="px-3 py-2">إجراءات</th></tr></thead>
                  <tbody>
                    {pastSessions.map((s) => (
                      <tr key={s.id} className="rounded-2xl bg-[var(--bg-surface)] shadow-sm ring-1 ring-slate-200/70">
                        <td className="rounded-r-2xl px-3 py-3 font-black text-[var(--text-primary)]">{s.date}</td>
                        <td className="px-3 py-3"><span className={"inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-black " + (s.status === "closed" ? "bg-[var(--bg-overlay)] text-[var(--text-secondary)]" : "bg-emerald-100 text-emerald-700")}>{s.status === "closed" ? <Lock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{s.status === "closed" ? "مغلق" : "مفتوح"}</span></td>
                        <td className="px-3 py-3 number-fmt text-2sm text-[var(--text-secondary)]">{fmt(s.previous_balance)}</td>
                        <td className="rounded-l-2xl px-3 py-3"><button onClick={() => { setDate(s.date); setHistoryOpen(false); setActiveTab("all"); }} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[11px] font-black text-white hover:bg-primary-600"><Eye className="h-3.5 w-3.5" /> معاينة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pastSessions.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)] gap-3"><History className="h-8 w-8 text-slate-200" /><span className="text-sm font-black">لا توجد يوميات مطابقة</span></div>}
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
              onClick={() => { setQuickSubmitting(false); setQuickModal(null); }}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-[var(--bg-surface)] shadow-2xl p-8 border border-[var(--border-subtle)]" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={"h-12 w-12 rounded-2xl flex items-center justify-center border " + (quickModal === "expense" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                    {quickModal === "expense" ? <TrendingDown className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-[var(--text-primary)] leading-tight">
                      {quickModal === "expense" ? "تسجيل مصروف" : "تسجيل إيراد"}
                    </h2>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">Quick Entry</p>
                  </div>
                </div>
                <button onClick={() => { setQuickSubmitting(false); setQuickModal(null); }} className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">القيمة (ج.م)</label>
                  <input
                    ref={quickAmountRef}
                    type="number"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: quickNoteRef })}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] px-4 text-[20px] font-black number-fmt-primary outline-none focus:border-zinc-400 focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">البيان / الوصف</label>
                  <input
                    ref={quickNoteRef}
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: quickCategoryRef, prevRef: quickAmountRef })}
                    placeholder="سبب المعاملة..."
                    className="w-full h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-normal)] px-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">الفئة</label>
                  <select
                    ref={quickCategoryRef}
                    value={quickCategoryId}
                    onChange={(e) => setQuickCategoryId(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: quickSubmitRef, prevRef: quickNoteRef })}
                    className={`w-full h-12 rounded-2xl bg-[var(--bg-surface)] border px-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none ${!quickCategoryId ? "border-rose-300 focus:border-rose-400" : "border-[var(--border-normal)] focus:border-zinc-400"}`}
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
                    ref={quickSubmitRef}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleQuickSave}
                    onKeyDown={e => handleKeyDown(e, { prevRef: quickCategoryRef, onEnter: handleQuickSave })}
                    disabled={!quickAmount || !quickCategoryId || quickSubmitting}
                    className={"w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-black text-white transition-all shadow-xl disabled:opacity-40 " + (quickModal === "expense" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20")}
                  >
                    <CheckCircle2 className="h-5 w-5" /> {quickSubmitting ? "جارٍ الحفظ..." : "حفظ واعتماد"}
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
              onClick={() => { setWithdrawalSubmitting(false); setWithdrawalOpen(false); }}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-[var(--bg-surface)] shadow-2xl p-8 border border-[var(--border-subtle)]" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[var(--bg-overlay)] text-[var(--text-secondary)] flex items-center justify-center border border-[var(--border-normal)]">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-[var(--text-primary)] leading-tight">تسجيل مسحوبات</h2>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">Cash Withdrawal</p>
                  </div>
                </div>
                <button onClick={() => { setWithdrawalSubmitting(false); setWithdrawalOpen(false); }} className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--bg-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">القيمة (ج.م)</label>
                  <input
                    ref={withdrawalAmountRef}
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: withdrawalNoteRef })}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] px-4 text-[20px] font-black number-fmt-primary outline-none focus:border-zinc-400 focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">البيان / الوصف</label>
                  <input
                    ref={withdrawalNoteRef}
                    type="text"
                    value={withdrawalNote}
                    onChange={(e) => setWithdrawalNote(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: withdrawalCategoryRef, prevRef: withdrawalAmountRef })}
                    placeholder="سبب المسحوبات..."
                    className="w-full h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-normal)] px-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">التصنيف</label>
                  <select
                    ref={withdrawalCategoryRef}
                    value={withdrawalCategoryId}
                    onChange={(e) => setWithdrawalCategoryId(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: withdrawalPaymentRef, prevRef: withdrawalNoteRef })}
                    className={`w-full h-12 rounded-2xl bg-[var(--bg-surface)] border px-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none ${!withdrawalCategoryId ? "border-rose-300 focus:border-rose-400" : "border-[var(--border-normal)] focus:border-zinc-400"}`}
                    required
                  >
                    <option value="">— اختر التصنيف (مطلوب) —</option>
                    {withdrawalCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)]">طريقة الدفع</label>
                  <select
                    ref={withdrawalPaymentRef}
                    value={withdrawalPaymentMethod}
                    onChange={(e) => setWithdrawalPaymentMethod(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: withdrawalSubmitRef, prevRef: withdrawalCategoryRef })}
                    className="w-full h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-normal)] px-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all appearance-none"
                  >
                    <option value="cash">💵 نقدي</option>
                    {recordMethods.map(m => <option key={m.id} value={m.name}>{(m.icon || '💳') + ' ' + m.name}</option>)}
                  </select>
                </div>
                <div className="pt-4">
                  <motion.button
                    ref={withdrawalSubmitRef}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleWithdrawalSave}
                    onKeyDown={e => handleKeyDown(e, { prevRef: withdrawalPaymentRef, onEnter: handleWithdrawalSave })}
                    disabled={!withdrawalAmount || !withdrawalCategoryId || withdrawalSubmitting}
                    className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-black text-white transition-all shadow-xl disabled:opacity-40 bg-primary hover:bg-primary-600 shadow-slate-900/20"
                  >
                    <CheckCircle2 className="h-5 w-5" /> {withdrawalSubmitting ? "جارٍ الحفظ..." : "حفظ واعتماد"}
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
              className="relative w-full max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-subtle)]" dir="rtl"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100/80 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-black text-[var(--text-primary)] leading-tight">آلة الجرد الفعلي</h2>
                    <p className="text-[11px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest">Cash Register</p>
                  </div>
                </div>
                <button onClick={() => setMoneyOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="rounded-3xl bg-[var(--bg-overlay)] border border-slate-200/60 p-4">
                  <div className="grid grid-cols-3 text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3 px-2">
                    <span>الفئة النقدية</span>
                    <span className="text-center">العدد</span>
                    <span className="text-left">الإجمالي الفرعي</span>
                  </div>
                  <div className="space-y-2">
                    {DENOMS.map((d, idx) => (
                      <div key={d} className="grid grid-cols-3 items-center gap-3 bg-[var(--bg-surface)] p-2 rounded-2xl border border-[var(--border-subtle)] shadow-sm transition-colors hover:border-blue-200">
                        <span className="text-sm font-black text-[var(--text-primary)] px-2 flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-emerald-500 opacity-50" />
                          {d >= 1 ? d + " ج" : (d * 100) + " قرش"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          ref={el => { denomRefs.current[idx] = el; }}
                          value={counts[d] || ""}
                          onChange={(e) => setCounts((p) => ({ ...p, [d]: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, { nextRef: idx < DENOMS.length - 1 ? { current: denomRefs.current[idx + 1] } : undefined })}
                          className="h-10 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-normal)] px-3 text-center text-[15px] font-black number-fmt outline-none focus:bg-[var(--bg-surface)] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                          placeholder="0"
                        />
                        <span className="number-fmt-primary text-[15px] text-[var(--text-secondary)] text-left px-2">
                          {fmt(Number(counts[d] || 0) * d)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-100 p-5 shadow-inner">
                  <span className="font-black text-emerald-800 text-sm uppercase tracking-widest">مجموع الجرد الفعلي</span>
                  <div className="flex items-baseline gap-1">
                    <span className="number-fmt-primary text-[28px] text-emerald-700 tracking-tighter leading-none">{fmt(moneyTotal)}</span>
                    <span className="text-2sm font-bold text-emerald-600">ج.م</span>
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
              className="relative w-full max-w-[340px] rounded-[2rem] bg-[var(--bg-surface)] shadow-2xl border border-[var(--border-subtle)] overflow-hidden" dir="rtl"
            >
              {/* Display */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
                <div className="text-right">
                  {calcPrev !== null && calcOp && (
                    <div className="text-2sm text-[var(--text-muted)] font-mono mb-1">
                      {fmt(calcPrev)} {calcOp}
                    </div>
                  )}
                  <div className="text-[36px] font-black font-mono text-white tracking-tight truncate">
                    {calcDisplay.length > 12 ? parseFloat(calcDisplay).toExponential(6) : calcDisplay}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="p-4 bg-[var(--bg-overlay)] grid grid-cols-4 gap-2">
                {/* Row 1 */}
                <button onClick={calcClear} className="h-14 rounded-2xl bg-slate-200 text-[var(--text-secondary)] text-[18px] font-black hover:bg-slate-300 transition-colors">AC</button>
                <button onClick={calcNegate} className="h-14 rounded-2xl bg-slate-200 text-[var(--text-secondary)] text-[18px] font-black hover:bg-slate-300 transition-colors">±</button>
                <button onClick={calcPercent} className="h-14 rounded-2xl bg-slate-200 text-[var(--text-secondary)] text-[18px] font-black hover:bg-slate-300 transition-colors">%</button>
                <button onClick={() => calcOperator("÷")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "÷" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>÷</button>

                {/* Row 2 */}
                <button onClick={() => calcInput("7")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">7</button>
                <button onClick={() => calcInput("8")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">8</button>
                <button onClick={() => calcInput("9")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">9</button>
                <button onClick={() => calcOperator("×")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "×" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>×</button>

                {/* Row 3 */}
                <button onClick={() => calcInput("4")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">4</button>
                <button onClick={() => calcInput("5")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">5</button>
                <button onClick={() => calcInput("6")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">6</button>
                <button onClick={() => calcOperator("-")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "-" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>−</button>

                {/* Row 4 */}
                <button onClick={() => calcInput("1")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">1</button>
                <button onClick={() => calcInput("2")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">2</button>
                <button onClick={() => calcInput("3")} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">3</button>
                <button onClick={() => calcOperator("+")} className={"h-14 rounded-2xl text-[20px] font-black transition-colors " + (calcOp === "+" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200")}>+</button>

                {/* Row 5 */}
                <button onClick={() => calcInput("0")} className="col-span-2 h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">0</button>
                <button onClick={calcDecimal} className="h-14 rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)] text-[20px] font-black hover:bg-[var(--bg-overlay)] transition-colors border border-[var(--border-normal)]">.</button>
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
            <DailyTreasuryTemplate
              data={{
                expected,
                actualCash: actualCash || moneyTotal,
                moneyTotal,
                discrepancy,
                transactions: sortedTransactions,
                date,
                opening_balance,
                closing_balance,
                notes,
                status,
                cashier_name,
                totalIn,
                totalOut,
              }}
              settings={settings}
            />
          )}
        />
      )}
    </div>
  );
}
