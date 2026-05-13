import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  PackageCheck, PackageMinus, Eye, X, Warehouse,
  Package, ArrowDownToLine, ArrowUpFromLine, RotateCcw,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import SearchInput from "../../components/ui/SearchInput";
import PermissionGate from "../../components/ui/PermissionGate";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { adaptForServer } from "../../utils/search";
import { useNavigate } from "react-router-dom";
import TodayInvoicesButton from "../../components/pos/TodayInvoicesButton";

function formatDate(d) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(d));
}
function formatQty(v) {
  return Number(v || 0).toLocaleString("ar-EG");
}

export default function BranchTransferPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await api.get(`/api/branch-transfers?${params}`);
      setRows(res.data.data || []);
    } catch {
      toast.error("فشل تحميل البيانات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo, typeFilter]);

  async function handleShowDetail(id) {
    try {
      const res = await api.get(`/api/branch-transfers/${id}`);
      setActiveTransfer(res.data.data);
      setDetailOpen(true);
    } catch { toast.error("فشل تحميل التفاصيل"); }
  }

  function clearFilters() { setSearchTerm(""); setDateFrom(""); setDateTo(""); setTypeFilter("all"); }
  const hasFilters = searchTerm || dateFrom || dateTo || typeFilter !== "all";

  const stats = useMemo(() => ({
    receiveCount: rows.filter(r => r.type === "receive").length,
    sendCount: rows.filter(r => r.type === "send").length,
    totalQty: rows.reduce((s, r) => s + Number(r.total_qty || 0), 0),
  }), [rows]);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-black text-slate-800 tracking-tight">استلام / تسليم بضاعة</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">حركات البضاعة بين الفروع — لا تؤثر على الأرباح</p>
        </div>
        <div className="flex items-center gap-3">
          <TodayInvoicesButton variant="ghost" />
          <PermissionGate page="branch_transfer" action="add">
            <button
              onClick={() => navigate("/operations/branch-transfer/new?type=receive")}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-emerald-500 transition-all active:scale-95"
            >
              <ArrowDownToLine className="h-4 w-4" /> استلام بضاعة
            </button>
          </PermissionGate>
          <PermissionGate page="branch_transfer" action="add">
            <button
              onClick={() => navigate("/operations/branch-transfer/new?type=send")}
              className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-blue-600 transition-all active:scale-95"
            >
              <ArrowUpFromLine className="h-4 w-4" /> تسليم بضاعة
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-white p-5 shadow-sm border-r-4 border-r-emerald-600 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter("receive")}>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><PackageCheck className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">وصولات استلام</span>
            <span className="text-[22px] font-black text-slate-800">{stats.receiveCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-600 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter("send")}>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><PackageMinus className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">وصولات تسليم</span>
            <span className="text-[22px] font-black text-slate-800">{stats.sendCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-slate-400">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><Package className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">إجمالي الكميات</span>
            <span className="text-[22px] font-black text-slate-800">{formatQty(stats.totalQty)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="بحث برقم الوصل أو المخزن..."
            className="flex-1 min-w-[180px]"
            size="md"
          />
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-white">
            {[["all", "الكل"], ["receive", "استلام"], ["send", "تسليم"]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={`px-3 py-1 rounded-md text-[12px] font-black transition-all ${typeFilter === v ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
            <span className="text-[11px] text-slate-400 font-bold">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
          <div className="mr-auto">
            <span className="text-[11px] font-bold text-slate-400">{rows.length} نتيجة</span>
          </div>
        </div>

        <DataGrid
          data={rows}
          rowKey="id"
          loading={loading}
          emptyMessage={hasFilters ? "لا توجد حركات مطابقة" : "لا توجد حركات بضاعة مسجّلة"}
          emptyIcon={<RotateCcw className="h-10 w-10 opacity-30 mb-2" />}
          className="border-0"
          columns={[
            {
              id: "ref", header: "رقم الوصل", width: 130, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black text-slate-800 border-l border-slate-100",
              render: (r) => r.reference_no,
            },
            {
              id: "type", header: "النوع", width: 110, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => r.type === "receive" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                  <ArrowDownToLine className="h-3 w-3" /> استلام
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                  <ArrowUpFromLine className="h-3 w-3" /> تسليم
                </span>
              ),
            },
            {
              id: "warehouse", header: "المخزن", width: 160, sortable: true, headerClass: "text-right px-3", cellClass: "font-bold text-slate-700 px-3 border-l border-slate-100",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Warehouse className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{r.warehouse_name}</span>
                </div>
              ),
            },
            {
              id: "lines", header: "الأصناف", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {r.line_count} صنف
                </span>
              ),
            },
            {
              id: "qty", header: "الكمية الإجمالية", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[14px] text-slate-700 border-l border-slate-100",
              sortValue: (r) => r.total_qty,
              render: (r) => formatQty(r.total_qty),
            },
            {
              id: "date", header: "التاريخ", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center text-[12px] font-medium text-slate-500 border-l border-slate-100",
              render: (r) => formatDate(r.created_at),
            },
            {
              id: "notes", header: "ملاحظات", sortable: false, headerClass: "text-right px-3", cellClass: "px-3 text-[12px] text-slate-400 border-l border-slate-100",
              render: (r) => r.notes || <span className="text-slate-200">—</span>,
            },
            {
              id: "actions", header: "", width: 60, sortable: false, cellClass: "text-center p-0 border-l-0",
              render: (row) => (
                <div className="flex h-[40px] items-center justify-center">
                  <button onClick={() => handleShowDetail(row.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`تفاصيل — ${activeTransfer?.reference_no || ""}`}>
        {activeTransfer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl p-4 border"
              style={{ background: activeTransfer.type === "receive" ? "#f0fdf4" : "#eff6ff", borderColor: activeTransfer.type === "receive" ? "#bbf7d0" : "#bfdbfe" }}>
              <div>
                <span className="text-[10px] font-black uppercase block mb-1" style={{ color: activeTransfer.type === "receive" ? "#16a34a" : "#2563eb" }}>النوع</span>
                {activeTransfer.type === "receive" ? (
                  <span className="inline-flex items-center gap-1 text-[13px] font-black text-emerald-700"><ArrowDownToLine className="h-4 w-4" /> وصل استلام بضاعة</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[13px] font-black text-blue-700"><ArrowUpFromLine className="h-4 w-4" /> وصل تسليم بضاعة</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase block mb-1" style={{ color: activeTransfer.type === "receive" ? "#16a34a" : "#2563eb" }}>المخزن</span>
                <span className="text-[14px] font-black text-slate-800">{activeTransfer.warehouse_name}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase block mb-1" style={{ color: activeTransfer.type === "receive" ? "#16a34a" : "#2563eb" }}>التاريخ</span>
                <span className="text-[13px] font-black text-slate-800">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "full" }).format(new Date(activeTransfer.created_at))}</span>
              </div>
              {activeTransfer.notes && (
                <div>
                  <span className="text-[10px] font-black uppercase block mb-1" style={{ color: activeTransfer.type === "receive" ? "#16a34a" : "#2563eb" }}>ملاحظات</span>
                  <span className="text-[13px] font-bold text-slate-700">{activeTransfer.notes}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col h-64 min-h-0">
              <DataGrid
                data={activeTransfer.lines || []}
                rowKey="id"
                emptyMessage="لا توجد أصناف"
                className="border-0"
                containerClass="flex-1 overflow-y-auto bg-white min-h-0"
                columns={[
                  { id: "barcode", header: "الباركود", width: 100, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-500 border-l border-slate-100", render: (l) => l.barcode || "—" },
                  { id: "name", header: "الصنف", headerClass: "text-right px-3", cellClass: "font-bold text-slate-800 border-l border-slate-100 px-3", render: (l) => l.item_name },
                  { id: "unit", header: "الوحدة", width: 80, headerClass: "text-center", cellClass: "text-center text-[12px] text-slate-500 border-l border-slate-100", render: (l) => l.unit_name || "—" },
                  { id: "qty", header: "الكمية", width: 80, headerClass: "text-center", cellClass: "text-center font-black text-blue-700 border-l-0", render: (l) => formatQty(l.quantity) },
                ]}
              />
              <div className="flex shrink-0 items-center justify-between bg-slate-800 px-4 py-3 text-white">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">إجمالي الكمية</span>
                <span className="text-[18px] font-black font-mono">
                  {formatQty(activeTransfer.lines?.reduce((s, l) => s + Number(l.quantity || 0), 0))}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setDetailOpen(false)} className="rounded-lg bg-slate-900 px-10 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
