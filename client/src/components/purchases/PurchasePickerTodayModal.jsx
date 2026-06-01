import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Package, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import DataGrid from "../ui/DataGrid";
import Highlight from "../ui/Highlight";

const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
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
          <button key={item.id} type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-amber-50/80" : "hover:bg-slate-50"}`}>
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

const PURCHASE_STATUS_STYLES = {
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

function PurchaseDetailView({ purchase, onClose, onConfirm }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!purchase) return;
    setLoading(true);
    const id = purchase.purchase_id || purchase.id;
    api.get(`/api/purchases/${id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(purchase))
      .finally(() => setLoading(false));
  }, [purchase?.purchase_id, purchase?.id]);
  if (!purchase) return null;
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              <span className="font-black text-amber-800">فاتورة #{detail?.doc_no || purchase.doc_no}</span>
              <span className="text-slate-600">المورد: <strong>{(detail || purchase).supplier_name || "—"}</strong></span>
              <span className="text-slate-500">{(detail || purchase).created_at ? formatArabicDateTime(new Date((detail || purchase).created_at)) : "—"}</span>
              <span className="font-bold text-amber-700">الإجمالي: {formatMoney((detail || purchase).total)} ج.م</span>
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
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">مُرتجع</th>
                </tr>
              </thead>
              <tbody>
                {((detail || purchase).lines || []).map((l, i) => {
                  const returned = Number(l.returned_quantity || 0);
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_cost)}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-amber-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                      <td className="px-3 py-2.5 text-center">
                        {returned > 0 ? <span className="text-amber-600 font-black">{returned}</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/purchases/${purchase.purchase_id || purchase.id}`)} className="flex items-center gap-2 rounded-sm border border-amber-200 bg-white px-5 py-2 text-[13px] font-black text-amber-700 hover:bg-amber-50 transition-colors">
            <Pencil className="h-4 w-4" /> عرض
          </button>
          <button onClick={() => onConfirm(detail || purchase)} className="flex items-center gap-2 rounded-sm bg-amber-700 px-6 py-2 text-[13px] font-black text-white hover:bg-amber-800 transition-colors">
            <CheckCircle2 className="h-4 w-4" /> اختيار هذا الأمر
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasePickerTodayModal({ open, onClose, onSelectPurchase, suppliers: propSuppliers }) {
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
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [detailItem, setDetailItem] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const suppliers = propSuppliers || [];

  useEffect(() => {
    const q = itemSearch.trim();
    if (!q) { setFilteredItems([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=8&offset=0`)
        .then(r => setFilteredItems(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierLookupOpen) return [];
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierLookupOpen, supplierQuery, suppliers]);

  function aggregateResults(data) {
    const map = {};
    (data || []).forEach(line => {
      const id = line.purchase_id;
      if (!map[id]) {
        map[id] = {
          id, doc_no: line.doc_no, supplier_name: line.supplier_name,
          supplier_id: line.supplier_id, created_at: line.created_at,
          total: 0, items_count: 0, status: line.status,
          payment_method: line.payment_method,
          created_by_username: line.created_by_username,
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
        const r = await api.get(`/api/purchases/items-search?${params}`);
        const raw = r.data.data || [];
        const aggregated = aggregateResults(raw);
        setData(aggregated);
        setSummary({ count: aggregated.length, total: aggregated.reduce((s, x) => s + x.total, 0) });
      } else {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, sort, dir });
        if (userId) params.set("user_id", userId);
        if (supplierId) params.set("supplier_id", supplierId);
        if (supplierQuery.trim() && !supplierId) params.set("supplier_search", supplierQuery.trim());
        if (docSearch.trim()) params.set("search", docSearch.trim());
        const r = await api.get(`/api/purchases?${params}`);
        let d = r.data.data || [];
        if (supplierQuery.trim() && !supplierId) {
          const q = supplierQuery.trim().toLowerCase();
          d = d.filter((inv) => String(inv.supplier_name || "").toLowerCase().includes(q));
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
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, supplierQuery, supplierId]);

  function handleRowClick(r) {
    setDetailItem(r); setDetailOpen(true);
  }

  const docColumns = [
    { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[12px] font-black text-slate-700", render: (inv) => inv.doc_no },
    { id: "supplier_name", header: "المورد", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[12px] font-bold text-slate-800", render: (inv) => inv.supplier_name || "—" },
    { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-[12px] font-bold text-slate-600", render: (inv) => inv.items_count },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-[13px] font-black text-amber-700", render: (inv) => formatMoney(inv.total) },
    { id: "payment_method", header: "الدفع", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (inv) => {
      if (inv.payment_splits) {
        const splits = inv.payment_splits.split("|||").filter(Boolean).map(s => { const [m, a] = s.split(":"); return { method: (m || "").trim(), amount: Number(a || 0) }; }).filter(s => s.amount > 0);
        if (splits.length) return (
          <div className="flex flex-col gap-0.5">
            {splits.map((s, i) => { const info = PAYMENT_METHOD_STYLES[s.method] || { label: s.method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" }; return (
              <div key={i} className="flex items-center gap-1">
                <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span>
                <span className="text-[10px] font-mono font-bold text-slate-500">{formatMoney(s.amount)}</span>
              </div>
            ); })}
          </div>
        );
      }
      const info = PAYMENT_METHOD_STYLES[inv.payment_method];
      return (
        <div className="flex flex-col gap-0.5">
          {info ? <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${info.cls}`}>{info.label}</span> : <span className="text-[11px] font-bold text-slate-600">{inv.payment_method || "—"}</span>}
          <span className="text-[10px] font-mono font-bold text-slate-500">{formatMoney(inv.total)}</span>
        </div>
      );
    } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (inv) => inv.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="طلبات التوريد — اختيار للمرتجع" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-4">
          {/* Context banner */}
          <div className="flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">أوامر شراء مسجلة</span>
            <span className="text-[10px] text-amber-600 font-bold">— اختر أمر شراء أصلي لإنشاء المرتجع منه.</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-sm border border-amber-200">
            <span className="text-[11px] font-black text-amber-700 shrink-0">بحث برقم المستند:</span>
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
              placeholder="PUR-0001..."
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
                <option value="payment_method">طريقة الدفع</option>
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
                    e.preventDefault(); const next = filteredSuppliers[activeSupplierIndex] || filteredSuppliers[0];
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
          <div className="flex items-center gap-4 rounded-sm bg-amber-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">عدد الفواتير</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-amber-700" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">إجمالي المشتريات</span>
              <span className="font-mono text-[20px] font-black text-amber-300 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-sm border border-amber-200">
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="معاينة أمر الشراء">
        {detailItem ? <PurchaseDetailView purchase={detailItem} onClose={() => setDetailOpen(false)} onConfirm={(p) => { setDetailOpen(false); onSelectPurchase(p); }} /> : null}
      </Modal>
    </>
  );
}
