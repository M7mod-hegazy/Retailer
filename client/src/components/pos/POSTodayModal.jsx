import React, { useEffect, useMemo, useState, useRef } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach, openDetachedModal } from "../../hooks/useDetach";
import { useAuthStore } from "../../stores/authStore";
import DataGrid from "../ui/DataGrid";
import InvoicePreviewModal from "./InvoicePreviewModal";
import ConfirmDialog from "../ui/ConfirmDialog";
import Highlight from "../ui/Highlight";
import toast from "react-hot-toast";
import PermissionGate from "../ui/PermissionGate";
import { formatNumber } from "../../utils/currency";
import { invoiceCustomerText } from "./WalkInCustomer";
import { parseSplits, resolvePaymentStyle, calculatePaymentBreakdown } from "../../utils/paymentMethodDisplay";

import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { todayCairo } from "../../utils/dateHelpers";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}
function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}
function toDateInput(date = new Date()) {
  return todayCairo(date);
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-border-subtle bg-bg-surface p-4 text-center text-2sm font-bold text-text-muted shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-border-subtle bg-bg-surface shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-border-normal/80" : "hover:bg-bg-overlay"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-border-normal" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-bg-overlay flex items-center justify-center border border-border-normal"><Package className="w-4 h-4 text-text-muted" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-black ${activeIndex === i ? "text-text-primary" : "text-text-primary"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[11px] text-text-muted font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const PAYMENT_TYPES = [
  { type: "cash",          label: "نقدي" },
  { type: "bank_transfer", label: "بنك / فيزا" },
  { type: "credit",        label: "آجل" },
  { type: "installments",  label: "أقساط" },
  { type: "multi",         label: "متعدد" },
];

