import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { formatNumber } from "../../utils/currency";
import { Pencil } from "lucide-react";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

const PAYMENT_LABELS_PREVIEW = {
  cash: "نقدي", bank_transfer: "حوالة بنكية", credit: "آجل",
  installments: "أقساط", multi: "متعدد",
};

const STATUS_PREVIEW = {
  paid:      { label: "مدفوع",  cls: "bg-emerald-100 text-emerald-700" },
  partial:   { label: "جزئي",   cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "ملغي",   cls: "bg-slate-100 text-slate-500" },
  unpaid:    { label: "آجل",    cls: "bg-rose-100 text-rose-700" },
};

export default function InvoicePreviewModal({ inv, onClose, onNavigate }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inv) return;
    setLoading(true);
    api.get(`/api/invoices/${inv.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(inv))
      .finally(() => setLoading(false));
  }, [inv?.id]);

  if (!inv) return null;

  const d = detail || inv;
  const statusInfo = STATUS_PREVIEW[d.status] || STATUS_PREVIEW.unpaid;

  const gotoTarget = (path) => {
    if (window.location.search.includes("detachedModal=1") && window.electronAPI?.navigateParent) {
      window.electronAPI.navigateParent(path);
      window.electronAPI?.closeModalWindow?.();
    } else if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          {/* Header info */}
          <div className="rounded-sm bg-slate-100 border border-slate-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="font-black text-slate-800">فاتورة #{d.invoice_no}</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${statusInfo.cls}`}>{statusInfo.label}</span>
            <span className="text-slate-600">العميل: <strong>{d.customer_name || "عميل نقدي"}</strong></span>
            <span className="text-slate-500">{d.created_at ? formatArabicDateTime(new Date(d.created_at)) : "—"}</span>
            {d.created_by_username && <span className="text-slate-500">بواسطة: <strong>{d.created_by_username}</strong></span>}
            <span className="font-bold text-slate-700">طريقة الدفع: {PAYMENT_LABELS_PREVIEW[d.payment_type] || d.payment_type || "—"}</span>
          </div>

          {/* Lines table */}
          <div className="max-h-[260px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">السعر</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">خصم</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(d.lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_price)}</td>
                    <td className="px-3 py-2.5 text-center text-amber-600">{l.discount > 0 ? formatMoney(l.discount) : "—"}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-slate-700">{formatMoney(l.line_total || (l.quantity * l.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + Payments row */}
          <div className="flex gap-3 flex-wrap">
            {/* Summary */}
            <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
              <div className="flex justify-between">
                <span className="text-slate-500">المجموع الفرعي</span>
                <span className="number-fmt-primary text-slate-700">{formatMoney(d.subtotal)}</span>
              </div>
              {Number(d.discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">خصم</span>
                  <span className="number-fmt-primary text-rose-600">- {formatMoney(d.discount)}</span>
                </div>
              )}
              {Number(d.increase) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">إضافة</span>
                  <span className="number-fmt-primary text-emerald-600">+ {formatMoney(d.increase)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
                <span className="font-black text-slate-800">الإجمالي</span>
                <span className="number-fmt-primary text-slate-900">{formatMoney(d.total)} ج.م</span>
              </div>
            </div>

            {/* Payments breakdown */}
            {d.payments?.length > 0 && (
              <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">المدفوعات</p>
                {d.payments.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-600">{p.method_name || PAYMENT_LABELS_PREVIEW[p.method] || p.method}</span>
                    <span className="number-fmt-primary text-slate-800">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {d.notes && (
            <div className="rounded-sm border border-slate-200 bg-amber-50 px-4 py-2.5 text-2sm text-slate-600">
              <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">ملاحظات: </span>{d.notes}
            </div>
          )}

          {/* Cancel reason */}
          {d.status === "cancelled" && d.cancel_reason && (
            <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-2.5 text-2sm text-rose-700">
              <span className="font-black text-[11px] uppercase tracking-widest">سبب الإلغاء: </span>{d.cancel_reason}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => gotoTarget(`/invoices/${inv.id}`)} className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2 text-sm font-black text-white hover:bg-primary-600 transition-colors">
          <Pencil className="h-4 w-4" /> فتح الفاتورة
        </button>
      </div>
    </div>
  );
}
