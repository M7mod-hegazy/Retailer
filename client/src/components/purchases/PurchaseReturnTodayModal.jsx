import React, { useEffect, useMemo, useState, useRef } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach, openDetachedModal } from "../../hooks/useDetach";
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
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}
function toDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-border-subtle bg-bg-surface/95 backdrop-blur-md p-4 text-center text-2sm font-bold text-text-muted shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-border-subtle bg-bg-surface/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-amber-50/80" : "hover:bg-bg-overlay"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-border-normal" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-bg-overlay flex items-center justify-center border border-border-normal"><Package className="w-4 h-4 text-text-muted" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-black ${activeIndex === i ? "text-amber-900" : "text-text-primary"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[11px] text-text-muted font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const SETTLEMENT_LABELS = {
  account: { label: "حساب المورد", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  cash:    { label: "نقداً",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  split:   { label: "مختلط",       cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const STATUS_STYLES = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", cls: "bg-bg-overlay text-text-secondary border-border-normal" },
};

export function ReturnPreviewModal({ ret, onClose, onNavigate: propNavigate }) {
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
        <div className="flex items-center justify-center h-32 text-text-muted font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-sm bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-black text-amber-800">مرتجع #{detail?.doc_no || ret.doc_no}</span>
              <span className="text-text-secondary">المورد: <strong>{(detail || ret).supplier_name || "—"}</strong></span>
              <span className="text-text-secondary">{(detail || ret).created_at ? formatArabicDateTime(new Date((detail || ret).created_at)) : "—"}</span>
              {Number((detail || ret).discount) > 0 && <span className="font-bold text-rose-600">خصم: −{formatMoney((detail || ret).discount)}</span>}
              {Number((detail || ret).increase) > 0 && <span className="font-bold text-emerald-600">زيادة: +{formatMoney((detail || ret).increase)}</span>}
              <span className="font-bold text-amber-700">صافي المرتجع: {formatMoney((detail || ret).total)} ج.م</span>
            </div>
          </div>
          <div className="max-h-[240px] overflow-auto rounded-sm border border-border-normal">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-bg-overlay border-b border-border-normal sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-text-secondary">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-text-secondary">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-text-secondary">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-text-secondary">التكلفة</th>
                  <th className="px-3 py-2.5 text-center font-black text-text-secondary">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {((detail || ret).lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-bg-overlay">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-text-secondary">{l.item_code || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-text-primary">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-text-secondary">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-text-secondary">{formatMoney(l.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-amber-700">{formatMoney(l.line_total || (l.quantity * l.unit_cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Payment breakdown */}
          {detail && (detail.settlement_type === "split" ? (
            <div className="rounded-sm border border-border-normal bg-bg-overlay px-4 py-3 space-y-1.5 text-2sm">
              <p className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-2">تفاصيل طريقة التسوية</p>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">نقداً</span>
                <span className="number-fmt-primary text-emerald-700">{formatMoney(detail.cash_amount)} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">رصيد حساب</span>
                <span className="number-fmt-primary text-amber-700">{formatMoney(detail.credit_amount)} ج.م</span>
              </div>
            </div>
          ) : detail.settlement_type === "cash" ? (
            <div className="rounded-sm border border-border-normal bg-bg-overlay px-4 py-3 space-y-1.5 text-2sm">
              <p className="text-[11px] font-black text-text-muted uppercase tracking-widest mb-2">طريقة التسوية</p>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">نقداً</span>
                <span className="number-fmt-primary text-emerald-700">{formatMoney(detail.total)} ج.م</span>
              </div>
            </div>
          ) : null)}
          {(detail || ret).notes && (
            <div className="rounded-sm border border-border-normal bg-amber-50 px-4 py-2.5 text-2sm text-text-secondary">
              <span className="font-black text-text-secondary text-[11px] uppercase tracking-widest">ملاحظات: </span>{(detail || ret).notes}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-border-normal pt-4">
        <button onClick={onClose} className="rounded-sm border border-border-normal px-5 py-2 text-sm font-bold text-text-secondary hover:bg-bg-overlay">رجوع</button>
        <button onClick={() => { onClose(); propNavigate?.("/purchases/returns/new"); }} className="flex items-center gap-2 rounded-sm bg-amber-700 px-6 py-2 text-sm font-black text-white hover:bg-amber-800 transition-colors">
          <Pencil className="h-4 w-4" /> فتح وتعديل
        </button>
      </div>
    </div>
  );
}

export default function PurchaseReturnTodayModal({ open, onClose, onNavigate: propNavigate, initialFilters }) {
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
  const [summary, setSummary] = useState({ count: 0, total: 0, byMethod: {} });
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
  const [supplierQuery, setSupplierQuery] = useState(initialFilters?.supplierQuery ?? "");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);
  const [supplierId, setSupplierId] = useState(initialFilters?.supplierId ?? "");
  const [suppliers, setSuppliers] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const handleKeyDown = useFieldNavigation();
  const { handleDetach } = useDetach("purchase-return-today", {
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
  const { handleDetach: handlePurchaseReturnPreviewDetach } = useDetach("purchase-return-preview", {
    onClose: () => setPreviewOpen(false),
    getState: () => ({ ret: previewItem }),
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
  const docSearchRef = useRef(null);
  const itemSearchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const sortRef = useRef(null);
  const userSelectRef = useRef(null);
  const supplierQueryRef = useRef(null);
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
    { id: "doc_no", header: "رقم المستند", width: 145, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 font-mono text-2sm font-black text-text-primary text-center",
      render: (r) => r.doc_no || "—" },
    { id: "supplier_name", header: "المورد", width: 150, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-2sm font-bold text-text-primary text-center",
      render: (r) => r.supplier_name || "—" },
    { id: "original_purchase_no", header: "أمر الشراء", width: 148, sortable: false,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 font-mono text-[11px] font-bold text-text-secondary text-center",
      render: (r) => r.original_purchase_no ? r.original_purchase_no : <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black bg-warning-bg text-warning-text border-warning-border">مباشر</span> },
    { id: "total", header: "الإجمالي", width: 110, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 number-fmt-primary text-sm text-warning-text text-center",
      render: (r) => formatMoney(r.total) },
    { id: "settlement_type", header: "طريقة التسوية", width: 160, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2",
      render: (r) => {
        const settlementType = r.settlement_type || "account";
        const info = SETTLEMENT_LABELS[settlementType] || SETTLEMENT_LABELS.account;
        const isSplit = settlementType === "split";
        const cashAmt = isSplit ? Number(r.cash_amount || 0) : 0;
        const creditAmt = isSplit ? Number(r.credit_amount || 0) : 0;
        return (
          <div className="flex flex-col gap-0.5 items-center">
            <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
            {isSplit && (
              <div className="flex flex-col gap-0.5 items-center">
                <span className="text-[11px] font-bold text-success-text">نقداً: {formatMoney(cashAmt)}</span>
                <span className="text-[11px] font-bold text-warning-text">حساب: {formatMoney(creditAmt)}</span>
              </div>
            )}
          </div>
        );
      } },
    { id: "created_by", header: "المستخدم", width: 100, sortable: false,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-[11px] font-bold text-text-secondary whitespace-nowrap text-center",
      render: (r) => r.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 140, sortable: true,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-[11px] text-text-muted number-fmt whitespace-nowrap text-center",
      render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 70, headerClass: "px-2", cellClass: "px-2",
      render: (r) => (
        <div className="flex gap-1 justify-center">
          <button onClick={() => gotoTarget("/purchases/returns/new")} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-blue-50 hover:text-blue-600" title="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => handleCancel(r)} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 100,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 font-mono text-[11px] font-bold text-text-secondary text-center",
      render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 170,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-2sm font-bold text-text-primary text-center",
      render: (r) => r.item_name || "—" },
    { id: "doc_no", header: "المستند", width: 130,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 font-mono text-[11px] font-black text-text-primary text-center",
      render: (r) => r.doc_no || "—" },
    { id: "supplier_name", header: "المورد", width: 120,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-[11px] font-bold text-text-secondary text-center",
      render: (r) => r.supplier_name || "—" },
    { id: "quantity", header: "الكمية", width: 70,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-center number-fmt text-2sm text-text-secondary",
      render: (r) => Number(r.quantity) },
    { id: "unit_cost", header: "التكلفة", width: 95,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 number-fmt text-2sm text-text-primary text-center",
      render: (r) => formatMoney(r.unit_cost) },
    { id: "line_total", header: "الإجمالي", width: 105,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 number-fmt text-sm text-warning-text text-center",
      render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_cost) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 135,
      headerClass: "text-center px-2 font-black uppercase tracking-widest text-text-muted",
      cellClass: "px-2 text-[11px] text-text-muted number-fmt whitespace-nowrap text-center",
      render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 50, cellClass: "px-2",
      render: (r) => (
        <div className="flex gap-1 justify-center">
          <button onClick={(e) => { e.stopPropagation(); gotoTarget("/purchases/returns/new"); }} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-blue-50 hover:text-blue-600" title="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
        </div>
      )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="سجل مرتجعات المشتريات" maxWidth="max-w-7xl" onDetach={handleDetach} showDetach={true} modalType="purchase-return-today">
        <div className="flex flex-col gap-4">
          {/* Context banner */}
          <div className="flex items-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest">سجل المرتجعات المسجلة</span>
            <span className="text-[11px] text-amber-600 font-bold">— هذه قائمة بمرتجعات المشتريات التي تم إنشاؤها مسبقاً، وليست طلبات التوريد.</span>
          </div>
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-sm border border-amber-200">
            <span className="text-[11px] font-black text-amber-700 shrink-0">بحث برقم المستند:</span>
            <input ref={docSearchRef} value={docSearch} onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="RET-0001..."
              className="flex-1 rounded-sm border border-amber-200 bg-bg-surface px-3 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            <span className="text-[11px] font-black text-amber-700 shrink-0">بحث صنف:</span>
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
                className="w-full rounded-sm border border-amber-200 bg-bg-surface px-3 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
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
              <input ref={dateFromRef} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: itemSearchRef })}
                className="rounded-sm border border-amber-200 bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">إلى</label>
              <input ref={dateToRef} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: sortRef, prevRef: dateFromRef })}
                className="rounded-sm border border-amber-200 bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">ترتيب</label>
              <select ref={sortRef} value={sort} onChange={(e) => setSort(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: userSelectRef, prevRef: dateToRef })}
                className="rounded-sm border border-amber-200 bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="doc_no">رقم المستند</option>
                <option value="settlement_type">طريقة التسوية</option>
              </select>
              <button onClick={() => setDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-amber-200 bg-bg-surface hover:bg-amber-100 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-amber-600" />
              </button>
            </div>
            {usersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">المستخدم</label>
                <select ref={userSelectRef} value={userId} onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: supplierQueryRef, prevRef: sortRef })}
                  className="rounded-sm border border-amber-200 bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            {/* Supplier filter */}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest">المورد</label>
              <input ref={supplierQueryRef} type="text" value={supplierQuery}
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
                  handleKeyDown(e, { nextRef: submitBtnRef, prevRef: userSelectRef });
                }}
                placeholder="كل الموردين..."
                className="w-[140px] rounded-sm border border-amber-200 bg-bg-surface px-2 py-1.5 text-2sm font-bold text-text-primary outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              {supplierQuery && (
                <button onClick={() => { setSupplierQuery(""); setSupplierId(""); }} className="text-text-muted hover:text-text-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {supplierLookupOpen && (
                <LookupList items={filteredSuppliers} onPick={(s) => { setSupplierQuery(s.name); setSupplierId(s.id); setSupplierLookupOpen(false); }}
                  activeIndex={activeSupplierIndex} query={supplierQuery} emptyLabel="لا توجد نتائج" />
              )}
            </div>
            <button ref={submitBtnRef} onClick={loadData}
              onKeyDown={e => handleKeyDown(e, { prevRef: supplierQueryRef })}
              className="flex items-center gap-1.5 rounded-sm border border-amber-200 bg-bg-surface px-3 py-1.5 text-2sm font-black text-amber-700 hover:bg-amber-100 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          {/* Summary strip */}
          <div className="flex items-center gap-0 rounded-sm bg-bg-overlay overflow-hidden border border-border-subtle">
            <div className="flex flex-col items-center px-4 py-3 shrink-0">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">عدد المرتجعات</span>
              <span className="font-mono text-[22px] font-black text-text-primary leading-none">{summary.count}</span>
            </div>
            <div className="h-10 w-px bg-border-subtle shrink-0" />
            <div className="flex flex-col items-center px-4 py-3 shrink-0">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">إجمالي المرتجعات</span>
              <span className="font-mono text-[22px] font-black text-warning-text leading-none">{formatMoney(summary.total)}</span>
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
                if (propNavigate && (r.return_id || r.id)) {
                  openDetachedModal("purchase-return-preview", { ret: r });
                  return;
                }
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
      {!propNavigate && (
        <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة المرتجع" onDetach={handlePurchaseReturnPreviewDetach} showDetach={true}>
          {previewItem ? <ReturnPreviewModal ret={previewItem} onClose={() => setPreviewOpen(false)} onNavigate={gotoTarget} /> : null}
        </Modal>
      )}
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