const STATUS_STYLES = {
  paid:    { label: "مدفوع",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "جزئي",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  unpaid:  { label: "آجل",     cls: "bg-rose-50 text-rose-700 border-rose-200" },
  voided:  { label: "ملغي",    cls: "bg-bg-overlay text-text-secondary border-border-normal" },
};



export default function POSTodayModal({ open, onClose, onNavigate: propNavigate, initialFilters }) {
  const navigate = useNavigate();
  const gotoTarget = (path) => {
    if (window.location.search.includes("detachedModal=1") && window.electronAPI?.navigateParent) {
      window.electronAPI.navigateParent(path);
      window.electronAPI?.closeModalWindow?.();
    } else if (propNavigate) {
      propNavigate(path);
    } else {
      navigate(path);
    }
  };
  const { handleDetach } = useDetach("post-today", {
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
    actions: { navigate: (path) => navigate(path) },
  });
  const { handleDetach: handlePreviewDetach } = useDetach("invoice-preview", {
    onClose: () => setPreviewOpen(false),
    getState: () => ({ invoiceId: previewItem?.id }),
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
  });
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0, byMethod: {} });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom ?? toDateInput());
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo ?? toDateInput());
  const [sort, setSort] = useState(initialFilters?.sort ?? "created_at");
  const [dir, setDir] = useState(initialFilters?.dir ?? "desc");
  const [userId, setUserId] = useState(initialFilters?.userId ?? "");
  const [usersList, setUsersList] = useState([]);
  const [docSearch, setDocSearch] = useState(initialFilters?.docSearch ?? "");
  const [itemSearch, setItemSearch] = useState(initialFilters?.itemSearch ?? "");
  const [rawItems, setRawItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [customerQuery, setCustomerQuery] = useState(initialFilters?.customerQuery ?? "");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [customerId, setCustomerId] = useState(initialFilters?.customerId ?? "");
  const [customers, setCustomers] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const handleKeyDown = useFieldNavigation();
  const docSearchRef = useRef(null);
  const itemSearchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const sortRef = useRef(null);
  const userSelectRef = useRef(null);
  const customerQueryRef = useRef(null);
  const submitBtnRef = useRef(null);

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
          id, invoice_no: line.invoice_no, customer_name: line.customer_name,
          customer_id: line.customer_id, created_at: line.created_at,
          total: 0, items_count: 0, status: line.status,
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
        setRawItems(raw);
        setData([]);
        const aggregated = aggregateResults(raw);
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
        setRawItems([]);
        const s = r.data.summary || { count: 0, total: 0, byMethod: {} };
        setSummary({ ...s, byMethod: s.byMethod || {} });
        if (r.data.paymentMethods) setPaymentMethods(r.data.paymentMethods);
      }
    } catch (e) { console.error("load error:", e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
    if (!usersList.length) {
      api.get("/api/users").then(r => setUsersList(r.data.data || [])).catch(() => {});
    }
    if (!customers.length) {
      api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, customerQuery, customerId]);

  function handleVoid(inv) {
    setVoidTarget(inv);
    setVoidOpen(true);
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    try {
      await api.post(`/api/invoices/${voidTarget.id}/void`, { reason: "إلغاء من فواتير اليوم" });
      toast.success("تم إلغاء الفاتورة");
      setVoidOpen(false);
      setVoidTarget(null);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
      setVoidOpen(false);
    }
  }

  const docColumns = [
    { id: "invoice_no",   header: "رقم الفاتورة", width: 148, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 font-mono text-2sm font-black text-text-primary text-center",
      render: (inv) => inv.invoice_no },
    { id: "customer_name", header: "العميل", width: 150, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 text-2sm font-bold text-text-primary text-center",
      render: (inv) => invoiceCustomerText(inv) },
    { id: "items_count", header: "الأصناف", width: 72, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 text-center text-2sm font-bold text-text-secondary",
      render: (inv) => inv.items_count },
    { id: "total", header: "الإجمالي", width: 110, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 number-fmt-primary text-sm text-emerald-700 text-center",
      render: (inv) => formatMoney(inv.total) },
    { id: "payment_type", header: "الدفع", width: 160, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass:   "px-2",
      render: (inv) => {
        if (inv.payment_splits) {
          const splits = parseSplits(inv.payment_splits);
          if (splits.length) return (
            <div className="flex flex-col gap-0.5 items-center">
              {splits.map((s, i) => {
                const info = resolvePaymentStyle(s.method, paymentMethods);
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
                    <span className="text-[11px] font-mono font-bold text-text-secondary">{formatMoney(s.amount)}</span>
                  </div>
                );
              })}
            </div>
          );
        }
        const info = resolvePaymentStyle(inv.payment_type, paymentMethods);
        return (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
            <span className="text-[11px] font-mono font-bold text-text-secondary">{formatMoney(inv.total)}</span>
          </div>
        );
      } },
    { id: "created_by", header: "المستخدم", width: 100, sortable: false,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 text-[11px] font-bold text-text-secondary whitespace-nowrap text-center",
      render: (inv) => inv.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 140, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass:   "px-2 text-[11px] text-text-secondary number-fmt whitespace-nowrap text-center",
      render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
    { id: "actions", header: "", width: 70, headerClass: "px-2", cellClass: "px-2",
      render: (inv) => (
        <div className="flex gap-1 justify-center">
          <PermissionGate page="pos" action="view">
            <button onClick={() => gotoTarget(`/invoices/${inv.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
          </PermissionGate>
          <PermissionGate page="pos" action="void">
            <button onClick={() => handleVoid(inv)} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
          </PermissionGate>
        </div>
      )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 100,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 font-mono text-[11px] font-bold text-text-secondary text-center",
      render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 170,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 text-2sm font-bold text-text-primary text-center",
      render: (r) => r.item_name || "—" },
    { id: "invoice_no", header: "الفاتورة", width: 130,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 font-mono text-[11px] font-black text-text-primary text-center",
      render: (r) => r.invoice_no || "—" },
    { id: "customer_name", header: "العميل", width: 120,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 text-[11px] font-bold text-text-secondary text-center",
      render: (r) => invoiceCustomerText(r) },
    { id: "quantity", header: "الكمية", width: 70,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 text-center number-fmt text-2sm text-text-secondary",
      render: (r) => Number(r.quantity) },
    { id: "unit_price", header: "السعر", width: 95,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 number-fmt text-2sm text-text-primary text-center",
      render: (r) => formatMoney(r.unit_price) },
    { id: "line_total", header: "الإجمالي", width: 105,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 number-fmt text-sm text-emerald-700 text-center",
      render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_price) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 135,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-secondary",
      cellClass: "px-2 text-[11px] text-text-secondary number-fmt whitespace-nowrap text-center",
      render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 50, cellClass: "px-2",
      render: (r) => (
        <div className="flex gap-1 justify-center">
          <button onClick={(e) => { e.stopPropagation(); gotoTarget(`/invoices/${r.invoice_id || r.id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
        </div>
      )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="فواتير اليوم" maxWidth="max-w-7xl" onDetach={handleDetach} showDetach={true} modalType="post-today">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-sm border border-slate-700">
            <span className="text-[11px] font-black text-text-muted shrink-0">بحث برقم فاتورة:</span>
            <input ref={docSearchRef} value={docSearch} onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="INV-0001..."
              className="flex-1 rounded-sm border border-slate-600 bg-slate-900 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400" />
            <span className="text-[11px] font-black text-text-muted shrink-0">بحث صنف:</span>
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
                className="w-full rounded-sm border border-slate-600 bg-slate-900 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400" />
              {itemLookupOpen && (
                <LookupList items={filteredItems} onPick={(item) => { setItemSearch(item.code || item.barcode || item.name); setItemLookupOpen(false); }}
                  activeIndex={activeItemIndex} query={itemSearch} />
              )}
            </div>
            <button onClick={() => { setDocSearch(""); setItemSearch(""); setItemLookupOpen(false); }} className="flex items-center gap-1.5 rounded-sm bg-slate-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-slate-600">
              مسح
            </button>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">من</label>
              <input ref={dateFromRef} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: itemSearchRef })}
                className="rounded-sm border border-border-normal bg-bg-surface px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">إلى</label>
              <input ref={dateToRef} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: sortRef, prevRef: dateFromRef })}
                className="rounded-sm border border-border-normal bg-bg-surface px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">ترتيب</label>
              <select ref={sortRef} value={sort} onChange={(e) => setSort(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: userSelectRef, prevRef: dateToRef })}
                className="rounded-sm border border-border-normal bg-bg-surface px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="invoice_no">رقم الفاتورة</option>
                <option value="payment_type">طريقة الدفع</option>
              </select>
              <button onClick={() => setDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-normal bg-bg-surface hover:bg-bg-overlay transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-text-secondary" />
              </button>
            </div>
            {usersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">المستخدم</label>
                <select ref={userSelectRef} value={userId} onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: customerQueryRef, prevRef: sortRef })}
                  className="rounded-sm border border-border-normal bg-bg-surface px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-widest">العميل</label>
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
                className="w-[140px] rounded-sm border border-border-normal bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100" />
              {customerQuery && (
                <button onClick={() => { setCustomerQuery(""); setCustomerId(""); }} className="text-text-muted hover:text-text-secondary">
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
              className="flex items-center gap-1.5 rounded-sm border border-border-normal bg-bg-surface px-3 py-1.5 text-2sm font-black text-text-secondary hover:border-slate-800 hover:text-text-primary transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          {/* Summary strip */}
          <div className="flex items-center gap-0 w-full overflow-x-auto rounded-[8px] bg-bg-overlay border border-border-normal shadow-sm mb-4 flex-nowrap hide-scrollbar">
            <div className="flex flex-col items-center justify-center px-6 py-3 bg-primary/5 shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">عدد الفواتير</span>
              <span className="font-mono text-[22px] font-black text-text-primary leading-none">{summary.count || 0}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center px-6 py-3 shrink-0 border-r border-border-subtle">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">الإجمالي</span>
              <span className="font-mono text-[22px] font-black text-text-primary leading-none">{formatMoney(summary.total || 0)}</span>
            </div>

            {Object.entries(calculatePaymentBreakdown(data, 'payment_type', paymentMethods)).map(([method, amount]) => {
               const info = resolvePaymentStyle(method, paymentMethods);
               return (
                 <div key={method} className="flex flex-col items-center justify-center px-6 py-3 shrink-0 border-r border-border-subtle bg-bg-base">
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">{info.label}</span>
                   <span className="font-mono text-[16px] font-black text-text-secondary leading-none">{formatMoney(amount)}</span>
                 </div>
               );
            })}
          </div>
          <div className="max-h-[420px] overflow-auto rounded-sm border border-border-normal">
            <DataGrid
              data={loading ? [] : (itemSearch.trim() ? rawItems : data)}
              rowKey={itemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد فواتير في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                const invId = r.invoice_id || r.id;
                if (propNavigate && invId) {
                  openDetachedModal("invoice-preview", { invoiceId: invId });
                  return;
                }
                if (itemSearch.trim()) {
                  if (invId) { setPreviewItem({ id: invId, invoice_no: r.invoice_no, customer_name: r.customer_name, total: Number(r.unit_price) * Number(r.quantity), created_at: r.created_at }); setPreviewOpen(true); }
                } else {
                  setPreviewItem(r); setPreviewOpen(true);
                }
              }}
              columns={itemSearch.trim() ? itemColumns : docColumns}
            />
          </div>
        </div>
      </Modal>
      {!propNavigate && (
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة الفاتورة" onDetach={handlePreviewDetach}>
          {previewItem ? <InvoicePreviewModal inv={previewItem} onClose={() => setPreviewOpen(false)} onNavigate={gotoTarget} /> : null}
        </Modal>
      )}
      <ConfirmDialog
        open={voidOpen}
        title={`إلغاء الفاتورة ${voidTarget?.invoice_no || ""}`}
        message={`إلغاء الفاتورة ${voidTarget?.invoice_no || ""}؟ سيتم عكس التأثير على المخزون والخزينة.`}
        onConfirm={confirmVoid}
        onCancel={() => { setVoidOpen(false); setVoidTarget(null); }}
      />
    </>
  );
}
