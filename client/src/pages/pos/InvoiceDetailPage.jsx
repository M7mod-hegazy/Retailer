import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft, Lock, Pencil, Trash2, AlertTriangle, CheckCircle2,
  User, Calendar, CreditCard, Banknote, Wallet, Clock, X,
  Package, ShoppingCart, Printer, History,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../../services/api";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PermissionGate from "../../components/ui/PermissionGate";
import toast from "react-hot-toast";

function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    api.get("/api/invoices/cancel-reasons").then(r => setPresets(r.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[12px] text-slate-500 mb-3">اختر سبباً أو اكتب سبباً مخصصاً:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${reason === p ? "bg-rose-600 text-white border-rose-600" : "border-slate-200 text-slate-600 hover:border-rose-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="أو اكتب السبب..."
          className="w-full border border-slate-200 rounded-xl p-3 text-[12px] resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-[13px] font-black disabled:opacity-40 hover:bg-rose-700 transition-colors"
          >
            تأكيد
          </button>
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-[13px] font-black text-slate-600 hover:bg-slate-50 transition-colors">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_LABELS = {
  cash: "نقدي",
  bank_transfer: "حوالة بنكية",
  credit: "آجل",
  installments: "أقساط",
  multi: "متعدد",
};

const STATUS_MAP = {
  paid:      { label: "مدفوع",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial:   { label: "جزئي",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  cancelled: { label: "ملغي",   cls: "bg-slate-100 text-slate-500 border-slate-200" },
  unpaid:    { label: "آجل",    cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

function fmt(n) {
  return Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printSettings, setPrintSettings] = useState({});
  const [printOpen, setPrintOpen] = useState(false);
  const [timeline, setTimeline] = useState([]);

  // Cancel / amend modals
  const [cancelOpen, setCancelOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
  }, []);

  async function loadInvoice() {
    setLoading(true);
    try {
      const r = await api.get(`/api/invoices/${id}`);
      const inv = r.data.data;
      setInvoice(inv);
      await loadTimeline(inv);
    } catch {
      toast.error("فشل تحميل الفاتورة");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline(inv) {
    const chain = [inv];
    try {
      let current = inv;
      while (current.amendment_of) {
        const r = await api.get(`/api/invoices/${current.amendment_of}`);
        chain.unshift(r.data.data);
        current = r.data.data;
      }
      current = inv;
      while (current.amended_by) {
        const r = await api.get(`/api/invoices/${current.amended_by}`);
        chain.push(r.data.data);
        current = r.data.data;
      }
    } catch (_) {}
    setTimeline(chain);
  }

  useEffect(() => { loadInvoice(); }, [id]);

  async function handleCancel(reason) {
    try {
      await api.delete(`/api/invoices/${id}`, { data: { reason } });
      toast.success("تم إلغاء الفاتورة");
      setCancelOpen(false);
      loadInvoice();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الإلغاء");
    }
  }

  function handleAmendStart(reason) {
    if (!invoice) return;
    navigate("/pos", {
      state: {
        amend_invoice_id: invoice.id,
        amend_reason: reason,
        prefill: {
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          lines: (invoice.lines || []).map(l => ({
            item_id: l.item_id,
            item_name: l.item_name || l.name,
            code: l.item_code || l.code || l.barcode || "",
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: l.discount || 0,
            warehouse_id: l.warehouse_id || 1,
          })),
          payment_type: invoice.payment_type,
          discount: invoice.discount || 0,
          increase: invoice.increase || 0,
          notes: invoice.notes,
          orig_balance_effect: invoice.debt_remaining || 0,
          invoice_no: invoice.invoice_no,
          created_at: invoice.created_at,
        },
      },
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-[14px] font-black text-slate-400 animate-pulse">جاري تحميل الفاتورة...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 flex-col gap-3">
        <ShoppingCart className="h-12 w-12 text-slate-300" />
        <p className="text-[14px] font-black text-slate-400">الفاتورة غير موجودة</p>
        <button onClick={() => navigate(-1)} className="text-[12px] font-bold text-slate-500 underline">عودة</button>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.unpaid;
  const isCancelled = invoice.status === "cancelled";
  const isAmended   = !!invoice.amended_by;   // was replaced by a newer invoice
  const isAmendment = !!invoice.amendment_of; // is itself a replacement of an older invoice

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden pb-6" dir="rtl">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800">فاتورة بيع #{invoice.invoice_no}</h1>
            <span className="text-[10px] font-bold text-slate-400">محفوظة</span>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
          {isAmended && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700">
              مُعدَّلة ← {invoice.amended_by_no || invoice.amended_by}
            </span>
          )}
          {isAmendment && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-blue-700">
              تعديل ↑ {invoice.amendment_of_no || invoice.amendment_of}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales" action="void">
              <button
                onClick={() => setCancelOpen(true)}
                className="flex h-9 items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 text-[13px] font-black text-rose-600 hover:bg-rose-100 transition-all"
              >
                <Trash2 className="h-4 w-4" /> إلغاء الفاتورة
              </button>
            </PermissionGate>
          )}
          <PermissionGate page="sales" action="print">
            <button
              onClick={() => setPrintOpen(true)}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all"
            >
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </PermissionGate>
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales" action="edit">
              <button
                onClick={() => setAmendOpen(true)}
                className="flex h-9 items-center gap-2 rounded-sm bg-indigo-600 px-6 text-[13px] font-black text-white hover:bg-indigo-700 transition-all"
              >
                <Pencil className="h-4 w-4" /> تعديل الفاتورة
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Info bar */}
          <section className="grid grid-cols-4 gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">العميل</span>
              <span className="text-[13px] font-black text-slate-800">{invoice.customer_name || "زبون نقدي"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">التاريخ</span>
              <span className="text-[13px] font-black text-slate-800">
                {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("ar-EG") : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">طريقة الدفع</span>
              <span className="text-[13px] font-black text-slate-800">{PAYMENT_LABELS[invoice.payment_type] || invoice.payment_type || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الوقت</span>
              <span className="text-[13px] font-black text-slate-800 font-mono">
                {invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
          </section>

          {/* Lines */}
          <DataGrid
            data={invoice.lines || []}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-300 min-h-0"
            columns={[
              { id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100", sortable: false, render: (_, i) => i + 1 },
              { id: "code", header: "الكود", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100",
                render: (l) => l.item_code || l.code || l.barcode || "—" },
              { id: "name", header: "الصنف", width: 200, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-3", headerClass: "text-right px-3",
                render: (l) => <div className="py-1"><p className="text-[13px] font-black">{l.item_name || l.name}</p></div> },
              { id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black border-l border-slate-100", render: (l) => l.quantity },
              { id: "unit_price", header: "السعر", width: 110, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black border-l border-slate-100 text-slate-700", render: (l) => fmt(l.unit_price) },
              { id: "discount", header: "خصم", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black border-l border-slate-100 text-amber-700", render: (l) => l.discount > 0 ? fmt(l.discount) : "—" },
              { id: "line_total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/50 border-l border-slate-100", render: (l) => fmt(l.line_total) },
            ]}
          />

          {/* Amendment timeline */}
          {timeline.length > 1 && (
            <div className="mt-2 border border-slate-200 rounded-xl p-4 bg-white shrink-0">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <History className="h-3.5 w-3.5" /> سجل التعديلات
              </h4>
              <div className="flex flex-col gap-2">
                {timeline.map((inv) => (
                  <div key={inv.id} className={`flex items-center gap-3 text-[12px] ${inv.id === invoice.id ? "font-black text-slate-900" : "text-slate-400"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${inv.status === "cancelled" ? "bg-rose-400" : "bg-emerald-400"}`} />
                    <span className="font-mono">{inv.invoice_no}</span>
                    <span className="text-slate-400">{inv.created_at?.slice(0, 10)}</span>
                    {inv.status === "cancelled" && <span className="text-rose-500 text-[11px] truncate max-w-[160px]">{inv.cancel_reason}</span>}
                    {inv.id !== invoice.id && (
                      <button onClick={() => navigate(`/pos/invoices/${inv.id}`)} className="text-indigo-500 text-[11px] underline mr-auto">عرض</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="w-[260px] shrink-0 flex flex-col gap-3">
          {/* Summary */}
          <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">ملخص الفاتورة</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="font-bold text-slate-500">عدد الأصناف</span>
                <span className="font-black text-slate-800">{(invoice.lines || []).length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="font-bold text-slate-500">المجموع الفرعي</span>
                <span className="font-black font-mono text-slate-800">{fmt(invoice.subtotal)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="font-bold text-slate-500">الخصم</span>
                  <span className="font-black font-mono text-rose-600">- {fmt(invoice.discount)}</span>
                </div>
              )}
              {Number(invoice.increase) > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="font-bold text-slate-500">زيادة</span>
                  <span className="font-black font-mono text-emerald-600">+ {fmt(invoice.increase)}</span>
                </div>
              )}
              <div className="h-px bg-slate-100" />
              <div className="rounded-sm bg-slate-900 p-4 text-center text-white">
                <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">الإجمالي</div>
                <div className="text-[26px] font-black tracking-tighter font-mono">{fmt(invoice.total)}</div>
                <div className="text-[10px] opacity-40">ج.م</div>
              </div>
            </div>
          </div>

          {/* Payments */}
          {invoice.payments?.length > 0 && (
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">المدفوعات</h3>
              <div className="space-y-2">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-sm bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="text-[11px] font-bold text-slate-600">{p.method_name || PAYMENT_LABELS[p.method] || p.method}</span>
                    <span className="font-mono text-[12px] font-black text-slate-800">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancellation info */}
          {isCancelled && invoice.cancel_reason && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">سبب الإلغاء</p>
              <p className="text-[12px] font-bold text-rose-700">{invoice.cancel_reason}</p>
              {invoice.cancelled_at && (
                <p className="text-[10px] text-rose-400 mt-1">{new Date(invoice.cancelled_at).toLocaleString("ar-EG")}</p>
              )}
            </div>
          )}
        </aside>
      </main>

      {cancelOpen && (
        <CancelReasonModal
          title={`إلغاء الفاتورة ${invoice.invoice_no}`}
          onConfirm={handleCancel}
          onClose={() => setCancelOpen(false)}
        />
      )}

      {amendOpen && (
        <CancelReasonModal
          title={`تعديل الفاتورة ${invoice.invoice_no}`}
          onConfirm={(reason) => { setAmendOpen(false); handleAmendStart(reason); }}
          onClose={() => setAmendOpen(false)}
        />
      )}

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        invoice={{
          invoice_no: invoice.invoice_no,
          created_at: invoice.created_at,
          customer_name: invoice.customer_name,
          lines: (invoice.lines || []).map(l => ({
            item_name: l.item_name || l.name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_amount: l.discount || 0,
          })),
        }}
        settings={printSettings}
        operationLabel="فاتورة بيع"
      />
    </div>
  );
}
