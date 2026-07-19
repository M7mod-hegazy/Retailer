import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  X, Eye, Pencil, SlidersHorizontal, ExternalLink,
  User, FileText, Loader2, CreditCard,
  Package, Layers, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ShoppingBag, Search, Printer, Trash2, Copy,
} from "lucide-react";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import api from "../../services/api";
import { copyToClipboard } from "../../services/connection";
import PermissionGate from "../../components/ui/PermissionGate";
import { usePermission } from "../../hooks/usePermission";
import useDebounce from "../../hooks/useDebounce";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { formatNumber } from "../../utils/currency";
import { invoiceCustomerText } from "../../components/pos/WalkInCustomer";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import { usePageTour } from '../../hooks/usePageTour';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAYMENT_LABELS = {
  cash: "نقدي", credit: "آجل", card: "بطاقة",
  multi: "متعدد", installments: "تقسيط", bank_transfer: "حوالة بنكية",
  wallet: "محفظة", bank: "بنك",
};
const PAYMENT_COLORS = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  credit: "bg-amber-50 text-amber-700 border-amber-200",
  card: "bg-blue-50 text-blue-700 border-blue-200",
  multi: "bg-purple-50 text-purple-700 border-purple-200",
  installments: "bg-violet-50 text-violet-700 border-violet-200",
  bank_transfer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  bank: "bg-indigo-50 text-indigo-700 border-indigo-200",
  wallet: "bg-teal-50 text-teal-700 border-teal-200",
};
const CHIP_COLORS = {
  cash:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  card:          "bg-blue-50 text-blue-700 border-blue-200",
  bank_transfer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  bank:          "bg-indigo-50 text-indigo-700 border-indigo-200",
  wallet:        "bg-teal-50 text-teal-700 border-teal-200",
  credit:        "bg-amber-50 text-amber-700 border-amber-200",
  installments:  "bg-violet-50 text-violet-700 border-violet-200",
};

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

const PAGE_SIZE = 20;

