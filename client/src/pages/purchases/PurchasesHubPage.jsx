import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, X, Eye, Pencil, SlidersHorizontal, Calendar, ExternalLink,
  User, FileText, Loader2, CreditCard, Clock, Ban, ArrowUpRight,
  Package, AlertTriangle, RefreshCw, Layers, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ClipboardList
} from "lucide-react";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

const METHOD_LABELS = {
  cash: "نقدي", 
  bank_transfer: "حوالة بنكية",
  credit: "آجل", 
  future_due: "استحقاق لاحق", 
  multi: "متعدد",
};

const METHOD_COLORS = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bank_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  credit: "bg-amber-50 text-amber-700 border-amber-200",
  future_due: "bg-rose-50 text-rose-700 border-rose-200",
  multi: "bg-purple-50 text-purple-700 border-purple-200",
};

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

const PAGE_SIZE = 20;

function formatMoney(v) {
  return formatNumber(v);
}

function fmtDate(d) {
  if (!d) return "—";
  const raw = d.split(".")[0].replace("T", " ");
  const [ymd, hms = "00:00"] = raw.split(" ");
  const [y, m, day] = ymd.split("-");
  const [hh, min] = hms.split(":");
  return `${day}/${m}/${y}, ${hh}:${min}`;
}

function parseSplits(splitsStr) {
  if (!splitsStr) return [];
  return splitsStr.split("|||").map(s => {
    const [type, amt] = s.split(":");
    return { type, amount: Number(amt || 0) };
  });
}

