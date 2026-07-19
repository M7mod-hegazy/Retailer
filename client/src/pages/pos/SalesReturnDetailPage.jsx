import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Trash2, Pencil, Printer, RotateCcw,
  User, Calendar, X, Package, Copy, Check,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PermissionGate from "../../components/ui/PermissionGate";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";
import { REFUND_LABELS, statusBadge } from "../../components/operations/docHelpers";
import { formatNumber } from "../../utils/currency";
import { invoiceCustomerText } from "../../components/pos/WalkInCustomer";
import { usePageTour } from '../../hooks/usePageTour';

function fmt(n) {
  return formatNumber(n, { decimals: 2 });
}

function CancelReasonModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const PRESETS = ["خطأ في البيانات", "خطأ في الكمية", "طلب العميل", "مرتجع مكرر", "أخرى"];
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-text-primary">سبب إلغاء المرتجع</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-bg-overlay text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-2sm font-bold border transition-colors ${reason === p ? "bg-rose-600 text-white border-rose-600" : "border-border-normal text-text-secondary hover:border-rose-300"}`}
            >{p}</button>
          ))}
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="أو اكتب السبب..."
          className="w-full border border-border-normal rounded-xl p-3 text-2sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300" />
        <div className="flex gap-2 mt-4">
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}
            className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-sm font-black disabled:opacity-40 hover:bg-rose-700 transition-colors">تأكيد</button>
          <button onClick={onClose} className="flex-1 border border-border-normal rounded-xl py-2.5 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors">رجوع</button>
        </div>
      </div>
    </div>
  );
}