function fmt(v) {
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

// ── Parse payment_splits string from list API ─────────────────────────────────
function parseRowChips(row) {
  const ptype = row.payment_type;
  const total = Number(row.total || 0);
  const received = Number(row.amount_received || 0);

  if (ptype === "credit") {
    return [{ method: "credit", label: "آجل", amount: total }];
  }

  if (row.payment_splits) {
    const parts = row.payment_splits.split("|||").filter(Boolean);
    const chips = parts.map(part => {
      const [method, amtStr] = part.split(":");
      const amount = Number(amtStr || 0);
      const isCredit = method === "credit";
      return {
        method,
        label: isCredit
          ? (ptype === "installments" ? "أقساط" : "آجل")
          : (PAYMENT_LABELS[method] || method),
        amount,
      };
    }).filter(c => c.amount > 0.005);
    return chips;
  }

  // fallback: just show received as the payment type
  if (received > 0.005) {
    return [{ method: ptype, label: PAYMENT_LABELS[ptype] || ptype, amount: received }];
  }
  return [];
}

// ── Payment chips builder (mirrors CustomerAccountsPage logic) ────────────────
function buildPaymentChips(d) {
  if (!d) return { chips: [], debtAmount: 0, isDebt: false };
  const ptype = d.payment_type;
  const total  = Number(d.total || 0);
  const received = Number(d.amount_received || 0);
  const debtRemaining = Number(d.debt_remaining || 0);
  const ajalAmount = Math.max(0, total - received);

  if (ptype === "credit") {
    return {
      chips: [{ method: "credit", label: "آجل", amount: total }],
      debtAmount: debtRemaining,
      isDebt: true,
    };
  }

  if (ptype === "installments") {
    const cashChips = (d.payments || [])
      .filter(p => p.method !== "credit" && Number(p.amount) > 0.005)
      .map(p => ({ method: p.method, label: PAYMENT_LABELS[p.method] || p.method_name || p.method, amount: Number(p.amount) }));
    return {
      chips: [
        ...cashChips,
        ...(ajalAmount > 0.005 ? [{ method: "credit", label: "أقساط متبقية", amount: ajalAmount }] : []),
      ],
      debtAmount: debtRemaining,
      isDebt: true,
      isInstallments: true,
      customerId: d.customer_id,
    };
  }

  if (ptype === "multi") {
    const allChips = (d.payments || [])
      .filter(p => Number(p.amount) > 0.005)
      .map(p => ({ method: p.method, label: PAYMENT_LABELS[p.method] || p.method_name || p.method, amount: Number(p.amount) }));
    const creditPart = allChips.find(c => c.method === "credit");
    return {
      chips: allChips,
      debtAmount: creditPart ? debtRemaining : 0,
      isDebt: !!creditPart,
    };
  }

  // cash / card / bank_transfer / wallet — fully paid
  const cashChips = (d.payments || [])
    .filter(p => Number(p.amount) > 0.005)
    .map(p => ({ method: p.method, label: PAYMENT_LABELS[p.method] || p.method_name || p.method, amount: Number(p.amount) }));
  if (cashChips.length === 0 && received > 0.005) {
    cashChips.push({ method: ptype, label: PAYMENT_LABELS[ptype] || ptype, amount: received });
  }
  return { chips: cashChips, debtAmount: 0, isDebt: false };
}

// ── Preview Drawer ────────────────────────────────────────────────────────────
function PreviewDrawer({ invoiceId, onClose }) {
  const navigate = useNavigate();
  const canSendWhatsApp = usePermission("whatsapp_receipt", "send");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waSendOpen, setWaSendOpen] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    api.get(`/api/invoices/${invoiceId}`)
      .then(r => setData(r.data.data || r.data))
      .catch(() => toast.error("تعذر تحميل تفاصيل الفاتورة"))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="text-xs number-fmt-primary tracking-widest text-zinc-400 uppercase">جاري تحميل المستند</span>
    </div>
  );
  if (!data) return <div className="text-center py-12 text-zinc-400 font-bold">تعذّر تحميل بيانات الفاتورة</div>;

  const d = data;
  const total    = Number(d.total || 0);
  const received = Number(d.amount_received || 0);
  const { chips, debtAmount, isDebt, isInstallments, customerId } = buildPaymentChips(d);

  return (
    <div className="flex flex-col gap-5 min-w-[320px] md:min-w-[620px] max-h-[80vh] overflow-y-auto" dir="rtl">
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="rounded-3xl bg-blue-50/50 border border-blue-100/80 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">رقم الفاتورة</span>
            <span className="font-mono text-xl font-black text-zinc-950">{d.invoice_no}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-black text-zinc-400 tracking-wider uppercase">تاريخ الفاتورة</span>
            <span className="font-mono text-sm font-bold text-zinc-600">{fmtDate(d.created_at)}</span>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">إجمالي الفاتورة</span>
            <span className="number-fmt text-xl font-black text-blue-700">{fmt(total)} ج.م</span>
          </div>
        </div>

        {/* Customer + Financial */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Customer card */}
          <div className="border border-zinc-100 rounded-3xl p-5 bg-bg-surface">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <User className="w-4 h-4 text-zinc-500" />
              </div>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">تفاصيل العميل</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-zinc-400">الاسم</span>
                {d.customer_name ? (
                  <span className="font-black text-zinc-800">{d.customer_name}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {d.walk_in_name && <span className="font-black text-zinc-800">{d.walk_in_name}</span>}
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">🚶 عميل نقدي</span>
                  </span>
                )}
              </div>
              {(d.customer_phone || d.walk_in_phone) && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-400">الهاتف</span>
                  <span className="font-mono font-black text-zinc-700" dir="ltr">{d.customer_phone || d.walk_in_phone}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-zinc-400">طريقة الدفع</span>
                <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-black ${PAYMENT_COLORS[d.payment_type] || "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>
                  {PAYMENT_LABELS[d.payment_type] || d.payment_type}
                </span>
              </div>
              {d.seller_name && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-400">البائع</span>
                  <span className="font-black text-zinc-700">{d.seller_name}</span>
                </div>
              )}
              {d.created_by_username && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-zinc-400">بواسطة</span>
                  <span className="font-black text-zinc-500">{d.created_by_username}</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial card */}
          <div className="border border-zinc-100 rounded-3xl p-5 bg-bg-surface flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-zinc-500" />
              </div>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">الموقف المالي</h3>
            </div>

            {/* Summary numbers */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-2.5 text-center">
                <span className="text-[9px] font-black text-zinc-400 block mb-1">الإجمالي</span>
                <span className="number-fmt text-xs font-black text-zinc-800">{fmt(total)}</span>
              </div>
              <div className="rounded-2xl bg-blue-50/50 border border-blue-100/50 p-2.5 text-center">
                <span className="text-[9px] font-black text-blue-600 block mb-1">المستلم</span>
                <span className="number-fmt text-xs font-black text-blue-700">{fmt(received)}</span>
              </div>
              <div className={`rounded-2xl border p-2.5 text-center ${debtAmount > 0.005 ? "bg-amber-50/50 border-amber-100" : "bg-zinc-50 border-zinc-100"}`}>
                <span className={`text-[9px] font-black block mb-1 ${debtAmount > 0.005 ? "text-amber-600" : "text-zinc-400"}`}>المتبقي</span>
                <span className={`number-fmt text-xs font-black ${debtAmount > 0.005 ? "text-amber-700" : "text-zinc-500"}`}>{fmt(debtAmount)}</span>
              </div>
            </div>

            {/* Before → adjustments → after (only shown when a discount or increase is applied) */}
            {(Number(d.discount) > 0 || Number(d.increase) > 0) && (
              <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-500">المجموع قبل الخصم/الزيادة</span>
                  <span className="number-fmt text-zinc-700">{fmt(Number(total) + Number(d.discount || 0) - Number(d.increase || 0))} ج.م</span>
                </div>
                {Number(d.discount) > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-black text-rose-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> خصم الفاتورة</span>
                    <span className="number-fmt font-black text-rose-600">− {fmt(d.discount)} ج.م</span>
                  </div>
                )}
                {Number(d.increase) > 0 && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-black text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> إضافة / رسوم</span>
                    <span className="number-fmt font-black text-emerald-600">+ {fmt(d.increase)} ج.م</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100">
                  <span className="font-black text-zinc-800">الإجمالي بعد التعديل</span>
                  <span className="number-fmt-primary font-black text-zinc-900">{fmt(total)} ج.م</span>
                </div>
              </div>
            )}
            {/* Payment chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip, i) => (
                  <span key={i} className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1.5 rounded-xl border ${CHIP_COLORS[chip.method] || "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {chip.label}
                    <span className="number-fmt">{fmt(chip.amount)}</span>
                    {d.payment_type === "multi" && total > 0 && (
                      <span className="opacity-50 text-[8.5px]">({Math.round((chip.amount / total) * 100)}%)</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Installments note */}
            {isInstallments && customerId && (
              <Link
                to={`/accounts/customers?id=${customerId}&tab=movements`}
                onClick={onClose}
                className="text-[11px] font-bold text-violet-600 hover:underline flex items-center gap-1"
              >
                عرض جدول الأقساط كاملاً ←
              </Link>
            )}
          </div>
        </div>

        {/* Payment allocations table (if multi/installments/detail) */}
        {(d.payments || []).length > 1 && (
          <div className="border border-zinc-100 rounded-3xl overflow-hidden bg-bg-surface">
            <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
              <span className="text-xs font-black text-zinc-800">تفاصيل الدفعات المسجلة</span>
            </div>
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-5 py-3 font-black text-zinc-500">وسيلة الدفع</th>
                  <th className="px-5 py-3 font-black text-zinc-500 text-center">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-5 py-3.5 font-bold text-zinc-700">{p.method_name || PAYMENT_LABELS[p.method] || p.method}</td>
                    <td className="px-5 py-3.5 number-fmt-primary text-zinc-900 text-center">{fmt(p.amount)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Items table */}
        <div className="border border-zinc-100 rounded-3xl overflow-hidden bg-bg-surface">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <span className="text-xs font-black text-zinc-800">أصناف الفاتورة ({(d.lines || []).length})</span>
          </div>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-100 z-10">
                <tr>
                  <th className="px-4 py-3 font-black text-zinc-500 text-center">الكود</th>
                  <th className="px-4 py-3 font-black text-zinc-500">الصنف</th>
                  <th className="px-4 py-3 font-black text-zinc-500 text-center">الكمية</th>
                  <th className="px-4 py-3 font-black text-zinc-500 text-center">السعر</th>
                  <th className="px-4 py-3 font-black text-zinc-500 text-center">الإجمالي</th>
                  <th className="px-4 py-3 font-black text-zinc-500 text-center">المرتجع</th>
                </tr>
              </thead>
              <tbody>
                {(d.lines || []).map((l, i) => (
                  <tr key={i} className="border-t border-zinc-100 hover:bg-blue-50/10">
                    <td className="px-4 py-3.5 text-center font-mono text-[11px] font-black text-zinc-400">{l.item_code || "—"}</td>
                    <td className="px-4 py-3.5 font-bold text-zinc-800">{l.item_name || "—"}</td>
                    <td className="px-4 py-3.5 text-center number-fmt text-zinc-700">{l.quantity}</td>
                    <td className="px-4 py-3.5 text-center number-fmt text-zinc-600">{fmt(l.unit_price)}</td>
                    <td className="px-4 py-3.5 text-center number-fmt-primary text-blue-700">{fmt(l.line_total || (l.quantity * l.unit_price))}</td>
                    <td className="px-4 py-3.5 text-center number-fmt text-rose-500 font-bold">
                      {Number(l.returned_quantity || 0) > 0 ? l.returned_quantity : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
          <button onClick={onClose} className="h-11 px-6 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black transition-colors">
            رجوع
          </button>
          <div className="flex items-center gap-2">
            {(d.customer_phone || d.walk_in_phone) && canSendWhatsApp && (
              <button
                onClick={() => setWaSendOpen(true)}
                className="h-11 px-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black hover:bg-emerald-100 transition-colors flex items-center gap-2"
              >
                <WhatsAppIcon className="w-4 h-4" /> واتساب
              </button>
            )}
            <button
              onClick={() => navigate(`/invoices/${invoiceId}`)}
              className="h-11 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/10"
            >
              <Eye className="w-4 h-4" /> عرض الفاتورة الكاملة
            </button>
          </div>
        </div>
      </div>

      {waSendOpen && (
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => setWaSendOpen(false)}
          invoice={d}
        />
      )}
    </div>
  );
}

// ── Invoice Row ────────────────────────────────────────────────────────────────
function InvoiceRow({ row, navigate, onPreviewRequest, onWhatsAppRequest, onPrintRequest, onCancelRequest }) {
  const canSendWhatsApp = usePermission("whatsapp_receipt", "send");
  const total    = Number(row.total || 0);
  const received = Number(row.amount_received || 0);
  const debt     = Math.max(0, total - received);
  const rowChips = parseRowChips(row);

  return (
    <motion.div
      variants={FADE_UP}
      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 px-6 py-5 bg-bg-surface border-b border-zinc-100 hover:bg-blue-50/20 transition-colors duration-300 overflow-hidden cursor-pointer"
      onClick={() => onPreviewRequest(row)}
    >
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />

      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-bg-surface group-hover:shadow-sm transition-all duration-300">
          <ShoppingBag className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">{row.invoice_no || `#${row.id}`}</span>
            <button onClick={() => { copyToClipboard(row.invoice_no || `#${row.id}`); toast.success("تم النسخ"); }} className="p-1 rounded hover:bg-bg-overlay transition-colors" title="نسخ رقم الفاتورة"><Copy className="w-3.5 h-3.5 text-text-muted" /></button>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black ${
              row.status === "cancelled" || row.status === "voided"
                ? "bg-zinc-100 text-zinc-400 border-zinc-200"
                : row.amended_by ? "bg-orange-50 text-orange-600 border-orange-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {row.status === "cancelled" || row.status === "voided" ? "ملغاة" : row.amended_by ? "معدّلة" : "نشطة"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-zinc-50 text-zinc-500 border-zinc-200">
              <Package className="w-3 h-3" /> {row.items_count} أصناف
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            <span className="text-zinc-600">{invoiceCustomerText(row)}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span dir="ltr">{fmtDate(row.created_at)}</span>
            {row.created_by_username && (
              <span className="text-zinc-500">{row.created_by_username}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-4 flex-shrink-0 z-10">
        {/* Financial summary: الإجمالي | payment method chips | المتبقي */}
        <div className="flex items-stretch gap-0 bg-bg-overlay border border-border-normal/80 rounded-2xl overflow-hidden">
          <div className="flex flex-col items-end justify-center px-3.5 py-1.5 min-w-[80px]">
            <span className="text-[8px] font-black text-text-muted uppercase tracking-wider mb-0.5">الإجمالي</span>
            <div className="text-sm font-black text-text-primary number-fmt leading-none flex items-baseline gap-0.5">
              <span>{fmt(total)}</span><span className="text-[8px] font-bold text-text-muted mr-0.5">ج.م</span>
            </div>
          </div>
          {rowChips.map((chip, i) => (
            <React.Fragment key={i}>
              <div className="w-px self-stretch bg-border-normal/80" />
              <div className={`flex flex-col items-end justify-center px-3 py-1.5 min-w-[70px] ${
                chip.method === "credit" ? "bg-amber-50/60" : "bg-blue-50/40"
              }`}>
                <span className={`text-[8px] font-black tracking-wider mb-0.5 flex items-center gap-1 ${
                  chip.method === "credit" ? "text-amber-500" : "text-blue-500"
                }`}>
                  <span className="w-1 h-1 rounded-full bg-current inline-block" />
                  {chip.label}
                </span>
                <div className={`text-2sm number-fmt-primary leading-none ${
                  chip.method === "credit" ? "text-amber-700" : "text-blue-700"
                }`}>
                  {fmt(chip.amount)}
                </div>
              </div>
            </React.Fragment>
          ))}
          {debt > 0.005 && rowChips.length === 0 && (
            <>
              <div className="w-px self-stretch bg-border-normal/80" />
              <div className="flex flex-col items-end justify-center px-3.5 py-1.5 bg-amber-50/50 min-w-[80px]">
                <span className="text-[8px] font-black text-amber-500 tracking-wider mb-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 inline-block" /> المتبقي
                </span>
                <div className="text-sm font-black text-amber-700 number-fmt leading-none">
                  {fmt(debt)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => onPreviewRequest(row)}
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
            title="معاينة"
          >
            <Eye className="w-4 h-4" />
          </button>
          <PermissionGate page="pos" action="print">
            <button
              onClick={(e) => { e.stopPropagation(); onPrintRequest?.(row); }}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
              title="طباعة الفاتورة"
            >
              <Printer className="w-4 h-4" />
            </button>
          </PermissionGate>
          {canSendWhatsApp && (
            <button
              onClick={(e) => { e.stopPropagation(); onWhatsAppRequest?.(row); }}
              className="p-2 text-zinc-400 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors"
              title="إرسال عبر واتساب"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => navigate(`/invoices/${row.id}`)}
            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="تفاصيل الفاتورة"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {row.status !== "cancelled" && (
            <PermissionGate page="pos" action="void">
              <button
                onClick={(e) => { e.stopPropagation(); onCancelRequest?.(row); }}
                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title="إلغاء الفاتورة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    api.get("/api/invoices/cancel-reasons").then(r => setPresets(r.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-zinc-800">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-50 text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-2sm text-zinc-500 mb-3 font-bold">اختر سبباً أو اكتب سبباً مخصصاً:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-2sm font-bold border transition-colors ${reason === p ? "bg-rose-600 text-white border-rose-600" : "bg-bg-surface border-zinc-200 text-zinc-600 hover:border-rose-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="أو اكتب السبب..."
          className="w-full border border-zinc-200 rounded-xl p-3 text-2sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300 text-zinc-800 font-bold"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-sm font-black disabled:opacity-40 transition-colors hover:bg-rose-700"
          >
            تأكيد
          </button>
          <button onClick={onClose} className="flex-1 border border-zinc-200 rounded-xl py-2.5 text-sm font-black text-zinc-600 hover:bg-zinc-50 transition-colors">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesHubPage() {
  usePageTour('sales_hub');
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("invoices");
  const [printTarget, setPrintTarget] = useState(null);
  const [printSettings, setPrintSettings] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
  }, []);

  async function handlePrintClick(row) {
    const tid = toast.loading("جاري تحميل تفاصيل الفاتورة...");
    try {
      const res = await api.get(`/api/invoices/${row.id}`);
      setPrintTarget(res.data?.data || res.data);
      toast.dismiss(tid);
    } catch {
      toast.error("تعذر تحميل تفاصيل الفاتورة");
      toast.dismiss(tid);
    }
  }

  async function handleConfirmCancel(reason) {
    if (!cancelTarget) return;
    const tid = toast.loading("جاري إلغاء الفاتورة...");
    try {
      await api.delete(`/api/invoices/${cancelTarget.id}`, { data: { reason } });
      toast.success(`تم إلغاء الفاتورة ${cancelTarget.invoice_no || `#${cancelTarget.id}`} بنجاح`);
      setCancelTarget(null);
      loadInvoices();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إلغاء الفاتورة");
    } finally {
      toast.dismiss(tid);
    }
  }
  const [invoices, setInvoices]   = useState([]);
  const [itemRows, setItemRows]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searched, setSearched]   = useState(false);

  // Invoices tab search
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [customerId, setCustomerId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [waSendTarget, setWaSendTarget] = useState(null);
  const [customers, setCustomers] = useState([]);

  async function handleWhatsAppClick(row) {
    const tid = toast.loading("جاري تحميل تفاصيل الفاتورة...");
    try {
      const res = await api.get(`/api/invoices/${row.id}`);
      setWaSendTarget(res.data?.data || res.data);
      toast.dismiss(tid);
    } catch {
      toast.error("تعذر تحميل تفاصيل الفاتورة");
      toast.dismiss(tid);
    }
  }

  // Customer autocomplete
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState(null);
  const customerInputRef = useRef(null);

  const [previewTarget, setPreviewTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  // Items tab search (autocomplete)
  const [itemQuery, setItemQuery]                 = useState("");
  const [itemLookupOpen, setItemLookupOpen]       = useState(false);
  const [itemResults, setItemResults]             = useState([]);
  const [selectedItemFilter, setSelectedItemFilter] = useState(null);
  const [activeLookupIndex, setActiveLookupIndex] = useState(-1);
  const [isLoadingItems, setIsLoadingItems]       = useState(false);
  const itemInputRef = useRef(null);

  const debouncedSearch      = useDebounce(searchTerm, 300);
  const debouncedItemQuery   = useDebounce(itemQuery, 300);

  // Item autocomplete fetch (items tab)
  useEffect(() => {
    if (!debouncedItemQuery.trim()) { setItemResults([]); return; }
    setIsLoadingItems(true);
    api.get(`/api/items?search=${encodeURIComponent(debouncedItemQuery)}&limit=20`)
      .then(r => setItemResults(r.data?.data || r.data || []))
      .catch(() => setItemResults([]))
      .finally(() => setIsLoadingItems(false));
  }, [debouncedItemQuery]);

  // Fetch users & customers for filters
  useEffect(() => {
    api.get("/api/users").then(r => setUsers(r.data.data || [])).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  // Load invoices list
  const loadInvoices = async () => {
    if (activeTab !== "invoices") return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo)   params.set("date_to", dateTo);
      if (customerId) params.set("customer_id", customerId);
      if (userId) params.set("user_id", userId);
      const res = await api.get(`/api/invoices?${params}`);
      setInvoices(res.data?.data || []);
    } catch { toast.error("فشل تحميل فواتير المبيعات"); }
    finally { setLoading(false); }
  };

  // Load items detail search
  const loadItemRows = async (queryOverride) => {
    if (activeTab !== "items") return;
    const q = queryOverride ?? (selectedItemFilter
      ? (selectedItemFilter.name || selectedItemFilter.code || selectedItemFilter.barcode)
      : itemQuery.trim());
    if (!q) { setItemRows([]); setSearched(false); setLoading(false); return; }
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo)   params.set("date_to", dateTo);
      if (customerId) params.set("customer_id", customerId);
      const res = await api.get(`/api/invoices/items-search?${params}`);
      setItemRows(res.data?.data || []);
    } catch { setItemRows([]); toast.error("فشل البحث بالأصناف"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "invoices") loadInvoices();
    else loadItemRows();
  }, [activeTab, debouncedSearch, customerId, selectedItemFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [invoices]);
  useEffect(() => { setItemPage(1); }, [itemRows]);

  const hasFilters = dateFrom || dateTo || customerId || userId;

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [customerQuery, customers]);

  function handlePickCustomer(c) {
    setSelectedCustomerFilter(c);
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setCustomerLookupOpen(false);
  }

  const clearItemSelection = () => {
    setSelectedItemFilter(null); setItemQuery(""); setItemResults([]);
    setItemRows([]); setSearched(false);
  };

  const totalInvoicePages = Math.ceil(invoices.length / PAGE_SIZE);
  const pagedInvoices = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalItemPages = Math.ceil(itemRows.length / PAGE_SIZE);
  const pagedItemRows = itemRows.slice((itemPage - 1) * PAGE_SIZE, itemPage * PAGE_SIZE);

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[var(--bg-base)]" dir="rtl">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <motion.header data-help="sales-header" initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg-surface border border-zinc-200 shadow-sm">
                <Layers className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[11px] font-black text-zinc-400 tracking-[0.2em] uppercase">فواتير المبيعات</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">فواتير <span className="text-blue-600">المبيعات</span></h1>
          </div>
          <PermissionGate page="pos" action="add">
            <button
              data-help="add-button"
              onClick={() => navigate("/pos")}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" /> فاتورة بيع جديدة
            </button>
          </PermissionGate>
        </motion.header>

        {/* Tab switcher */}
        <motion.div data-help="sales-tabs" initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col gap-2">
          <div className="bg-zinc-100/80 border border-zinc-200/40 p-1.5 rounded-2xl flex gap-1.5 self-start">
            <button
              onClick={() => { setActiveTab("invoices"); setItemQuery(""); setSelectedItemFilter(null); setItemResults([]); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === "invoices" ? "bg-bg-surface text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
            >
              سجل الفواتير
            </button>
            <button
              onClick={() => { setActiveTab("items"); setSearchTerm(""); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === "items" ? "bg-bg-surface text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
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
                ? "عرض وبحث في جميع فواتير المبيعات المسجلة"
                : "تتبّع مبيعات صنف بعينه عبر كامل سجل الفواتير"}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Search & Filters bar */}
        <motion.div data-help="search-bar" initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col bg-bg-surface border border-zinc-200/60 rounded-[2rem] shadow-sm p-4 gap-4">
          <div className="flex flex-col md:flex-row items-start gap-4">

            {/* Left search — changes per tab */}
            <div className="relative flex-1 w-full">
              {activeTab === "invoices" ? (
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onClear={() => setSearchTerm("")}
                  placeholder="ابحث برقم الفاتورة أو اسم العميل..."
                  size="lg" autoFocus className="w-full"
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
                    onClear={clearItemSelection}
                    onFocus={() => setItemLookupOpen(true)}
                    onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (itemResults.length > 0 && activeLookupIndex >= 0) {
                          const p = itemResults[activeLookupIndex];
                          setSelectedItemFilter(p); setItemQuery(p.name); setItemLookupOpen(false);
                        } else if (itemQuery.trim()) {
                          setSelectedItemFilter(null); setItemLookupOpen(false); loadItemRows(itemQuery.trim());
                        }
                      } else if (e.key === "Escape") { e.preventDefault(); setItemLookupOpen(false); }
                      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveLookupIndex(p => Math.min(p + 1, itemResults.length - 1)); }
                      else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveLookupIndex(p => Math.max(p - 1, 0)); }
                    }}
                    placeholder="ابحث باسم المنتج أو الباركود أو SKU..."
                    size="lg" loading={isLoadingItems} autoFocus className="w-full"
                  />
                  {itemLookupOpen && (itemResults.length > 0 || itemQuery.trim()) && (
                    <SearchDropdown
                      items={itemResults}
                      activeIndex={activeLookupIndex}
                      query={itemQuery}
                      emptyLabel="لا توجد نتائج"
                      onPick={(item) => { setSelectedItemFilter(item); setItemQuery(item.name); setItemLookupOpen(false); setActiveLookupIndex(-1); }}
                    />
                  )}
                  {selectedItemFilter && (
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mt-2">
                      <span className="font-mono text-[11px] font-black text-blue-700 shrink-0">
                        {selectedItemFilter.code || selectedItemFilter.item_code || `#${selectedItemFilter.id}`}
                      </span>
                      <div className="h-3 w-px bg-blue-300 shrink-0" />
                      <span className="text-2sm text-blue-700 font-bold truncate">{selectedItemFilter.name}</span>
                      <button type="button" onClick={clearItemSelection} className="mr-auto text-blue-400 hover:text-rose-500 transition-colors">
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
              {activeTab === "invoices" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">العميل</span>
                  <div className="relative">
                    <input
                      ref={customerInputRef}
                      type="text"
                      value={customerQuery}
                      onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); setSelectedCustomerFilter(null); setCustomerId(""); }}
                      onFocus={() => setCustomerLookupOpen(true)}
                      onBlur={() => setTimeout(() => setCustomerLookupOpen(false), 200)}
                      placeholder="جميع العملاء"
                      className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]"
                    />
                    {customerLookupOpen && (
                      <SearchDropdown items={filteredCustomers} onPick={handlePickCustomer} emptyLabel="لا يوجد عملاء" />
                    )}
                  </div>
                  {selectedCustomerFilter && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-1">
                      <span className="text-[11px] text-emerald-700 font-bold truncate">{selectedCustomerFilter.name}</span>
                      <button onClick={() => { setSelectedCustomerFilter(null); setCustomerId(""); setCustomerQuery(""); }}>
                        <X className="w-3 h-3 text-emerald-400 hover:text-rose-500" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المستخدم</span>
                <select value={userId} onChange={e => setUserId(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]">
                  <option value="">كل المستخدمين</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
                <input 
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)} 
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
                <input 
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)} 
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" 
                />
              </div>
              {hasFilters && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setCustomerId(""); setUserId(""); setCustomerQuery(""); setSelectedCustomerFilter(null); }}
                  className="h-10 flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors">
                  <X className="w-3.5 h-3.5" /> مسح التصفية
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Results */}
        <motion.div
          data-help="main-table"
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="flex flex-col bg-bg-surface rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden min-h-[420px]"
        >
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري مزامنة السجلات</span>
            </div>
          ) : activeTab === "invoices" ? (
            invoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                  <FileText className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد فواتير</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي فاتورة مبيعات مطابقة للمعايير المحددة.</p>
              </div>
            ) : (
              <>
                {pagedInvoices.map(row => (
                  <InvoiceRow
                    key={row.id}
                    row={row}
                    navigate={navigate}
                    onPreviewRequest={setPreviewTarget}
                    onWhatsAppRequest={handleWhatsAppClick}
                    onPrintRequest={handlePrintClick}
                    onCancelRequest={setCancelTarget}
                  />
                ))}
                {totalInvoicePages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-bg-surface border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="h-4 w-4" /> السابق
                    </button>
                    <span className="text-[11px] font-black text-zinc-400">{page} / {totalInvoicePages}</span>
                    <button onClick={() => setPage(p => Math.min(totalInvoicePages, p + 1))} disabled={page >= totalInvoicePages}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-bg-surface border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      التالي <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )
          ) : (
            !searched ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-zinc-400">
                <Search className="w-12 h-12 opacity-25 mb-4" />
                <h3 className="text-base font-black text-zinc-800 mb-1">بحث تفصيلي ببيانات الصنف</h3>
                <p className="text-xs font-bold text-zinc-400 max-w-[45ch] leading-relaxed">
                  اكتب اسم المنتج أو الكود في شريط البحث للوصول لجميع سطور فواتير المبيعات التاريخية المرتبطة به.
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
                      <th className="px-5 py-3.5 font-black text-zinc-500">العميل</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">كود الصنف</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">اسم المنتج</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الكمية</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">سعر البيع</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الإجمالي</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">القابل للإرجاع</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">معاينة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItemRows.map((r, i) => (
                      <tr key={r.line_id || i} className="border-b border-zinc-100 hover:bg-blue-50/10 transition-colors">
                        <td className="px-5 py-4 font-mono font-black text-zinc-700">{r.invoice_no || "—"}</td>
                        <td className="px-5 py-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{fmtDate(r.created_at)}</td>
                        <td className="px-5 py-4 font-bold text-zinc-700">{invoiceCustomerText(r)}</td>
                        <td className="px-5 py-4 text-center font-mono text-[11px] font-black text-zinc-400">{r.item_code || r.barcode || "—"}</td>
                        <td className="px-5 py-4 font-bold text-zinc-800">
                          <div>{r.item_name || "—"}</div>
                          {r.item_id && (
                            <Link to={`/operations/items/${r.item_id}?types=sales`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-800">
                              <ExternalLink className="w-3 h-3" /> عرض كامل
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center number-fmt text-zinc-700">{r.quantity}</td>
                        <td className="px-5 py-4 text-center number-fmt-primary text-zinc-700">{fmt(r.unit_price)}</td>
                        <td className="px-5 py-4 text-center number-fmt-primary text-blue-700">{fmt(r.line_total || (r.quantity * r.unit_price))}</td>
                        <td className="px-5 py-4 text-center number-fmt text-emerald-600">{r.returnable_qty ?? "—"}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => setPreviewTarget({ id: r.invoice_id, invoice_no: r.invoice_no })}
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
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-bg-surface border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" /> السابق
                  </button>
                  <span className="text-[11px] font-black text-zinc-400">{itemPage} / {totalItemPages}</span>
                  <button onClick={() => setItemPage(p => Math.min(totalItemPages, p + 1))} disabled={itemPage >= totalItemPages}
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-bg-surface border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    التالي <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
              </>
            )
          )}
        </motion.div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setPreviewTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-3xl bg-bg-surface rounded-[2rem] shadow-2xl p-7"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-5">
                <h2 className="text-[17px] font-black text-zinc-900">
                  تفاصيل الفاتورة — {previewTarget.invoice_no}
                </h2>
                <button onClick={() => setPreviewTarget(null)} className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PreviewDrawer invoiceId={previewTarget.id} onClose={() => setPreviewTarget(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {waSendTarget && (
        <WhatsAppSendModal
          open={Boolean(waSendTarget)}
          onClose={() => setWaSendTarget(null)}
          invoice={waSendTarget}
        />
      )}

      {printTarget && (
        <PrintPreviewModal
          open={Boolean(printTarget)}
          onClose={() => setPrintTarget(null)}
          docType="pos_receipt"
          invoice={{
            ...printTarget,
            invoice_no: printTarget.invoice_no,
            created_at: printTarget.created_at,
            customer_name: printTarget.customer_name,
            cashier_name: printTarget.created_by_username || printTarget.cashier_name || "",
            subtotal: printTarget.subtotal || printTarget.total || 0,
            total: printTarget.total || 0,
            discount: printTarget.discount || 0,
            increase: printTarget.increase || 0,
            notes: printTarget.notes || "",
            lines: (printTarget.lines || []).map(l => ({
              ...l,
              item_name: l.item_name || l.name,
              quantity: l.quantity,
              unit_price: l.unit_price,
              discount_amount: l.discount || 0,
              code: l.item_code || l.code || "",
            })),
          }}
          settings={printSettings}
          operationLabel="فاتورة بيع"
          onSendWhatsApp={() => {
            const target = printTarget;
            setWaSendTarget(target);
          }}
        />
      )}

      {cancelTarget && (
        <CancelReasonModal
          title={`إلغاء الفاتورة ${cancelTarget.invoice_no || `#${cancelTarget.id}`}`}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
