import React, { useEffect, useMemo, useState } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useDetach } from "../../hooks/useDetach";
import DataGrid from "../ui/DataGrid";
import ConfirmDialog from "../ui/ConfirmDialog";
import SearchDropdown from "../ui/SearchDropdown";
import toast from "react-hot-toast";
import { formatNumber } from "../../utils/currency";
import { scoredFilterRows } from "../../utils/search";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const PAYMENT_METHOD_STYLES = {
  cash: { label: "نقدي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  bank_transfer: { label: "حوالة بنكية", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  credit: { label: "آجل", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  future_due: { label: "استحقاق لاحق", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  multi: { label: "متعدد", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export function PurchasePreviewModal({ purchase, onClose, onNavigate: propNavigate }) {
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
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className="rounded-sm bg-emerald-50 border border-emerald-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="font-black text-emerald-800">فاتورة #{detail?.doc_no || purchase.doc_no}</span>
            <span className="text-slate-600">المورد: <strong>{(detail || purchase).supplier_name || "—"}</strong></span>
            <span className="text-slate-500">{(detail || purchase).created_at ? formatArabicDateTime(new Date((detail || purchase).created_at)) : "—"}</span>
            {(detail || purchase).created_by_username && (
              <span className="text-slate-500">بواسطة: <strong>{(detail || purchase).created_by_username}</strong></span>
            )}
            <span className="font-bold text-emerald-700">الإجمالي: {formatMoney((detail || purchase).total)} ج.م</span>
          </div>
          <div className="max-h-[260px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
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
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || l.code || l.barcode || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_cost)}</td>
                      <td className="px-3 py-2.5 text-center number-fmt-primary text-emerald-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                      <td className="px-3 py-2.5 text-center">
                        {returned > 0 ? <span className="text-amber-600 font-black">{returned}</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
              {Number((detail || purchase).discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">خصم</span>
                  <span className="number-fmt-primary text-rose-600">- {formatMoney((detail || purchase).discount)}</span>
                </div>
              )}
              {Number((detail || purchase).increase) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">إضافة</span>
                  <span className="number-fmt-primary text-emerald-600">+ {formatMoney((detail || purchase).increase)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-black text-slate-800">الإجمالي</span>
                <span className="number-fmt-primary text-slate-900">{formatMoney((detail || purchase).total)} ج.م</span>
              </div>
            </div>
            {detail?.payments?.length > 0 && (
              <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">تفاصيل الدفع</p>
                {detail.payments.map((p, i) => {
                  const PSTYLE = { cash: "text-emerald-700", bank_transfer: "text-sky-700", credit: "text-amber-700", future_due: "text-orange-700" };
                  return (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-slate-600">{p.method_name || p.method_type || "—"}</span>
                      <span className={`number-fmt-primary ${PSTYLE[p.method_type] || "text-slate-800"}`}>{formatMoney(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {(detail || purchase).notes && (
            <div className="rounded-sm border border-slate-200 bg-amber-50/40 px-4 py-3">
              <p className="text-[11px] font-bold text-slate-500 mb-1">ملاحظات</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{(detail || purchase).notes}</p>
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose}
          className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">
          رجوع
        </button>
        <button onClick={() => gotoTarget(`/purchases/${purchase.purchase_id || purchase.id}`)}
          className="flex items-center gap-2 rounded-sm bg-emerald-700 px-6 py-2 text-sm font-black text-white hover:bg-emerald-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح الفاتورة
        </button>
      </div>
    </div>
  );
}

export default function TodayPurchasesModal({ open, onClose, onNavigate: propNavigate, initialFilters }) {
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
  const { handleDetach } = useDetach("purchases-today", {
    onClose,
    getState: () => ({
      dateFrom, dateTo, sort, dir, userId, docSearch, itemSearch, supplierQuery, supplierId,
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
  const { handleDetach: handlePreviewDetach } = useDetach("purchase-preview", {
    onClose: () => setPreviewOpen(false),
    getState: () => ({ purchase: previewInvoice }),
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
  const [purchases, setPurchases] = useState([]);
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
  const [allItems, setAllItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [supplierQuery, setSupplierQuery] = useState(initialFilters?.supplierQuery ?? "");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);
  const [supplierId, setSupplierId] = useState(initialFilters?.supplierId ?? "");
  const [suppliers, setSuppliers] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim();
    if (!q || !allItems.length) return [];
    return scoredFilterRows(allItems, q, ["name", "code", "barcode"]);
  }, [itemSearch, allItems]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierLookupOpen) return [];
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q)).slice(0, 8);
  }, [supplierLookupOpen, supplierQuery, suppliers]);

  function aggregatePurchaseResults(data) {
    const map = {};
    (data || []).forEach(line => {
      const id = line.purchase_id;
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
        const r = await api.get(`/api/purchases/items-search?${params}`);
        const raw = r.data.data || [];
        setRawItems(raw);
        setPurchases([]);
        const aggregated = aggregatePurchaseResults(raw);
        setSummary({ count: aggregated.length, total: aggregated.reduce((s, x) => s + x.total, 0) });
      } else {
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, sort, dir });
        if (userId) params.set("user_id", userId);
        if (supplierId) params.set("supplier_id", supplierId);
        if (supplierQuery.trim() && !supplierId) {
          params.set("supplier_search", supplierQuery.trim());
        }
        if (docSearch.trim()) params.set("search", docSearch.trim());
        const r = await api.get(`/api/purchases?${params}`);
        let d = r.data.data || [];
        if (supplierQuery.trim() && !supplierId) {
          const q = supplierQuery.trim().toLowerCase();
          d = d.filter((inv) => String(inv.supplier_name || "").toLowerCase().includes(q));
        }
        setPurchases(d);
        setRawItems([]);
        setSummary(r.data.summary || { count: 0, total: 0 });
      }
    } catch (e) { console.error("loadData error:", e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
    api.get("/api/items").then(r => setAllItems(r.data.data || [])).catch(() => {});
    if (!usersList.length) {
      api.get("/api/users").then(r => setUsersList(r.data.data || [])).catch(() => {});
    }
    if (!suppliers.length) {
      api.get("/api/suppliers").then(r => setSuppliers(r.data.data || [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [open, dateFrom, dateTo, sort, dir, userId, itemSearch, docSearch, supplierQuery, supplierId]);

  function handleVoid(inv) {
    setVoidTarget(inv);
    setVoidOpen(true);
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    try {
      await api.post(`/api/purchases/${voidTarget.id}/void`);
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
    { id: "doc_no", header: "رقم المستند", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (inv) => inv.doc_no },
    { id: "supplier_name", header: "المورد", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-2sm font-bold text-slate-800", render: (inv) => inv.supplier_name || "—" },
    { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-2sm font-bold text-slate-600", render: (inv) => inv.items_count },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 number-fmt-primary text-sm text-emerald-700", render: (inv) => formatMoney(inv.total) },
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
      const info = PAYMENT_METHOD_STYLES[inv.payment_method] || { label: inv.payment_method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" };
      return (
        <div className="flex flex-col gap-0.5">
          <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
          <span className="text-[11px] number-fmt text-slate-500">{formatMoney(inv.total)}</span>
        </div>
      );
    }},
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (inv) => inv.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
    { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (inv) => (
      <div className="flex gap-1">
        <button onClick={() => gotoTarget(`/purchases/${inv.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح الفاتورة"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={() => handleVoid(inv)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-2sm font-bold text-slate-800", render: (r) => r.item_name || "—" },
    { id: "doc_no", header: "المستند", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.doc_no || "—" },
    { id: "supplier_name", header: "المورد", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.supplier_name || "—" },
    { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center number-fmt text-2sm text-slate-600", render: (r) => Number(r.quantity) },
    { id: "unit_cost", header: "التكلفة", width: 100, cellClass: "px-3 number-fmt text-2sm text-slate-700", render: (r) => formatMoney(r.unit_cost) },
    { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 number-fmt-primary text-sm text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_cost) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); gotoTarget(`/purchases/${r.purchase_id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح الفاتورة"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="مشتريات اليوم" maxWidth="max-w-5xl" onDetach={handleDetach} showDetach={true} modalType="purchases-today">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-sm border border-emerald-200">
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث برقم المستند:</span>
            <input
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              placeholder="PUR-0001..."
              className="flex-1 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="text-[11px] font-black text-emerald-700 shrink-0">بحث صنف:</span>
            <div className="relative flex-1">
              <input
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setItemLookupOpen(true); }}
                onFocus={() => setItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveItemIndex(i => Math.min(i + 1, filteredItems.length - 1)); setItemLookupOpen(true); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveItemIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (filteredItems.length > 0 && activeItemIndex >= 0) { const picked = filteredItems[activeItemIndex]; setItemSearch(picked.code || picked.barcode || picked.name); setItemLookupOpen(false); } }
                  else if (e.key === "Escape") { setItemLookupOpen(false); }
                }}
                placeholder="اسم الصنف أو الكود..."
                className="w-full rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {itemLookupOpen && (
                <SearchDropdown items={filteredItems} onPick={(item) => { setItemSearch(item.code || item.barcode || item.name); setItemLookupOpen(false); }}
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
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">إلى</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">ترتيب</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
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
                <select value={userId} onChange={(e) => setUserId(e.target.value)}
                  className="rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            {/* Supplier filter */}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">المورد</label>
              <input
                type="text"
                value={supplierQuery}
                onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setActiveSupplierIndex(0); if (!e.target.value) { setSupplierId(""); } }}
                onFocus={() => setSupplierLookupOpen(true)}
                onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                onKeyDown={(e) => {
                  if (!supplierLookupOpen && e.key === "ArrowDown") { setSupplierLookupOpen(true); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "ArrowDown") { e.preventDefault(); setActiveSupplierIndex((v) => Math.min(v + 1, filteredSuppliers.length - 1)); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "ArrowUp") { e.preventDefault(); setActiveSupplierIndex((v) => Math.max(v - 1, 0)); return; }
                  if (supplierLookupOpen && filteredSuppliers.length && e.key === "Enter") {
                    e.preventDefault();
                    const next = filteredSuppliers[activeSupplierIndex] || filteredSuppliers[0];
                    setSupplierQuery(next.name);
                    setSupplierId(next.id);
                    setSupplierLookupOpen(false);
                    return;
                  }
                  if (e.key === "Escape") { setSupplierLookupOpen(false); }
                }}
                placeholder="كل الموردين..."
                className="w-[140px] rounded-sm border border-emerald-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {supplierQuery && (
                <button onClick={() => { setSupplierQuery(""); setSupplierId(""); }} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {supplierLookupOpen && (
                <SearchDropdown
                  items={filteredSuppliers}
                  onPick={(s) => { setSupplierQuery(s.name); setSupplierId(s.id); setSupplierLookupOpen(false); }}
                  activeIndex={activeSupplierIndex}
                  query={supplierQuery}
                  emptyLabel="لا توجد نتائج"
                />
              )}
            </div>
            <button onClick={loadData}
              className="flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-2sm font-black text-emerald-700 hover:bg-emerald-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>

          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-emerald-800 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">عدد الفواتير</span>
              <span className="number-fmt-primary text-[20px] text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-emerald-700" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">إجمالي المشتريات</span>
              <span className="number-fmt-primary text-[20px] text-emerald-300 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-emerald-200">
            <DataGrid
              data={loading ? [] : (itemSearch.trim() ? rawItems : purchases)}
              rowKey={itemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد نتائج في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                if (itemSearch.trim()) {
                  if (r.purchase_id) { setPreviewInvoice({ id: r.purchase_id, purchase_id: r.purchase_id, doc_no: r.doc_no, supplier_name: r.supplier_name, total: Number(r.unit_cost) * Number(r.quantity), created_at: r.created_at }); setPreviewOpen(true); }
                } else {
                  setPreviewInvoice(r); setPreviewOpen(true);
                }
              }}
              columns={itemSearch.trim() ? itemColumns : docColumns}
            />
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة الفاتورة" maxWidth="max-w-4xl" onDetach={handlePreviewDetach} showDetach={true}>
        {previewInvoice ? <PurchasePreviewModal purchase={previewInvoice} onClose={() => setPreviewOpen(false)} onNavigate={propNavigate} /> : null}
      </Modal>

      <ConfirmDialog
        open={voidOpen}
        title={`إلغاء الفاتورة ${voidTarget?.doc_no || ""}`}
        message={`إلغاء الفاتورة ${voidTarget?.doc_no || ""}؟ سيتم عكس التأثير على المخزون والأرصدة.`}
        onConfirm={confirmVoid}
        onCancel={() => { setVoidOpen(false); setVoidTarget(null); }}
      />
    </>
  );
}
