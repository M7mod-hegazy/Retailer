import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Calendar, ArrowRight, Wallet, BarChart3,
  Lock, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../services/api";
import { formatNumber } from "../../utils/currency";
import { todayCairo, formatDateTime } from "../../utils/dateHelpers";
import { usePageTour } from '../../hooks/usePageTour';

const fmt = (n) => formatNumber(n ?? 0);
const todayStr = () => todayCairo();

const BUCKET_LABEL = {
  pos_cash_sales: "مبيعات POS نقدية",
  pos_installments: "أقساط نقدية",
  pos_multi_cash: "دفع متعدد (نقدي)",
  pos_credit_sales: "مبيعات آجلة",
  customer_collections: "تحصيلات عملاء",
  revenues_cash: "إيرادات نقدية",
  purchase_returns_cash: "مرتجعات شراء نقدية",
  supplier_cash_payments: "مدفوعات موردين نقدية",
  expenses_cash: "مصروفات نقدية",
  sales_returns_cash: "مرتجعات مبيعات نقدية",
  withdrawals: "مسحوبات",
  non_cash_movements: "حركات غير نقدية",
  purchases_payable: "مشتريات آجلة",
  sales_returns_account: "مرتجعات مبيعات بالحساب",
  purchase_returns_payable: "مرتجعات شراء بالحساب",
};

const DOC_TYPE_LABEL = {
  pos_invoice: "فاتورة POS",
  credit_invoice: "آجل",
  installment_invoice: "تقسيط",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات",
  supplier_payment: "دفع لمورد",
  sales_return: "مرتجع مبيعات",
  purchase_return: "مرتجع مشتريات",
  ajal_payment: "حركة آجل",
  customer_payment: "تحصيل عميل",
  withdrawal: "مسحوب",
  cancelled_invoice: "فاتورة ملغاة (عكس)",
};

function DirectionBadge({ direction, amount }) {
  if (direction === "non_cash") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-bg-overlay text-text-muted border border-border-subtle">
        <Minus className="h-2.5 w-2.5" /> غير نقدي
      </span>
    );
  }
  if (direction === "in") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-success-bg text-success-text border border-success-border">
        <ArrowUpRight className="h-2.5 w-2.5" /> دخل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-danger-bg text-danger-text border border-danger-border">
      <ArrowDownRight className="h-2.5 w-2.5" /> خرج
    </span>
  );
}

