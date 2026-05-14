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
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-amber-50/80" : "hover:bg-slate-50"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-amber-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[10px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const SETTLEMENT_LABELS = {
  account: { label: "حساب", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  cash: { label: "نقدي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
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
    api.get(`/api/purchases/returns/${ret.id}`)
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
          <div className="flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              <span className="font-black text-amber-800">مرتجع #{detail?.doc_no || ret.doc_no}</span>
              <span className="text-slate-600">المورد: <strong>{(detail || ret).supplier_name || "—"}</strong></span>
              <span className="text-slate-500">{(detail || ret).created_at ? formatArabicDateTime(new Date((detail || ret).created_at)) : "—"}</span>
              <span className="font-bold text-amber-700">الإجمالي: {formatMoney((detail || ret).total)} ج.م</span>
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">التكلفة</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {((detail || ret).lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-black text-amber-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => navigate(`/purchases/returns/${ret.id}`)} className="flex items-center gap-2 rounded-sm bg-amber-700 px-6 py-2 text-[13px] font-black text-white hover:bg-amber-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح المرتجع
        </button>
      </div>
    </div>
  );
}

export default function PurchaseReturnTodayModal({ open, onClose }) {
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
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim() || !allItems.length) return [];
    return fuzzyFilterRows(allItems, itemSearch, ["name", "code", "barcode"]).slice(0, 8);
  }, [itemSearch, allItems]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierLookupOpen) return [];
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierLookupOpen, supplierQuery, suppliers]);

  function aggregateResults(data) {
    const map = {};
    (data || []).forEach(line => {
      const id = line.return_id;
      if (!map[id]) {
        map[id] = {
          id, doc_no: line.doc_no, supplier_name: line.supplier_name,
          supplier_id: line.supplier_id, created_at: line.created_at,
          total: 0, items_count: 0, status: line.status,
        };
      }
      map[id].total += Number(line.unit_cost || 0) * Number(line.quantity || 0);
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
        if (supplierQuery.trim()) params.set("supplier_search", supplierQuery.trim());
        if (supplierId) params.set("supplier_id", supplierId);
        if (userId) params.set("user_id", userId);
        params.set("date_from", dateFrom);
        params.set("date_to", dateTo);
        const r = await api.get(`/api/purchases/returns/items-search?${params}`);
        const raw = r.data.data || [];
        setRawItems(raw);
        setData([]);
        const aggregated = aggregateResults(raw);
        setSummary({ count: aggregated.length, total: aggregated.reduce((s, x) => s + x.total, 0) });
      } else {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, sort, dir });
        if (userId) params.set("user_id", userId);
        if (supplierId) params.set("supplier_id", supplierId);
        if (supplierQuery.trim() && !supplierId) params.set("supplier_search", supplierQuery.trim());
        if (docSearch.trim()) params.set("search", docSearch.trim());
        const r = await api.get(`/api/purchases/returns?${params}`);
        let d = r.data.data || [];
        if (supplierQuery.trim() && !supplierId) {
          const q = supplierQuery.trim().toLowerCase();
          d = d.filter((inv) => String(inv.supplier_name || "").toLowerCase().includes(q));
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
    api.get("/api/suppliers?limit=500").then(r => setSuppliers(r.data.data || [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, supplierQuery, supplierId]);

  function handleCancel(ret) {
    setCancelTarget(ret);
    setCancelOpen(true);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await api.post(`/api/purchases/returns/${cancelTarget.id}/cancel`, { reason: "إلغاء من اليوميات" });
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
    { id: "supplier_name", header: "المورد", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (r) => r.supplier_name || "—" },
    { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-[12px] font-bold text-slate-600", render: (r) => r.items_count },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[13px] font-black text-amber-700", render: (r) => formatMoney(r.total) },
    { id: "settlement_type", header: "التسوية", width: 110, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (r) => { const info = SETTLEMENT_LABELS[r.settlement_type] || SETTLEMENT_LABELS.account; return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>; } },
    { id: "status", header: "الحالة", width: 100, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (r) => { const info = STATUS_STYLES[r.status] || STATUS_STYLES.active; return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>; } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (r) => r.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={() => navigate(`/purchases/returns/${r.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleCancel(r)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (r) => r.item_name || "—" },
    { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "supplier_name", header: "المورد", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.supplier_name || "—" },
    { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center font-mono text-[12px] font-bold text-slate-600", render: (r) => Number(r.quantity) },
    { id: "unit_cost", header: "التكلفة", width: 100, cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (r) => formatMoney(r.unit_cost) },
    { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 font-mono text-[13px] font-black text-amber-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_cost) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/purchases/returns/${r.return_id || r.id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="مرتجعات اليوم" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-sm border border-amber-200">
            <span className="text-[11px] font-black text-amber-700 shrink-0">بحث برقم المستند:</span>
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
              placeholder="RET-0001..."
              className="flex-1 rounded-sm border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            <span className="text-[11px] font-black text-amber-700 shrink-0">بحث صنف:</span>
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
                className="w-full rounded-sm border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              {itemLookupOpen && (
                <LookupList items={filteredItems} onPick={(item) => { setItemSearch(item.code || item.barcode || item.name); setItemLookupOpen(false); }}
                  activeIndex={activeItemIndex} query={itemSearch} />
              )}
            </div>
            <button onClick={() => { setDocSearch(""); setItemSearch(""); setItemLookupOpen(false); }} className="flex items-center gap-1.5 rounded-sm bg-amber-200 px-3 py-1.5 text-[11px] font-black text-amber-800 hover:bg-amber-300">
              مسح
            </button>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">من</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-sm border border-amber-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">إلى</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-sm border border-amber-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">ترتيب</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="rounded-sm border border-amber-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="doc_no">رقم المستند</option>
                <option value="settlement_type">طريقة التسوية</option>
              </select>
              <button onClick={() => setDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-amber-200 bg-white hover:bg-amber-100 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-amber-600" />
              </button>
            </div>
            {usersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">المستخدم</label>
                <select value={userId} onChange={(e) => setUserId(e.target.value)}
                  className="rounded-sm border border-amber-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            {/* Supplier filter */}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">المورد</label>
              <input type="text" value={supplierQuery}
                onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setActiveSupplierIndex(0); if (!e.target.value) setSupplierId(""); }}
                onFocus={() => setSupplierLookupOpen(true)}
                onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                onKeyDown={(e) => {
                  if (!supplierLookupOpen && e.key === "ArrowDown") { setSupplierLookupOpen(true); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "ArrowDown") { e.preventDefault(); setActiveSupplierIndex((v) => Math.min(v + 1, filteredSuppliers.length - 1)); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "ArrowUp") { e.preventDefault(); setActiveSupplierIndex((v) => Math.max(v - 1, 0)); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "Enter") {
                    e.preventDefault();
                    const next = filteredSuppliers[activeSupplierIndex] || filteredSuppliers[0];
                    setSupplierQuery(next.name); setSupplierId(next.id); setSupplierLookupOpen(false); return;
                  }
                  if (e.key === "Escape") setSupplierLookupOpen(false);
                }}
                placeholder="كل الموردين..."
                className="w-[140px] rounded-sm border border-amber-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              {supplierQuery && (
                <button onClick={() => { setSupplierQuery(""); setSupplierId(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {supplierLookupOpen && (
                <LookupList items={filteredSuppliers} onPick={(s) => { setSupplierQuery(s.name); setSupplierId(s.id); setSupplierLookupOpen(false); }}
                  activeIndex={activeSupplierIndex} query={supplierQuery} emptyLabel="لا توجد نتائج" />
              )}
            </div>
            <button onClick={loadData}
              className="flex items-center gap-1.5 rounded-sm border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-black text-amber-700 hover:bg-amber-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-amber-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">عدد المرتجعات</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-amber-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">إجمالي المرتجعات</span>
              <span className="font-mono text-[20px] font-black text-amber-300 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>
          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-amber-200">
            <DataGrid
              data={loading ? [] : (itemSearch.trim() ? rawItems : data)}
              rowKey={itemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد نتائج في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                if (itemSearch.trim()) {
                  if (r.return_id || r.id) { setPreviewItem({ id: r.return_id || r.id, doc_no: r.doc_no, supplier_name: r.supplier_name, total: Number(r.unit_cost) * Number(r.quantity), created_at: r.created_at }); setPreviewOpen(true); }
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
