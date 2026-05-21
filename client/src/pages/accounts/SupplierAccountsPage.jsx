import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building, Search, Plus, X, Phone, SlidersHorizontal,
  MessageSquare, Eye, ExternalLink, RefreshCw, FileText,
  ShoppingBag, CreditCard, RotateCcw, Scale, ChevronDown, ChevronUp, Calendar,
  Copy, Check, TrendingUp, TrendingDown, Info, AlertCircle
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { usePageTour } from "../../hooks/usePageTour";
import PermissionGate from "../../components/ui/PermissionGate";
import AddSupplierModal from "../../components/modals/AddSupplierModal";
import SupplierInfoModal from "../../components/modals/SupplierInfoModal";

const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";


function Modal({ onClose, children, width = "480px" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div style={{ width }} className="bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// Deterministic avatar gradient
const getAvatarBg = (name) => {
  if (!name) return "from-slate-400 to-slate-500";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-orange-500 to-amber-650",
    "from-emerald-500 to-teal-650",
    "from-rose-500 to-pink-650",
    "from-indigo-500 to-blue-650",
    "from-sky-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-cyan-500 to-emerald-600",
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const EVENT_TYPES = {
  purchase:   { icon: ShoppingBag, label: "فاتورة شراء",   color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-100" },
  payment:    { icon: CreditCard,  label: "سداد دفعة",     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  return:     { icon: RotateCcw,   label: "مرتجع شراء",    color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100" },
  adjustment: { icon: Scale,       label: "تسوية يدوية",   color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
};

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

const PMETHOD_LABEL = { cash: "نقداً", credit: "آجل", bank_transfer: "تحويل بنكي", multi: "متعدد", future_due: "استحقاق لاحق" };

// Parse ALL splits including credit — used for متعدد display
function parseAllPaymentSplits(splits) {
  if (!splits) return [];
  const raw = splits.split("|||").map(s => {
    const idx = s.indexOf(":");
    if (idx === -1) return null;
    const method = s.slice(0, idx).trim();
    const amount = Number(s.slice(idx + 1));
    return { method, amount };
  }).filter(Boolean).filter(s => s.amount > 0.005);
  const map = {};
  for (const item of raw) map[item.method] = (map[item.method] || 0) + item.amount;
  return Object.entries(map).map(([method, amount]) => ({ method, amount }));
}

// Per-method color tokens (shared with customer page pattern)
const S_METHOD_STYLE = {
  cash:          { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  card:          { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  bank:          { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500" },
  bank_transfer: { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200",     dot: "bg-sky-500" },
  credit:        { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  installments:  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200",  dot: "bg-violet-500" },
  wallet:        { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200",  dot: "bg-purple-500" },
  default:       { bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200",   dot: "bg-slate-400" },
};
const sms = (method) => S_METHOD_STYLE[method] || S_METHOD_STYLE.default;

const TYPE_CARD_STYLE = {
  purchase: "border-slate-200/70 hover:border-orange-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  payment: "border-slate-200/70 hover:border-emerald-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  return: "border-slate-200/70 hover:border-rose-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  adjustment: "border-slate-200/70 hover:border-amber-300/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
  opening: "border-slate-200 border-dashed bg-slate-50/50",
};

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
    <div className="mt-1.5">
      <button onClick={load}
        className="flex items-center gap-1 text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-2 py-0.5 hover:bg-violet-100">
        <Calendar className="h-3 w-3" />
        {pending !== null ? `${pending} قسط متبقي` : "الأقساط"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && schedules?.length > 0 && (
        <div className="mt-1.5 space-y-1 pr-2 border-r-2 border-violet-200">
          {schedules.map(s => {
            const isOverdue = s.status !== "paid" && s.due_date < today;
            const isPaid = s.status === "paid";
            return (
              <div key={s.id} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[10px] font-bold ${isPaid ? "bg-emerald-50 text-emerald-700" : isOverdue ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-600"}`}>
                <span>القسط {s.installment_no} — {fmtDate(s.due_date)}</span>
                <span className="font-black font-mono">{fmt(s.amount)}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-200 text-emerald-800" : isOverdue ? "bg-rose-200 text-rose-800" : "bg-slate-200 text-slate-700"}`}>
                  {isPaid ? "مسدد" : isOverdue ? "متأخر" : "معلق"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MovementsTab({ party, onOpenPurchase, onOpenReturn }) {
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
    <div className="bg-slate-50/45 border border-slate-100 rounded-[28px] p-5 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.015)] backdrop-blur-md select-none text-right" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11.5px] font-black text-slate-400 ml-1.5 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            تصفية الحركات:
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "الكل", color: "hover:border-slate-350 hover:bg-slate-50 text-slate-650 bg-white" },
              { id: "purchase", label: "مشتريات آجل", color: "hover:border-orange-200 hover:bg-orange-50/30 text-orange-700 bg-white" },
              { id: "payment", label: "سداد دفعة", color: "hover:border-emerald-200 hover:bg-emerald-50/30 text-emerald-750 bg-white" },
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
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            تحديد الفترة:
          </span>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* From Date Pill */}
            <div className="flex items-center gap-2 bg-white border border-slate-200/85 rounded-2xl px-3.5 py-1.5 shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 transition-all">
              <span className="text-[10px] font-black text-slate-450 shrink-0">من</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[12px] font-black text-slate-700 bg-transparent border-0 p-0 m-0 outline-none focus:outline-none focus:ring-0 w-28 cursor-pointer text-center"
              />
            </div>

            {/* To Date Pill */}
            <div className="flex items-center gap-2 bg-white border border-slate-200/85 rounded-2xl px-3.5 py-1.5 shadow-sm focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 transition-all">
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

  const arMethod = (key) => PMETHOD_LABEL[key] || key;

  const load = useCallback(async () => {
    if (!party?.id) return;
    setLoading(true);
    try {
      const [docsR, paysR, retsR, adjR] = await Promise.allSettled([
        api.get(`/api/purchases?supplier_id=${party.id}&limit=200`),
        api.get(`/api/payments?party_type=supplier&party_id=${party.id}&limit=200`),
        api.get(`/api/purchases/returns?supplier_id=${party.id}&limit=200`),
        api.get(`/api/suppliers/${party.id}/notes?type=adjustment`),
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
        // For متعدد: parse ALL splits (incl. credit) so آجل is never lost
        const allChips = d.payment_type === "multi"
          ? parseAllPaymentSplits(d.payment_splits)
          : chips;
        // Original آجل amount from splits (permanent, even if debt later paid off)
        const ajalChipAmount = d.payment_type === "multi"
          ? (allChips.find(c => c.method === "credit")?.amount || 0)
          : 0;
        items.push({
          id: `pur-${d.id}`,
          type: "purchase",
          date: new Date(d.created_at),
          ref: d.doc_no || `#${d.id}`,
          chips,
          allChips,
          // Full purchase amount shown on card; balance impact only for أجل portion
          invoiceTotal: total,
          ajalAmount,
          ajalChipAmount,
          impactAmount: ajalAmount,
          impactDir: ajalAmount > 0.005 ? "add" : null,
          raw: d,
        });
      });

      // Only standalone payments (not at purchase creation)
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
        const isSplit = r.settlement_type === "split";
        const isCashOnly = r.settlement_type === "cash";
        const creditAmt = isSplit ? Number(r.credit_amount || 0) : (isCashOnly ? 0 : Number(r.total || 0));
        items.push({
          id: `ret-${r.id}`,
          type: "return",
          date: new Date(r.created_at),
          ref: r.doc_no || `RET-${r.id}`,
          description: r.purchase_id ? `مرتجع فاتورة #${r.purchase_id}` : "مرتجع شراء",
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
          description: n.note || "تسوية يدوية",
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
  }, [party]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 animate-pulse">
        <RefreshCw className="h-7 w-7 animate-spin text-orange-600" />
        <span className="text-[12px] font-bold">جاري تحميل سجل الحركات...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-350 gap-4 border border-dashed border-slate-200 rounded-[24px] bg-white/40 max-w-5xl mx-auto shadow-inner animate-fade-in">
        <div className="p-4 rounded-full bg-slate-50 border border-slate-100/80 shadow-sm">
          <FileText className="h-7 w-7 text-slate-400 stroke-[1.5px]" />
        </div>
        <span className="font-extrabold text-[13px] text-slate-500 tracking-tight">لا توجد حركات مالية مسجلة للمورد حالياً</span>
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
        const isDocRow = ev.type === "purchase";

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

        // Theme mapping for suppliers
        const theme = {
          purchase: {
            bezel: "bg-gradient-to-br from-orange-50/60 to-amber-50/20 border-orange-200/50 hover:border-orange-300/80",
            borderRight: "border-r-orange-500",
            badge: "bg-orange-50 text-orange-700 border-orange-200/50",
            label: "مشتريات آجل"
          },
          payment: {
            bezel: "bg-gradient-to-br from-emerald-50/60 to-teal-50/20 border-emerald-200/50 hover:border-emerald-300/80",
            borderRight: "border-r-emerald-500",
            badge: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
            label: "دفعة مسددة"
          },
          return: {
            bezel: "bg-gradient-to-br from-rose-50/60 to-pink-50/20 border-rose-200/50 hover:border-rose-300/80",
            borderRight: "border-r-rose-500",
            badge: "bg-rose-50 text-rose-750 border-rose-200/50",
            label: "مرتجع مشتريات"
          },
          adjustment: {
            bezel: "bg-gradient-to-br from-amber-50/60 to-orange-50/20 border-amber-200/50 hover:border-amber-300/80",
            borderRight: "border-r-amber-500",
            badge: "bg-amber-50 text-amber-700 border-amber-200/50",
            label: "تسوية رصيد"
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
                            const style = sms(chip.method);
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
                        <span className="text-[11.5px] text-slate-450 font-semibold border-r-2 border-slate-200 pr-2 block truncate max-w-[240px]" title={ev.description}>
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
                            <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider mb-1 select-none">
                              {ev.type === "return"
                                ? "المخصوم من الآجل"
                                : ev.impactDir === "add" || isMulti
                                  ? "المضاف للآجل"
                                  : "المخصوم من الرصيد"}
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
                      {ev.type === "purchase" && (
                        <button
                          onClick={() => onOpenPurchase(ev.raw)}
                          className="h-8.5 w-8.5 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-600 border border-slate-200/80 hover:border-orange-200 transition-all duration-200 shrink-0 cursor-pointer shadow-sm active:scale-95 group"
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

                  {/* ── Installments schedule expandable sub-section ── */}
                  {isDocRow && isInstallments && ev.raw?.id && (
                    <div className="pt-3 border-t border-slate-100">
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

export default function SupplierAccountsPage() {
  usePageTour('supplier_accounts');
  const [searchParams, setSearchParams] = useSearchParams();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "movements");
  const [notesData, setNotesData] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [netBalance, setNetBalance] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReturn, setDetailReturn] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  const [payForm, setPayForm] = useState({ amount: "", method_id: "", notes: "" });
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "subtract", reason: "" });
  const [saving, setSaving] = useState(false);

  // Copy badges state hook
  const [copiedBadge, setCopiedBadge] = useState(null);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedBadge(type);
    toast.success(type === "phone" ? "تم نسخ رقم الهاتف" : "تم نسخ كود المورد");
    setTimeout(() => setCopiedBadge(null), 2000);
  };

  const loadSuppliers = useCallback(async () => {
    try {
      const [res, methodsReq] = await Promise.all([
        api.get("/api/suppliers"),
        api.get("/api/payment-methods"),
      ]);
      setSuppliers(res.data.data || []);
      setPaymentMethods((methodsReq.data.data || []).filter(m => m.id !== 2));
    } catch { toast.error("فشل تحميل الموردين"); }
    finally { setLoading(false); }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const r = await api.get("/api/suppliers/balance-summary");
      setNetBalance(r.data.data?.net_balance ?? null);
    } catch { setNetBalance(null); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!selected) return;
    setNotesLoading(true);
    try {
      const r = await api.get(`/api/suppliers/${selected.id}/notes?type=note`);
      setNotesData(r.data.data || []);
    } catch { setNotesData([]); }
    finally { setNotesLoading(false); }
  }, [selected]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === "notes") loadNotes(); }, [activeTab, loadNotes]);

  useEffect(() => {
    const urlId = searchParams.get("id");
    const urlTab = searchParams.get("tab");
    if (urlTab) setActiveTab(urlTab);
    if (urlId && suppliers.length > 0) {
      const found = suppliers.find(s => String(s.id) === String(urlId));
      if (found && (!selected || selected.id !== found.id)) setSelected(found);
      else if (!found) setSearchParams({});
    }
  }, [searchParams, suppliers, selected]);

  const selectSupplier = useCallback((s, tab = "movements") => {
    setSelected(s);
    setActiveTab(tab);
    setNotesData([]);
    setSearchParams({ id: String(s.id), tab });
  }, [setSearchParams]);

  const changeTab = useCallback((tab) => {
    setActiveTab(tab);
    if (selected) setSearchParams({ id: String(selected.id), tab });
  }, [selected, setSearchParams]);

  const refreshSelected = async () => {
    if (!selected) return;
    const r = await api.get(`/api/suppliers/${selected.id}`);
    setSelected(r.data.data);
    loadSuppliers();
    loadSummary();
  };

  useEffect(() => {
    if (!detailPurchase) { setDetailData(null); return; }
    setDetailLoading(true);
    api.get(`/api/purchases/${detailPurchase.id}`)
      .then(r => setDetailData(r.data.data))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailPurchase]);

  const handleSupplierCreated = (supplier) => {
    toast.success("تم إضافة المورد");
    loadSuppliers();
    selectSupplier(supplier, "movements");
  };

  const handlePayment = async () => {
    if (!payForm.amount || !payForm.method_id) return toast.error("أدخل المبلغ ووسيلة الدفع");
    setSaving(true);
    try {
      await api.post("/api/payments", {
        party_type: "supplier",
        party_id: selected.id,
        amount: Number(payForm.amount),
        method_id: Number(payForm.method_id),
        notes: payForm.notes || null,
      });
      toast.success("تم تسجيل السداد");
      setShowPayment(false);
      setPayForm({ amount: "", method_id: "", notes: "" });
      await refreshSelected();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تسجيل السداد"); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjForm.amount || Number(adjForm.amount) <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setSaving(true);
    try {
      await api.post(`/api/suppliers/${selected.id}/adjust`, adjForm);
      setShowAdjust(false);
      setAdjForm({ amount: "", direction: "subtract", reason: "" });
      await refreshSelected();
      toast.success("تم تسوية الرصيد وتسجيل الحركة");
    } catch (e) { toast.error(e.response?.data?.message || "فشل التسوية"); }
    finally { setSaving(false); }
  };

  const handleAddNote = async (noteText) => {
    if (!noteText?.trim()) return;
    try {
      await api.post(`/api/suppliers/${selected.id}/notes`, { note: noteText });
      toast.success("تم إضافة الملاحظة");
      loadNotes();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الإضافة"); }
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.code?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filter === "creditors") return Number(s.opening_balance) > 0;
    if (filter === "debtors") return Number(s.opening_balance) < 0;
    return true;
  });

  const bal = Number(selected?.opening_balance || 0);

  return (
    <div className="flex flex-1 min-h-0 bg-zinc-50 overflow-hidden" dir="rtl">

      {/* ── Left Panel ── */}
      <div className="w-[360px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-lg">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
                <Building className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[15px] font-black text-slate-900">حسابات الموردين</h1>
            </div>
            <PermissionGate page="supplier_accounts" action="add">
              <button onClick={() => setShowCreate(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-[11px] font-black text-white hover:bg-orange-700 transition-colors shadow-md shadow-orange-200">
                <Plus className="h-3.5 w-3.5" /> مورد جديد
              </button>
            </PermissionGate>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، الكود..."
              className="w-full h-10 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] font-bold outline-none focus:border-orange-500 bg-white" />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[{ id: "all", label: "الكل" }, { id: "creditors", label: "ندين لهم" }, { id: "debtors", label: "يدينون لنا" }].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-1 py-1.5 text-[11px] font-black rounded-md transition-all ${filter === f.id ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Net Balance Summary ── */}
        <div className="mx-2 mt-2 mb-1 rounded-xl bg-orange-50 border border-orange-100 p-3">
          <div className="text-[10px] font-black text-slate-500 mb-0.5">إجمالي المديونية</div>
          <div className={`text-[20px] font-black font-mono ${netBalance > 0 ? "text-rose-600" : netBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
            {summaryLoading ? "..." : fmt(netBalance ?? 0)}
            <span className="text-[11px] font-bold text-slate-400 mr-1">ج.م</span>
          </div>
          {netBalance > 0 && <div className="text-[9px] font-black text-rose-500 mt-0.5">مستحقات للموردين</div>}
          {netBalance < 0 && <div className="text-[9px] font-black text-emerald-600 mt-0.5">رصيد لصالحنا</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-[12px] text-slate-400 animate-pulse">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Building className="h-10 w-10 text-slate-200 mx-auto mb-2" />
              <p className="text-[12px] font-black text-slate-400">لا يوجد موردين</p>
            </div>
          ) : filtered.map(s => {
            const b = Number(s.opening_balance || 0);
            return (
              <div key={s.id} onClick={() => selectSupplier(s, "movements")}
                className={`p-3 rounded-xl cursor-pointer border transition-all ${selected?.id === s.id ? "bg-orange-50 border-orange-300" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[14px] font-black text-white shrink-0">
                    {s.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-black text-slate-900 truncate mb-0.5">{s.name}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400 font-mono truncate">{s.phone || s.code || "—"}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {b > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">له مستحق</span>}
                        {b < 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">عليه مستحق</span>}
                        <span className={`text-[12px] font-black font-mono ${b > 0 ? "text-rose-600" : b < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmt(Math.abs(b))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-350 bg-slate-50/20">
            <div className="p-5 rounded-full bg-slate-100/50 border border-slate-200/50 shadow-inner">
              <Building className="h-14 w-14 text-slate-400 opacity-60" />
            </div>
            <p className="text-[13px] font-bold text-slate-400">برجاء اختيار أحد الموردين من القائمة الجانبية لعرض الملف والتحركات المالية</p>
          </div>
        ) : (
          <>
            {/* Supplier Header Panel */}
            <div className="bg-white border-b border-slate-200/60 px-6 py-4 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.01)] relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Right Column: Supplier Info & Avatar (lg:col-span-5) */}
                <div className="lg:col-span-5 flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-750 flex items-center justify-center text-[16px] font-black text-white shrink-0 shadow-sm border border-white ring-2 ring-slate-100">
                    {selected.name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-black text-slate-900 truncate leading-tight tracking-tight">{selected.name}</h2>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="p-1 text-slate-400 hover:text-orange-600 hover:bg-slate-50 rounded-lg transition-all shrink-0 cursor-pointer active:scale-95"
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
                        </span>
                      )}
                      {selected.code && (
                        <span className="text-[9px] font-bold font-mono bg-slate-50 text-slate-550 border border-slate-200/50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>كود: {selected.code}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Column: Balance (lg:col-span-4) */}
                <div className="lg:col-span-4 flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={`h-8.5 w-8.5 rounded-lg flex items-center justify-center shrink-0 border shadow-sm ${bal > 0 ? "bg-rose-50 border-rose-200/60 text-rose-600" : bal < 0 ? "bg-emerald-50 border-emerald-200/60 text-emerald-600" : "bg-slate-50 border-slate-200/80 text-slate-400"}`}>
                      {bal > 0 ? <TrendingUp className="h-4 w-4 stroke-[2.3px]" /> : bal < 0 ? <TrendingDown className="h-4 w-4 stroke-[2.3px]" /> : <Check className="h-4 w-4 stroke-[2.5px]" />}
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        {bal > 0 ? "له مستحق بذمتنا" : bal < 0 ? "عليه مستحق لنا" : "رصيد الحساب مسوّى"}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <div className={`text-[17px] font-black font-mono leading-none tracking-tight ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-650" : "text-slate-700"}`}>
                          {fmt(Math.abs(bal))}
                        </div>
                        <span className={`text-[10px] font-extrabold ${bal > 0 ? "text-rose-450" : bal < 0 ? "text-emerald-450" : "text-slate-450"}`}>ج.م</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Left Column: Quick CTA Actions (lg:col-span-3) */}
                <div className="lg:col-span-3 flex items-center justify-end gap-2 shrink-0">
                  <PermissionGate page="supplier_accounts" action="edit">
                    <motion.button
                      whileHover={{ y: -1, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setPayForm({ amount: bal > 0 ? String(bal) : "", method_id: "", notes: "" }); setShowPayment(true); }}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-650 hover:from-orange-600 hover:to-orange-700 px-3.5 py-2.5 text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer text-[11px] font-extrabold"
                    >
                      <Plus className="h-4 w-4 stroke-[2.5px]" />
                      <span>سداد دفعة</span>
                    </motion.button>
                  </PermissionGate>
                  <PermissionGate page="supplier_accounts" action="edit">
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

            <div className="flex gap-1 px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
              {[{ id: "movements", label: "الحركات" }, { id: "notes", label: "الملاحظات" }].map(t => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className={`pb-3 px-3 text-[13px] font-black transition-colors relative ${activeTab === t.id ? "text-orange-600" : "text-slate-500 hover:text-slate-800"}`}>
                  {t.label}
                  {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 rounded-t-full" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {activeTab === "movements" ? (
                <MovementsTab
                  party={selected}
                  onOpenPurchase={setDetailPurchase}
                  onOpenReturn={setDetailReturn}
                />
              ) : (
                <NotesTab notes={notesData} loading={notesLoading} onAdd={handleAddNote} />
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ Purchase Detail Modal ══════════════════════════════ */}
      {detailPurchase && (
        <Modal onClose={() => { setDetailPurchase(null); setDetailData(null); }} width="640px">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">تفاصيل فاتورة الشراء</h2>
                <p className="text-[12px] text-slate-400 font-bold font-mono mt-0.5">{detailPurchase.doc_no || `#${detailPurchase.id}`}</p>
              </div>
              <button onClick={() => { setDetailPurchase(null); setDetailData(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse text-[12px] font-black">
                <RefreshCw className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            ) : detailData ? (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div><span className="font-black text-slate-400">المورد:</span> <span className="font-bold text-slate-800">{detailData.supplier_name || "—"}</span></div>
                    <div><span className="font-black text-slate-400">التاريخ:</span> <span className="font-bold text-slate-800">{fmtDate(detailData.created_at)}</span></div>
                    <div><span className="font-black text-slate-400">الإجمالي:</span> <span className="font-black font-mono text-slate-900">{fmt(detailData.total)} ج.م</span></div>
                    <div><span className="font-black text-slate-400">الحالة:</span> <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${detailData.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{detailData.status || "—"}</span></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => window.open(`/purchases/${detailPurchase.id}`, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-[12px] font-black text-white hover:bg-orange-700">
                    <ExternalLink className="h-3.5 w-3.5" /> فتح فاتورة الشراء
                  </button>
                  <button onClick={() => setDetailPurchase(null)} className="px-5 rounded-xl border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                <FileText className="h-8 w-8 opacity-40" />
                <span className="font-black text-[13px]">لا توجد تفاصيل</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ══ Return Detail Modal ══════════════════════════════ */}
      {detailReturn && (
        <Modal onClose={() => setDetailReturn(null)} width="480px">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[17px] font-black text-slate-900">تفاصيل المرتجع</h2>
                <p className="text-[12px] text-slate-400 font-bold font-mono mt-0.5">{detailReturn.doc_no || `#${detailReturn.id}`}</p>
              </div>
              <button onClick={() => setDetailReturn(null)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-[12px]">
              {[["المبلغ", `${fmt(detailReturn.total)} ج.م`], ["طريقة التسوية", detailReturn.settlement_type || "—"], ["السبب", detailReturn.reason || "—"], ["التاريخ", fmtDate(detailReturn.created_at)]].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-black text-slate-500">{label}</span>
                  <span className="font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setDetailReturn(null)} className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-[12px] font-black text-slate-600 hover:bg-slate-50">إغلاق</button>
          </div>
        </Modal>
      )}

      <AddSupplierModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleSupplierCreated}
      />

      <SupplierInfoModal
        open={showEdit}
        supplierId={selected?.id}
        onClose={() => setShowEdit(false)}
        onUpdated={(updated) => {
          setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelected(updated);
        }}
      />

      {/* Payment Modal */}
      {showPayment && selected && (
        <Modal onClose={() => setShowPayment(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">سداد دفعة للمورد</h2>
              <button onClick={() => setShowPayment(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-3">المورد: <span className="text-slate-800">{selected.name}</span></p>
            {bal > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-[12px] font-bold text-rose-800">
                له مستحق <span className="font-mono font-black">{fmt(bal)} ج.م</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-orange-500" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">وسيلة الدفع <span className="text-rose-500">*</span></label>
                <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-bold bg-white outline-none focus:border-orange-500">
                  <option value="">-- اختر الوسيلة --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">ملاحظات (اختياري)</label>
                <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-orange-500" placeholder="مثال: سداد فاتورة" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handlePayment} disabled={saving || !payForm.amount || !payForm.method_id}
                className="flex-1 h-11 rounded-xl bg-orange-600 text-white text-[13px] font-black hover:bg-orange-700 disabled:opacity-50 shadow-md shadow-orange-200">
                {saving ? "جاري التسجيل..." : "تأكيد السداد"}
              </button>
              <button onClick={() => setShowPayment(false)} className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjust Modal */}
      {showAdjust && selected && (
        <Modal onClose={() => setShowAdjust(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-black text-slate-900">تسوية رصيد يدوية</h2>
              <button onClick={() => setShowAdjust(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-[12px] text-slate-500 font-bold mb-5">
              المورد: <span className="text-slate-800">{selected.name}</span>
              {" — "}الرصيد الحالي:
              <span className={`font-mono font-black ${bal > 0 ? "text-rose-600" : bal < 0 ? "text-emerald-600" : "text-slate-500"}`}> {fmt(Math.abs(bal))} ج.م</span>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-[11px] font-black text-amber-800">⚠️ التسوية اليدوية تعدّل رصيد المورد مباشرة بدون تأثير على الخزنة. تُسجَّل في الحركات.</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "subtract" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "subtract" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                  <div className="text-[18px] mb-1">↓</div>تخفيض المستحق للمورد
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(خصم / تصحيح)</div>
                </button>
                <button onClick={() => setAdjForm(f => ({ ...f, direction: "add" }))}
                  className={`p-3 rounded-xl border-2 text-[12px] font-black transition-all ${adjForm.direction === "add" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"}`}>
                  <div className="text-[18px] mb-1">↑</div>رفع المستحق للمورد
                  <div className="text-[10px] font-bold mt-0.5 opacity-70">(إضافة مستحق / تصحيح)</div>
                </button>
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">المبلغ <span className="text-rose-500">*</span></label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-slate-200 px-4 text-[16px] font-black font-mono outline-none focus:border-orange-500" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[12px] font-black text-slate-600 mb-1.5 block">سبب التسوية</label>
                <input value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-200 px-4 text-[13px] outline-none focus:border-orange-500"
                  placeholder="مثال: خصم متفق عليه / تصحيح خطأ" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdjust} disabled={saving || !adjForm.amount}
                className="flex-1 h-11 rounded-xl bg-slate-800 text-white text-[13px] font-black hover:bg-slate-900 disabled:opacity-50">
                {saving ? "جاري التسوية..." : "تأكيد التسوية وتسجيلها"}
              </button>
              <button onClick={() => setShowAdjust(false)} className="h-11 px-6 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-black hover:bg-slate-200">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

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

  if (loading) return <div className="flex h-32 items-center justify-center text-[12px] font-black text-slate-400 animate-pulse">جاري التحميل...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="text-[11px] font-black text-slate-500 mb-2">إضافة ملاحظة</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          className="w-full rounded-xl border border-slate-200 p-3 text-[13px] font-bold outline-none focus:border-amber-400 resize-none"
          placeholder="اكتب ملاحظتك هنا..." />
        <button onClick={submit} disabled={saving || !text.trim()}
          className="mt-2 h-9 px-5 rounded-xl bg-amber-600 text-white text-[12px] font-black hover:bg-amber-700 disabled:opacity-40">
          {saving ? "جاري الحفظ..." : "حفظ الملاحظة"}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-slate-300 gap-2">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <span className="font-black text-[13px]">لا توجد ملاحظات</span>
        </div>
      ) : notes.map(n => (
        <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">📝 ملاحظة</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold">{n.user_name || "النظام"}</span>
              <span className="text-[10px] text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleDateString("ar-EG") : "—"}</span>
            </div>
          </div>
          <p className="text-[13px] font-bold leading-relaxed text-slate-800">{n.note}</p>
        </div>
      ))}
    </div>
  );
}
