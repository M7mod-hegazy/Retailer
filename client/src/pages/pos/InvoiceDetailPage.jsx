import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowLeft, Lock, Pencil, Trash2, AlertTriangle, CheckCircle2,
  User, Calendar, CreditCard, Banknote, Wallet, Clock, X,
  Package, ShoppingCart, Printer, History, Settings2, Copy,
} from "lucide-react";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useUiStore } from "../../stores/uiStore";
import api from "../../services/api";
import { copyToClipboard } from "../../services/connection";
import { useShortcut } from "../../shortcuts/useShortcut";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";
import PermissionGate from "../../components/ui/PermissionGate";
import DocumentHeaderBar from "../../components/document/DocumentHeaderBar";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import ReturnsWarningModal from "../../components/ui/ReturnsWarningModal";
import toast from "react-hot-toast";
import { PAYMENT_LABELS, statusBadge } from "../../components/operations/docHelpers";
import { formatNumber } from "../../utils/currency";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { usePageTour } from '../../hooks/usePageTour';

function CancelReasonModal({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    api.get("/api/invoices/cancel-reasons").then(r => setPresets(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl" onClick={onClose}>
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-black text-text-primary">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-bg-overlay text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-2sm text-text-secondary mb-3">اختر سبباً أو اكتب سبباً مخصصاً:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className={`px-3 py-1.5 rounded-lg text-2sm font-bold border transition-colors ${reason === p ? "btn-danger" : "border-border-normal text-text-secondary hover:border-rose-300"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="أو اكتب السبب..."
          className="w-full border border-border-normal rounded-xl p-3 text-2sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 btn-danger rounded-xl py-2.5 text-sm font-black disabled:opacity-40 transition-colors"
          >
            تأكيد
          </button>
          <button onClick={onClose} className="flex-1 border border-border-normal rounded-xl py-2.5 text-sm font-black text-text-secondary hover:bg-bg-overlay transition-colors">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(n) {
  return formatNumber(n);
}

export default function InvoiceDetailPage() {
  usePageTour('invoice_detail');
  const { id } = useParams();
  const navigate = useNavigate();
  const setDynamicBreadcrumb = useUiStore((s) => s.setDynamicBreadcrumb);
  const clearDynamicBreadcrumb = useUiStore((s) => s.clearDynamicBreadcrumb);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printSettings, setPrintSettings] = useState({});
  const [printOpen, setPrintOpen] = useState(false);
  const [waSendOpen, setWaSendOpen] = useState(false);
  const [timeline, setTimeline] = useState([]);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnsWarningOpen, setReturnsWarningOpen] = useState(false);

  useShortcut('invoice.print', () => setPrintOpen(true));

  const ALL_COLUMNS = ["index","code","name","quantity","unit_price","discount","line_total"];
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("retailer.invoiceDetail.visibleColumns");
      return saved ? JSON.parse(saved) : ALL_COLUMNS;
    } catch { return ALL_COLUMNS; }
  });
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const colSettingsRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(e) {
      if (colSettingsRef.current && !colSettingsRef.current.contains(e.target)) {
        setColSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
  }, []);

  async function loadInvoice() {
    setLoading(true);
    try {
      const r = await api.get(`/api/invoices/${id}`);
      const inv = r.data.data;
      setInvoice(inv);
      setDynamicBreadcrumb({ label: inv.invoice_no, path: `/invoices/${id}` });
      await loadTimeline(inv);
    } catch {
      toast.error("فشل تحميل الفاتورة");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => () => clearDynamicBreadcrumb(), []);

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

  function handleEdit() {
    if (!invoice) return;
    if (invoice.has_returns) {
      setReturnsWarningOpen(true);
      return;
    }
    navigate("/pos", {
      state: {
        edit_invoice_id: invoice.id,
        prefill: {
          customer_id: invoice.customer_id,
          customer_name: invoice.customer_name,
          walk_in_phone: invoice.walk_in_phone || null,
          walk_in_name: invoice.walk_in_name || null,
          lines: (invoice.lines || []).map(l => ({
            item_id: l.item_id,
            item_name: l.item_name || l.name,
            code: l.item_code || l.code || l.barcode || "",
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: l.discount || 0,
            warehouse_id: l.warehouse_id || 1,
            // preserve multi-unit snapshot through amend/display
            sold_unit_id: l.sold_unit_id || null,
            sold_unit_name: l.sold_unit_name || null,
            sold_unit_factor: l.sold_unit_factor || null,
          })),
          payment_type: invoice.payment_type,
          discount: invoice.discount || 0,
          increase: invoice.increase || 0,
          notes: invoice.notes,
          tax_enabled: invoice.tax_enabled,
          tax_rate: invoice.tax_rate,
          orig_balance_effect: invoice.debt_remaining || 0,
          invoice_no: invoice.invoice_no,
          created_at: invoice.created_at,
          created_by_username: invoice.created_by_username || null,
          allocations: invoice.allocations || [],
          amount_received: invoice.amount_received || 0,
          treasury_id: invoice.treasury_id || null,
          bank_id: invoice.bank_id || null,
        },
      },
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-overlay">
        <div className="text-sm font-black text-text-muted animate-pulse">جاري تحميل الفاتورة...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-overlay flex-col gap-3">
        <ShoppingCart className="h-12 w-12 text-text-muted" />
        <p className="text-sm font-black text-text-muted">الفاتورة غير موجودة</p>
        <button onClick={() => navigate(-1)} className="text-2sm font-bold text-text-secondary underline">عودة</button>
      </div>
    );
  }

  const statusInfo = statusBadge(invoice.status, "unpaid");
  const isCancelled = invoice.status === "cancelled";
  const isAmended   = !!invoice.amended_by;   // was replaced by a newer invoice
  const isAmendment = !!invoice.amendment_of; // is itself a replacement of an older invoice

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-bg-overlay font-sans overflow-hidden pb-6" dir="rtl">
      {/* Header */}
      <DocumentHeaderBar
        onBack={() => navigate(-1)}
        title={`فاتورة بيع #${invoice.invoice_no}`}
        subtitle={<span className="flex items-center gap-1.5">محفوظة<button onClick={() => { copyToClipboard(invoice.invoice_no); toast.success("تم النسخ"); }} className="p-1 rounded hover:bg-bg-overlay transition-colors" title="نسخ رقم الفاتورة"><Copy className="w-3.5 h-3.5 text-text-muted" /></button></span>}
        badges={[
          { label: statusInfo.label, cls: statusInfo.cls },
          ...(isAmended ? [{ label: `مُعدَّلة ← ${invoice.amended_by_no || invoice.amended_by}`, cls: "border-amber-200 bg-amber-100 text-amber-700" }] : []),
          ...(isAmendment ? [{ label: `تعديل ↑ ${invoice.amendment_of_no || invoice.amendment_of}`, cls: "border-blue-200 bg-blue-100 text-blue-700" }] : []),
        ]}
        actions={
          <>
            {!isCancelled && !isAmended && (
              <PermissionGate page="pos" action="void">
                <DocumentActionButton variant="delete" icon={Trash2} onClick={() => setCancelOpen(true)}>
                  إلغاء الفاتورة
                </DocumentActionButton>
              </PermissionGate>
            )}
            <PermissionGate page="pos" action="print">
              <DocumentActionButton variant="print" icon={Printer} onClick={() => setPrintOpen(true)}>
                طباعة
              </DocumentActionButton>
            </PermissionGate>
            <PermissionGate page="whatsapp_receipt" action="send">
              <DocumentActionButton
                onClick={() => setWaSendOpen(true)}
                className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border border-[#25D366]/20"
                icon={WhatsAppIcon}
              >
                واتساب
              </DocumentActionButton>
            </PermissionGate>
            {!isCancelled && !isAmended && (
              <PermissionGate page="pos" action="edit">
                <DocumentActionButton variant="edit" icon={Pencil} onClick={handleEdit}>
                  تعديل الفاتورة
                </DocumentActionButton>
              </PermissionGate>
            )}
          </>
        }
      />

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Info bar */}
          <section className="grid grid-cols-5 gap-3 rounded-md border border-border-strong bg-bg-surface p-4 shadow-sm shrink-0">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">العميل</span>
              {invoice.customer_name ? (
                <span className="text-sm font-black text-text-primary">{invoice.customer_name}</span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                    🚶 عميل نقدي
                  </span>
                  {invoice.walk_in_phone && (
                    <span className="text-xs font-bold text-text-secondary">
                      {invoice.walk_in_name ? `${invoice.walk_in_name} — ` : ""}
                      <span className="font-mono" dir="ltr">{invoice.walk_in_phone}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">التاريخ</span>
              <span className="text-sm font-black text-text-primary">
                {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("ar-EG-u-nu-latn") : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">الوقت</span>
              <span className="text-sm font-black text-text-primary font-mono">
                {invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">طريقة الدفع</span>
              <span className="text-sm font-black text-text-primary">{PAYMENT_LABELS[invoice.payment_type] || invoice.payment_type || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> بواسطة
              </span>
              <span className="text-sm font-black text-text-primary">{invoice.created_by_username || "—"}</span>
            </div>
          </section>

          {/* Lines */}
          <div className="flex items-center justify-between shrink-0 px-2">
            <span className="text-[11px] font-black text-text-secondary uppercase tracking-widest">الأصناف ({(invoice.lines || []).length})</span>
            <div className="relative" ref={colSettingsRef}>
              <button
                onClick={() => setColSettingsOpen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border-normal bg-bg-surface text-text-muted hover:text-text-primary hover:border-border-strong transition-all"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              {colSettingsOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-border-normal bg-bg-surface shadow-lg p-2">
                  <div className="text-[10px] font-black text-text-muted px-2 pb-1 border-b border-border-subtle mb-1">إظهار الأعمدة</div>
                  {ALL_COLUMNS.map((col) => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-overlay cursor-pointer text-2sm font-bold text-text-primary">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col)}
                        onChange={() => {
                          const next = visibleColumns.includes(col)
                            ? visibleColumns.filter((c) => c !== col)
                            : [...visibleColumns, col];
                          setVisibleColumns(next);
                          localStorage.setItem("retailer.invoiceDetail.visibleColumns", JSON.stringify(next));
                        }}
                        className="accent-indigo-500"
                      />
                      {col === "index" ? "#" : col === "code" ? "الكود" : col === "name" ? "الصنف" : col === "quantity" ? "الكمية" : col === "unit_price" ? "السعر" : col === "discount" ? "الخصم" : col === "line_total" ? "الإجمالي" : col}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DataGrid
            data={invoice.lines || []}
            rowKey={(row, i) => `${row.item_id}-${i}`}
            emptyMessage="لا يوجد أصناف"
            emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
            className="border-0"
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-bg-surface scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-border-strong min-h-0"
            columns={[
              { id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center number-fmt text-[11px] text-text-muted border-l border-border-subtle", sortable: false, render: (_, i) => i + 1 },
              { id: "code", header: "الكود", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-text-secondary border-l border-border-subtle",
                render: (l) => l.item_code || l.code || l.barcode || "—" },
              { id: "name", header: "الصنف", width: 220, sortable: true, cellClass: "font-black text-text-primary border-l border-border-subtle px-3", headerClass: "text-right px-3",
                render: (l) => <div className="flex items-center gap-2 py-1">{l.primary_image_url ? <img src={resolveImageUrl(l.primary_image_url)} alt="" className="w-[22px] h-[22px] rounded object-cover shrink-0" /> : null}<p className="text-sm font-black">{l.item_name || l.name}{l.sold_unit_name ? <span className="text-[11px] font-bold text-sky-600"> — {l.sold_unit_qty ?? ""} {l.sold_unit_name}</span> : null}</p></div> },
              { id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt text-sm border-l border-border-subtle", render: (l) => l.quantity },
              { id: "unit_price", header: "السعر", width: 110, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm border-l border-border-subtle text-text-primary", render: (l) => fmt(l.unit_price) },
              { id: "discount", header: "خصم", width: 90, sortable: true, headerClass: "text-center", cellClass: "text-center number-fmt-primary text-sm border-l border-border-subtle text-amber-700", render: (l) => l.discount > 0 ? fmt(l.discount) : "—" },
              { id: "line_total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 number-fmt-primary text-sm text-text-primary bg-bg-overlay/50 border-l border-border-subtle", render: (l) => fmt(l.line_total) },
            ].filter(c => c.id === "index" || c.id === "actions" || visibleColumns.includes(c.id))}
          />

          {/* Amendment timeline */}
          {timeline.length > 1 && (
            <div className="mt-2 border border-border-normal rounded-xl p-4 bg-bg-surface shrink-0">
              <h4 className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                <History className="h-3.5 w-3.5" /> سجل التعديلات
              </h4>
              <div className="flex flex-col gap-2">
                {timeline.map((inv) => (
                  <div key={inv.id} className={`flex items-center gap-3 text-2sm ${inv.id === invoice.id ? "font-black text-text-primary" : "text-text-muted"}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${inv.status === "cancelled" ? "bg-rose-400" : "bg-emerald-400"}`} />
                    <span className="font-mono">{inv.invoice_no}</span>
                    <span className="text-text-muted">{inv.created_at?.slice(0, 10)}</span>
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
          <div className="rounded-md border border-border-strong bg-bg-surface p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black text-text-muted uppercase tracking-widest border-b pb-2 border-border-subtle">ملخص الفاتورة</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-2sm">
                <span className="font-bold text-text-secondary">عدد الأصناف</span>
                <span className="font-black text-text-primary">{(invoice.lines || []).length}</span>
              </div>
              <div className="flex justify-between text-2sm">
                <span className="font-bold text-text-secondary">المجموع الفرعي</span>
                <span className="number-fmt-primary text-text-primary">{fmt(invoice.subtotal)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-2sm">
                  <span className="font-bold text-text-secondary">الخصم</span>
                  <span className="number-fmt-primary text-rose-600">- {fmt(invoice.discount)}</span>
                </div>
              )}
              {Number(invoice.increase) > 0 && (
                <div className="flex justify-between text-2sm">
                  <span className="font-bold text-text-secondary">زيادة</span>
                  <span className="number-fmt-primary text-emerald-600">+ {fmt(invoice.increase)}</span>
                </div>
              )}
              {Number(invoice.tax_amount) > 0 && (
                <div className="flex justify-between text-2sm">
                  <span className="font-bold text-text-secondary">ضريبة ({invoice.tax_rate}%)</span>
                  <span className="number-fmt-primary text-indigo-600">+ {fmt(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="h-px bg-bg-overlay" />
              <div className="rounded-sm bg-slate-900 p-4 text-center text-white">
                <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest">الإجمالي</div>
                <div className="text-[26px] number-fmt-primary tracking-tighter">{fmt(invoice.total)}</div>
                <div className="text-[11px] opacity-40">ج.م</div>
              </div>
            </div>
          </div>

          {/* Payments */}
          {invoice.payments?.length > 0 && (
            <div className="rounded-md border border-border-strong bg-bg-surface p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-text-muted uppercase tracking-widest">المدفوعات</h3>
              <div className="space-y-2">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-sm bg-bg-overlay border border-border-normal px-3 py-2">
                    <span className="text-[11px] font-bold text-text-secondary">{p.method_name || PAYMENT_LABELS[p.method] || p.method}</span>
                    <span className="number-fmt-primary text-2sm text-text-primary">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-md border border-border-normal bg-bg-surface p-4 shadow-sm">
              <h3 className="mb-2 text-[11px] font-black text-text-muted uppercase tracking-widest">ملاحظات</h3>
              <p className="text-2sm font-medium text-text-primary whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Cancellation info */}
          {isCancelled && invoice.cancel_reason && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-1">سبب الإلغاء</p>
              <p className="text-2sm font-bold text-rose-700">{invoice.cancel_reason}</p>
              {invoice.cancelled_at && (
                <p className="text-[11px] text-rose-400 mt-1">{new Date(invoice.cancelled_at).toLocaleString("en-US")}</p>
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

      <ReturnsWarningModal
        open={returnsWarningOpen}
        onClose={() => setReturnsWarningOpen(false)}
      />

      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        docType="pos_receipt"
        invoice={{
          ...invoice,
          invoice_no: invoice.invoice_no,
          created_at: invoice.created_at,
          customer_name: invoice.customer_name,
          cashier_name: invoice.created_by_username || invoice.cashier_name || "",
          subtotal: invoice.subtotal || invoice.total || 0,
          total: invoice.total || 0,
          discount: invoice.discount || 0,
          increase: invoice.increase || 0,
          notes: invoice.notes || "",
          lines: (invoice.lines || []).map(l => ({
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
        onSendWhatsApp={() => setWaSendOpen(true)}
      />

      {waSendOpen && (
        <WhatsAppSendModal
          open={waSendOpen}
          onClose={() => setWaSendOpen(false)}
          invoice={invoice}
        />
      )}
    </div>
  );
}
