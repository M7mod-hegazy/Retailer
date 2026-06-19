import React, { useEffect, useMemo, useState, useRef } from "react";
import { X, RefreshCw, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import DataGrid from "../ui/DataGrid";
import ConfirmDialog from "../ui/ConfirmDialog";
import Highlight from "../ui/Highlight";
import toast from "react-hot-toast";
import PermissionGate from "../ui/PermissionGate";
import { formatNumber } from "../../utils/currency";

import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { todayCairo } from "../../utils/dateHelpers";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}
function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
function toDateInput(date = new Date()) {
  return todayCairo(date);
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
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-slate-200/80" : "hover:bg-slate-50"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300" /></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-sm font-black ${activeIndex === i ? "text-slate-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[11px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
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
  voided:  { label: "ملغي",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const PAYMENT_LABELS_PREVIEW = {
  cash: "نقدي", bank_transfer: "حوالة بنكية", credit: "آجل",
  installments: "أقساط", multi: "متعدد",
};

const STATUS_PREVIEW = {
  paid:      { label: "مدفوع",  cls: "bg-emerald-100 text-emerald-700" },
  partial:   { label: "جزئي",   cls: "bg-amber-100 text-amber-700" },
  cancelled: { label: "ملغي",   cls: "bg-slate-100 text-slate-500" },
  unpaid:    { label: "آجل",    cls: "bg-rose-100 text-rose-700" },
};

function InvoicePreviewModal({ inv, onClose }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!inv) return;
    setLoading(true);
    api.get(`/api/invoices/${inv.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(inv))
      .finally(() => setLoading(false));
  }, [inv?.id]);
  if (!inv) return null;
  const d = detail || inv;
  const statusInfo = STATUS_PREVIEW[d.status] || STATUS_PREVIEW.unpaid;
  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          {/* Header info */}
          <div className="rounded-sm bg-slate-100 border border-slate-200 px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <span className="font-black text-slate-800">فاتورة #{d.invoice_no}</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${statusInfo.cls}`}>{statusInfo.label}</span>
            <span className="text-slate-600">العميل: <strong>{d.customer_name || "زبون نقدي"}</strong></span>
            <span className="text-slate-500">{d.created_at ? formatArabicDateTime(new Date(d.created_at)) : "—"}</span>
            {d.created_by_username && <span className="text-slate-500">بواسطة: <strong>{d.created_by_username}</strong></span>}
            <span className="font-bold text-slate-700">طريقة الدفع: {PAYMENT_LABELS_PREVIEW[d.payment_type] || d.payment_type || "—"}</span>
          </div>

          {/* Lines table */}
          <div className="max-h-[260px] overflow-auto rounded-sm border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">السعر</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">خصم</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(d.lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name_ar || l.item_name || l.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{l.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{formatMoney(l.unit_price)}</td>
                    <td className="px-3 py-2.5 text-center text-amber-600">{l.discount > 0 ? formatMoney(l.discount) : "—"}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-slate-700">{formatMoney(l.line_total || (l.quantity * l.unit_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + Payments row */}
          <div className="flex gap-3 flex-wrap">
            {/* Summary */}
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

            {/* Payments breakdown */}
            {d.payments?.length > 0 && (
              <div className="flex-1 min-w-[160px] rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-2sm">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">المدفوعات</p>
                {d.payments.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-slate-600">{p.method_name || PAYMENT_LABELS_PREVIEW[p.method] || p.method}</span>
                    <span className="number-fmt-primary text-slate-800">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {d.notes && (
            <div className="rounded-sm border border-slate-200 bg-amber-50 px-4 py-2.5 text-2sm text-slate-600">
              <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">ملاحظات: </span>{d.notes}
            </div>
          )}

          {/* Cancel reason */}
          {d.status === "cancelled" && d.cancel_reason && (
            <div className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-2.5 text-2sm text-rose-700">
              <span className="font-black text-[11px] uppercase tracking-widest">سبب الإلغاء: </span>{d.cancel_reason}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-sm border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => navigate(`/invoices/${inv.id}`)} className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2 text-sm font-black text-white hover:bg-primary-600 transition-colors">
          <Pencil className="h-4 w-4" /> فتح الفاتورة
        </button>
      </div>
    </div>
  );
}

export default function POSTodayModal({ open, onClose }) {
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
  const [filteredItems, setFilteredItems] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [customerId, setCustomerId] = useState("");
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
    { id: "invoice_no", header: "رقم الفاتورة", width: 140, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 font-mono text-2sm font-black text-slate-700", render: (inv) => inv.invoice_no },
    { id: "customer_name", header: "العميل", width: 160, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-2sm font-bold text-slate-800", render: (inv) => inv.customer_name || "زبون نقدي" },
    { id: "items_count", header: "الأصناف", width: 80, sortable: true, headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-center text-2sm font-bold text-slate-600", render: (inv) => inv.items_count },
    { id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 number-fmt-primary text-sm text-emerald-700", render: (inv) => formatMoney(inv.total) },
    { id: "payment_type", header: "الدفع", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3", render: (inv) => {
      const PSTYLE = { cash: { label: "نقدي", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }, bank_transfer: { label: "بنك / فيزا", cls: "bg-sky-50 text-sky-700 border-sky-200" }, credit: { label: "آجل", cls: "bg-amber-50 text-amber-700 border-amber-200" }, installments: { label: "أقساط", cls: "bg-purple-50 text-purple-700 border-purple-200" }, multi: { label: "متعدد", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" } };
      if (inv.payment_splits) {
        const splits = inv.payment_splits.split("|||").filter(Boolean).map(s => { const [m, a] = s.split(":"); return { method: (m || "").trim(), amount: Number(a || 0) }; }).filter(s => s.amount > 0);
        if (splits.length) return (
          <div className="flex flex-col gap-0.5">
            {splits.map((s, i) => { const info = PSTYLE[s.method] || { label: s.method || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" }; return (
              <div key={i} className="flex items-center gap-1">
                <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
                <span className="text-[11px] number-fmt text-slate-500">{formatMoney(s.amount)}</span>
              </div>
            ); })}
          </div>
        );
      }
      const info = PSTYLE[inv.payment_type] || { label: inv.payment_type || "—", cls: "bg-slate-50 text-slate-600 border-slate-200" };
      return (
        <div className="flex flex-col gap-0.5">
          <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-black ${info.cls}`}>{info.label}</span>
          <span className="text-[11px] number-fmt text-slate-500">{formatMoney(inv.total)}</span>
        </div>
      );
    } },
    { id: "created_by", header: "المستخدم", width: 110, sortable: false, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] font-bold text-slate-600 whitespace-nowrap", render: (inv) => inv.created_by_username || "—" },
    { id: "created_at", header: "الوقت", width: 150, sortable: true, headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500", cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap", render: (inv) => formatArabicDateTime(new Date(inv.created_at)) },
    { id: "actions", header: "", width: 90, headerClass: "px-3", cellClass: "px-3", render: (inv) => (
      <div className="flex gap-1">
        <PermissionGate page="pos" action="view">
          <button onClick={() => navigate(`/invoices/${inv.id}`)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
        </PermissionGate>
        <PermissionGate page="pos" action="void">
          <button onClick={() => handleVoid(inv)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="إلغاء"><Trash2 className="h-3.5 w-3.5" /></button>
        </PermissionGate>
      </div>
    )},
  ];

  const itemColumns = [
    { id: "item_code", header: "كود الصنف", width: 110, cellClass: "px-3 font-mono text-[11px] font-bold text-slate-600", render: (r) => r.item_code || "—" },
    { id: "item_name", header: "اسم الصنف", width: 180, cellClass: "px-3 text-2sm font-bold text-slate-800", render: (r) => r.item_name || "—" },
    { id: "invoice_no", header: "الفاتورة", width: 130, cellClass: "px-3 font-mono text-[11px] font-black text-slate-700", render: (r) => r.invoice_no || "—" },
    { id: "customer_name", header: "العميل", width: 130, cellClass: "px-3 text-[11px] font-bold text-slate-600", render: (r) => r.customer_name || "زبون نقدي" },
    { id: "quantity", header: "الكمية", width: 80, cellClass: "px-3 text-center number-fmt text-2sm text-slate-600", render: (r) => Number(r.quantity) },
    { id: "unit_price", header: "السعر", width: 100, cellClass: "px-3 number-fmt text-2sm text-slate-700", render: (r) => formatMoney(r.unit_price) },
    { id: "line_total", header: "الإجمالي", width: 110, cellClass: "px-3 number-fmt text-sm text-emerald-700", render: (r) => formatMoney(r.line_total || r.total || (Number(r.unit_price) * Number(r.quantity))) },
    { id: "created_at", header: "التاريخ", width: 140, cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap", render: (r) => r.created_at ? formatArabicDateTime(new Date(r.created_at)) : "—" },
    { id: "actions", header: "", width: 60, cellClass: "px-3", render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${r.invoice_id || r.id}`); }} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="فتح"><Pencil className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="فواتير اليوم" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-4">
          {/* Search bars row */}
          <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-sm border border-slate-700">
            <span className="text-[11px] font-black text-slate-400 shrink-0">بحث برقم فاتورة:</span>
            <input ref={docSearchRef} value={docSearch} onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="INV-0001..."
              className="flex-1 rounded-sm border border-slate-600 bg-slate-800 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400" />
            <span className="text-[11px] font-black text-slate-400 shrink-0">بحث صنف:</span>
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
                className="w-full rounded-sm border border-slate-600 bg-slate-800 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400" />
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
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">من</label>
              <input ref={dateFromRef} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: itemSearchRef })}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">إلى</label>
              <input ref={dateToRef} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: sortRef, prevRef: dateFromRef })}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ترتيب</label>
              <select ref={sortRef} value={sort} onChange={(e) => setSort(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: userSelectRef, prevRef: dateToRef })}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="invoice_no">رقم الفاتورة</option>
                <option value="payment_type">طريقة الدفع</option>
              </select>
              <button onClick={() => setDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </div>
            {usersList.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">المستخدم</label>
                <select ref={userSelectRef} value={userId} onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, { nextRef: customerQueryRef, prevRef: sortRef })}
                  className="rounded-sm border border-slate-200 px-2 py-1.5 text-2sm font-bold outline-none focus:border-slate-800">
                  <option value="">الكل</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
            )}
            <div className="relative flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">العميل</label>
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
                className="w-[140px] rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-2sm font-bold text-slate-800 outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-100" />
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
              className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-2sm font-black text-slate-600 hover:border-slate-800 hover:text-slate-900 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-slate-950 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">عدد الفواتير</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{summary.count}</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">إجمالي الإيرادات</span>
              <span className="font-mono text-[20px] font-black text-emerald-400 leading-none">{formatMoney(summary.total)}</span>
            </div>
          </div>
          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-slate-200">
            <DataGrid
              data={loading ? [] : (itemSearch.trim() ? rawItems : data)}
              rowKey={itemSearch.trim() ? (r, i) => `${r.id || r.item_id}-${i}` : "id"}
              emptyMessage={loading ? "جاري التحميل..." : "لا توجد فواتير في هذه الفترة"}
              className="border-0"
              onRowClick={r => {
                if (itemSearch.trim()) {
                  if (r.invoice_id || r.id) { setPreviewItem({ id: r.invoice_id || r.id, invoice_no: r.invoice_no, customer_name: r.customer_name, total: Number(r.unit_price) * Number(r.quantity), created_at: r.created_at }); setPreviewOpen(true); }
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
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="معاينة الفاتورة">
        {previewItem ? <InvoicePreviewModal inv={previewItem} onClose={() => setPreviewOpen(false)} /> : null}
      </Modal>
      {/* Void Confirmation */}
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
