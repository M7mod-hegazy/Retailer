import React, { useEffect, useMemo, useState, useRef } from "react";
import { X, RefreshCw, ArrowUpDown, Package, CheckCircle2 } from "lucide-react";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach } from "../../hooks/useDetach";
import DataGrid from "../ui/DataGrid";
import Highlight from "../ui/Highlight";
import { formatNumber } from "../../utils/currency";

import { resolveImageUrl } from "../../utils/resolveImageUrl";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}
function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
function toDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-2sm font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
        {items.map((item, i) => (
          <button key={item.id} type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-emerald-50/80" : "hover:bg-slate-50"}`}>
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-black ${activeIndex === i ? "text-emerald-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[11px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const INVOICE_STATUS_STYLES = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  voided: { label: "ملغي", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "ملغي", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const PAYMENT_METHOD_LABELS = {
  cash: "نقدي", bank_transfer: "حوالة بنكية", credit: "آجل",
  future_due: "استحقاق لاحق", multi: "متعدد",
};

const PAYMENT_METHOD_STYLES = {
  cash:          { label: "نقدي",            cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  bank_transfer: { label: "حوالة بنكية",     cls: "bg-sky-50 text-sky-700 border-sky-200" },
  credit:        { label: "آجل",             cls: "bg-amber-50 text-amber-700 border-amber-200" },
  future_due:    { label: "استحقاق لاحق",    cls: "bg-orange-50 text-orange-700 border-orange-200" },
  multi:         { label: "متعدد",           cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const STATUS_STYLES_PICKER = {
  paid:      { label: "مدفوع",  cls: "bg-emerald-100 text-emerald-700" },
  partial:   { label: "جزئي",   cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "ملغي",   cls: "bg-slate-100 text-slate-500" },
  unpaid:    { label: "آجل",    cls: "bg-rose-100 text-rose-700" },
};

function InvoiceDetailView({ invoice, onClose, onConfirm }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!invoice) return;
    setLoading(true);
    const id = invoice.invoice_id || invoice.id;
    api.get(`/api/invoices/${id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(invoice))
      .finally(() => setLoading(false));
  }, [invoice?.invoice_id, invoice?.id]);
  if (!invoice) return null;
  const d = detail || invoice;
  const statusInfo = STATUS_STYLES_PICKER[d.status] || STATUS_STYLES_PICKER.unpaid;
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          {/* Header */}
          <div className="rounded-sm bg-emerald-50 border border-emerald-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="font-black text-emerald-800">فاتورة #{d.invoice_no || d.doc_no}</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${statusInfo.cls}`}>{statusInfo.label}</span>
            <span className="text-slate-600">العميل: <strong>{d.customer_name || "—"}</strong></span>
            <span className="text-slate-500">{d.created_at ? formatArabicDateTime(new Date(d.created_at)) : "—"}</span>
            {d.created_by_username && <span className="text-slate-500">بواسطة: <strong>{d.created_by_username}</strong></span>}
            <span className="font-bold text-slate-700">طريقة الدفع: {PAYMENT_METHOD_LABELS[d.payment_type] || d.payment_type || "—"}</span>
          </div>

          {/* Lines */}
          <div className="max-h-[240px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">السعر</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">خصم</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">مُرتجع</th>
                </tr>
              </thead>
              <tbody>
                {(d.lines || []).map((l, i) => {
                  const returned = Number(l.returned_quantity || 0);
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_price)}</td>
                      <td className="px-3 py-2.5 text-center text-amber-600">{l.discount > 0 ? formatMoney(l.discount) : "—"}</td>
                      <td className="px-3 py-2.5 text-center number-fmt text-emerald-700">{formatMoney(l.line_total || (l.quantity * (l.unit_price || 0)))}</td>
                      <td className="px-3 py-2.5 text-center">
                        {returned > 0 ? <span className="text-rose-500 font-black">{returned}</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals + Payments */}
          <div className="flex gap-3 flex-wrap">
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

            {d.payments?.length > 0 && (
              <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">المدفوعات</p>
                {d.payments.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-600">{p.method_name || PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
                    <span className="number-fmt-primary text-slate-800">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {d.notes && (
            <div className="rounded-sm border border-slate-200 bg-amber-50 px-4 py-2.5 text-2sm text-slate-600">
              <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">ملاحظات: </span>{d.notes}
            </div>
          )}
          {d.status === "cancelled" && d.cancel_reason && (
            <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-2.5 text-2sm text-rose-700">
              <span className="font-black text-[11px] uppercase tracking-widest">سبب الإلغاء: </span>{d.cancel_reason}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => onConfirm(d)} className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors">
          <CheckCircle2 className="h-4 w-4" /> اختيار هذه الفاتورة
        </button>
      </div>
    </div>
  );
}

export default function InvoicePickerTodayModal({ open, onClose, onSelectInvoice, customers: propCustomers, initialFilters }) {
  const { handleDetach } = useDetach("invoice-picker-today", {
    onClose,
    getState: () => ({
      dateFrom, dateTo, sort, dir, userId, docSearch, itemSearch, customerQuery, customerId,
    }),
    getBounds: () => {
      const el = document.querySelector('[data-modal-content]');
      if (!el) return undefined;
      const panel = el.parentElement;
      if (!panel) return undefined;
      const rect = panel.getBoundingClientRect();
      return {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
      };
    },
    actions: { selectInvoice: (inv) => onSelectInvoice?.(inv) },
  });
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom ?? toDateInput());
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo ?? toDateInput());
  const [sort, setSort] = useState(initialFilters?.sort ?? "created_at");
  const [dir, setDir] = useState(initialFilters?.dir ?? "desc");
  const [userId, setUserId] = useState(initialFilters?.userId ?? "");
  const [usersList, setUsersList] = useState([]);
  const [docSearch, setDocSearch] = useState(initialFilters?.docSearch ?? "");
  const [itemSearch, setItemSearch] = useState(initialFilters?.itemSearch ?? "");
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [customerQuery, setCustomerQuery] = useState(initialFilters?.customerQuery ?? "");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [customerId, setCustomerId] = useState(initialFilters?.customerId ?? "");
  const [detailItem, setDetailItem] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const handleKeyDown = useFieldNavigation();
  const docSearchRef = useRef(null);
  const itemSearchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const sortRef = useRef(null);
  const userSelectRef = useRef(null);
  const customerQueryRef = useRef(null);
  const submitBtnRef = useRef(null);

  const customers = propCustomers || [];

  useEffect(() => {
    const q = itemSearch.trim();
    if (!q) { setFilteredItems([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=8&offset=0`)
        .then(r => setFilteredItems(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerLookupOpen) return [];
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter(c => String(c.name).toLowerCase().includes(q) || String(c.phone || "").includes(q)).slice(0, 8);
  }, [customerLookupOpen, customerQuery, customers]);

  function aggregateResults(data) {
    const map = {};
    (data || []).forEach(line => {
      const id = line.invoice_id;
      if (!map[id]) {
        map[id] = {
          id, invoice_no: line.invoice_no || line.doc_no, customer_name: line.customer_name,
          customer_id: line.customer_id, created_at: line.created_at,
          total: 0, items_count: 0, status: line.status,
          payment_method: line.payment_method || line.payment_type,
          created_by_username: line.created_by_username,
        };
      }
      map[id].total += Number(line.unit_price || 0) * Number(line.quantity || 0);
      map[id].items_count += 1;
    });
    return Object.values(map);
  }

  async function loadData() {
    setLoading(true);
    try {
      if (itemSearch.trim()) {
        const params = new URLSearchParams({ q: itemSearch.trim() });
        if (docSearch.trim()) params.set("invoice_search", docSearch.trim());
        if (customerQuery.trim()) params.set("customer_search", customerQuery.trim());
        if (customerId) params.set("customer_id", customerId);
        if (userId) params.set("user_id", userId);
        params.set("date_from", dateFrom);
        params.set("date_to", dateTo);
        const r = await api.get(`/api/invoices/items-search?${params}`);
        const raw = r.data.data || [];
        const aggregated = aggregateResults(raw);
        setData(aggregated);
        setSummary({ count: aggregated.length, total: aggregated.reduce((s, x) => s + x.total, 0) });
      } else {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, sort, dir });
        if (userId) params.set("user_id", userId);
        if (customerId) params.set("customer_id", customerId);
        if (customerQuery.trim() && !customerId) params.set("customer_search", customerQuery.trim());
        if (docSearch.trim()) params.set("search", docSearch.trim());
        const r = await api.get(`/api/invoices?${params}`);
        let d = r.data.data || [];
        if (customerQuery.trim() && !customerId) {
          const q = customerQuery.trim().toLowerCase();
          d = d.filter((inv) => String(inv.customer_name || "").toLowerCase().includes(q));
        }
        setData(d);
        setSummary(r.data.summary || { count: 0, total: 0 });
      }
    } catch (e) { console.error("load error:", e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
    if (!usersList.length) {
      api.get("/api/users").then(r => setUsersList(r.data.data || [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, customerQuery, customerId]);

  function handleRowClick(r) {
    setDetailItem(r); setDetailOpen(true);
  }

  const docColumns = [
    { id: "invoice_no", header: "رقم الفاتورة", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (inv) => inv.invoice_no || inv.doc_no },
    { id: "customer_name", header: "العميل", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-2sm font-bold text-slate-800", render: (inv) => inv.customer_name || "—" },
    { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-2sm font-bold text-slate-600", render: (inv) => inv.items_count },
    { id: "total", header: "الإجمالي", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 number-fmt-primary text-sm text-emerald-700", render: (inv) => (
      <div className="flex flex-col gap-0.5">
        <span>{formatMoney(inv.total)}</span>
        {(Number(inv.discount) > 0 || Number(inv.increase) > 0) && (
          <span className="text-[9px] font-black leading-none">
            {Number(inv.discount) > 0 && <span className="text-rose-500">خصم −{formatMoney(inv.discount)} </span>}
            {Number(inv.increase) > 0 && <span className="text-emerald-600">زيادة +{formatMoney(inv.increase)}</span>}
          </span>
        )}
      </div>
    ) },
    { id: "payment_method", header: "الدفع", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (inv) => {
      if (inv.payment_splits) {
        const splits = inv.payment_splits.split("|||").filter(Boolean).map(s => { const [m, a] = s.split(":"); return { method: (m || "").trim(), amount: Number(a || 0) }; }).filter(s => s.amount > 0);
        if (splits.length) return (
          <div className="flex flex-col gap-0.5">
            {splits.map((s, i) => { const info = PAYMENT_METHOD_STYLES[s.method] || { label: s.method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" }; return (
              <div key={i} className="flex items-center gap-1">
                <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
                <span className="text-[11px] number-fmt text-slate-500">{formatMoney(s.amount)}</span>
              </div>
            ); })}
          </div>
        );
      }
      const method = inv.payment_method || inv.payment_type; const info = PAYMENT_METHOD_STYLES[method];
      return (
        <div className="flex flex-col gap-0.5">
          {info ? <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span> : <span className="text-[11px] font-bold text-slate-600">{method || "—"}</span>}
          <span className="text-[11px] number-fmt text-slate-500">{formatMoney(inv.total)}</span>
        </div>
      );
    } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (inv) => inv.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap", render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="فواتير المبيعات — اختيار للمرتجع" maxWidth="max-w-5xl" onDetach={handleDetach} showDetach={true} modalType="invoice-picker-today">
        <div className="flex flex-col gap-4">
          {/* Context banner */}
          <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">فواتير نقطة البيع (POS)</span>
            <span className="text-[11px] text-emerald-600 font-bold">— اختر فاتورة مبيعات أصلية لإنشاء المرتجع منها.</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-sm border border-emerald-200">
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث برقم المستند:</span>
            <input ref={docSearchRef} value={docSearch} onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="INV-0001..."
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث صنف:</span>
            <div className="relative flex-1">
              <input ref={itemSearchRef}
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setItemLookupOpen(true); }}
                onFocus={() => setItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveItemIndex(i => Math.min(i + 1, filteredItems.length - 1)); setItemLookupOpen(true); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveItemIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (filteredItems.length > 0 && activeItemIndex >= 0) { const picked = filteredItems[activeItemIndex]; setItemSearch(picked.code || picked.barcode || picked.name); setItemLookupOpen(false); } else { handleKeyDown(e, { nextRef: dateFromRef, prevRef: docSearchRef }); } }
                  else if (e.key === "Escape") { setItemLookupOpen(false); }
                }}
                placeholder="اسم الصنف أو الكود..."
                className="w-full rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              {itemLookupOpen && (
                <LookupList items={filteredItems} onPick={(item) => { setItemSearch(item.code || item.barcode || item.name); setItemLookupOpen(false); }}
                  activeIndex={activeItemIndex} query={itemSearch} />
              )}
            </div>
            <button onClick={() => { setDocSearch(""); setItemSearch(""); setItemLookupOpen(false); }} className="flex items-center gap-1.5 rounded-sm bg-emerald-200 px-3 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-300">
              مسح
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">من</label>
              <input ref={dateFromRef} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: itemSearchRef })}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">إلى</label>
              <input ref={dateToRef} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: sortRef, prevRef: dateFromRef })}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">ترتيب</label>
              <select ref={sortRef} value={sort} onChange={(e) => setSort(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: userSelectRef, prevRef: dateToRef })}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="doc_no">رقم المستند</option>
                <option value="payment_method">طريقة الدفع</option>
              </select>
              <button onClick={() => setDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-emerald-200 bg-white hover:bg-emerald-100 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-emerald-600" />
              </button>
            </div>
            {usersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">المستخدم</label>
                <select ref={userSelectRef} value={userId} onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: customerQueryRef, prevRef: sortRef })}
                  className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">العميل</label>
              <input ref={customerQueryRef} type="text" value={customerQuery}
                onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); setActiveCustomerIndex(0); if (!e.target.value) setCustomerId(""); }}
                onFocus={() => setCustomerLookupOpen(true)}
                onBlur={() => setTimeout(() => setCustomerLookupOpen(false), 200)}
                onKeyDown={(e) => {
                  if (!customerLookupOpen && e.key === "ArrowDown") { setCustomerLookupOpen(true); return; }
                  if (customerLookupOpen && filteredCustomers.length && e.key === "ArrowDown") { e.preventDefault(); setActiveCustomerIndex((v) => Math.min(v + 1, filteredCustomers.length - 1)); return; }
                  if (customerLookupOpen && filteredCustomers.length && e.key === "ArrowUp") { e.preventDefault(); setActiveCustomerIndex((v) => Math.max(v - 1, 0)); return; }
                  if (customerLookupOpen && filteredCustomers.length && e.key === "Enter") {
                    e.preventDefault(); const next = filteredCustomers[activeCustomerIndex] || filteredCustomers[0];
                    setCustomerQuery(next.name); setCustomerId(next.id); setCustomerLookupOpen(false); return;
                  }
                  if (e.key === "Escape") setCustomerLookupOpen(false);
                  handleKeyDown(e, { nextRef: submitBtnRef, prevRef: userSelectRef });
                }}
                placeholder="كل العملاء..."
                className="w-[140px] rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              {customerQuery && (
                <button onClick={() => { setCustomerQuery(""); setCustomerId(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {customerLookupOpen && (
                <LookupList items={filteredCustomers} onPick={(c) => { setCustomerQuery(c.name); setCustomerId(c.id); setCustomerLookupOpen(false); }}
                  activeIndex={activeCustomerIndex} query={customerQuery} emptyLabel="لا توجد نتائج" />
              )}
            </div>
            <button ref={submitBtnRef} onClick={loadData}
              onKeyDown={e => handleKeyDown(e, { prevRef: customerQueryRef })}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">عدد الفواتير</span>
              <span className="number-fmt-primary text-[20px] text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المبيعات</span>
              <span className="number-fmt-primary text-[20px] text-emerald-300 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-sm border border-emerald-200">
            <DataGrid
              data={loading ? [] : data}
              rowKey="id"
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد نتائج في هذه الفترة"}
              className="border-0"
              onRowClick={handleRowClick}
              columns={docColumns}
            />
          </div>
        </div>
      </Modal>
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="معاينة الفاتورة">
        {detailItem ? <InvoiceDetailView invoice={detailItem} onClose={() => setDetailOpen(false)} onConfirm={(inv) => { setDetailOpen(false); onSelectInvoice(inv); }} /> : null}
      </Modal>
    </>
  );
}
