import React, { useEffect, useMemo, useState, useRef } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach } from "../../hooks/useDetach";
import DataGrid from "../ui/DataGrid";
import ConfirmDialog from "../ui/ConfirmDialog";
import Highlight from "../ui/Highlight";
import toast from "react-hot-toast";
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
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-emerald-50/80" : "hover:bg-slate-50"}`}
          >
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

const REFUND_LABELS = {
  cash_back:    { label: "نقداً",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  credit_note:  { label: "رصيد حساب",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  store_credit: { label: "رصيد حساب",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  split:        { label: "مختلط",        cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const STATUS_STYLES = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function ReturnPreviewModal({ ret, onClose, onNavigate: propNavigate }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!ret) return;
    setLoading(true);
    api.get(`/api/invoices/returns/${ret.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(ret))
      .finally(() => setLoading(false));
  }, [ret?.id]);
  if (!ret) return null;
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-sm bg-emerald-50 border border-emerald-200 px-4 py-3">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-black text-emerald-800">مرتجع #{detail?.doc_no || ret.doc_no}</span>
              <span className="text-slate-600">العميل: <strong>{(detail || ret).customer_name || "—"}</strong></span>
              <span className="text-slate-500">{(detail || ret).created_at ? formatArabicDateTime(new Date((detail || ret).created_at)) : "—"}</span>
              {Number((detail || ret).discount) > 0 && <span className="font-bold text-rose-600">خصم: −{formatMoney((detail || ret).discount)}</span>}
              {Number((detail || ret).increase) > 0 && <span className="font-bold text-emerald-600">زيادة: +{formatMoney((detail || ret).increase)}</span>}
              <span className="font-bold text-emerald-700">صافي المرتجع: {formatMoney((detail || ret).total)} ج.م</span>
            </div>
          </div>
          <div className="max-h-[240px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">السعر</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {((detail || ret).lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_price)}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Payment breakdown card */}
          {detail && (Number(detail.cash_amount || 0) > 0 || Number(detail.credit_amount || 0) > 0) && (
            <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">تفاصيل طريقة الاسترداد</p>
              {Number(detail.cash_amount || 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />نقداً (صندوق)</span>
                  <span className="number-fmt-primary text-emerald-700">{formatMoney(detail.cash_amount)} ج.م</span>
                </div>
              )}
              {Number(detail.credit_amount || 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />رصيد حساب العميل</span>
                  <span className="number-fmt-primary text-blue-700">{formatMoney(detail.credit_amount)} ج.م</span>
                </div>
              )}
            </div>
          )}
          {(detail || ret).notes && (
            <div className="rounded-sm border border-slate-200 bg-amber-50 px-4 py-2.5 text-2sm text-slate-600">
              <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">ملاحظات: </span>{(detail || ret).notes}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => { onClose(); propNavigate?.("/sales/returns/new"); }} className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح وتعديل
        </button>
      </div>
    </div>
  );
}

export default function SalesReturnTodayModal({ open, onClose, initialFilters }) {
  const navigate = useNavigate();
  const gotoTarget = (path) => {
    if (window.location.search.includes("detachedModal=1") && window.electronAPI?.navigateParent) {
      window.electronAPI.navigateParent(path);
      window.electronAPI?.closeModalWindow?.();
    } else {
      navigate(path);
    }
  };
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const handleKeyDown = useFieldNavigation();
  const { handleDetach } = useDetach("sales-return-today", {
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
      const id = line.return_id;
      if (!map[id]) {
        map[id] = {
          id, doc_no: line.doc_no, customer_name: line.customer_name,
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
        if (docSearch.trim()) params.set("doc_search", docSearch.trim());
        if (customerQuery.trim()) params.set("customer_search", customerQuery.trim());
        if (customerId) params.set("customer_id", customerId);
        if (userId) params.set("user_id", userId);
        params.set("date_from", dateFrom);
        params.set("date_to", dateTo);
        const r = await api.get(`/api/invoices/returns/items-search?${params}`);
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
        const r = await api.get(`/api/invoices/returns?${params}`);
        let d = r.data.data || [];
        if (customerQuery.trim() && !customerId) {
          const q = customerQuery.trim().toLowerCase();
          d = d.filter((inv) => String(inv.customer_name || "").toLowerCase().includes(q));
        }
        setData(d);
        setRawItems([]);
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
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, customerQuery, customerId]);

  function handleCancel(ret) {
    setCancelTarget(ret);
    setCancelOpen(true);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await api.post(`/api/invoices/returns/${cancelTarget.id}/cancel`, { reason: "إلغاء من اليوميات" });
      toast.success("تم إلغاء المرتجع");
      setCancelOpen(false);
      setCancelTarget(null);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
      setCancelOpen(false);
    }
  }

  const docColumns = [
    { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "customer_name", header: "العميل", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-2sm font-bold text-slate-800", render: (r) => r.customer_name || "—" },
    { id: "original_invoice_no", header: "الفاتورة الأصلية", width: 140, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.original_invoice_no ? r.original_invoice_no : <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black bg-amber-50 text-amber-700 border-amber-200">مباشر</span> },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 number-fmt-primary text-sm text-emerald-700", render: (r) => formatMoney(r.total) },
    { id: "refund_method", header: "طريقة الرد", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (r) => {
      const info = REFUND_LABELS[r.refund_method] || REFUND_LABELS.cash_back;
      const cashAmt = Number(r.cash_amount || 0);
      const creditAmt = Number(r.credit_amount || 0);
      return (
        <div className="flex flex-col gap-0.5">
          <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
          {r.refund_method === "split" && (<>
            {cashAmt > 0 && <span className="text-[11px] text-emerald-600 font-bold">نقداً: {formatMoney(cashAmt)}</span>}
            {creditAmt > 0 && <span className="text-[11px] text-blue-600 font-bold">رصيد: {formatMoney(creditAmt)}</span>}
          </>)}
          {(r.refund_method === "credit_note" || r.refund_method === "store_credit") && creditAmt > 0 && (
            <span className="text-[11px] text-blue-600 font-bold">رصيد: {formatMoney(creditAmt)}</span>
          )}
          {r.refund_method === "cash_back" && cashAmt > 0 && (
            <span className="text-[11px] text-emerald-600 font-bold">نقداً: {formatMoney(cashAmt)}</span>
          )}
        </div>
      );
    } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (r) => r.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={() => gotoTarget("/sales/returns/new")} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleCancel(r)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-2sm font-bold text-slate-800", render: (r) => r.item_name || "—" },
    { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "customer_name", header: "العميل", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.customer_name || "—" },
    { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center number-fmt text-2sm text-slate-600", render: (r) => Number(r.quantity) },
    { id: "unit_price", header: "السعر", width: 100, cellClass: "px-3 number-fmt text-2sm text-slate-700", render: (r) => formatMoney(r.unit_price) },
    { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 number-fmt text-sm text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_price) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); gotoTarget("/sales/returns/new"); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="سجل مرتجعات المبيعات" maxWidth="max-w-5xl" onDetach={handleDetach} showDetach={true} modalType="sales-return-today">
        <div className="flex flex-col gap-4">
          {/* Context banner */}
          <div className="flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest">سجل المرتجعات المسجلة</span>
            <span className="text-[11px] text-amber-600 font-bold">— هذه قائمة بمرتجعات المبيعات التي تم إنشاؤها مسبقاً، وليست فواتير البيع.</span>
          </div>
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-sm border border-emerald-200">
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث برقم المستند:</span>
            <input ref={docSearchRef} value={docSearch} onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="SRET-0001..."
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث صنف:</span>
            <div className="relative flex-1">
              <input ref={itemSearchRef}
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setItemLookupOpen(true); }}
                onFocus={() => setItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); if (filteredItems.length > 0) setActiveItemIndex(i => Math.min(i + 1, filteredItems.length - 1)); setItemLookupOpen(true); }
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
          {/* Filters */}
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
                <option value="refund_method">طريقة الرد</option>
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
            {/* Customer filter */}
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
                    e.preventDefault();
                    const next = filteredCustomers[activeCustomerIndex] || filteredCustomers[0];
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
          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">عدد المرتجعات</span>
              <span className="number-fmt-primary text-[20px] text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المرتجعات</span>
              <span className="number-fmt-primary text-[20px] text-emerald-300 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>
          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-emerald-200">
            <DataGrid
              data={loading ? [] : (itemSearch.trim() ? rawItems : data)}
              rowKey={itemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد نتائج في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                if (itemSearch.trim()) {
                  if (r.return_id || r.id) { setPreviewItem({ id: r.return_id || r.id, doc_no: r.doc_no, customer_name: r.customer_name, total: Number(r.unit_price) * Number(r.quantity), created_at: r.created_at }); setPreviewOpen(true); }
                } else {
                  setPreviewItem(r); setPreviewOpen(true);
                }
              }}
              columns={itemSearch.trim() ? itemColumns : docColumns}
            />
          </div>
        </div>
      </Modal>
      {/* Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة المرتجع">
        {previewItem ? <ReturnPreviewModal ret={previewItem} onClose={() => setPreviewOpen(false)} onNavigate={gotoTarget} /> : null}
      </Modal>
      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={cancelOpen}
        title={`إلغاء المرتجع ${cancelTarget?.doc_no || ""}`}
        message={`إلغاء المرتجع ${cancelTarget?.doc_no || ""}؟ سيتم عكس التأثير على المخزون والأرصدة.`}
        onConfirm={confirmCancel}
        onCancel={() => { setCancelOpen(false); setCancelTarget(null); }}
      />
    </>
  );
}