export default function SalesReturnDetailPage() {
  usePageTour('sales_return_detail');
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState({});
  const [waSendOpen, setWaSendOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  function handleCopy(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/api/invoices/returns/${id}`);
      const data = r.data.data;
      setDoc(data);
      await buildTimeline(data);
    } catch {
      toast.error("فشل تحميل المرتجع");
    } finally {
      setLoading(false);
    }
  }

  async function buildTimeline(d) {
    const chain = [d];
    try {
      let cur = d;
      while (cur.amendment_of) {
        const r = await api.get(`/api/invoices/returns/${cur.amendment_of}`);
        chain.unshift(r.data.data);
        cur = r.data.data;
      }
      cur = d;
      while (cur.amended_by) {
        const r = await api.get(`/api/invoices/returns/${cur.amended_by}`);
        chain.push(r.data.data);
        cur = r.data.data;
      }
    } catch (_) {}
    setTimeline(chain);
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
  }, []);

  async function handleCancel(reason) {
    try {
      await api.post(`/api/invoices/returns/${id}/cancel`, { reason });
      toast.success("تم إلغاء المرتجع");
      setCancelOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الإلغاء");
    }
  }

  function handleAmend() {
    if (!doc) return;
    navigate("/sales/returns/new", {
      state: {
        edit_return_id: doc.id,
        original: doc,
      },
    });
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[600px] flex-col bg-bg-overlay font-sans overflow-hidden pb-6" dir="rtl">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border-strong bg-bg-surface px-6">
          <div className="h-8 w-8 rounded-sm bg-bg-overlay animate-pulse" />
          <div className="h-4 w-48 bg-border-normal rounded animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-bg-overlay animate-pulse" />
        </header>
        <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
          <div className="flex flex-1 flex-col gap-3 min-w-0">
            <section className="grid grid-cols-4 gap-3 rounded-md border border-border-normal bg-bg-surface p-4 shrink-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2 w-16 bg-bg-overlay rounded animate-pulse" />
                  <div className="h-4 bg-border-normal rounded animate-pulse w-3/4" style={{ animationDelay: `${i * 40}ms` }} />
                </div>
              ))}
            </section>
            <div className="rounded-md border border-border-normal bg-bg-surface overflow-hidden flex-1">
              <div className="bg-bg-overlay border-b px-4 py-3 flex gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-3 bg-border-normal rounded animate-pulse flex-1" />)}
              </div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-4 border-b border-border-subtle">
                  {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-bg-overlay rounded animate-pulse flex-1" style={{ animationDelay: `${(i * 4 + j) * 30}ms` }} />)}
                </div>
              ))}
            </div>
          </div>
          <div className="w-72 shrink-0 space-y-3">
            <div className="rounded-md border border-border-normal bg-bg-surface p-4 space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-3 bg-bg-overlay rounded animate-pulse w-full" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-overlay flex-col gap-3">
        <RotateCcw className="h-12 w-12 text-text-muted" />
        <p className="text-sm font-black text-text-muted">المرتجع غير موجود</p>
        <button onClick={() => navigate(-1)} className="text-2sm font-bold text-text-secondary underline">عودة</button>
      </div>
    );
  }

  const statusInfo = statusBadge(doc.status, "active");
  const isCancelled = doc.status === "cancelled";
  const isAmended   = !!doc.amended_by;
  const isAmendment = !!doc.amendment_of;

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-bg-overlay font-sans overflow-hidden pb-6" dir="rtl">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-strong bg-bg-surface px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-normal text-text-secondary hover:bg-bg-overlay transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-text-primary">مرتجع مبيعات #{doc.doc_no}
              <button onClick={() => handleCopy(doc.doc_no, "doc")} className="inline-flex ms-1 rounded p-1 hover:bg-bg-overlay transition-colors align-middle">
                {copied === "doc" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-text-muted" />}
              </button>
            </h1>
            <span className="text-[11px] font-bold text-text-muted">
              {doc.original_invoice_no ? `من فاتورة ${doc.original_invoice_no}` : "مرتجع عام"}
            </span>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
          {isAmended && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-700">
              مُعدَّل ← {doc.amended_by_no || doc.amended_by}
            </span>
          )}
          {isAmendment && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
              تعديل ↑ {doc.amendment_of_no || doc.amendment_of}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PermissionGate page="sales_returns" action="print">
            <button onClick={() => setPrintOpen(true)}
              className="flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-bg-surface px-4 text-sm font-black text-text-primary hover:bg-bg-overlay transition-all">
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </PermissionGate>
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales_returns" action="delete">
              <button onClick={() => setCancelOpen(true)}
                className="flex h-9 items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 hover:bg-rose-100 transition-all">
                <Trash2 className="h-4 w-4" /> إلغاء المرتجع
              </button>
            </PermissionGate>
          )}
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales_returns" action="edit">
              <button onClick={handleAmend}
                className="flex h-9 items-center gap-2 rounded-sm bg-indigo-600 px-6 text-sm font-black text-white hover:bg-indigo-700 transition-all">
                <Pencil className="h-4 w-4" /> تعديل المرتجع
              </button>
            </PermissionGate>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: info + lines */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-auto">
          {/* Info */}
          <section className="grid grid-cols-4 gap-3 rounded-md border border-border-strong bg-bg-surface p-4 shadow-sm shrink-0">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">العميل</span>
              <span className="text-sm font-black text-text-primary">{invoiceCustomerText(doc)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">التاريخ</span>
              <span className="text-sm font-black text-text-primary">{new Date(doc.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">طريقة الاسترداد</span>
              <span className="text-sm font-black text-text-primary">{REFUND_LABELS[doc.refund_method] || doc.refund_method}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">السبب</span>
              <span className="text-sm font-black text-text-primary">{doc.reason || "—"}</span>
            </div>
          </section>

          {/* Lines */}
          <section className="rounded-md border border-border-strong bg-bg-surface shadow-sm overflow-hidden">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-black text-text-primary flex items-center gap-2"><Package className="h-4 w-4" /> الأصناف المرتجعة</h2>
            </div>
            <table className="w-full text-2sm">
              <thead className="bg-bg-overlay">
                <tr>
                  <th className="px-4 py-2 text-right font-black text-text-secondary">الصنف</th>
                  <th className="px-4 py-2 text-center font-black text-text-secondary">الكمية</th>
                  <th className="px-4 py-2 text-center font-black text-text-secondary">سعر الوحدة</th>
                  <th className="px-4 py-2 text-left font-black text-text-secondary">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(doc.lines || []).map((l, i) => (
                  <tr key={i} className="border-t border-border-subtle hover:bg-bg-overlay/50">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        {(l.item_code || l.code) && <span className="font-mono text-[11px] text-text-muted">{l.item_code || l.code}</span>}
                        <span className="font-bold text-text-primary">{l.item_name_ar || l.item_name || l.item_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-text-primary">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-center text-text-primary">{fmt(l.unit_price)}</td>
                    <td className="px-4 py-2.5 text-left font-black text-text-primary">{fmt(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border-normal bg-bg-overlay">
                {(Number(doc.discount) > 0 || Number(doc.increase) > 0 || Number(doc.tax_amount) > 0) && (
                  <>
                    <tr>
                      <td colSpan={3} className="px-4 py-1.5 text-right font-bold text-text-secondary">إجمالي الأصناف</td>
                      <td className="px-4 py-1.5 text-left font-bold text-text-secondary">{fmt((doc.lines || []).reduce((a, l) => a + Number(l.line_total || 0), 0))} ج.م</td>
                    </tr>
                    {Number(doc.discount) > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-right font-bold text-rose-600">خصم على المرتجع</td>
                        <td className="px-4 py-1.5 text-left font-bold text-rose-600">− {fmt(doc.discount)} ج.م</td>
                      </tr>
                    )}
                    {Number(doc.increase) > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-right font-bold text-emerald-700">زيادة على المرتجع</td>
                        <td className="px-4 py-1.5 text-left font-bold text-emerald-700">+ {fmt(doc.increase)} ج.م</td>
                      </tr>
                    )}
                    {Number(doc.tax_amount) > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-right font-bold text-indigo-600">ضريبة ({doc.tax_rate}%)</td>
                        <td className="px-4 py-1.5 text-left font-bold text-indigo-600">+ {fmt(doc.tax_amount)} ج.م</td>
                      </tr>
                    )}
                  </>
                )}
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-black text-text-primary">صافي المرتجع</td>
                  <td className="px-4 py-3 text-left font-black text-text-primary text-sm">{fmt(doc.total)} ج.م</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Notes */}
          {doc.notes && (
            <section className="rounded-md border border-border-normal bg-bg-surface p-4 shadow-sm">
              <p className="text-[11px] font-bold text-text-muted mb-1">ملاحظات</p>
              <p className="text-sm text-text-primary">{doc.notes}</p>
            </section>
          )}
        </div>

        {/* Right: amendment timeline */}
        {timeline.length > 1 && (
          <aside className="w-64 shrink-0 overflow-auto rounded-md border border-border-strong bg-bg-surface p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-2sm font-black text-text-secondary uppercase tracking-wider border-b border-border-subtle pb-2">سلسلة التعديلات</h3>
            {timeline.map((t, i) => {
              const timelineStatus = statusBadge(t.status, "active");
              return (
                <div key={t.id}
                  onClick={() => navigate(`/pos/sales-returns/${t.id}`)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${t.id === doc.id ? "border-indigo-300 bg-indigo-50" : "border-border-normal hover:border-border-strong bg-bg-surface"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-black text-text-primary">{t.doc_no}</span>
                    {i === 0 && timeline.length > 1 && <span className="text-[9px] font-black text-text-muted bg-bg-overlay px-1.5 py-0.5 rounded">الأصلي</span>}
                    {i === timeline.length - 1 && timeline.length > 1 && i !== 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">الأحدث</span>}
                  </div>
                  <div className="text-[11px] text-text-secondary">{new Date(t.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</div>
                  <div className="text-[11px] font-bold text-text-secondary">{fmt(t.total)} ج.م</div>
                  <span className={`inline-flex mt-1 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-black ${timelineStatus.cls}`}>
                    {timelineStatus.label}
                  </span>
                </div>
              );
            })}
          </aside>
        )}
      </main>

      {cancelOpen && <CancelReasonModal onConfirm={handleCancel} onClose={() => setCancelOpen(false)} />}

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        docType="sales_return"
        invoice={{
          ...doc,
          invoice_no: doc.doc_no,
          customer_name: doc.customer_name,
          cashier_name: doc.created_by_username || doc.cashier_name || "",
          subtotal: doc.subtotal || (doc.lines || []).reduce((a, l) => a + Number(l.line_total || 0), 0),
          total: doc.total || 0,
          discount: doc.discount || 0,
          increase: doc.increase || 0,
          notes: doc.notes || "",
          lines: (doc.lines || []).map(l => ({
            ...l,
            item_name: l.item_name_ar || l.item_name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_amount: 0,
            code: l.item_code || l.code || "",
          })),
        }}
        settings={printSettings}
        operationLabel="مرتجع مبيعات"
        onSendWhatsApp={() => setWaSendOpen(true)}
      />

      {waSendOpen && (
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => setWaSendOpen(false)}
          invoice={doc}
          kind="return_receipt"
        />
      )}
    </div>
  );
}