function MagneticButton({ children, onClick, className, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e) => {
    if (disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX * 0.3);
    y.set(mouseY * 0.3);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: mouseXSpring, y: mouseYSpring }}
      whileTap={{ scale: 0.95 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}

// ── Cancel invoice modal ────────────────────────────────────────────────────────
function CancelWarningModal({ row, onConfirm, onClose, cancelling }) {
  const [reason, setReason] = useState("");
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("يرجى إدخال سبب الإلغاء");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <AnimatePresence>
      {row && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <form onSubmit={handleSubmit} className="p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-[17px] number-fmt-primary text-zinc-900 mb-1">تأكيد إلغاء الفاتورة</h2>
                  <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                    سيتم إلغاء فاتورة الشراء <span className="font-black text-zinc-800 font-mono">{row.doc_no || `#${row.id}`}</span> نهائياً.
                    سيؤدي ذلك إلى عكس تأثيرها على المخزون وحساب المورد والخزينة.
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-[11px] font-black text-zinc-500 mb-2 uppercase tracking-wider">سبب الإلغاء</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="اكتب سبب إلغاء هذه الفاتورة..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={cancelling}
                  className="flex-1 h-11 rounded-2xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm shadow-rose-200"
                >
                  {cancelling ? "جاري الإلغاء..." : "تأكيد إلغاء الفاتورة"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 px-6 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-black hover:bg-zinc-200 transition-colors"
                >
                  تراجع
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Preview Modal Component ──────────────────────────────────────────────────
function PreviewDrawer({ purchaseId, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!purchaseId) return;
    setLoading(true);
    api.get(`/api/purchases/${purchaseId}`)
      .then(r => setData(r.data.data))
      .catch(() => toast.error("تعذر تحميل تفاصيل الفاتورة"))
      .finally(() => setLoading(false));
  }, [purchaseId]);

  const d = data;

  // Determine how much has been paid based on payment method
  // cash/bank_transfer: fully paid immediately (no payment records created)
  // credit/future_due:  nothing paid upfront — use debt_remaining if available
  // multi:              sum the payment split records
  const totalPaid = (() => {
    if (!d) return 0;
    const method = d.payment_method;
    if (method === "multi") return (d.payments || [])
      .filter(p => p.method_type !== "credit" && p.method_category !== "credit")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    if (d.amount_paid != null) return Number(d.amount_paid);
    if (method === "cash" || method === "bank_transfer") return Number(d.total || 0);
    // credit / future_due — any recorded partial payments
    return (d.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  })();
  const remaining = d
    ? (d.debt_remaining != null ? Number(d.debt_remaining) : Math.max(0, Number(d.total || 0) - totalPaid))
    : 0;

  return (
    <div className="flex flex-col gap-5 min-w-[320px] md:min-w-[620px]" dir="rtl">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري تحميل المستند</span>
        </div>
      ) : !d ? (
        <div className="text-center py-12 text-zinc-400 font-bold">تعذّر تحميل بيانات الفاتورة</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Header Card */}
          <div className="rounded-3xl bg-emerald-50/50 border border-emerald-100/80 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-black text-emerald-600 tracking-wider uppercase">رقم المستند</span>
              <span className="font-mono text-xl font-black text-zinc-950">{d.doc_no}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-black text-zinc-400 tracking-wider uppercase">تاريخ الفاتورة</span>
              <span className="font-mono text-sm font-bold text-zinc-600">{fmtDate(d.created_at)}</span>
            </div>
            <div className="flex flex-col gap-1 items-start md:items-end">
              <span className="text-[11px] font-black text-emerald-600 tracking-wider uppercase">إجمالي الفاتورة</span>
              <span className="number-fmt text-xl font-black text-emerald-700">{formatMoney(d.total)} ج.م</span>
            </div>
          </div>

          {/* Details & Payment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Supplier Info */}
            <div className="border border-zinc-100 rounded-3xl p-5 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-500" />
                </div>
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">تفاصيل المورد</h3>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-400">الاسم</span>
                  <Link to={`/accounts/suppliers/${d.supplier_id}`} className="font-black text-emerald-600 hover:underline">
                    {d.supplier_name || "مورد نقدي"}
                  </Link>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-400">طريقة الدفع</span>
                  <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-black ${METHOD_COLORS[d.payment_method] || "bg-zinc-50"}`}>
                    {METHOD_LABELS[d.payment_method] || d.payment_method}
                  </span>
                </div>
              </div>
            </div>

            {/* Balances summary */}
            <div className="border border-zinc-100 rounded-3xl p-5 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-zinc-500" />
                </div>
                <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">الموقف المالي للفاتورة</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100/80 p-2.5 text-center">
                  <span className="text-[9px] font-black text-zinc-400 block mb-1">الإجمالي</span>
                  <span className="number-fmt text-xs font-black text-zinc-800">{formatMoney(d.total)}</span>
                </div>
                <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100/50 p-2.5 text-center">
                  <span className="text-[9px] font-black text-emerald-600 block mb-1">المدفوع</span>
                  <span className="number-fmt text-xs font-black text-emerald-700">{formatMoney(totalPaid)}</span>
                </div>
                <div className={`rounded-2xl border p-2.5 text-center ${remaining > 0.005 ? "bg-amber-50/50 border-amber-100/50" : "bg-zinc-50 border-zinc-100"}`}>
                  <span className={`text-[9px] font-black block mb-1 ${remaining > 0.005 ? "text-amber-600" : "text-zinc-400"}`}>المتبقي</span>
                  <span className={`number-fmt text-xs font-black ${remaining > 0.005 ? "text-amber-700" : "text-zinc-600"}`}>{formatMoney(remaining)}</span>
                </div>
              </div>
              {/* Before → adjustments → after (only shown when a discount or increase is applied) */}
              {(Number(d.discount) > 0 || Number(d.increase) > 0) && (
                <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-500">المجموع قبل الخصم/الزيادة</span>
                    <span className="number-fmt text-zinc-700">{formatMoney(Number(d.total) + Number(d.discount || 0) - Number(d.increase || 0))} ج.م</span>
                  </div>
                  {Number(d.discount) > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-rose-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> خصم الفاتورة</span>
                      <span className="number-fmt font-black text-rose-600">− {formatMoney(d.discount)} ج.م</span>
                    </div>
                  )}
                  {Number(d.increase) > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> إضافة / رسوم</span>
                      <span className="number-fmt font-black text-emerald-600">+ {formatMoney(d.increase)} ج.م</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100">
                    <span className="font-black text-zinc-800">الإجمالي بعد التعديل</span>
                    <span className="number-fmt-primary font-black text-zinc-900">{formatMoney(d.total)} ج.م</span>
                  </div>
                </div>
              )}
              {d.payment_method === "multi" && d.payments?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1.5">
                  {d.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-500">{p.method_name || p.method_type || "—"}</span>
                      <span className="number-fmt-primary text-zinc-700">{formatMoney(p.amount)} ج.م</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items breakdown list */}
          <div className="border border-zinc-100 rounded-3xl overflow-hidden bg-white">
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-xs font-black text-zinc-800">أصناف الفاتورة ({d.lines?.length || 0})</span>
            </div>
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-100 z-10">
                  <tr>
                    <th className="px-4 py-3 font-black text-zinc-500 text-center">الكود</th>
                    <th className="px-4 py-3 font-black text-zinc-500">الصنف</th>
                    <th className="px-4 py-3 font-black text-zinc-500 text-center">الكمية</th>
                    <th className="px-4 py-3 font-black text-zinc-500 text-center">التكلفة فردي</th>
                    <th className="px-4 py-3 font-black text-zinc-500 text-center">إجمالي السطر</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.lines || []).map((l, i) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-emerald-50/10">
                      <td className="px-4 py-3.5 text-center font-mono text-[11px] font-black text-zinc-400">{l.item_code || "—"}</td>
                      <td className="px-4 py-3.5 font-bold text-zinc-800">{l.item_name || "—"}</td>
                      <td className="px-4 py-3.5 text-center number-fmt text-zinc-700">{l.quantity}</td>
                      <td className="px-4 py-3.5 text-center number-fmt text-zinc-600">{formatMoney(l.unit_cost)}</td>
                      <td className="px-4 py-3.5 text-center number-fmt-primary text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
            <button
              onClick={onClose}
              className="h-11 px-6 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black transition-colors"
            >
              رجوع
            </button>
            {d.status !== "cancelled" && (
              <PermissionGate page="purchases" action="edit">
                <button
                  onClick={() => navigate(`/purchases/${purchaseId}`)}
                  className="h-11 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/10"
                >
                  <Pencil className="w-4 h-4" /> تعديل الفاتورة
                </button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Individual Invoice List Row ────────────────────────────────────────────────
function InvoiceRow({ row, navigate, onPreviewRequest, onCancelRequest }) {
  const total = Number(row.total || 0);
  const paid = Number(row.amount_paid || 0);
  const remaining = Math.max(0, total - paid);

  return (
    <motion.div
      variants={FADE_UP}
      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 px-6 py-5 bg-white border-b border-zinc-100 hover:bg-emerald-50/20 transition-colors duration-300 overflow-hidden"
    >
      {/* Decorative vertical focus anchor */}
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />
      
      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
          <ArrowUpRight className="w-5 h-5 text-emerald-500" />
        </div>
        
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">
              {row.doc_no || `#${row.id}`}
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black ${
              row.status === "cancelled" ? "bg-zinc-100 text-zinc-400 border-zinc-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {row.status === "cancelled" ? "ملغاة" : "نشطة"}
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black ${METHOD_COLORS[row.payment_method] || "bg-zinc-50"}`}>
              {METHOD_LABELS[row.payment_method] || row.payment_method}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-zinc-50 text-zinc-500 border-zinc-200">
              <Package className="w-3 h-3" /> {row.items_count} أصناف
            </span>
            {row.source_purchase_order_id && (
              <Link to="/purchases/orders" title="ناتج عن أمر توريد"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors">
                <ClipboardList className="w-3 h-3" /> PO-{String(row.source_purchase_order_id).padStart(5, "0")}
              </Link>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            {row.supplier_id ? (
              <Link to={`/accounts/suppliers/${row.supplier_id}`} className="text-zinc-600 hover:text-emerald-600 hover:underline truncate">
                {row.supplier_name || `مورد #${row.supplier_id}`}
              </Link>
            ) : (
              <span>{row.supplier_name || "مورد نقدي"}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span dir="ltr">{fmtDate(row.created_at)}</span>
            {row.created_by_username && (
              <span className="text-zinc-500">{row.created_by_username}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-4 flex-shrink-0 z-10">
        {/* Money ledger pill */}
        <div className="flex items-stretch gap-0 bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="flex flex-col items-end justify-center px-3.5 py-1.5 min-w-[90px]">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">الإجمالي</span>
            <div className="text-sm font-black text-slate-800 number-fmt leading-none flex items-baseline gap-0.5">
              <span>{formatMoney(total)}</span>
              <span className="text-[8px] font-bold text-slate-400 mr-0.5">ج.م</span>
            </div>
          </div>
          
          {paid > 0.005 && (
            <>
              <div className="w-px self-stretch bg-slate-200/80" />
              <div className="flex flex-col items-end justify-center px-3.5 py-1.5 bg-emerald-50/50 min-w-[90px]">
                <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
                  المدفوع
                </span>
                <div className="text-sm font-black text-emerald-700 number-fmt leading-none flex items-baseline gap-0.5">
                  <span>{formatMoney(paid)}</span>
                  <span className="text-[8px] font-bold mr-0.5">ج.م</span>
                </div>
              </div>
            </>
          )}
          
          {remaining > 0.005 && (
            <>
              <div className="w-px self-stretch bg-slate-200/80" />
              <div className="flex flex-col items-end justify-center px-3.5 py-1.5 bg-amber-50/50 min-w-[90px]">
                <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 inline-block" />
                  المتبقي
                </span>
                <div className="text-sm font-black text-amber-700 number-fmt leading-none flex items-baseline gap-0.5">
                  <span>{formatMoney(remaining)}</span>
                  <span className="text-[8px] font-bold mr-0.5">ج.م</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Interactive row actions */}
        <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={() => onPreviewRequest(row)} 
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          {row.status !== "cancelled" && (
            <>
              <PermissionGate page="purchases" action="edit">
                <button 
                  onClick={() => navigate(`/purchases/${row.id}`)} 
                  className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
              <PermissionGate page="purchases" action="edit">
                <button 
                  onClick={() => onCancelRequest(row)} 
                  className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </PermissionGate>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Redesigned Purchases Hub Page Component ───────────────────────────────────
export default function PurchasesHubPage() {
  usePageTour('purchases');
  const handleKeyDown = useFieldNavigation();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("invoices"); // "invoices" | "items"
  const [invoices, setInvoices] = useState([]);
  const [itemRows, setItemRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const filterUserIdRef = useRef(null);
  const filterDateFromRef = useRef(null);
  const filterDateToRef = useRef(null);
  const filterSupplierRef = useRef(null);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const supplierInputRef = useRef(null);

  // Item autocomplete for the items tab
  const [itemQuery, setItemQuery] = useState("");
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [itemResults, setItemResults] = useState([]);
  const [selectedItemFilter, setSelectedItemFilter] = useState(null);
  const [activeLookupIndex, setActiveLookupIndex] = useState(-1);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const itemInputRef = useRef(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const debouncedItemQuery = useDebounce(itemQuery, 300);

  // Load suppliers filter dropdown
  useEffect(() => {
    api.get("/api/suppliers?limit=500")
      .then(r => setSuppliers(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  // Load users filter dropdown
  useEffect(() => {
    api.get("/api/users").then(r => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  // Fetch item autocomplete results
  useEffect(() => {
    if (!debouncedItemQuery.trim()) { setItemResults([]); return; }
    setIsLoadingItems(true);
    api.get(`/api/items?search=${encodeURIComponent(debouncedItemQuery)}&limit=20`)
      .then(r => setItemResults(r.data?.data || r.data || []))
      .catch(() => setItemResults([]))
      .finally(() => setIsLoadingItems(false));
  }, [debouncedItemQuery]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => s.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [supplierQuery, suppliers]);

  const handlePickSupplier = (s) => {
    setSelectedSupplier(s);
    setSupplierId(s.id);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
  };

  // Fetch Invoices ledger
  const loadInvoices = async () => {
    if (activeTab !== "invoices") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (supplierId) params.set("supplier_id", supplierId);
      if (userId) params.set("user_id", userId);

      const res = await api.get(`/api/purchases?${params}`);
      setInvoices(res.data?.data || []);
    } catch {
      toast.error("فشل تحميل فواتير المشتريات");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Item detail search — driven by selectedItemFilter or raw itemQuery
  const loadItemRows = async (queryOverride) => {
    if (activeTab !== "items") return;
    const q = queryOverride ?? (selectedItemFilter
      ? (selectedItemFilter.name || selectedItemFilter.code || selectedItemFilter.barcode)
      : itemQuery.trim());
    if (!q) {
      setItemRows([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (supplierId) params.set("supplier_id", supplierId);
      if (userId) params.set("user_id", userId);

      const res = await api.get(`/api/purchases/items-search?${params}`);
      setItemRows(res.data?.data || []);
    } catch {
      setItemRows([]);
      toast.error("فشل البحث بالأصناف");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "invoices") {
      loadInvoices();
    } else {
      loadItemRows();
    }
  }, [activeTab, debouncedSearch, selectedItemFilter, dateFrom, dateTo, supplierId, userId]);

  useEffect(() => { setPage(1); }, [invoices]);
  useEffect(() => { setItemPage(1); }, [itemRows]);

  // Handle invoice cancellation
  const handleConfirmCancel = async (reason) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.post(`/api/purchases/${cancelTarget.id}/cancel`, { reason });
      toast.success(`تم إلغاء الفاتورة ${cancelTarget.doc_no || `#${cancelTarget.id}`} بنجاح`);
      setCancelTarget(null);
      loadInvoices();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إلغاء الفاتورة");
    } finally {
      setCancelling(false);
    }
  };

  const hasFilters = dateFrom || dateTo || supplierId || userId;

  const totalInvoicePages = Math.ceil(invoices.length / PAGE_SIZE);
  const pagedInvoices = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalItemPages = Math.ceil(itemRows.length / PAGE_SIZE);
  const pagedItemRows = itemRows.slice((itemPage - 1) * PAGE_SIZE, itemPage * PAGE_SIZE);

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[var(--bg-base)]" dir="rtl">

      {/* Background kinetic light emitters */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Cinematic Header Block */}
        <motion.header 
          initial="hidden" 
          animate="visible" 
          variants={FADE_UP} 
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm">
                <Layers className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-[11px] font-black text-zinc-400 tracking-[0.2em] uppercase">سلسلة الإمداد</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">فواتير <span className="text-emerald-600">المشتريات</span></h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <PermissionGate page="purchases" action="add">
              <MagneticButton
                data-help="add-button"
                onClick={() => navigate("/purchases/new")}
                className="flex items-center gap-2 bg-primary text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-zinc-950/20 hover:bg-primary-600 transition-colors"
              >
                <Plus className="w-5 h-5" /> فاتورة شراء جديدة
              </MagneticButton>
            </PermissionGate>
          </div>
        </motion.header>

        {/* Tab Selection Pill Slider */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col gap-2">
          <div className="bg-zinc-100/80 border border-zinc-200/40 p-1.5 rounded-2xl flex gap-1.5 self-start">
            <button
              onClick={() => { setActiveTab("invoices"); setSearchTerm(""); setItemQuery(""); setSelectedItemFilter(null); setItemResults([]); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === "invoices"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              سجل الفواتير
            </button>
            <button
              onClick={() => { setActiveTab("items"); setSearchTerm(""); setItemQuery(""); setSelectedItemFilter(null); setItemResults([]); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === "items"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              البحث التفصيلي بالأصناف
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] font-bold text-zinc-400 px-2"
            >
              {activeTab === "invoices"
                ? "عرض وبحث في جميع فواتير المشتريات المسجلة"
                : "تتبّع مشتريات صنف بعينه عبر كامل سجل الفواتير"}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Unified Search & Filters Action Bar */}
        <motion.div 
          initial="hidden" 
          animate="visible" 
          variants={FADE_UP} 
          className="flex flex-col bg-white border border-zinc-200/60 rounded-[2rem] shadow-sm p-4 gap-4"
        >
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div data-help="search-bar" className="relative flex-1 w-full">
              {activeTab === "invoices" ? (
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onClear={() => setSearchTerm("")}
                  placeholder="ابحث برقم الفاتورة أو اسم المورد..."
                  size="lg"
                  autoFocus
                  className="w-full"
                />
              ) : (
                <div className="relative">
                  <SearchInput
                    ref={itemInputRef}
                    value={itemQuery}
                    onChange={(val) => {
                      setItemQuery(val);
                      setSelectedItemFilter(null);
                      setActiveLookupIndex(-1);
                      setItemLookupOpen(true);
                    }}
                    onClear={() => {
                      setItemQuery("");
                      setSelectedItemFilter(null);
                      setItemResults([]);
                      setItemRows([]);
                      setSearched(false);
                    }}
                    onFocus={() => setItemLookupOpen(true)}
                    onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (itemResults.length > 0 && activeLookupIndex >= 0) {
                          const picked = itemResults[activeLookupIndex];
                          setSelectedItemFilter(picked);
                          setItemQuery(picked.name);
                          setItemLookupOpen(false);
                        } else if (itemQuery.trim()) {
                          setSelectedItemFilter(null);
                          setItemLookupOpen(false);
                          loadItemRows(itemQuery.trim());
                        }
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveLookupIndex(p => Math.min(p + 1, itemResults.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveLookupIndex(p => Math.max(p - 1, 0));
                      }
                    }}
                    placeholder="ابحث باسم المنتج أو الباركود أو SKU..."
                    size="lg"
                    loading={isLoadingItems}
                    autoFocus
                    className="w-full"
                  />
                  {itemLookupOpen && (itemResults.length > 0 || itemQuery.trim()) && (
                    <SearchDropdown
                      items={itemResults}
                      activeIndex={activeLookupIndex}
                      query={itemQuery}
                      emptyLabel="لا توجد نتائج"
                      onPick={(item) => {
                        setSelectedItemFilter(item);
                        setItemQuery(item.name);
                        setItemLookupOpen(false);
                        setActiveLookupIndex(-1);
                      }}
                    />
                  )}
                  {selectedItemFilter && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-2">
                      <span className="font-mono text-[11px] font-black text-emerald-700 shrink-0">
                        {selectedItemFilter.code || selectedItemFilter.item_code || `#${selectedItemFilter.id}`}
                      </span>
                      <div className="h-3 w-px bg-emerald-300 shrink-0" />
                      <span className="text-2sm text-emerald-700 font-bold truncate">{selectedItemFilter.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemFilter(null);
                          setItemQuery("");
                          setItemResults([]);
                          setItemRows([]);
                          setSearched(false);
                        }}
                        className="mr-auto text-emerald-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-xs font-black transition-all w-full md:w-auto shrink-0 ${
                hasFilters 
                  ? "border-emerald-300 bg-emerald-50/50 text-emerald-700" 
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              تصفية
              {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Collapsible Filter Compartment */}
          {filtersOpen && (
            <div className="border-t border-zinc-100 pt-4 flex flex-wrap gap-4 items-end bg-transparent">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المستخدم</span>
                <select ref={filterUserIdRef} value={userId} onChange={e => setUserId(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]" onKeyDown={e => handleKeyDown(e, { nextRef: filterDateFromRef })}>
                  <option value="">كل المستخدمين</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
                <input 
                  ref={filterDateFromRef}
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)} 
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" 
                  onKeyDown={e => handleKeyDown(e, { nextRef: filterDateToRef, prevRef: filterUserIdRef })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
                <input 
                  ref={filterDateToRef}
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)} 
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" 
                  onKeyDown={e => handleKeyDown(e, { nextRef: filterSupplierRef, prevRef: filterDateFromRef })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المورد</span>
                <div className="relative">
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierQuery}
                    onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setSelectedSupplier(null); setSupplierId(""); }}
                    onFocus={() => setSupplierLookupOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                    placeholder="جميع الموردين"
                    className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]"
                    onKeyDown={e => handleKeyDown(e, { prevRef: filterDateToRef })}
                  />
                  {supplierLookupOpen && (
                    <SearchDropdown items={filteredSuppliers} onPick={handlePickSupplier} emptyLabel="لا يوجد موردين" />
                  )}
                </div>
                {selectedSupplier && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-1">
                    <span className="text-[11px] text-emerald-700 font-bold truncate">{selectedSupplier.name}</span>
                    <button onClick={() => { setSelectedSupplier(null); setSupplierId(""); setSupplierQuery(""); }}>
                      <X className="w-3 h-3 text-emerald-400 hover:text-rose-500" />
                    </button>
                  </div>
                )}
              </div>
              {hasFilters && (
                <button 
                  onClick={() => { setDateFrom(""); setDateTo(""); setSupplierId(""); setUserId(""); setSupplierQuery(""); setSelectedSupplier(null); }}
                  className="h-10 flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> مسح التصفية
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Master Ledger List View */}
        <motion.div
          initial="hidden" 
          animate="visible" 
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          data-help="main-table"
          className="flex flex-col bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden min-h-[420px]"
        >
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري مزامنة السجلات</span>
            </div>
          ) : activeTab === "invoices" ? (
            invoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                  <FileText className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد فواتير</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي فاتورة شراء مطابقة للمعايير المحددة.</p>
              </div>
            ) : (
              <>
                {pagedInvoices.map(row => (
                  <InvoiceRow
                    key={row.id}
                    row={row}
                    navigate={navigate}
                    onPreviewRequest={(r) => setPreviewTarget(r)}
                    onCancelRequest={setCancelTarget}
                  />
                ))}
                {totalInvoicePages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="h-4 w-4" /> السابق
                    </button>
                    <span className="text-[11px] font-black text-zinc-400">{page} / {totalInvoicePages}</span>
                    <button onClick={() => setPage(p => Math.min(totalInvoicePages, p + 1))} disabled={page >= totalInvoicePages}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      التالي <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )
          ) : (
            /* Item detail search result ledger */
            !searched ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-zinc-400">
                <Search className="w-12 h-12 opacity-25 mb-4" />
                <h3 className="text-base font-black text-zinc-800 mb-1">بحث تفصيلي ببيانات الصنف</h3>
                <p className="text-xs font-bold text-zinc-400 max-w-[45ch] leading-relaxed">
                  اكتب اسم المنتج أو الكود في شريط البحث للوصول لجميع سطور الفواتير التاريخية المرتبطة به.
                </p>
              </div>
            ) : itemRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                  <Package className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد نتائج مطابقة</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي صنف يطابق بحثك الحالي عبر جميع الفواتير.</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      <th className="px-5 py-3.5 font-black text-zinc-500">المستند</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">التاريخ</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">المورد</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">كود الصنف</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">اسم المنتج</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الكمية</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">تكلفة الشراء</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">سعر البيع</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الإجمالي</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">معاينة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItemRows.map((r, i) => (
                      <tr key={r.line_id || i} className="border-b border-zinc-100 hover:bg-emerald-50/10 transition-colors">
                        <td className="px-5 py-4 font-mono font-black text-zinc-700">{r.doc_no || "—"}</td>
                        <td className="px-5 py-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-5 py-4 font-bold text-zinc-700">{r.supplier_name || "—"}</td>
                        <td className="px-5 py-4 text-center font-mono text-[11px] font-black text-zinc-400">{r.item_code || r.barcode || "—"}</td>
                        <td className="px-5 py-4 font-bold text-zinc-800">
                          <div>{r.item_name || "—"}</div>
                          {r.item_id && (
                            <Link to={`/operations/items/${r.item_id}?types=purchases`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 hover:text-emerald-800">
                              <ExternalLink className="w-3 h-3" /> عرض كامل
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center number-fmt text-zinc-700">{r.quantity}</td>
                        <td className="px-5 py-4 text-center number-fmt-primary text-zinc-700">{formatMoney(r.unit_cost)}</td>
                        <td className="px-5 py-4 text-center number-fmt text-blue-600">{r.selling_price ? formatMoney(r.selling_price) : "—"}</td>
                        <td className="px-5 py-4 text-center number-fmt-primary text-emerald-700">{formatMoney(r.line_total || (r.quantity * r.unit_cost))}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setPreviewTarget({ id: r.purchase_id, doc_no: r.doc_no })}
                            className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors inline-block"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalItemPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                  <button onClick={() => setItemPage(p => Math.max(1, p - 1))} disabled={itemPage <= 1}
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" /> السابق
                  </button>
                  <span className="text-[11px] font-black text-zinc-400">{itemPage} / {totalItemPages}</span>
                  <button onClick={() => setItemPage(p => Math.min(totalItemPages, p + 1))} disabled={itemPage >= totalItemPages}
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    التالي <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
              </>
            )
          )}
        </motion.div>
      </div>

      {/* Floating Detailed Document Preview Drawer Overlay */}
      <AnimatePresence>
        {previewTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setPreviewTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-7 pt-7 pb-4 shrink-0">
                <h2 className="text-[17px] font-black text-zinc-900">
                  تفاصيل الفاتورة — {previewTarget.doc_no}
                </h2>
                <button
                  onClick={() => setPreviewTarget(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-7 pb-7">
                <PreviewDrawer 
                  purchaseId={previewTarget.id || previewTarget.purchase_id} 
                  onClose={() => setPreviewTarget(null)} 
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Warning Modal Overlay */}
      <CancelWarningModal
        row={cancelTarget}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
        cancelling={cancelling}
      />
    </div>
  );
}
