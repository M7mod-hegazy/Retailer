import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Pencil, Printer, X } from "lucide-react";
import api from "../../services/api";
import { dateTime, money, PAYMENT_LABELS, REFUND_LABELS, SETTLEMENT_LABELS, statusBadge } from "./docHelpers";

const CONFIG = {
  invoice: {
    endpoint: (id) => `/api/invoices/${id}`,
    full: (id) => `/invoices/${id}`,
    edit: (id) => `/invoices/${id}`,
    numberKey: "invoice_no",
    partyKey: "customer_name",
    partyFallback: "عميل نقدي",
    totalKey: "total",
  },
  sales_return: {
    endpoint: (id) => `/api/invoices/returns/${id}`,
    full: (id) => `/pos/sales-returns/${id}`,
    edit: (id) => `/sales/returns/amend?id=${id}`,
    numberKey: "doc_no",
    partyKey: "customer_name",
    partyFallback: "عميل نقدي",
    totalKey: "total",
  },
  purchase: {
    endpoint: (id) => `/api/purchases/${id}`,
    full: (id) => `/purchases/${id}`,
    edit: (id) => `/purchases/${id}`,
    numberKey: "doc_no",
    partyKey: "supplier_name",
    partyFallback: "مورد نقدي",
    totalKey: "total",
  },
  purchase_return: {
    endpoint: (id) => `/api/purchases/returns/${id}`,
    full: (id) => `/purchases/returns/${id}`,
    edit: (id) => `/purchases/returns/amend?id=${id}`,
    numberKey: "doc_no",
    partyKey: "supplier_name",
    partyFallback: "مورد نقدي",
    totalKey: "total",
  },
  branch_transfer: {
    endpoint: (id) => `/api/branch-transfers/${id}`,
    full: (id) => `/operations/branch-transfer/edit/${id}`,
    edit: (id) => `/operations/branch-transfer/edit/${id}`,
    numberKey: "reference_no",
    partyKey: "partner_branch",
    partyFallback: "فرع",
    totalKey: null,
  },
  opening_balance: {
    endpoint: (id) => `/api/purchases/${id}`,
    full: (id) => `/purchases/${id}`,
    edit: (id) => `/purchases/${id}`,
    numberKey: "doc_no",
    partyKey: "supplier_name",
    partyFallback: "رصيد افتتاحي",
    totalKey: "total",
  },
};

function normalizeLines(doc, docType) {
  const rows = doc?.lines || doc?.items || [];
  return rows.map((line, index) => {
    const quantity = Number(line.quantity || 0);
    const unit = Number(line.unit_price ?? line.unit_cost ?? line.selling_price ?? 0);
    return {
      id: line.id || index,
      code: line.item_code || line.code || line.barcode || "—",
      name: line.item_name || line.name || "—",
      quantity,
      unit,
      total: Number(line.line_total ?? (quantity * unit)),
      note: docType === "branch_transfer" ? (line.warehouse_name || "") : "",
    };
  });
}

function paymentRows(doc) {
  if (Array.isArray(doc?.payments) && doc.payments.length) {
    return doc.payments.map((payment, index) => ({
      id: index,
      label: payment.method_name || PAYMENT_LABELS[payment.method] || PAYMENT_LABELS[payment.method_type] || payment.method || payment.method_type || "—",
      amount: Number(payment.amount || 0),
    }));
  }
  const type = doc?.payment_type || doc?.payment_method;
  const total = Number(doc?.total || 0);
  if (!type || total <= 0) return [];
  return [{ id: "single", label: PAYMENT_LABELS[type] || type, amount: Number(doc.amount_received || doc.amount_paid || total || 0) }];
}

export default function DocumentPreviewModal({ open, docType, docId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const config = CONFIG[docType];

  useEffect(() => {
    if (!open || !config || !docId) return;
    setLoading(true);
    setDoc(null);
    api.get(config.endpoint(docId))
      .then((res) => setDoc(res.data?.data || res.data || null))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [open, config, docId]);

  const lines = useMemo(() => normalizeLines(doc, docType), [doc, docType]);
  const payments = useMemo(() => paymentRows(doc), [doc]);

  if (!open || !config) return null;

  const docNo = doc?.[config.numberKey] || `#${docId}`;
  const party = doc?.[config.partyKey] || config.partyFallback;
  const total = config.totalKey ? Number(doc?.[config.totalKey] || 0) : lines.reduce((sum, line) => sum + line.total, 0);
  const status = doc?.status || (doc?.cancelled_at ? "cancelled" : "active");
  const statusInfo = statusBadge(status, "active");
  const paymentType = doc?.payment_type || doc?.payment_method;
  const refundType = doc?.refund_method || doc?.settlement_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" dir="rtl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <div className={`mb-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${statusInfo.cls}`}>
              {statusInfo.label}
            </div>
            <h2 className="text-xl font-black text-slate-900">{docNo}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">{party} - {dateTime(doc?.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-left">
              <div className="text-[11px] font-black text-slate-400">الإجمالي</div>
              <div className="font-mono text-lg font-black text-slate-900">{money(total)}</div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-16 text-slate-400">
            <Loader2 className="animate-spin" />
            <span className="text-sm font-bold">جاري تحميل المستند...</span>
          </div>
        ) : !doc ? (
          <div className="p-16 text-center text-sm font-bold text-slate-400">تعذر تحميل المستند</div>
        ) : (
          <div className="flex-1 space-y-4 overflow-auto p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-black text-slate-400">طريقة الدفع</div>
                <div className="mt-1 text-sm font-black text-slate-800">{PAYMENT_LABELS[paymentType] || paymentType || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-black text-slate-400">طريقة الرد</div>
                <div className="mt-1 text-sm font-black text-slate-800">{SETTLEMENT_LABELS[refundType] || REFUND_LABELS[refundType] || refundType || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-black text-slate-400">الحالة</div>
                <div className="mt-1 text-sm font-black text-slate-800">{statusInfo.label}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[680px] text-right text-sm">
                <thead className="bg-slate-100 text-[11px] font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3">الكود</th>
                    <th className="px-4 py-3">الصنف</th>
                    <th className="px-4 py-3">الكمية</th>
                    <th className="px-4 py-3">السعر</th>
                    <th className="px-4 py-3">الإجمالي</th>
                    <th className="px-4 py-3">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">لا توجد سطور</td></tr>
                  ) : lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs font-black text-indigo-600">{line.code}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{line.name}</td>
                      <td className="px-4 py-3 font-mono">{money(line.quantity)}</td>
                      <td className="px-4 py-3 font-mono">{money(line.unit)}</td>
                      <td className="px-4 py-3 font-mono font-black">{money(line.total)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{line.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {payments.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 text-xs font-black text-slate-500">تفاصيل الدفع</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-xs font-bold text-slate-500">{payment.label}</div>
                      <div className="font-mono text-sm font-black text-slate-900">{money(payment.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <Link to={config.edit(docId)} className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
            <Pencil size={13} /> تعديل
          </Link>
          <Link to={config.full(docId)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
            <ExternalLink size={13} /> فتح كاملا
          </Link>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
            <Printer size={13} /> طباعة
          </button>
          <button onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
