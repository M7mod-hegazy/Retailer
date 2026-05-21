import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Plus, X, Phone, AlertTriangle, SlidersHorizontal,
  MessageSquare, Eye, ExternalLink, RefreshCw, FileText,
  ShoppingBag, CreditCard, RotateCcw, Scale, ChevronDown, ChevronUp, Calendar,
  Copy, Check, TrendingUp, TrendingDown, Info, AlertCircle
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";
import AddCustomerModal from "../../components/modals/AddCustomerModal";
import CustomerInfoModal from "../../components/modals/CustomerInfoModal";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

const PAYMENT_METHOD_AR = {
  cash: "نقداً", card: "بطاقة", bank: "بنك", bank_transfer: "تحويل بنكي",
  credit: "آجل", installments: "تقسيط", wallet: "محفظة", multi: "متعدد",
};
const arMethod = (key) => PAYMENT_METHOD_AR[key] || key;

// Deterministic avatar gradient
const getAvatarBg = (name) => {
  if (!name) return "from-slate-400 to-slate-500";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-indigo-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-sky-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-cyan-500 to-emerald-600",
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Per-method color tokens
const METHOD_STYLE = {
  cash: { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200/50", dot: "bg-emerald-500" },
  card: { bg: "bg-blue-50/80", text: "text-blue-700", border: "border-blue-200/50", dot: "bg-blue-500" },
  bank: { bg: "bg-sky-50/80", text: "text-sky-700", border: "border-sky-200/50", dot: "bg-sky-500" },
  bank_transfer: { bg: "bg-sky-50/80", text: "text-sky-700", border: "border-sky-200/50", dot: "bg-sky-500" },
  credit: { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200/50", dot: "bg-amber-500" },
  installments: { bg: "bg-violet-50/80", text: "text-violet-700", border: "border-violet-200/50", dot: "bg-violet-500" },
  wallet: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200/50", dot: "bg-purple-500" },
  default: { bg: "bg-slate-50/80", text: "text-slate-700", border: "border-slate-200/50", dot: "bg-slate-400" },
};
const ms = (method) => METHOD_STYLE[method] || METHOD_STYLE.default;

const PTYPE_COLOR = {
  cash: "text-emerald-700 bg-emerald-50/80 border-emerald-200/50",
  credit: "text-amber-700 bg-amber-50/80 border-amber-200/50",
  installments: "text-violet-700 bg-violet-50/80 border-violet-200/50",
  multi: "text-blue-700 bg-blue-50/80 border-blue-200/50",
  bank_transfer: "text-sky-700 bg-sky-50/80 border-sky-200/50",
};

// Modern spring animated Modal wrapper
function Modal({ onClose, children, width = "480px" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[6px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        style={{ width }}
        className="bg-white rounded-2xl shadow-[0_32px_64px_rgba(0,0,0,0.18)] max-h-[90vh] overflow-y-auto border border-slate-200/60"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Event type config ─────────────────────────────────────
const EVENT_TYPES = {
  invoice: { icon: ShoppingBag, label: "فاتورة مبيعات", color: "text-blue-600", bg: "bg-blue-50/80", border: "border-blue-100" },
  payment: { icon: CreditCard, label: "تحصيل دفعة", color: "text-emerald-600", bg: "bg-emerald-50/80", border: "border-emerald-100" },
  return: { icon: RotateCcw, label: "مرتجع مبيعات", color: "text-rose-600", bg: "bg-rose-50/80", border: "border-rose-100" },
  adjustment: { icon: Scale, label: "تسوية يدوية", color: "text-amber-600", bg: "bg-amber-50/80", border: "border-amber-100" },
};

const TYPE_CARD_STYLE = {
  invoice: "border-slate-200/70 hover:border-blue-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  payment: "border-slate-200/70 hover:border-emerald-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  return: "border-slate-200/70 hover:border-rose-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  adjustment: "border-slate-200/70 hover:border-amber-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  opening: "border-slate-200 border-dashed bg-slate-50/50",
};

// Parse payment splits string
function parsePaymentSplits(splits) {
  if (!splits) return [];
  return splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.method !== "credit" && s.amount > 0.005);
}

function parseAllPaymentSplits(splits) {
  if (!splits) return [];
  return splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.amount > 0.005);
}

// ── Installments expandable within invoice row ────────────
function InstallmentsBadge({ debtId }) {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (schedules !== null) { setOpen(o => !o); return; }
    try {
      const r = await api.get(`/api/ajal-debts/${debtId}`);
      setSchedules(r.data.data?.schedule || []);
      setOpen(true);
    } catch { setSchedules([]); setOpen(true); }
  }, [debtId, schedules]);

  const pending = schedules ? schedules.filter(s => s.status !== "paid").length : null;

  return (
    <div className="mt-2">
      <button onClick={load}
        className="flex items-center gap-1.5 text-[10px] font-bold text-violet-650 bg-violet-50/80 border border-violet-200/60 rounded-xl px-3 py-1.5 hover:bg-violet-100/80 transition-colors">
        <Calendar className="h-3.5 w-3.5" />
        {pending !== null ? `${pending} أقساط متبقية` : "متابعة جدول الأقساط"}
        {open ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
      </button>
      <AnimatePresence>
        {open && schedules?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="mt-2.5 space-y-1.5 pr-3 border-r-2 border-violet-200 overflow-hidden"
          >
            {schedules.map(s => {
              const isOverdue = s.status !== "paid" && s.due_date < today;
              const isPaid = s.status === "paid";
              return (
                <div key={s.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-[10px] font-bold border transition-colors ${isPaid
                    ? "bg-emerald-50/30 border-emerald-100/80 text-emerald-700"
                    : isOverdue
                      ? "bg-rose-50/30 border-rose-100/80 text-rose-700"
                      : "bg-slate-50/40 border-slate-200/80 text-slate-600"
                  }`}>
                  <span className="font-semibold text-slate-600">القسط {s.installment_no} — {fmtDate(s.due_date)}</span>
                  <span className="font-bold font-mono text-[11px]">{fmt(s.amount)}</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${isPaid
                      ? "bg-emerald-100/80 border-emerald-200 text-emerald-800"
                      : isOverdue
                        ? "bg-rose-100/80 border-rose-200 text-rose-800"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}>
                    {isPaid ? "مسدد" : isOverdue ? "متأخر" : "معلق"}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {open && schedules?.length === 0 && (
        <div className="text-[10px] text-slate-450 pr-3 font-semibold">لا توجد أقساط مجدولة لهذا الدين</div>
      )}
    </div>
  );
}

// ── Movements Tab Component ───────────────────────────────────────────
function MovementsTab({ party, partyType, onOpenInvoice, onOpenReturn }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredEvents = events.filter(ev => {
    if (filterType !== "all" && ev.type !== filterType) return false;
    if (ev.date) {
      const d = new Date(ev.date);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (d < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
    } else {
      if (startDate || endDate) return false;
    }
    return true;
  });

  const renderFilterBar = () => (
    <div className="bg-slate-50/45 border border-slate-200/50 rounded-[28px] p-5 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-md select-none text-right" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] font-black text-slate-400 ml-1.5 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-450" />
            تصفية الحركات:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "الكل", color: "hover:border-slate-350 hover:bg-slate-50 text-slate-650 bg-white" },
              { id: "invoice", label: "مبيعات آجل", color: "hover:border-blue-200 hover:bg-blue-50/30 text-blue-700 bg-white" },
              { id: "payment", label: "دفعة مسددة", color: "hover:border-emerald-200 hover:bg-emerald-50/30 text-emerald-750 bg-white" },
              { id: "return", label: "مرتجع", color: "hover:border-rose-200 hover:bg-rose-50/30 text-rose-700 bg-white" },
              { id: "adjustment", label: "تسوية", color: "hover:border-amber-200 hover:bg-amber-50/30 text-amber-700 bg-white" },
            ].map(btn => {
              const active = filterType === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => setFilterType(btn.id)}
                  className={`text-[12px] font-black px-4 py-2.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                    active 
                      ? "bg-slate-900 border-slate-900 text-white shadow-[0_4px_14px_rgba(15,23,42,0.12)] scale-[1.02]" 
                      : `${btn.color} border-slate-200/80 shadow-sm hover:scale-[1.01]`
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0">
          <span className="text-[11.5px] font-black text-slate-400 ml-1.5 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5 text-slate-450" />
            تحديد الفترة:
          </span>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* From Date Pill */}
            <div className="flex items-center gap-2 bg-white border border-slate-200/85 rounded-2xl px-3.5 py-1.5 shadow-sm focus-within:border-slate-450 focus-within:ring-1 focus-within:ring-slate-200 transition-all">
              <span className="text-[10px] font-black text-slate-450 shrink-0">من</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[12px] font-black text-slate-700 bg-transparent border-0 p-0 m-0 outline-none focus:outline-none focus:ring-0 w-28 cursor-pointer text-center"
              />
            </div>

            {/* To Date Pill */}
            <div className="flex items-center gap-2 bg-white border border-slate-200/85 rounded-2xl px-3.5 py-1.5 shadow-sm focus-within:border-slate-450 focus-within:ring-1 focus-within:ring-slate-200 transition-all">
              <span className="text-[10px] font-black text-slate-450 shrink-0">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[12px] font-black text-slate-700 bg-transparent border-0 p-0 m-0 outline-none focus:outline-none focus:ring-0 w-28 cursor-pointer text-center"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/80 hover:border-rose-250 rounded-2xl transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
                title="إعادة تعيين الفترة"
              >
                <X className="h-4 w-4 stroke-[2.5px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const load = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const idParam = partyType === "customer" ? `customer_id=${party.id}` : `supplier_id=${party.id}`;
      const docEndpoint = partyType === "customer" ? `/api/invoices?${idParam}&limit=200` : `/api/purchases?${idParam}&limit=200`;
      const payEndpoint = `/api/payments?party_type=${partyType}&party_id=${party.id}&limit=200`;
      const retEndpoint = partyType === "customer"
        ? `/api/invoices/returns?customer_id=${party.id}&limit=200`
        : `/api/purchases/returns?supplier_id=${party.id}&limit=200`;
      const adjEndpoint = partyType === "customer"
        ? `/api/customers/${party.id}/notes?type=adjustment`
        : `/api/suppliers/${party.id}/notes?type=adjustment`;

      const [docsR, paysR, retsR, adjR] = await Promise.allSettled([
        api.get(docEndpoint),
        api.get(payEndpoint),
        api.get(retEndpoint),
        api.get(adjEndpoint),
      ]);

      const items = [];

      (docsR.value?.data?.data || []).forEach(d => {
        const total = Number(d.total || 0);
        const received = Number(d.amount_received || 0);
        const ajalAmount = Math.max(0, total - received);
        let chips = parsePaymentSplits(d.payment_splits);
        if (chips.length === 0 && d.payment_type !== "credit" && received > 0) {
          chips = [{ method: d.payment_type, amount: received }];
        }
        const allChips = d.payment_type === "multi"
          ? parseAllPaymentSplits(d.payment_splits)
          : chips;
        const ajalChipAmount = d.payment_type === "multi"
          ? (allChips.find(c => c.method === "credit")?.amount || 0)
          : 0;
        items.push({
          id: `inv-${d.id}`,
          type: "invoice",
          date: new Date(d.created_at),
          ref: d.invoice_no || d.doc_no || `#${d.id}`,
          chips,
          allChips,
          invoiceTotal: total,
          ajalAmount,
          ajalChipAmount,
          impactAmount: ajalAmount,
          impactDir: ajalAmount > 0.005 ? "add" : null,
          raw: d,
        });
      });

      (paysR.value?.data?.data || []).filter(p => !p.invoice_id).forEach(p => {
        items.push({
          id: `pay-${p.id}`,
          type: "payment",
          date: new Date(p.created_at),
          ref: p.doc_no || `PAY-${p.id}`,
          methodLabel: arMethod(p.method || ""),
          description: p.notes || null,
          impactAmount: Number(p.amount || 0),
          impactDir: "subtract",
          raw: p,
        });
      });

      (retsR.value?.data?.data || []).forEach(r => {
        const isSplit = r.refund_method === "split";
        const isCashOnly = r.refund_method === "cash_back";
        const creditAmt = isSplit ? Number(r.credit_amount || 0) : (isCashOnly ? 0 : Number(r.total || 0));
        items.push({
          id: `ret-${r.id}`,
          type: "return",
          date: new Date(r.created_at),
          ref: r.doc_no || `RET-${r.id}`,
          description: r.original_invoice_no ? `مرتجع فاتورة ${r.original_invoice_no}` : "مرتجع",
          impactAmount: creditAmt,
          impactDir: creditAmt > 0.005 ? "subtract" : null,
          totalAmount: Number(r.total || 0),
          isSplit,
          isCashOnly,
          cashAmount: Number(r.cash_amount || 0),
          raw: r,
        });
      });

      (adjR.value?.data?.data || []).forEach(n => {
        const amount = Number(n.amount || 0);
        items.push({
          id: `adj-${n.id}`,
          type: "adjustment",
          date: new Date(n.created_at),
          ref: `ADJ-${n.id}`,
          description: n.note || "تسوية يدوية للرصيد",
          impactAmount: Math.abs(amount),
          impactDir: amount > 0 ? "add" : "subtract",
          raw: n,
        });
      });

      items.sort((a, b) => b.date - a.date);

      const currentBal = Number(party.opening_balance || 0);
      let running = currentBal;
      for (const item of items) {
        if (item.impactDir === "add") running -= (item.impactAmount || 0);
        else if (item.impactDir === "subtract") running += (item.impactAmount || 0);
      }
      if (Math.abs(running) > 0.005) {
        items.push({
          id: "opening",
          type: "opening",
          date: null,
          impactAmount: Math.abs(running),
          impactDir: running > 0 ? "add" : "subtract",
        });
      }

      setEvents(items);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [party, partyType]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 animate-pulse">
        <RefreshCw className="h-7 w-7 animate-spin text-blue-600" />
        <span className="text-[12px] font-bold">جاري تحميل سجل الحركات المالية...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-350 gap-4 border border-dashed border-slate-200 rounded-[24px] bg-white/40 max-w-5xl mx-auto shadow-inner animate-fade-in">
        <div className="p-4 rounded-full bg-slate-50 border border-slate-100/80 shadow-sm">
          <FileText className="h-7 w-7 text-slate-400 stroke-[1.5px]" />
        </div>
        <span className="font-extrabold text-[13px] text-slate-500 tracking-tight">لا توجد حركات مالية مسجلة في هذا الحساب حالياً</span>
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col relative px-1 select-none">
        {renderFilterBar()}
        
        <div className="flex flex-col items-center justify-center py-16 text-slate-350 gap-4 border border-dashed border-slate-200 rounded-[28px] bg-white/40 shadow-inner animate-fade-in text-right">
          <div className="p-4 rounded-full bg-slate-50 border border-slate-100 shadow-sm">
            <SlidersHorizontal className="h-7 w-7 text-slate-400 stroke-[1.5px]" />
          </div>
          <span className="font-extrabold text-[13px] text-slate-500 tracking-tight">لا توجد حركات مالية مطابقة للفلاتر المحددة حالياً</span>
          <button 
            onClick={() => { setFilterType("all"); setStartDate(""); setEndDate(""); }}
            className="text-[11px] font-black text-blue-650 bg-blue-50 border border-blue-150 rounded-xl px-4 py-2 hover:bg-blue-100 transition-all cursor-pointer shadow-sm"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col relative px-1 select-none">
      {renderFilterBar()}
      
      {filteredEvents.map((ev, index) => {
        const isOpening = ev.type === "opening";
        const cfg = !isOpening ? EVENT_TYPES[ev.type] : {
          icon: FileText,
          label: "رصيد افتتاحي",
          color: "text-slate-500",
          bg: "bg-slate-50/80",
          border: "border-slate-200"
        };
        const Icon = cfg.icon;

        // Document flags
        const ptype = ev.raw?.payment_type;
        const isMulti = ptype === "multi";
        const isCredit = ptype === "credit";
        const isInstallments = ptype === "installments";
        const isDocRow = ev.type === "invoice";

        const multiAjalAmount = isMulti ? (ev.ajalChipAmount || 0) : 0;
        const hasImpact = isMulti
          ? multiAjalAmount > 0.005
          : (ev.impactDir && ev.impactAmount > 0.005);
        const displayImpactAmount = isMulti ? multiAjalAmount : ev.impactAmount;

        const multiChips = isMulti ? (ev.allChips || []) : [];
        const creditChips = isCredit ? [{ method: "credit", amount: ev.raw?.total }] : [];
        const installChips = isInstallments ? [
          ...(ev.chips || []),
          ...(ev.ajalAmount > 0.005 ? [{ method: "credit", amount: ev.ajalAmount }] : []),
        ] : [];
        const singleChips = !isMulti && !isCredit && !isInstallments && ev.chips?.length > 0 ? ev.chips : [];
        const renderChips = isMulti ? multiChips : isCredit ? creditChips : isInstallments ? installChips : singleChips;

        // Theme mapping for customer
        const theme = {
          invoice: {
            bezel: "bg-gradient-to-br from-blue-50/60 to-indigo-50/20 border-blue-200/50 hover:border-blue-300/80",
            borderRight: "border-r-blue-500",
            badge: "bg-blue-50 text-blue-700 border-blue-200/50",
            label: "مبيعات آجل"
          },
          payment: {
            bezel: "bg-gradient-to-br from-emerald-50/60 to-teal-50/20 border-emerald-200/50 hover:border-emerald-300/80",
            borderRight: "border-r-emerald-500",
            badge: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
            label: "تحصيل دفعة"
          },
          return: {
            bezel: "bg-gradient-to-br from-rose-50/60 to-pink-50/20 border-rose-200/50 hover:border-rose-300/80",
            borderRight: "border-r-rose-500",
            badge: "bg-rose-50 text-rose-750 border-rose-200/50",
            label: "مرتجع مبيعات"
          },
          adjustment: {
            bezel: "bg-gradient-to-br from-amber-50/60 to-orange-50/20 border-amber-200/50 hover:border-amber-300/80",
            borderRight: "border-r-amber-500",
            badge: "bg-amber-50 text-amber-700 border-amber-200/50",
            label: "تسوية يدوية"
          },
          opening: {
            bezel: "bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200/80",
            borderRight: "border-r-slate-400",
            badge: "bg-slate-100 text-slate-700 border-slate-200/60",
            label: "رصيد افتتاحي"
          }
        }[ev.type];

        return (
          <div key={ev.id} className="flex gap-6 items-stretch relative py-5 select-none">
            {/* Premium Timeline Node Column with Integrated Date */}
            <div className="flex flex-col items-center shrink-0 w-24 relative select-none">
              {/* Dual-layered highly aesthetic connecting line track */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3.5px] bg-slate-100 rounded-full pointer-events-none" />
              <div className={`absolute left-1/2 -translate-x-1/2 w-[2px] pointer-events-none ${
                index === 0 
                  ? "top-8 bottom-0 bg-gradient-to-b from-blue-500 to-slate-200" 
                  : index === filteredEvents.length - 1 
                    ? "top-0 h-8 bg-gradient-to-b from-slate-200 to-transparent" 
                    : "top-0 bottom-0 bg-slate-200"
              }`} />
              
              {/* Sleek Date Squircle Node */}
              <div className="w-16 h-16 rounded-[22px] bg-white border border-slate-200/80 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex flex-col items-center justify-center z-10 transition-all duration-300 hover:scale-105 hover:border-slate-450 hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] group cursor-pointer relative">
                {/* Floating micro-badge for event icon */}
                <span className={`absolute -top-1.5 -right-1.5 inline-flex items-center justify-center h-6.5 w-6.5 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border} shadow-[0_2px_6px_rgba(0,0,0,0.04)] z-20 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-3.5 w-3.5 stroke-[2.3px]" />
                </span>

                {/* Vertical Date typography */}
                {ev.date ? (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[9px] font-black text-slate-450 uppercase tracking-wide leading-none whitespace-nowrap">
                      {new Date(ev.date).toLocaleDateString("ar-EG", { month: "short", year: "numeric" })}
                    </span>
                    <span className="text-[20px] font-black text-slate-800 font-mono tracking-tighter leading-none mt-1">
                      {new Date(ev.date).toLocaleDateString("ar-EG", { day: "2-digit" })}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10.5px] font-black text-slate-500 leading-none">البداية</span>
                )}
              </div>
            </div>

            {/* Event Card: Double-Bezel Concentric architecture with asymmetric colored edge */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.998 }}
              transition={{ type: "spring", stiffness: 350, damping: 28, delay: Math.min(0.3, index * 0.02) }}
              className={`flex-1 p-[3px] rounded-[28px] border shadow-[0_8px_24px_rgba(0,0,0,0.015)] backdrop-blur-md transition-all duration-300 ${theme.bezel}`}
            >
              <div className={`bg-white rounded-[24px] p-5 md:p-6 relative overflow-hidden border border-slate-100/80 ${theme.borderRight} flex flex-col gap-4 shadow-[inset_0_2px_4px_rgba(255,255,255,1)]`}>
                <div className="flex flex-col gap-4">
                  {/* ── Main Asymmetric Ledger Row ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                    
                    {/* Column 1: Stylized Card Type Header & Reference (spans 3 cols) */}
                    <div className="lg:col-span-3 flex flex-col justify-center min-w-0 pr-1 select-none">
                      <div className="flex items-center gap-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[16px] font-black text-slate-800 tracking-tight leading-none">
                              {isOpening ? "رصيد افتتاحي سابق" : cfg.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${theme.badge}`}>
                              {theme.label}
                            </span>
                          </div>
                          
                          <div className="mt-2.5 flex items-center gap-1">
                            <span className="text-[9.5px] font-bold text-slate-400 select-none">المرجع:</span>
                            <span className="text-[10px] font-black text-slate-500 font-mono bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded-[5px] select-all tracking-tight" title={ev.ref || "رصيد البداية"}>
                              {isOpening ? "سجل افتتاحي" : ev.ref}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Payment splits / method tags / notes (spans 4 cols) */}
                    <div className="lg:col-span-4 flex flex-wrap items-center gap-2 min-w-0">
                      {isDocRow && renderChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {renderChips.map((chip, i) => {
                            const style = ms(chip.method);
                            const pct = ev.invoiceTotal > 0 ? Math.round((chip.amount / ev.invoiceTotal) * 100) : 0;
                            return (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1.5 text-[9.5px] font-extrabold px-2.5 py-1.5 rounded-xl border transition-all duration-200 hover:scale-102 shadow-sm ${style.bg} ${style.text} ${style.border}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse`} />
                                {arMethod(chip.method)}
                                <span className="font-mono text-[10px] font-black">{fmt(chip.amount)}</span>
                                {isMulti && <span className="opacity-60 text-[8.5px] font-bold mr-0.5">({pct}%)</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {!isDocRow && !isOpening && ev.methodLabel && (
                        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-extrabold px-2.5 py-1.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-650 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {ev.methodLabel}
                        </span>
                      )}
                      {isOpening && (
                        <span className="text-[11px] text-slate-450 font-bold font-mono">
                          قبل سجل الحركات المالية المعروضة في الكشف الحالي
                        </span>
                      )}
                      {ev.description && (
                        <span className="text-[11.5px] text-slate-455 font-semibold border-r-2 border-slate-200 pr-2 block truncate max-w-[240px]" title={ev.description}>
                          {ev.description}
                        </span>
                      )}
                    </div>

                    {/* Column 3: Unified Ledger Cockpit Widget (spans 4 cols) */}
                    <div className="lg:col-span-4 flex flex-row items-center justify-end gap-3 shrink-0 ml-auto lg:ml-0">
                      <div className="flex items-center gap-4 shrink-0 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-2.5 hover:bg-slate-50/90 transition-all duration-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.02)] min-w-[315px] ml-auto lg:ml-0">
                        {/* Metric 1: Total Transaction Value */}
                        <div className="flex flex-col items-end px-3 py-0.5 flex-1 min-w-0">
                          <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider mb-1 select-none">
                            {isOpening ? "القيمة الافتتاحية" : isDocRow ? "إجمالي الفاتورة" : ev.type === "return" ? "إجمالي المرتجع" : ev.type === "payment" ? "المبلغ المسدد" : "قيمة التسوية"}
                          </span>
                          <div className="text-[18px] font-black text-slate-800 font-mono tracking-tight leading-none flex items-baseline gap-0.5 truncate">
                            <span>{fmt(isOpening ? ev.impactAmount : isDocRow ? ev.invoiceTotal : ev.type === "return" ? (ev.totalAmount || ev.impactAmount) : ev.impactAmount)}</span>
                            <span className="text-[9.5px] font-bold text-slate-400 mr-0.5">ج.م</span>
                          </div>
                        </div>

                        {/* Vertical Divider */}
                        {hasImpact && <div className="h-10 w-[1px] bg-slate-200/80 self-center" />}

                        {/* Metric 2: Balance Impact */}
                        {hasImpact && (
                          <div className={`flex flex-col items-end px-3 py-1.5 rounded-[12px] border flex-1 transition-all ${
                            ev.impactDir === "add" || isMulti
                              ? "bg-rose-500/[0.04] text-rose-700 border-rose-200/60 shadow-[0_2px_8px_rgba(244,63,94,0.03)]"
                              : "bg-emerald-500/[0.04] text-emerald-700 border-emerald-200/60 shadow-[0_2px_8px_rgba(16,185,129,0.03)]"
                          }`}>
                            <span className="text-[9px] font-black text-slate-455 tracking-wider mb-1 select-none">
                              {ev.type === "return"
                                ? "المخصوم من المديونية"
                                : ev.impactDir === "add" || isMulti
                                  ? "المضاف للمديونية"
                                  : "المخصوم من المديونية"}
                            </span>
                            <div className="text-[18px] font-black font-mono tracking-tight leading-none flex items-baseline gap-0.5 truncate">
                              <span className="text-[13px] font-black select-none leading-none mr-0.5">
                                {ev.impactDir === "add" || isMulti ? "+" : "−"}
                              </span>
                              <span>{fmt(displayImpactAmount)}</span>
                              <span className="text-[9.5px] font-bold mr-0.5">ج.م</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {ev.type === "return" && ev.isSplit && (
                        <div className="flex flex-col gap-1 items-end shrink-0 select-none">
                          <span className="text-[8.5px] font-bold text-rose-600 bg-rose-50 border border-rose-250 rounded-lg px-2 py-0.5">
                            نقداً: {fmt(ev.cashAmount)}
                          </span>
                          <span className="text-[8.5px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5">
                            رصيد: {fmt(ev.impactAmount)}
                          </span>
                        </div>
                      )}
                      {ev.type === "return" && ev.isCashOnly && (
                        <span className="text-[8.5px] font-bold text-rose-600 bg-rose-50 border border-rose-250 rounded-lg px-2 py-0.5 select-none">نقداً فقط</span>
                      )}
                    </div>

                    {/* Column 4: Detail Action Button (spans 1 col) */}
                    <div className="lg:col-span-1 flex items-center justify-end shrink-0">
                      {ev.type === "invoice" && (
                        <button
                          onClick={() => onOpenInvoice(ev.raw)}
                          className="h-8.5 w-8.5 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 border border-slate-200/80 hover:border-blue-200 transition-all duration-200 shrink-0 cursor-pointer shadow-sm active:scale-95 group"
                          title="عرض تفاصيل الفاتورة"
                        >
                          <Eye className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-105" />
                        </button>
                      )}
                      {ev.type === "return" && (
                        <button
                          onClick={() => onOpenReturn(ev.raw)}
                          className="h-8.5 w-8.5 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition-all duration-200 shrink-0 cursor-pointer shadow-sm active:scale-95 group"
                          title="عرض تفاصيل المرتجع"
                        >
                          <Eye className="h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-105" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Installments expandable within invoice row ── */}
                  {isDocRow && isInstallments && ev.raw?.id && (
                    <div className="px-1.5 pb-2.5 border-t border-slate-100 pt-3">
                      <InstallmentsBadge debtId={ev.raw.debt_id || ev.raw.id} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerAccountsPage() {
  usePageTour('customer_accounts');
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [walkInId, setWalkInId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "movements");
  const [notesData, setNotesData] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);

  // Summary
  const [netBalance, setNetBalance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Invoice detail modal
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Return detail modal
  const [detailReturn, setDetailReturn] = useState(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // Forms
  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [saving, setSaving] = useState(false);

  // Copy badges state hook
  const [copiedBadge, setCopiedBadge] = useState(null);

  // ── Loaders ───────────────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    try {
      const [res, methodsReq, settingsReq] = await Promise.all([
        api.get("/api/customers"),
        api.get("/api/payment-methods"),
        api.get("/api/settings"),
      ]);
      const wid = settingsReq.data.data?.walk_in_customer_id || null;
      setWalkInId(wid);
      setCustomers((res.data.data || []).filter(c => c.id !== wid));
      setPaymentMethods((methodsReq.data.data || []).filter(m => m.id !== 2));
    } catch { toast.error("فشل تحميل العملاء"); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/customers/balance-summary");
      setNetBalance(r.data.data?.net_balance ?? null);
    } catch { setNetBalance(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected) return;
    setNotesLoading(true);
    try {
      const r = await api.get(`/api/customers/${selected.id}/notes?type=note`);
      setNotesData(r.data.data || []);
    } catch { setNotesData([]); }
    finally { setNotesLoading(false); }
  }, [selected]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === "notes") loadNotes(); }, [activeTab, loadNotes]);

  // ── URL sync ──────────────────────────────────────────────
  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && customers.length > 0) {
      const found = customers.find(c => String(c.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) setSelected(found);
      else if (!found) setSearchParams({});
    }
  }, [searchParams, customers, selected]);

  const selectCustomer = useCallback((c, tab = "movements") => {
    setSelected(c);
    setActiveTab(tab);
    setNotesData([]);
    setSearchParams({ id: String(c.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/customers/${selected.id}`);
    setSelected(r.data.data);
    loadCustomers();
    loadSummary();
  };

  // ── Invoice detail ────────────────────────────────────────
  useEffect(() => {
    if (!detailInvoice) { setDetailData(null); return; }
    setDetailLoading(true);
    api.get(`/api/invoices/${detailInvoice.id}`)
      .then(r => setDetailData(r.data.data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailInvoice]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCustomerCreated = (customer) => {
    toast.success("تم إضافة العميل بنجاح");
    loadCustomers();
    selectCustomer(customer, "movements");
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("برجاء إدخال المبلغ وتحديد وسيلة الدفع");
    setSaving(true);
    try {
      await api.post("/api/payments", {
        party_type: "customer",
        party_id: selected.id,
        amount: Number(payForm.amount),
        method_id: Number(payForm.method_id),
        notes: payForm.notes || null,
      });
      toast.success("تم تسجيل الدفعة بنجاح");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسجيل الدفعة"); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("برجاء إدخال مبلغ صحيح");
    setSaving(true);
    try {
      await api.post(`/api/customers/${selected.id}/adjust`, adjForm);
      setShowAdjust(false);
      setAdjForm({ amount: "", direction: "subtract", reason: "" });
      await refreshSelected();
      toast.success("تمت تسوية الرصيد بنجاح");
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسوية الرصيد"); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (noteText) => {
    if (!noteText?.trim()) return;
    try {
      await api.post(`/api/customers/${selected.id}/notes`, { note: noteText });
      toast.success("تمت إضافة الملاحظة");
      loadNotes();
    } catch (e) { toast.error(e.response?.data?.message || "فشل إضافة الملاحظة"); }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedBadge(type);
    toast.success(type === "phone" ? "تم نسخ رقم الهاتف" : "تم نسخ كود العميل");
    setTimeout(() => setCopiedBadge(null), 2000);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.code?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === "debtors") return Number(c.opening_balance) > 0;
    if (filter === "creditors") return Number(c.opening_balance) < 0;
    return true;
  });

  const bal = Number(selected?.opening_balance || 0);
  const creditLimit = Number(selected?.credit_limit || 0);
  const creditPct = creditLimit > 0 ? (bal / creditLimit) * 100 : 0;

  return (
    <div className="flex flex-1 min-h-0 bg-slate-100 overflow-hidden font-sans" dir="rtl">

      {/* ── Left Sidebar Panel ── */}
      <div className="w-[360px] bg-slate-50/40 border-l border-slate-200/80 flex flex-col shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.01)] select-none">
        <div className="p-4.5 border-b border-slate-200/50 bg-slate-50/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9.5 w-9.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-650 flex items-center justify-center shadow-md shadow-blue-200/80 ring-4 ring-blue-50/50">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-[14px] font-black text-slate-800 tracking-tight">حسابات العملاء</h1>
            </div>
            <PermissionGate page="customer_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3.5 text-[11px] font-bold text-white shadow-md shadow-blue-200/50 hover:shadow-blue-200/70 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer">
                <Plus className="h-4 w-4 stroke-[2.5px]" /> عميل جديد
              </button>
            </PermissionGate>
          </div>

          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 focus-within:text-blue-500 transition-colors" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="البحث بالاسم، الهاتف، الكود..."
              className="w-full h-11 rounded-xl border border-slate-200 focus:border-blue-500/80 pr-10 pl-3.5 text-[12px] font-semibold outline-none bg-white transition-all focus:shadow-[0_4px_16px_rgba(37,99,235,0.04)] focus:ring-1 focus:ring-blue-100" />
          </div>

          <div className="flex bg-slate-200/60 p-1 rounded-xl relative">
            {[{ id: "all", label: "الكل" }, { id: "debtors", label: "يدينون لنا" }, { id: "creditors", label: "ندين لهم" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="flex-1 py-2 text-[11px] font-extrabold rounded-lg relative z-10 transition-colors duration-200 cursor-pointer"
                style={{ color: filter === f.id ? "#1e3a8a" : "#475569" }}
              >
                {filter === f.id && (
                  <motion.div
                    layoutId="activeFilterBg"
                    className="absolute inset-0 bg-white rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.06)] -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Net Balance Ticker Summary ── */}
        <div className="mx-4 mt-4 mb-2.5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-4.5 shadow-[0_16px_36px_rgba(0,0,0,0.25)] relative overflow-hidden group">
          {/* Dynamic background glowing ambient lights depending on status */}
          <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-xl pointer-events-none group-hover:scale-150 transition-all duration-500 ${netBalance > 0 ? "bg-rose-500/10" : netBalance < 0 ? "bg-emerald-500/10" : "bg-blue-500/10"}`} />
          <div className={`absolute -left-4 -top-4 w-20 h-20 rounded-full blur-lg pointer-events-none group-hover:scale-150 transition-all duration-500 ${netBalance > 0 ? "bg-rose-600/5" : netBalance < 0 ? "bg-emerald-600/5" : "bg-indigo-600/5"}`} />

          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">إجمالي صافي مديونية العملاء</span>
            <span className={`p-1.5 rounded-xl border ${netBalance > 0 ? "bg-rose-500/15 border-rose-500/25 text-rose-450" : netBalance < 0 ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-450" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
              {netBalance > 0 ? <TrendingUp className="h-4 w-4" /> : netBalance < 0 ? <TrendingDown className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
            </span>
          </div>

          <div className="relative z-10 flex items-baseline gap-1.5">
            <span className={`text-[24px] font-black font-mono tracking-tight bg-gradient-to-r ${netBalance > 0 ? "from-rose-400 to-rose-350" : netBalance < 0 ? "from-emerald-400 to-emerald-350" : "from-slate-200 to-slate-400"} text-transparent bg-clip-text`}>
              {summaryLoading ? (
                <span className="inline-block w-16 h-7 bg-slate-800 rounded animate-pulse" />
              ) : (
                fmt(netBalance ?? 0)
              )}
            </span>
            <span className="text-[11px] font-bold text-slate-400">ج.م</span>
          </div>

          <div className="mt-2.5 text-[9.5px] font-bold flex items-center gap-1.5 relative z-10">
            {netBalance < 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-pulse" />
                رصيد دائن لصالح العملاء
              </span>
            ) : netBalance > 0 ? (
              <span className="text-rose-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-450 animate-pulse" />
                مديونية معلقة مستحقة على العملاء
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                جميع الحسابات مسواة حالياً
              </span>
            )}
          </div>
        </div>

        {/* ── Customers List Scroll ── */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {loading ? (
            <div className="py-20 text-center text-[12px] font-bold text-slate-400 animate-pulse">جاري تحميل القائمة...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <Users className="h-9 w-9 text-slate-300 opacity-60" />
              <p className="text-[12px] font-bold text-slate-400">لا يوجد عملاء مطابقين للبحث</p>
            </div>
          ) : filtered.map((c, index) => {
            const b = Number(c.opening_balance || 0);
            const lim = Number(c.credit_limit || 0);
            const nearLimit = lim > 0 && b >= lim * 0.9;
            const isSelected = selected?.id === c.id;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(0.3, index * 0.02) }}
                onClick={() => selectCustomer(c, activeTab)}
                className={`p-4 mx-2 my-1 rounded-[22px] cursor-pointer border transition-all duration-300 relative group flex items-center gap-3.5 ${isSelected
                    ? "bg-gradient-to-br from-blue-500/[0.04] to-indigo-500/[0.01] border-blue-200/80 shadow-[0_4px_16px_rgba(37,99,235,0.06)]"
                    : "bg-white border-transparent hover:bg-slate-50/60 hover:border-slate-200"
                  }`}
              >
                {/* Visual Accent dot and vertical line for selected state */}
                {isSelected && (
                  <div className="absolute right-0 top-3 bottom-3 w-[3.5px] bg-gradient-to-b from-blue-500 to-indigo-650 rounded-l-md" />
                )}

                {/* Letter Avatar with Deterministic Gradient & Sleek Outer Ring */}
                <div className={`h-10.5 w-10.5 rounded-2xl flex items-center justify-center text-[14px] font-black text-white shrink-0 shadow-sm bg-gradient-to-br transition-all duration-300 group-hover:scale-105 ${getAvatarBg(c.name)} ring-2 ring-white/80 border border-slate-200/40`}
                >
                  {c.name?.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={`text-[13px] font-extrabold truncate transition-colors ${isSelected ? "text-blue-900" : "text-slate-800"}`}>{c.name}</div>
                    {nearLimit && (
                      <span className="flex items-center shrink-0 p-1 bg-amber-50 rounded-lg border border-amber-200" title="تنبيه: اقتراب من الحد الائتماني">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-450 font-mono font-bold truncate bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">{c.phone || c.code || "—"}</div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {b < 0 && <span className="text-[8.5px] font-black bg-emerald-500/[0.08] text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded-lg">له رصيد</span>}
                      {b > 0 && <span className="text-[8.5px] font-black bg-rose-500/[0.08] text-rose-750 border border-rose-250 px-2 py-0.5 rounded-lg">عليه دين</span>}
                      <span className={`text-[12.5px] font-black font-mono tracking-tight ${b > 0 ? "text-rose-650" : b < 0 ? "text-emerald-650" : "text-slate-400"}`}>
                        {fmt(Math.abs(b))}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-350 bg-slate-50/20">
            <div className="p-5 rounded-full bg-slate-100/50 border border-slate-200/50 shadow-inner">
              <Users className="h-14 w-14 text-slate-400 opacity-60" />
            </div>
            <p className="text-[13px] font-bold text-slate-400">برجاء اختيار أحد العملاء من القائمة الجانبية لعرض الملف والتحركات المالية</p>
          </div>
        ) : (
          <>
            {/* Customer Header Panel */}
            <div className="bg-white border-b border-slate-200/60 px-6 py-4 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.01)] relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Right Column: Customer Info & Avatar (lg:col-span-5) */}
                <div className="lg:col-span-5 flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-[16px] font-black text-white shrink-0 shadow-sm bg-gradient-to-br ${getAvatarBg(selected.name)} border border-white ring-2 ring-slate-100`}>
                    {selected.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-black text-slate-900 truncate leading-tight tracking-tight">{selected.name}</h2>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all shrink-0 cursor-pointer active:scale-95"
                        title="تعديل بيانات الملف"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {selected.phone && (
                        <span className="inline-flex items-center gap-1 text-[9.5px] text-slate-500 font-bold bg-slate-50 border border-slate-200/50 rounded-lg px-2 py-0.5 transition-all hover:bg-slate-100/50">
                          <Phone className="h-3 w-3 text-slate-450" />
                          <span className="font-mono">{selected.phone}</span>
                          <button
                            onClick={() => handleCopy(selected.phone, "phone")}
                            className="hover:text-blue-600 p-0.5 transition-colors mr-0.5 cursor-pointer"
                          >
                            {copiedBadge === "phone" ? <Check className="h-2.5 w-2.5 text-emerald-500 animate-scale" /> : <Copy className="h-2.5 w-2.5" />}
                          </button>
                        </span>
                      )}
                      {selected.code && (
                        <span className="text-[9px] font-bold font-mono bg-slate-50 text-slate-500 border border-slate-200/50 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all hover:bg-slate-100/50">
                          <span>كود: {selected.code}</span>
                          <button
                            onClick={() => handleCopy(selected.code, "code")}
                            className="hover:text-blue-600 p-0.5 transition-colors mr-0.5 cursor-pointer"
                          >
                            {copiedBadge === "code" ? <Check className="h-2.5 w-2.5 text-emerald-500 animate-scale" /> : <Copy className="h-2.5 w-2.5" />}
                          </button>
                        </span>
                      )}
                      {selected.is_blacklisted === 1 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-50 border border-rose-200 text-rose-600 px-2 py-0.5 rounded-lg">
                          <AlertCircle className="h-3 w-3 text-rose-500" /> محظور
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Column: Balance & Credit Limit (lg:col-span-4) */}
                <div className="lg:col-span-4 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-8.5 w-8.5 rounded-lg flex items-center justify-center shrink-0 border shadow-sm ${bal > 0 ? "bg-rose-50 border-rose-200/60 text-rose-600" : bal < 0 ? "bg-emerald-50 border-emerald-200/60 text-emerald-600" : "bg-slate-50 border-slate-200/80 text-slate-400"}`}>
                      {bal > 0 ? <TrendingUp className="h-4 w-4 stroke-[2.3px]" /> : bal < 0 ? <TrendingDown className="h-4 w-4 stroke-[2.3px]" /> : <Check className="h-4 w-4 stroke-[2.5px]" />}
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        {bal > 0 ? "صافي الرصيد المستحق بذمته" : bal < 0 ? "الرصيد الدائن للعميل" : "رصيد الحساب مسوّى"}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <div className={`text-[17px] font-black font-mono leading-none tracking-tight ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                          {fmt(Math.abs(bal))}
                        </div>
                        <span className={`text-[10px] font-extrabold ${bal > 0 ? "text-rose-450" : bal < 0 ? "text-emerald-450" : "text-slate-450"}`}>ج.م</span>
                      </div>
                    </div>
                  </div>
                  {creditLimit > 0 && bal > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex justify-between text-[9px] font-extrabold text-slate-450">
                        <span className={creditPct > 90 ? "text-rose-600" : creditPct > 70 ? "text-orange-600" : "text-emerald-600"}>مستنفذ من الحد {Math.round(creditPct)}%</span>
                        <span className="font-mono text-slate-600">{fmt(bal)} / {fmt(creditLimit)} ج.م</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-500 ${creditPct > 90
                            ? "bg-gradient-to-r from-rose-500 to-red-600"
                            : creditPct > 70
                              ? "bg-gradient-to-r from-amber-400 to-orange-500"
                              : "bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"
                          }`} style={{ width: `${creditPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Left Column: Quick Actions (lg:col-span-3) */}
                <div className="lg:col-span-3 flex items-center justify-end gap-2 shrink-0">
                  <PermissionGate page="customer_accounts" action="edit">
                    <motion.button
                      whileHover={{ y: -1, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 px-3.5 py-2.5 text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer text-[11px] font-extrabold"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5px]" />
                      <span>{bal < 0 ? "رد دفعة" : "تحصيل دفعة"}</span>
                    </motion.button>
                  </PermissionGate>
                  <PermissionGate page="customer_accounts" action="edit">
                    <motion.button
                      whileHover={{ y: -1, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setAdjForm({ amount: "", direction: "subtract", reason: "" }); setShowAdjust(true); }}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50/50 px-3.5 py-2.5 text-slate-700 shadow-sm transition-all duration-200 cursor-pointer text-[11px] font-extrabold"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-slate-450" />
                      <span>تسوية رصيد</span>
                    </motion.button>
                  </PermissionGate>
                </div>
              </div>
            </div>

            {/* Custom Tab Panel bar with Sliding Background */}
            <div className="flex gap-2 px-6 py-3 bg-white border-b border-slate-200/50 shrink-0 relative">
              {[
                { id: "movements", label: "سجل الحركات المالية" },
                { id: "notes", label: "ملاحظات وتنبيهات العميل" },
              ].map(t => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className="px-4 py-2 text-[12px] font-bold rounded-xl relative z-10 transition-colors duration-200"
                  style={{ color: activeTab === t.id ? "#1d4ed8" : "#64748b" }}
                >
                  {activeTab === t.id && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-slate-100 rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Container */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/40">
              {activeTab === "movements" ? (
                <MovementsTab
                  party={selected}
                  partyType="customer"
                  onOpenInvoice={setDetailInvoice}
                  onOpenReturn={setDetailReturn}
                />
              ) : (
                <NotesTab
                  notes={notesData}
                  loading={notesLoading}
                  onAdd={handleAddNote}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Invoice Detail Modal ══════════════════════════════ */}
      <AnimatePresence>
        {detailInvoice && (
          <Modal onClose={() => { setDetailInvoice(null); setDetailData(null); }} width="650px">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[16px] font-black text-slate-800">تفاصيل فاتورة المبيعات</h2>
                  <p className="text-[11px] text-slate-400 font-bold font-mono mt-0.5">{detailInvoice.invoice_no || `#${detailInvoice.id}`}</p>
                </div>
                <button onClick={() => { setDetailInvoice(null); setDetailData(null); }} className="h-8.5 w-8.5 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-zinc-900 transition-colors">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-[12px] font-bold">جاري تحميل تفاصيل الفاتورة...</span>
                </div>
              ) : detailData ? (
                <>
                  <div className="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-4 mb-4">
                    <div className="grid grid-cols-2 gap-3.5 text-[12px]">
                      <div><span className="font-bold text-slate-400">العميل المستفيد:</span> <span className="font-bold text-slate-800">{detailData.customer_name || "—"}</span></div>
                      <div><span className="font-bold text-slate-400">طريقة سداد الفاتورة:</span> <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold ${PTYPE_COLOR[detailData.payment_type] || "text-slate-650 bg-slate-100 border-slate-200"}`}>{arMethod(detailData.payment_type)}</span></div>
                      <div><span className="font-bold text-slate-400">تاريخ المعاملة:</span> <span className="font-bold text-slate-800 font-mono">{fmtDate(detailData.created_at)}</span></div>
                      <div><span className="font-bold text-slate-400">حالة السداد:</span> <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${detailData.status === "paid" ? "bg-emerald-100/80 text-emerald-700" : detailData.status === "cancelled" ? "bg-rose-100/80 text-rose-700" : "bg-amber-100/80 text-amber-700"}`}>{detailData.status === "paid" ? "مسدد بالكامل" : detailData.status === "cancelled" ? "ملغي" : "آجل غير كامل السداد"}</span></div>
                    </div>
                  </div>

                  {/* Lines Receipt */}
                  <div className="rounded-2xl border border-slate-200/80 overflow-hidden mb-4 shadow-sm bg-white">
                    <div className="bg-slate-50/80 grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] font-bold text-slate-500 border-b border-slate-200/60">
                      <div className="col-span-5">اسم البند/الصنف</div>
                      <div className="col-span-2 text-center">الكمية</div>
                      <div className="col-span-2 text-center">سعر الوحدة</div>
                      <div className="col-span-1 text-center">خصم</div>
                      <div className="col-span-2 text-left">الإجمالي</div>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {detailData.lines?.map((line, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50/40 transition-colors">
                          <div className="col-span-5 text-[12px] font-bold text-slate-800 truncate">{line.item_name || line.name}</div>
                          <div className="col-span-2 text-center font-mono text-[11px] text-slate-650">{line.quantity}</div>
                          <div className="col-span-2 text-center font-mono text-[11px] text-slate-650">{fmt(line.unit_price)}</div>
                          <div className="col-span-1 text-center font-mono text-[10px] text-rose-500">{line.discount > 0 ? fmt(line.discount) : "—"}</div>
                          <div className="col-span-2 text-left font-mono text-[11px] font-bold text-slate-800">{fmt(line.line_total)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-900 text-white px-4 py-4.5">
                      <div className="flex justify-between text-[11px] mb-2"><span className="text-slate-400">إجمالي الأصناف الفرعي</span><span className="font-mono">{fmt(detailData.subtotal)} ج.م</span></div>
                      {Number(detailData.discount) > 0 && <div className="flex justify-between text-[11px] mb-2"><span className="text-slate-400">خصم إضافي للفاتورة</span><span className="font-mono text-rose-350">- {fmt(detailData.discount)} ج.م</span></div>}
                      {Number(detailData.increase) > 0 && <div className="flex justify-between text-[11px] mb-2"><span className="text-slate-400">رسوم / تكلفة إضافية</span><span className="font-mono text-amber-350">+ {fmt(detailData.increase)} ج.م</span></div>}
                      <div className="flex justify-between text-[14px] font-bold border-t border-slate-700/80 pt-3 mt-3">
                        <span className="text-slate-355">إجمالي قيمة الفاتورة النهائي</span>
                        <span className="font-mono text-emerald-350">{fmt(detailData.total)} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods Breakdown */}
                  {detailData.payments?.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 overflow-hidden mb-4 shadow-sm bg-white">
                      <div className="bg-slate-50/80 px-4 py-2.5 text-[10px] font-bold text-slate-500 border-b border-slate-200/60 uppercase">
                        توزيع القنوات المالية المستلمة
                      </div>
                      <div className="divide-y divide-slate-100">
                        {detailData.payments.map((p, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-3">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${p.method === "cash" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" :
                                p.method === "credit" ? "bg-amber-50 text-amber-700 border-amber-200/60" :
                                  p.method === "bank" ? "bg-sky-50 text-sky-700 border-sky-200/60" :
                                    "bg-slate-150 text-slate-750 border-slate-200/60"
                              }`}>
                              {arMethod(p.method) || p.method_name || p.method}
                            </span>
                            <span className="font-mono font-bold text-[13px] text-slate-800">{fmt(p.amount)} <span className="text-[10px] font-bold text-slate-400 mr-0.5">ج.م</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-5">
                    <button onClick={() => window.open(`/invoices/${detailInvoice.id}`, "_blank")}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 py-3 text-[12px] font-bold text-white shadow-sm transition-all duration-200 active:scale-[0.98]">
                      <ExternalLink className="h-4 w-4" /> فتح الفاتورة بالكامل
                    </button>
                    <button onClick={() => { setDetailInvoice(null); setDetailData(null); }} className="px-6 rounded-2xl border border-slate-250 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">إغلاق</button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <FileText className="h-8 w-8 opacity-30" />
                  <span className="font-bold text-[13px]">تعذر عرض تفاصيل الفاتورة المطلوبة</span>
                </div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Return Detail Modal ══════════════════════════════ */}
      <AnimatePresence>
        {detailReturn && (
          <Modal onClose={() => setDetailReturn(null)} width="480px">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-[16px] font-black text-slate-800">تفاصيل سند المرتجع المالي</h2>
                  <p className="text-[11px] text-slate-400 font-bold font-mono mt-0.5">{detailReturn.doc_no || `#${detailReturn.id}`}</p>
                </div>
                <button onClick={() => setDetailReturn(null)} className="h-8.5 w-8.5 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"><X className="h-4.5 w-4.5" /></button>
              </div>
              <div className="space-y-4 text-[12px]">
                {[
                  ["سند الفاتورة الأصلية", detailReturn.original_invoice_no || "—", "font-mono"],
                  ["قيمة المرتجع المالي", `${fmt(detailReturn.total)} ج.م`, "font-mono font-bold text-rose-600"],
                  ["طريقة استرداد القيمة", arMethod(detailReturn.refund_method) || detailReturn.refund_method || "—", ""],
                  ["سبب إرجاع البضاعة", detailReturn.reason || "لا يوجد سبب مسجل للحركة", ""],
                  ["تاريخ قيد الحركة", fmtDate(detailReturn.created_at), "font-mono"]
                ].map(([label, value, classes]) => (
                  <div key={label} className="flex justify-between border-b border-slate-100 pb-3.5 items-center">
                    <span className="font-bold text-slate-450">{label}</span>
                    <span className={`text-slate-800 ${classes}`}>{value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setDetailReturn(null)} className="mt-5 w-full rounded-2xl border border-slate-250 py-3 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">إغلاق النافذة</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ══ Modals ══════════════════════════════════════════ */}

      <AddCustomerModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCustomerCreated}
      />

      <CustomerInfoModal
        open={showEdit}
        customerId={selected?.id}
        onClose={() => setShowEdit(false)}
        onUpdated={(updated) => {
          setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
          setSelected(updated);
        }}
      />

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && selected && (
          <Modal onClose={() => setShowPayment(false)}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-[16px] font-black text-slate-850">{bal < 0 ? "رد دفعة مالية للعميل" : "تحصيل دفعة مالية من العميل"}</h2>
                <button onClick={() => setShowPayment(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-[12px] text-slate-450 font-bold mb-3.5">الحساب المالي المستهدف: <span className="text-slate-800 font-bold">{selected.name}</span></p>
              {bal > 0 && (
                <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-3.5 mb-4 text-[12px] font-bold text-rose-800 flex justify-between items-center">
                  <span>إجمالي الرصيد المستحق بذمته:</span>
                  <span className="font-mono font-bold text-[14px]">{fmt(bal)} ج.م</span>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-450 mb-1.5 block uppercase">المبلغ المقبوض أو المسترد <span className="text-rose-500">*</span></label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full h-11.5 rounded-xl border border-slate-200 px-4 text-[17px] font-bold font-mono outline-none focus:border-blue-500 focus:shadow-sm" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-450 mb-1.5 block uppercase">قناة استلام أو رد النقدية <span className="text-rose-500">*</span></label>
                  <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                    className="w-full h-11.5 rounded-xl border border-slate-200 px-4 text-[12px] font-bold bg-white outline-none focus:border-blue-500">
                    <option value="">-- اختر القناة المالية --</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-450 mb-1.5 block uppercase">ملاحظات توضيحية على الدفعة (اختياري)</label>
                  <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-11.5 rounded-xl border border-slate-200 px-4 text-[12px] font-semibold outline-none focus:border-blue-500" placeholder="مثال: دفعة تحت الحساب للفواتير المعلقة" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                  className="flex-1 h-11 rounded-2xl bg-blue-600 text-white text-[12px] font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all duration-200 active:scale-[0.98]">
                  {saving ? "جاري قيد المعاملة المالية..." : "تأكيد وقيد الحركة الآن"}
                </button>
                <button onClick={() => setShowPayment(false)} className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-[12px] font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Adjust Modal */}
      <AnimatePresence>
        {showAdjust && selected && (
          <Modal onClose={() => setShowAdjust(false)}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-[16px] font-black text-slate-850">تسوية رصيد حساب العميل يدوياً</h2>
                <button onClick={() => setShowAdjust(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-[12px] text-slate-450 font-bold mb-4">
                العميل: <span className="text-slate-800 font-bold">{selected.name}</span>
                {" — "}قبل التسوية:
                <span className={`font-mono font-bold ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}> {fmt(Math.abs(bal))} ج.م</span>
              </p>
              <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-3.5 mb-4">
                <p className="text-[10.5px] font-semibold text-amber-800 leading-relaxed flex gap-1.5 items-start">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                  <span>تنبيه هام: التسوية اليدوية تقوم بتعديل الرصيد الدفتري للعميل مباشرة دون إثبات أو قيد حركة نقدية في الصناديق. تستخدم لتصحيح الأرصدة أو في حالة الخصومات المتفق عليها خارج الحساب.</span>
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                    className={`p-3 rounded-2xl border-2 text-[12px] font-bold transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400 hover:border-slate-350"}`}>
                    <div className="text-[18px] mb-1">↓</div>تخفيض مديونية العميل
                    <div className="text-[10px] font-medium mt-0.5 opacity-70">(خصم / إعفاء خاص)</div>
                  </button>
                  <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                    className={`p-3 rounded-2xl border-2 text-[12px] font-bold transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-400 hover:border-slate-350"}`}>
                    <div className="text-[18px] mb-1">↑</div>رفع مديونية العميل
                    <div className="text-[10px] font-medium mt-0.5 opacity-70">(إضافة دين / قيد تصحيح)</div>
                  </button>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-450 mb-1.5 block uppercase">قيمة التسوية المطلوبة <span className="text-rose-500">*</span></label>
                  <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full h-11.5 rounded-xl border border-slate-200 px-4 text-[17px] font-bold font-mono outline-none focus:border-blue-500 focus:shadow-sm" placeholder="0.00" autoFocus />
                </div>
                {adjForm.amount > 0 && (() => {
                  const newBal = adjForm.direction === "subtract" ? bal - Number(adjForm.amount) : bal + Number(adjForm.amount);
                  return (
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-200/60">
                      <p className="text-[10px] font-bold text-slate-450 mb-1">صافي الرصيد المتوقع لحساب العميل بعد الحفظ:</p>
                      <p className={`text-[17px] font-bold font-mono ${newBal > 0 ? "text-rose-600" : newBal < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {fmt(Math.abs(newBal))} ج.م
                      </p>
                    </div>
                  );
                })()}
                <div>
                  <label className="text-[11px] font-bold text-slate-450 mb-1.5 block uppercase">سبب وقيد التسوية اليدوية (مطلوب) <span className="text-rose-500">*</span></label>
                  <input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                    className="w-full h-11.5 rounded-xl border border-slate-200 px-4 text-[12px] outline-none focus:border-blue-500 font-semibold"
                    placeholder="مثال: تسوية خصومات مسموح بها للفواتير السابقة" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAdjust} disabled={saving || !adjForm.amount || !adjForm.reason}
                  className="flex-1 h-11 rounded-2xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-950 disabled:opacity-50 transition-colors">
                  {saving ? "جاري تنفيذ وحفظ التسوية..." : "تأكيد وقيد التسوية الآن"}
                </button>
                <button onClick={() => setShowAdjust(false)} className="h-11 px-6 rounded-2xl bg-slate-100 text-slate-700 text-[12px] font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Notes Tab (inline, keeps file self-contained) ─────────
function NotesTab({ notes, loading, onAdd }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onAdd(text);
    setText("");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-amber-600" />
        <span className="text-[12px] font-bold">جاري تحميل ملاحظات وتنبيهات العميل...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Add note inline */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-shadow duration-200">
        <div className="text-[10px] font-bold text-slate-450 mb-2 uppercase tracking-wider">إضافة ملاحظة أو تنبيه جديد لملف العميل</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full rounded-xl border border-slate-200 p-3 text-[13px] font-semibold outline-none focus:border-amber-500 resize-none transition-all focus:shadow-sm"
          placeholder="اكتب هنا أي ملاحظة هامة تتعلق بالتعامل المالي، المبيعات أو شروط التسوية..." />
        <div className="flex justify-end mt-2">
          <button onClick={submit} disabled={saving || !text.trim()}
            className="h-9 px-5 rounded-xl bg-amber-650 hover:bg-amber-700 text-white text-[12px] font-bold disabled:opacity-40 transition-colors shadow-sm shadow-amber-100">
            {saving ? "جاري الحفظ..." : "حفظ الملاحظة الآن"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-350 gap-3 bg-white/40 border border-dashed border-slate-200 rounded-2xl p-6">
          <div className="p-3.5 rounded-full bg-slate-100/50 border border-slate-200/50">
            <MessageSquare className="h-6 w-6 text-slate-400" />
          </div>
          <span className="font-bold text-[12px] text-slate-400">لا توجد ملاحظات أو تنبيهات مسجلة لهذا العميل</span>
        </div>
      ) : (
        <div className="relative pr-6 border-r-2 border-slate-200 space-y-4">
          {notes.map((n, index) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(0.4, index * 0.03) }}
              className="relative rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-200"
            >
              {/* Timeline marker */}
              <div className="absolute right-[-31px] top-6 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-sm animate-pulse" />

              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                  <span>ملاحظة مسجلة</span>
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                  <span>بواسطة: {n.user_name || "النظام"}</span>
                  <span>•</span>
                  <span className="font-mono">{n.created_at ? new Date(n.created_at).toLocaleDateString("ar-EG") : "—"}</span>
                </div>
              </div>
              <p className="text-[12.5px] font-semibold leading-relaxed text-slate-700 whitespace-pre-wrap">{n.note}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
