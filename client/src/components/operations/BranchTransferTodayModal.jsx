import React, { useEffect, useMemo, useState, useRef } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Package, Pencil, RefreshCw, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import Modal from "../ui/Modal";
import DataGrid from "../ui/DataGrid";
import toast from "react-hot-toast";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { useDetach } from "../../hooks/useDetach";
import { formatNumber } from "../../utils/currency";

function toDateInput(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtDateTime(d) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(d));
}
function fmtQty(v) {
  return formatNumber(v, { decimals: 0 });
}
function fmtMoney(v) {
  return formatNumber(v);
}

function TransferDetailPreview({ transfer, onClose, onEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transfer) return;
    setLoading(true);
    api.get(`/api/branch-transfers/${transfer.id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => setDetail(transfer))
      .finally(() => setLoading(false));
  }, [transfer?.id]);

  if (!transfer) return null;
  const d = detail || transfer;
  const isReceive = d.type === "receive";

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className={`rounded-xl px-5 py-4 flex flex-wrap gap-x-6 gap-y-2 text-sm ${isReceive ? "bg-emerald-50 border border-emerald-200" : "bg-blue-50 border border-blue-200"}`}>
            <span className={`font-black text-[15px] ${isReceive ? "text-emerald-800" : "text-blue-800"}`}>{d.reference_no}</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-black ${isReceive ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
              {isReceive ? "استلام" : "تسليم"}
            </span>
            {d.partner_branch && <span className="text-slate-600">الفرع: <strong>{d.partner_branch}</strong></span>}
            <span className="text-slate-500">{d.created_at ? fmtDateTime(d.created_at) : "—"}</span>
          </div>

          <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-2sm border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكود</th>
                  <th className="px-4 py-2.5 text-right font-black text-slate-500">الصنف</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الوحدة</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">المخزن</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الكمية</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">السعر</th>
                  <th className="px-3 py-2.5 text-center font-black text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(d.lines || []).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] font-black text-slate-500">{l.item_code || l.barcode || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{l.item_name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{l.unit_name || "—"}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{l.warehouse_name || "—"}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-slate-700">{fmtQty(l.quantity)}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-slate-600">{fmtMoney(l.unit_cost)}</td>
                    <td className="px-3 py-2.5 text-center number-fmt text-slate-700">{fmtMoney(l.quantity * l.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-xl border border-slate-200 px-5 py-3">
            <span className="text-2sm font-black text-slate-500">إجمالي الكمية</span>
            <span className="number-fmt-primary text-[18px] text-slate-900">
              {fmtQty((d.lines || []).reduce((s, l) => s + Number(l.quantity || 0), 0))}
            </span>
          </div>

          {d.notes && (
            <div className="rounded-xl border border-slate-200 bg-amber-50 px-4 py-2.5 text-2sm text-slate-600">
              <span className="font-black text-slate-500 text-[11px] uppercase tracking-widest">ملاحظات: </span>{d.notes}
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">رجوع</button>
        <button onClick={() => onEdit(transfer.id)} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-black text-white hover:bg-primary-600 transition-colors">
          <Pencil className="h-4 w-4" /> تعديل المستند
        </button>
      </div>
    </div>
  );
}

export default function BranchTransferTodayModal({ open, onClose, initialFilters }) {
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
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialFilters?.dateFrom ?? toDateInput());
  const [dateTo, setDateTo] = useState(initialFilters?.dateTo ?? toDateInput());
  const [typeFilter, setTypeFilter] = useState(initialFilters?.typeFilter ?? "all");
  const [docSearch, setDocSearch] = useState(initialFilters?.docSearch ?? "");
  const [itemSearch, setItemSearch] = useState(initialFilters?.itemSearch ?? "");
  const [filteredItemSuggestions, setFilteredItemSuggestions] = useState([]);
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [previewTransfer, setPreviewTransfer] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const handleKeyDown = useFieldNavigation();
  const { handleDetach } = useDetach("branch-transfer-today", {
    onClose,
    getState: () => ({
      dateFrom, dateTo, typeFilter, docSearch, itemSearch,
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
  const submitBtnRef = useRef(null);

  useEffect(() => {
    const q = itemSearch.trim();
    if (!q) { setFilteredItemSuggestions([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(q)}&limit=8&offset=0`)
        .then(r => setFilteredItemSuggestions(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [itemSearch]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (docSearch.trim()) params.set("search", docSearch.trim());
      if (itemSearch.trim()) params.set("item_search", itemSearch.trim());
      const r = await api.get(`/api/branch-transfers?${params}`);
      setData(r.data.data || []);
    } catch { toast.error("فشل تحميل البيانات"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!open) return;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [open, dateFrom, dateTo, typeFilter, docSearch, itemSearch]);

  function handleRowClick(row) {
    setPreviewTransfer(row);
    setPreviewOpen(true);
  }

  function handleEdit(id) {
    gotoTarget(`/operations/branch-transfer/edit/${id}`);
  }

  const columns = [
    {
      id: "ref", header: "رقم المستند", width: 170, sortable: true,
      headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 font-mono text-2sm font-black text-slate-800",
      render: (r) => r.reference_no,
    },
    {
      id: "type", header: "النوع", width: 100, sortable: true,
      headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 text-center",
      render: (r) => r.type === "receive"
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"><ArrowDownToLine className="h-3 w-3" /> استلام</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200"><ArrowUpFromLine className="h-3 w-3" /> تسليم</span>,
    },
    {
      id: "partner_branch", header: "الفرع", width: 130, sortable: true,
      headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 text-2sm font-bold text-slate-600",
      render: (r) => r.partner_branch || "—",
    },
    {
      id: "line_count", header: "الأصناف", width: 80, sortable: true,
      headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 text-center text-2sm font-bold text-slate-600",
      render: (r) => r.line_count,
    },
    {
      id: "total_qty", header: "الكمية", width: 90, sortable: true,
      headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 text-center number-fmt text-sm text-slate-800",
      render: (r) => fmtQty(r.total_qty),
    },
    {
      id: "created_at", header: "التاريخ والوقت", width: 160, sortable: true,
      headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
      cellClass: "px-3 text-[11px] text-slate-500 number-fmt whitespace-nowrap",
      render: (r) => fmtDateTime(r.created_at),
    },
    {
      id: "actions", header: "", width: 60, sortable: false,
      headerClass: "px-3", cellClass: "px-3",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(r.id); }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600"
          title="تعديل"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="مستندات النقل الداخلي" maxWidth="max-w-5xl" onDetach={handleDetach} showDetach={true} modalType="branch-transfer-today">
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl border border-slate-700 flex-wrap">
            <span className="text-[11px] font-black text-slate-400 shrink-0">رقم المستند:</span>
            <input
              ref={docSearchRef}
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { nextRef: itemSearchRef })}
              placeholder="BT-R-..."
              className="w-[160px] rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400"
            />
            <span className="text-[11px] font-black text-slate-400 shrink-0">بحث صنف:</span>
            <div className="relative flex-1 min-w-[160px]">
              <input
                ref={itemSearchRef}
                value={itemSearch}
                onChange={e => { setItemSearch(e.target.value); setItemLookupOpen(true); }}
                onFocus={() => setItemLookupOpen(true)}
                onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveItemIdx(i => Math.min(i + 1, filteredItemSuggestions.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveItemIdx(i => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter" && filteredItemSuggestions[activeItemIdx]) {
                    e.preventDefault();
                    const p = filteredItemSuggestions[activeItemIdx];
                    setItemSearch(p.item_code || p.name);
                    setItemLookupOpen(false);
                  }
                  else if (e.key === "Enter" && !filteredItemSuggestions[activeItemIdx]) { handleKeyDown(e, { nextRef: dateFromRef, prevRef: docSearchRef }); }
                  else if (e.key === "Escape") setItemLookupOpen(false);
                }}
                placeholder="اسم الصنف أو SKU..."
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-2sm font-bold text-white outline-none focus:border-slate-400"
              />
              {itemLookupOpen && filteredItemSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {filteredItemSuggestions.map((item, i) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setItemSearch(item.item_code || item.name); setItemLookupOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start ${activeItemIdx === i ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      >
                        <Package className="w-4 h-4 text-slate-300 shrink-0" />
                        <span className="text-2sm font-bold text-slate-800">{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 mr-auto">{item.item_code || ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => { setDocSearch(""); setItemSearch(""); }} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-slate-600">
              <X className="h-3 w-3" /> مسح
            </button>
            <button ref={submitBtnRef} onClick={loadData} onKeyDown={e => handleKeyDown(e, { prevRef: dateToRef })} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-slate-600">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200">
              <input ref={dateFromRef} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: itemSearchRef })}
                className="rounded-lg bg-white px-3 py-1.5 text-2sm font-bold text-slate-600 outline-none border border-slate-100 focus:border-indigo-300" />
              <span className="text-slate-300 text-[11px]">—</span>
              <input ref={dateToRef} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                onKeyDown={e => handleKeyDown(e, { nextRef: submitBtnRef, prevRef: dateFromRef })}
                className="rounded-lg bg-white px-3 py-1.5 text-2sm font-bold text-slate-600 outline-none border border-slate-100 focus:border-indigo-300" />
            </div>
            <div className="flex items-center gap-1">
              {[["all", "الكل"], ["receive", "استلام"], ["send", "تسليم"]].map(([v, l]) => (
                <button key={v} onClick={() => setTypeFilter(v)}
                  className={`rounded-full px-4 py-1.5 text-2sm font-black transition-all ${typeFilter === v ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {l}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-bold text-slate-400 mr-auto">{data.length} مستند</span>
          </div>

          {/* Grid */}
          <DataGrid
            data={data}
            rowKey={r => r.id}
            columns={columns}
            loading={loading}
            onRowClick={handleRowClick}
            emptyMessage="لا توجد مستندات في هذا النطاق"
            emptyIcon={<Package className="h-10 w-10 text-slate-300 mb-2" />}
            containerClass="max-h-[400px] overflow-y-auto rounded-xl border border-slate-200 bg-white"
            className="border-0"
          />
        </div>
      </Modal>

      {/* Detail preview sub-modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`تفاصيل المستند — ${previewTransfer?.reference_no || ""}`}
        maxWidth="max-w-3xl"
      >
        <TransferDetailPreview
          transfer={previewTransfer}
          onClose={() => setPreviewOpen(false)}
          onEdit={handleEdit}
        />
      </Modal>
    </>
  );
}
