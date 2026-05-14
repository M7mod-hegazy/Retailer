import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import DataGrid from "../ui/DataGrid";
import ConfirmDialog from "../ui/ConfirmDialog";
import Highlight from "../ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import toast from "react-hot-toast";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-[12px] font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
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
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-emerald-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[10px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const REFUND_LABELS = {
  cash_back: { label: "استرداد نقدي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  credit_note: { label: "إشعار دائن", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

const STATUS_STYLES = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function ReturnPreviewModal({ ret, onClose }) {
  const navigate = useNavigate();
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
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              <span className="font-black text-emerald-800">مرتجع #{detail?.doc_no || ret.doc_no}</span>
              <span className="text-slate-600">العميل: <strong>{(detail || ret).customer_name || "—"}</strong></span>
              <span className="text-slate-500">{(detail || ret).created_at ? formatArabicDateTime(new Date((detail || ret).created_at)) : "—"}</span>
              <span className="font-bold text-emerald-700">الإجمالي: {formatMoney((detail || ret).total)} ج.م</span>
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-[12px] border-collapse">
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
                    <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => navigate(`/sales/returns/${ret.id}`)} className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-[13px] font-black text-white hover:bg-emerald-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح المرتجع
        </button>
      </div>
    </div>
  );
}

export default function SalesReturnTodayModal({ open, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(toDateInput());
  const [dateTo, setDateTo] = useState(toDateInput());
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState("desc");
  const [userId, setUserId] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [docSearch, setDocSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [rawItems, setRawItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim() || !allItems.length) return [];
    return fuzzyFilterRows(allItems, itemSearch, ["name", "code", "barcode"]).slice(0, 8);
  }, [itemSearch, allItems]);

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
    api.get("/api/items").then(r => setAllItems(r.data.data || [])).catch(() => {});
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
    { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "customer_name", header: "العميل", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (r) => r.customer_name || "—" },
    { id: "original_invoice_no", header: "الفاتورة الأصلية", width: 140, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.original_invoice_no || "—" },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[13px] font-black text-emerald-700", render: (r) => formatMoney(r.total) },
    { id: "refund_method", header: "طريقة الرد", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (r) => { const info = REFUND_LABELS[r.refund_method] || REFUND_LABELS.cash_back; return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>; } },
    { id: "status", header: "الحالة", width: 100, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (r) => { const info = STATUS_STYLES[r.status] || STATUS_STYLES.active; return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>; } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (r) => r.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={() => navigate(`/sales/returns/${r.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleCancel(r)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (r) => r.item_name || "—" },
    { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "customer_name", header: "العميل", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.customer_name || "—" },
    { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center font-mono text-[12px] font-bold text-slate-600", render: (r) => Number(r.quantity) },
    { id: "unit_price", header: "السعر", width: 100, cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (r) => formatMoney(r.unit_price) },
    { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 font-mono text-[13px] font-black text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_price) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/returns/${r.return_id || r.id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="مرتجعات المبيعات اليوم" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-sm border border-emerald-200">
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث برقم المستند:</span>
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
              placeholder="SRET-0001..."
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث صنف:</span>
            <div className="relative flex-1">
              <input value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setItemLookupOpen(true); }}
                onFocus={() => setItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); if (filteredItems.length > 0) setActiveItemIndex(i => Math.min(i + 1, filteredItems.length - 1)); setItemLookupOpen(true); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveItemIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (filteredItems.length > 0 && activeItemIndex >= 0) { const picked = filteredItems[activeItemIndex]; setItemSearch(picked.code || picked.barcode || picked.name); setItemLookupOpen(false); } }
                  else if (e.key === "Escape") { setItemLookupOpen(false); }
                }}
                placeholder="اسم الصنف أو الكود..."
                className="w-full rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
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
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">إلى</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">ترتيب</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500">
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
                <select value={userId} onChange={(e) => setUserId(e.target.value)}
                  className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            {/* Customer filter */}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">العميل</label>
              <input type="text" value={customerQuery}
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
                }}
                placeholder="كل العملاء..."
                className="w-[140px] rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
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
            <button onClick={loadData}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">عدد المرتجعات</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المرتجعات</span>
              <span className="font-mono text-[20px] font-black text-emerald-300 leading-none">{formatMoney(summary.total)}</span>
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
        {previewItem ? <ReturnPreviewModal ret={previewItem} onClose={() => setPreviewOpen(false)} /> : null}
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