export default function CashflowLedgerPage() {
  usePageTour('cashflow_ledger');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") || todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/api/daily-sessions/${date}/cashflow`);
      setData(r.data.data);
    } catch (e) {
      setError(e?.response?.data?.message || "فشل تحميل كشف الحركات");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const cashRows = data?.rows?.filter(r => r.direction !== "non_cash") ?? [];
  const nonCashRows = data?.rows?.filter(r => r.direction === "non_cash") ?? [];
  const totalIn = cashRows.filter(r => r.direction === "in").reduce((s, r) => s + r.cash_effect, 0);
  const totalOut = cashRows.filter(r => r.direction === "out").reduce((s, r) => s + Math.abs(r.cash_effect), 0);

  return (
    <div className="min-h-screen bg-bg-page" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-surface/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-black text-text-primary">كشف الحركات التفصيلي</span>
            <span className="text-border-subtle text-xs font-bold">{date}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-xl border border-border-normal bg-bg-input px-3 text-sm font-bold text-text-secondary outline-none focus:border-primary transition-all"
            />
            <button
              onClick={load}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-normal bg-bg-surface hover:bg-bg-overlay text-text-secondary transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-7 w-7 animate-spin text-text-muted" />
              <span className="text-sm font-black text-text-muted">جاري تحميل الكشف...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-2xl bg-danger-bg border border-danger-border p-5">
            <AlertTriangle className="h-5 w-5 text-danger-text shrink-0" />
            <p className="text-sm font-bold text-danger-text">{error}</p>
          </div>
        ) : !data ? null : (
          <AnimatePresence mode="wait">
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* No-session notice */}
              {!data.has_session && (
                <div className="flex items-start gap-3 rounded-2xl bg-info-bg border border-info-border p-4">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-info-text" />
                  <p className="text-xs font-bold text-info-text">
                    لا توجد جلسة رسمية لهذا اليوم — الأرصدة محسوبة من الحركات المسجلة فقط. قد لا يطابق الكشف ميزان التسوية.
                  </p>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "الرصيد الافتتاحي", value: data.opening_balance, icon: Wallet, color: "text-text-secondary", bg: "bg-bg-surface border-border-normal" },
                  { label: "إجمالي الدخل", value: totalIn, icon: TrendingUp, color: "text-success-text", bg: "bg-success-bg border-success-border" },
                  { label: "إجمالي الخروج", value: totalOut, icon: TrendingDown, color: "text-danger-text", bg: "bg-danger-bg border-danger-border" },
                  { label: "الرصيد الختامي", value: data.closing_balance, icon: BarChart3, color: data.closing_balance >= 0 ? "text-primary" : "text-danger-text", bg: "bg-primary-50 border-primary" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-wide">{label}</span>
                    </div>
                    <p className={`text-xl font-black ${color}`}>{fmt(value)}</p>
                    <p className="text-[10px] text-text-muted font-bold">ج.م.</p>
                  </div>
                ))}
              </div>

              {/* Reconciliation status */}
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                !data.has_session
                  ? "bg-info-bg border-info-border"
                  : data.reconciles
                  ? "bg-success-bg border-success-border"
                  : "bg-warning-bg border-warning-border"
              }`}>
                {!data.has_session ? (
                  <Info className="h-4 w-4 text-info-text shrink-0" />
                ) : data.reconciles ? (
                  <CheckCircle2 className="h-4 w-4 text-success-text shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning-text shrink-0" />
                )}
                <p className={`text-xs font-black ${
                  !data.has_session ? "text-info-text" : data.reconciles ? "text-success-text" : "text-warning-text"
                }`}>
                  {!data.has_session
                    ? "لا توجد جلسة — لا يمكن التحقق من التسوية."
                    : data.reconciles
                    ? `الكشف متوازن: الرصيد الختامي (${fmt(data.closing_balance)}) يطابق المتوقع (${fmt(data.expected_cash)}) ج.م.`
                    : `فرق في التسوية: الختامي ${fmt(data.closing_balance)} ج.م. ← المتوقع ${fmt(data.expected_cash)} ج.م. (فرق ${fmt(data.closing_balance - data.expected_cash)} ج.م.)`}
                </p>
              </div>

              {/* Ledger Table */}
              {cashRows.length === 0 ? (
                <div className="flex items-center justify-center h-40 rounded-2xl border border-dashed border-border-subtle bg-bg-surface">
                  <p className="text-sm font-black text-text-muted">لا توجد حركات نقدية لهذا اليوم.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border-normal bg-bg-surface overflow-hidden shadow-card">
                  {/* Opening balance row */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-bg-overlay border-b border-border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface border border-border-normal">
                        <Wallet className="h-3.5 w-3.5 text-text-muted" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-primary">رصيد افتتاحي</p>
                        <p className="text-[10px] text-text-muted font-bold">بداية يوم {date}</p>
                      </div>
                    </div>
                    <p className="text-base font-black text-text-primary">{fmt(data.opening_balance)} <span className="text-[10px] text-text-muted font-bold">ج.م.</span></p>
                  </div>

                  {/* Ledger rows */}
                  <div className="divide-y divide-border-subtle">
                    {cashRows.map((row, i) => (
                      <motion.div
                        key={`${row.doc_type}-${row.id}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-bg-overlay transition-colors"
                      >
                        {/* Direction indicator */}
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          row.direction === "in" ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"
                        }`}>
                          {row.direction === "in"
                            ? <ArrowUpRight className="h-3.5 w-3.5" />
                            : <ArrowDownRight className="h-3.5 w-3.5" />}
                        </div>

                        {/* Doc info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-text-primary truncate">
                              {DOC_TYPE_LABEL[row.doc_type] || row.doc_type}
                            </span>
                            {row.doc_no && (
                              <span className="text-[10px] font-mono text-text-muted">#{row.doc_no}</span>
                            )}
                            {row.flags?.includes("large") && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-warning-bg text-warning-text border border-warning-border">كبير</span>
                            )}
                            {row.flags?.includes("amended") && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-info-bg text-info-text border border-info-border">معدّل</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {row.party && (
                              <span className="text-[10px] font-bold text-text-muted truncate max-w-[120px]">{row.party}</span>
                            )}
                            {row.created_at && (
                              <span className="text-[10px] text-text-muted font-mono">
                                {row.created_at?.substring(11, 16)}
                              </span>
                            )}
                            {row.bucket_id && BUCKET_LABEL[row.bucket_id] && (
                              <span className="text-[9px] font-bold text-text-muted bg-bg-overlay rounded-full px-1.5 py-0.5">
                                {BUCKET_LABEL[row.bucket_id]}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Effect + running balance */}
                        <div className="text-end shrink-0">
                          <p className={`text-sm font-black ${row.direction === "in" ? "text-success-text" : "text-danger-text"}`}>
                            {row.direction === "in" ? "+" : ""}{fmt(row.cash_effect)}
                          </p>
                          <p className="text-[10px] font-black text-text-muted mt-0.5">
                            = <span className="text-text-primary">{fmt(row.running_balance)}</span>
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Closing balance row */}
                  <div className="flex items-center justify-between px-5 py-3.5 bg-bg-overlay border-t border-border-normal">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        data.closing_balance >= 0 ? "bg-success-bg" : "bg-danger-bg"
                      }`}>
                        <Lock className={`h-3.5 w-3.5 ${data.closing_balance >= 0 ? "text-success-text" : "text-danger-text"}`} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-primary">رصيد ختامي</p>
                        <p className="text-[10px] text-text-muted font-bold">{cashRows.length} حركة نقدية</p>
                      </div>
                    </div>
                    <p className={`text-xl font-black ${data.closing_balance >= 0 ? "text-success-text" : "text-danger-text"}`}>
                      {fmt(data.closing_balance)} <span className="text-[10px] text-text-muted font-bold">ج.م.</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Non-cash movements (collapsed) */}
              {nonCashRows.length > 0 && (
                <details className="rounded-2xl border border-border-subtle bg-bg-surface overflow-hidden">
                  <summary className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-bg-overlay list-none select-none">
                    <Minus className="h-4 w-4 text-text-muted" />
                    <span className="text-xs font-black text-text-secondary">
                      حركات غير نقدية ({nonCashRows.length}) — لا تؤثر على الرصيد
                    </span>
                  </summary>
                  <div className="divide-y divide-border-subtle border-t border-border-subtle">
                    {nonCashRows.map((row, i) => (
                      <div key={`nc-${i}`} className="flex items-center justify-between px-5 py-2.5">
                        <div>
                          <span className="text-xs font-bold text-text-muted">{DOC_TYPE_LABEL[row.doc_type] || row.doc_type}</span>
                          {row.party && <span className="text-[10px] text-text-muted mr-2">{row.party}</span>}
                        </div>
                        <span className="text-xs font-bold text-text-muted">{fmt(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
