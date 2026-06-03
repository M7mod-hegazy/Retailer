import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Trash2, Pencil, Printer, RotateCcw,
  User, Calendar, X, Package,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PermissionGate from "../../components/ui/PermissionGate";
import { REFUND_LABELS, statusBadge } from "../../components/operations/docHelpers";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function CancelReasonModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const PRESETS = ["خطأ في البيانات", "خطأ في الكمية", "طلب العميل", "مرتجع مكرر", "أخرى"];
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-slate-800">سبب إلغاء المرتجع</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${reason === p ? "bg-rose-600 text-white border-rose-600" : "border-slate-200 text-slate-600 hover:border-rose-300"}`}
            >{p}</button>
          ))}
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="أو اكتب السبب..."
          className="w-full border border-slate-200 rounded-xl p-3 text-[12px] resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300" />
        <div className="flex gap-2 mt-4">
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}
            className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-[13px] font-black disabled:opacity-40 hover:bg-rose-700 transition-colors">تأكيد</button>
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-[13px] font-black text-slate-600 hover:bg-slate-50 transition-colors">رجوع</button>
        </div>
      </div>
    </div>
  );
}

export default function SalesReturnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState({});

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
    return <div className="flex h-full items-center justify-center bg-slate-50"><div className="text-[14px] font-black text-slate-400 animate-pulse">جاري التحميل...</div></div>;
  }

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 flex-col gap-3">
        <RotateCcw className="h-12 w-12 text-slate-300" />
        <p className="text-[14px] font-black text-slate-400">المرتجع غير موجود</p>
        <button onClick={() => navigate(-1)} className="text-[12px] font-bold text-slate-500 underline">عودة</button>
      </div>
    );
  }

  const statusInfo = statusBadge(doc.status, "active");
  const isCancelled = doc.status === "cancelled";
  const isAmended   = !!doc.amended_by;
  const isAmendment = !!doc.amendment_of;

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden pb-6" dir="rtl">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800">مرتجع مبيعات #{doc.doc_no}</h1>
            <span className="text-[10px] font-bold text-slate-400">
              {doc.original_invoice_no ? `من فاتورة ${doc.original_invoice_no}` : "مرتجع عام"}
            </span>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
          {isAmended && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700">
              مُعدَّل ← {doc.amended_by_no || doc.amended_by}
            </span>
          )}
          {isAmendment && (
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-blue-700">
              تعديل ↑ {doc.amendment_of_no || doc.amendment_of}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PermissionGate page="sales_returns" action="print">
            <button onClick={() => setPrintOpen(true)}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all">
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </PermissionGate>
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales_returns" action="delete">
              <button onClick={() => setCancelOpen(true)}
                className="flex h-9 items-center gap-2 rounded-sm border border-rose-200 bg-rose-50 px-4 text-[13px] font-black text-rose-600 hover:bg-rose-100 transition-all">
                <Trash2 className="h-4 w-4" /> إلغاء المرتجع
              </button>
            </PermissionGate>
          )}
          {!isCancelled && !isAmended && (
            <PermissionGate page="sales_returns" action="edit">
              <button onClick={handleAmend}
                className="flex h-9 items-center gap-2 rounded-sm bg-indigo-600 px-6 text-[13px] font-black text-white hover:bg-indigo-700 transition-all">
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
          <section className="grid grid-cols-4 gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">العميل</span>
              <span className="text-[13px] font-black text-slate-800">{doc.customer_name || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">التاريخ</span>
              <span className="text-[13px] font-black text-slate-800">{new Date(doc.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">طريقة الاسترداد</span>
              <span className="text-[13px] font-black text-slate-800">{REFUND_LABELS[doc.refund_method] || doc.refund_method}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">السبب</span>
              <span className="text-[13px] font-black text-slate-800">{doc.reason || "—"}</span>
            </div>
          </section>

          {/* Lines */}
          <section className="rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-[13px] font-black text-slate-700 flex items-center gap-2"><Package className="h-4 w-4" /> الأصناف المرتجعة</h2>
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-4 py-2 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-4 py-2 text-center font-black text-slate-500">سعر الوحدة</th>
                  <th className="px-4 py-2 text-left font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(doc.lines || []).map((l, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        {(l.item_code || l.code) && <span className="font-mono text-[10px] text-slate-400">{l.item_code || l.code}</span>}
                        <span className="font-bold text-slate-800">{l.item_name_ar || l.item_name || l.item_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{l.quantity}</td>
                    <td className="px-4 py-2.5 text-center text-slate-700">{fmt(l.unit_price)}</td>
                    <td className="px-4 py-2.5 text-left font-black text-slate-800">{fmt(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-black text-slate-700">الإجمالي</td>
                  <td className="px-4 py-3 text-left font-black text-slate-900 text-[14px]">{fmt(doc.total)} ج.م</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Notes */}
          {doc.notes && (
            <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold text-slate-400 mb-1">ملاحظات</p>
              <p className="text-[13px] text-slate-700">{doc.notes}</p>
            </section>
          )}
        </div>

        {/* Right: amendment timeline */}
        {timeline.length > 1 && (
          <aside className="w-64 shrink-0 overflow-auto rounded-md border border-slate-300 bg-white p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-[12px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-100 pb-2">سلسلة التعديلات</h3>
            {timeline.map((t, i) => {
              const timelineStatus = statusBadge(t.status, "active");
              return (
                <div key={t.id}
                  onClick={() => navigate(`/pos/sales-returns/${t.id}`)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${t.id === doc.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-black text-slate-700">{t.doc_no}</span>
                    {i === 0 && timeline.length > 1 && <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">الأصلي</span>}
                    {i === timeline.length - 1 && timeline.length > 1 && i !== 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">الأحدث</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">{new Date(t.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</div>
                  <div className="text-[10px] font-bold text-slate-500">{fmt(t.total)} ج.م</div>
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
        invoice={{
          invoice_no: doc.doc_no,
          created_at: doc.created_at,
          customer_name: doc.customer_name,
          lines: (doc.lines || []).map(l => ({
            item_name: l.item_name_ar || l.item_name,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_amount: 0,
          })),
        }}
        settings={printSettings}
        operationLabel="مرتجع مبيعات"
      />
    </div>
  );
}
