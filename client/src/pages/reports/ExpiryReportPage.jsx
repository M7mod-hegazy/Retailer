import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { Clock, Package, Search, X, ArrowUpDown, Download, Printer, FileSpreadsheet, AlertTriangle, Activity } from "lucide-react";
import api from "../../services/api";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ReportViaLayout from "../../components/print/templates/ReportViaLayout";
import { formatNumber } from "../../utils/currency";
import { usePageTour } from '../../hooks/usePageTour';

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "expired", label: "منتهي" },
  { key: "critical", label: "حرج (≤٧ أيام)" },
  { key: "warning", label: "تحذير (١٤ يوم)" },
  { key: "valid", label: "ساري" },
];

export default function ExpiryReportPage() {
  usePageTour('expiry_report');
  const [searchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "days_remaining", dir: "asc" });
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const warehouseRef = useRef(null);
  const searchRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  useEffect(() => {
    api.get("/api/warehouses").then(r => setWarehouses(r.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const wh = searchParams.get("warehouse_id") || "";
    const item = searchParams.get("item_id") || "";
    if (wh) setWarehouseId(wh);
    if (item) setSearch(item);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const p = new URLSearchParams();
      p.set("days", "365");
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (warehouseId) p.set("warehouse_id", warehouseId);
      if (search.trim()) p.set("search", search.trim());
      const res = await api.get(`/api/reports/expiring-soon?${p}`).catch(() => ({ data: { data: [], stats: null } }));
      setData(res.data?.data || []);
      setStats(res.data?.stats || null);
      setLoading(false);
    }
    load();
  }, [statusFilter, warehouseId, search]);

  useEffect(() => {
    async function loadDetail() {
      setDetailLoading(true);
      const p = new URLSearchParams();
      if (warehouseId) p.set("warehouse_id", warehouseId);
      const qs = p.toString();
      const res = await api.get(`/api/reports/run/expiry${qs ? `?${qs}` : ""}`).catch(() => ({ data: { data: [] } }));
      setDetailData(res.data?.data || []);
      setDetailLoading(false);
    }
    loadDetail();
  }, [warehouseId]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const av = a[sortConfig.key] ?? "";
      const bv = b[sortConfig.key] ?? "";
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "ar");
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  function SortTh({ label, sortKey }) {
    const active = sortConfig.key === sortKey;
    return (
      <th className="px-3 py-3 text-right text-[11px] font-black text-slate-500 cursor-pointer select-none hover:text-slate-800 transition-colors whitespace-nowrap" onClick={() => toggleSort(sortKey)}>
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <ArrowUpDown className={`w-3 h-3 ${active ? "text-indigo-600" : "text-slate-300"}`} />
        </div>
      </th>
    );
  }

  const detailColumns = useMemo(() => [
    { id: "batch_no", header: "رقم الدفعة", width: 110, render: (r) => <span className="font-mono text-[11px] font-bold text-slate-500">{r.batch_no || "—"}</span> },
    { id: "item_code", header: "الكود", width: 100, render: (r) => <span className="font-mono text-[11px] text-slate-400">{r.item_code || "—"}</span> },
    { id: "item_name", header: "اسم الصنف", width: 200, render: (r) => <Link to={`/items?search=${encodeURIComponent(r.item_name)}`} className="font-bold text-slate-800 text-sm hover:text-indigo-600 transition-colors">{r.item_name}</Link> },
    { id: "quantity", header: "الكمية", width: 80, render: (r) => <span className="font-bold text-slate-700">{r.quantity}</span> },
    { id: "expiry_date", header: "تاريخ الانتهاء", width: 120, render: (r) => <span className="font-mono text-[11px] font-bold">{r.expiry_date}</span> },
    { id: "days_until_expiry", header: "الأيام المتبقية", width: 110, render: (r) => {
      const d = Number(r.days_until_expiry);
      const cls = d < 0 ? "text-red-600 bg-red-50" : d <= 7 ? "text-orange-600 bg-orange-50" : d <= 14 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-black ${cls}`}>{d < 0 ? `منذ ${Math.abs(d)} يوم` : `${d} يوم`}</span>;
    }},
    { id: "cost_price", header: "سعر التكلفة", width: 100, align: "left", render: (r) => <span className="font-mono font-bold text-slate-600">{Number(r.cost_price || 0).toFixed(2)}</span> },
    { id: "expiry_status", header: "الحالة", width: 120, render: (r) => {
      const m = { "منتهي": "bg-red-100 text-red-700", "ينتهي قريباً": "bg-amber-100 text-amber-700", "ساري": "bg-emerald-100 text-emerald-700" };
      return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-black ${m[r.expiry_status] || "bg-slate-100 text-slate-600"}`}>{r.expiry_status}</span>;
    }},
  ], []);

  return (
    <div className="flex flex-col min-h-full font-sans bg-[var(--bg-base)] p-4 md:p-8 relative overflow-x-hidden" dir="rtl">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-amber-400/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[1400px] mx-auto space-y-5 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/reports/center" className="w-10 h-10 rounded-[14px] bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm">
              <X className="w-4 h-4" />
            </Link>
            <div className="w-12 h-12 rounded-[20px] bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">تقرير انتهاء الصلاحية</h1>
              <p className="text-sm font-bold text-slate-500 mt-0.5">
                رصد شامل لصلاحية الأصناف — منتهية، حرجة، وتحذيرية مع تحليل كامل للدفعات
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPrintOpen(true)} className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Printer className="w-4 h-4" /> طباعة
            </button>
          </div>
        </div>

        {/* Summary Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-[20px] bg-gradient-to-br from-red-50 to-red-50/50 border border-red-200/60 p-5 flex flex-col shadow-sm">
              <span className="text-[32px] font-black text-red-700 leading-none">{stats.expired}</span>
              <span className="text-[12px] font-bold text-red-500 mt-1.5">دفعات منتهية الصلاحية</span>
              {stats.expired_qty > 0 && <span className="text-[11px] font-bold text-red-400 mt-0.5">{stats.expired_qty} وحدة متأثرة</span>}
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-orange-50 to-orange-50/50 border border-orange-200/60 p-5 flex flex-col shadow-sm">
              <span className="text-[32px] font-black text-orange-700 leading-none">{stats.critical}</span>
              <span className="text-[12px] font-bold text-orange-500 mt-1.5">دفعات حرجة (≤٧ أيام)</span>
              {stats.critical_qty > 0 && <span className="text-[11px] font-bold text-orange-400 mt-0.5">{stats.critical_qty} وحدة بحاجة تدخل</span>}
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-amber-50 to-amber-50/50 border border-amber-200/60 p-5 flex flex-col shadow-sm">
              <span className="text-[32px] font-black text-amber-700 leading-none">{stats.warning}</span>
              <span className="text-[12px] font-bold text-amber-500 mt-1.5">دفعات تحذيرية (١٤ يوم)</span>
            </div>
            <div className="rounded-[20px] bg-gradient-to-br from-emerald-50 to-emerald-50/50 border border-emerald-200/60 p-5 flex flex-col shadow-sm">
              <span className="text-[32px] font-black text-emerald-700 leading-none">{stats.valid}</span>
              <span className="text-[12px] font-bold text-emerald-500 mt-1.5">دفعات سارية</span>
              <span className="text-[11px] font-bold text-emerald-400 mt-0.5">{stats.total_quantity} إجمالي الوحدات</span>
            </div>
          </div>
        )}

        {/* Tracked items info */}
        {stats?.tracked_items > 0 && (
          <div className="rounded-[16px] bg-indigo-50/60 border border-indigo-200/50 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="text-[12px] font-bold text-indigo-700">
              {stats.tracked_items} صنف مفعّل عليها تتبع الصلاحية
              {stats.tracked_without_batches > 0 && (
                <> — {stats.tracked_without_batches} صنف منها ليس لها مشتريات مسجّلة مع تواريخ انتهاء</>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-[20px] bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="flex p-0.5 bg-slate-100 rounded-[12px] gap-0.5">
            {STATUS_TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[11px] font-black transition-all whitespace-nowrap ${
                  statusFilter === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          <select ref={warehouseRef} value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            onKeyDown={e => handleKeyDown(e, { nextRef: searchRef })}
            className="text-[11px] font-bold bg-white border border-slate-200 rounded-[10px] px-3 py-1.5 outline-none text-slate-600 cursor-pointer">
            <option value="">كل المخازن</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
            <input ref={searchRef} type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => handleKeyDown(e, { prevRef: warehouseRef })}
              placeholder="بحث بالاسم أو الكود أو الدفعة..."
              className="w-full text-[12px] bg-white border border-slate-200 rounded-[10px] pr-8 pl-3 py-1.5 outline-none text-slate-700 placeholder:text-slate-300 font-bold" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Link to="/reports/center" className="text-[11px] font-black text-indigo-600 hover:underline shrink-0">
            عودة لمركز التقارير ←
          </Link>
        </div>

        {/* Overview List */}
        <div className="rounded-[20px] bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-black text-slate-900 tracking-tight">
              نظرة عامة
              {!loading && <span className="mr-2 text-[12px] font-bold text-slate-400">({data.length} دفعة)</span>}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-300">
              <Activity className="w-6 h-6 animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-[16px] border border-dashed border-slate-200 bg-slate-50/30">
              <Package className="w-10 h-10 text-slate-300 mb-3" />
              <span className="text-sm font-black text-slate-500">
                {statusFilter !== "all" ? "لا توجد دفعات في هذا التصنيف" : "لا توجد دفعات مسجلة"}
              </span>
              <span className="text-[12px] font-bold text-slate-400 mt-1">
                {statusFilter !== "all" ? "حاول تغيير الفلتر أو المخزن" : "فعّل تتبع الانتهاء على أصناف التاريخ الحساسة ثم سجّل مشترياتها مع تاريخ الانتهاء"}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedData.map((b) => {
                const dr = Number(b.days_remaining);
                const pct = dr < 0 ? 100 : Math.max(2, Math.min(100, ((30 - dr) / 30) * 100));
                const statusBg = b.batch_status === "expired" ? "border-red-200 bg-red-50/40" :
                  b.batch_status === "critical" ? "border-orange-200 bg-orange-50/40" :
                  b.batch_status === "warning" ? "border-amber-200 bg-amber-50/40" :
                  "border-emerald-200 bg-emerald-50/20";
                const barColor = b.batch_status === "expired" ? "bg-red-400" :
                  b.batch_status === "critical" ? "bg-orange-400" :
                  b.batch_status === "warning" ? "bg-amber-400" :
                  "bg-emerald-400";
                const badgeCls = b.batch_status === "expired" ? "bg-red-100 text-red-700 ring-red-200" :
                  b.batch_status === "critical" ? "bg-orange-100 text-orange-700 ring-orange-200" :
                  b.batch_status === "warning" ? "bg-amber-100 text-amber-700 ring-amber-200" :
                  "bg-emerald-100 text-emerald-700 ring-emerald-200";

                return (
                  <div key={b.id} className={`flex flex-col gap-1.5 rounded-[14px] border p-3 ${statusBg} transition-all hover:shadow-sm`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link to={`/items?search=${encodeURIComponent(b.item_name)}`}
                            className="font-bold text-slate-800 text-sm hover:text-indigo-600 transition-colors truncate">
                            {b.item_name}
                          </Link>
                          {b.batch_no && (
                            <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{b.batch_no}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {b.item_code && <span className="font-mono text-[10px] text-slate-400">{b.item_code}</span>}
                          {b.warehouse_name && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{b.warehouse_name}</span>}
                          <span className="text-[10px] font-bold text-slate-500">{b.quantity} وحدة</span>
                          <span className="text-[10px] font-bold text-slate-400">{b.expiry_date}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`inline-flex items-center justify-center h-7 px-3 rounded-full text-2sm font-black ring-1 ${badgeCls}`}>
                          {dr < 0 ? `منذ ${Math.abs(dr)} يوم` : `${Math.round(dr)} يوم`}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {stats && data.length > 0 && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400">
                إجمالي {stats.total_batches} دفعة — {stats.total_quantity} وحدة
              </span>
              <span className="text-[11px] font-bold text-slate-300">{data.length} معروض</span>
            </div>
          )}
        </div>

        {/* Detailed Data Grid */}
        <div className="rounded-[20px] bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-black text-slate-900 tracking-tight">
              بيانات تفصيلية
              {!detailLoading && <span className="mr-2 text-[12px] font-bold text-slate-400">({detailData.length} سجل)</span>}
            </h2>
          </div>
          {detailLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-300">
              <Activity className="w-6 h-6 animate-spin" />
            </div>
          ) : detailData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-[16px] border border-dashed border-slate-200 bg-slate-50/30">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-3" />
              <span className="text-sm font-black text-slate-500">لا توجد بيانات تفصيلية</span>
            </div>
          ) : (
            <DataGrid
              columns={detailColumns}
              data={detailData}
              rowKey="id"
              emptyMessage="لا توجد بيانات"
              virtualized={detailData.length > 100}
              height={600}
            />
          )}
        </div>
      </div>

      {/* Print Modal */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        docType="reports_generic"
        reportColumns={[
          { key: "item_name", label: "اسم الصنف", type: "text" },
          { key: "item_code", label: "الكود", type: "code" },
          { key: "batch_no", label: "رقم الدفعة", type: "code" },
          { key: "quantity", label: "الكمية", type: "number" },
          { key: "expiry_date", label: "تاريخ الانتهاء", type: "date" },
          { key: "days_remaining", label: "الأيام المتبقية", type: "number" },
          { key: "cost_price", label: "سعر التكلفة", type: "money" },
          { key: "expiry_status", label: "الحالة", type: "text" },
        ]}
        totalRows={detailData.length}
        renderContent={(s) => (
          <ReportViaLayout
            rows={detailData}
            columns={[
              { key: "item_name", label: "اسم الصنف", type: "text" },
              { key: "item_code", label: "الكود", type: "code" },
              { key: "batch_no", label: "رقم الدفعة", type: "code" },
              { key: "quantity", label: "الكمية", type: "number" },
              { key: "expiry_date", label: "تاريخ الانتهاء", type: "date" },
              { key: "days_remaining", label: "الأيام المتبقية", type: "number" },
              { key: "cost_price", label: "سعر التكلفة", type: "money" },
              { key: "expiry_status", label: "الحالة", type: "text" },
            ]}
            title="تقرير انتهاء الصلاحية"
            subtitle={warehouseId ? `مخزن: ${warehouses.find(w => String(w.id) === String(warehouseId))?.name || ""}` : undefined}
            filters={{ status: statusFilter, search }}
            settings={s}
            currentPage={s.currentPage || 1}
            onPageCount={s.onPageCount}
          />
        )}
      />
    </div>
  );
}
