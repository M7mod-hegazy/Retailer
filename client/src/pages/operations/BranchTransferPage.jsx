import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Eye, Warehouse, Pencil,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw,
  Search, ArrowLeftRight, Package, X, Loader2,
  SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import PermissionGate from "../../components/ui/PermissionGate";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { adaptForServer } from "../../utils/search";
import { useNavigate } from "react-router-dom";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { motion, AnimatePresence } from "framer-motion";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { formatNumber } from "../../utils/currency";

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

const PAGE_SIZE = 20;

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};
const ROW_ANIMATION = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
};

function formatDate(d) {
  if (!d) return "—";
  const raw = d.split(".")[0].replace("T", " ");
  const [ymd] = raw.split(" ");
  const [y, m, day] = ymd.split("-");
  return `${day}/${m}/${y}`;
}
function formatDateTime(d) {
  if (!d) return "—";
  const raw = d.split(".")[0].replace("T", " ");
  const [ymd, hms = "00:00"] = raw.split(" ");
  const [y, m, day] = ymd.split("-");
  const [hh, min] = hms.split(":");
  return `${day}/${m}/${y}, ${hh}:${min}`;
}
function formatQty(v) {
  return formatNumber(v, { decimals: 0 });
}
function fmtMoney(v) {
  return formatNumber(v);
}

function TransferDetailModal({ transfer, onClose, onEdit }) {
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
    <div className="space-y-6 p-2">
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden ${
            isReceive ? "bg-emerald-950 text-white shadow-emerald-900/20" : "bg-blue-950 text-white shadow-blue-900/20"
          }`}>
            <div className="flex flex-col relative z-10">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">نوع الحركة</span>
              <span className="text-[20px] font-black flex items-center gap-3">
                {isReceive ? <><ArrowDownToLine className="h-6 w-6" /> استلام بضاعة</> : <><ArrowUpFromLine className="h-6 w-6" /> تسليم بضاعة</>}
              </span>
            </div>
            <div className="flex flex-col md:border-r border-white/20 md:pr-8 relative z-10">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">المخزن / الفرع</span>
              <span className="text-[18px] font-black truncate">{d.partner_branch || d.warehouse_name || "—"}</span>
            </div>
            <div className="flex flex-col md:border-r border-white/20 md:pr-8 relative z-10">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">تاريخ التنفيذ</span>
              <span className="text-[16px] font-bold">{formatDateTime(d.created_at)}</span>
            </div>
          </div>

          {d.notes && (
            <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-6">
              <span className="text-2sm font-black uppercase tracking-widest text-slate-500 block mb-2">ملاحظات</span>
              <span className="text-[15px] font-bold text-slate-700">{d.notes}</span>
            </div>
          )}

          <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col max-h-[400px]">
            <div className="grid grid-cols-[100px_1fr_90px_90px_90px_110px] bg-slate-50 border-b border-slate-200 px-2">
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">الكود</div>
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50">الصنف</div>
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">الوحدة</div>
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">الكمية</div>
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">السعر</div>
              <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-900 tracking-widest text-center">الإجمالي</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(d.lines || []).length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm font-black">القائمة خالية</div>
              ) : (
                (d.lines || []).map(l => (
                  <div key={l.id} className="grid grid-cols-[100px_1fr_90px_90px_90px_110px] items-center rounded-xl hover:bg-slate-50 p-3 transition-colors">
                    <div className="px-2 text-center border-l border-slate-100 font-mono text-2sm text-slate-400">{l.item_code || l.barcode || "—"}</div>
                    <div className="px-3 border-l border-slate-100 text-sm font-black text-slate-900">{l.item_name}</div>
                    <div className="px-2 text-center border-l border-slate-100 text-2sm font-bold text-slate-500">{l.unit_name || "—"}</div>
                    <div className="px-2 text-center border-l border-slate-100 number-fmt-primary text-[15px] text-slate-900">{formatQty(l.quantity)}</div>
                    <div className="px-2 text-center border-l border-slate-100 font-mono text-2sm text-slate-600">{fmtMoney(l.unit_cost)}</div>
                    <div className="px-2 text-center number-fmt-primary text-sm text-slate-800">{fmtMoney(l.quantity * l.unit_cost)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between bg-slate-950 px-8 py-6 text-white">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-60">الكمية الكلية</span>
              <span className="text-[2.5rem] number-fmt-primary tracking-tighter leading-none">
                {formatQty((d.lines || []).reduce((s, l) => s + Number(l.quantity || 0), 0))}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={onClose} className="rounded-[1.5rem] bg-slate-100 px-10 py-4 text-sm font-black text-slate-900 hover:bg-slate-200 transition-all active:scale-95">
              إغلاق
            </button>
            <PermissionGate page="branch_transfer" action="edit">
              <button
                onClick={() => onEdit(d.id)}
                className="flex items-center gap-2 rounded-[1.5rem] bg-primary px-10 py-4 text-sm font-black text-white hover:bg-primary-600 transition-all active:scale-95 shadow-lg"
              >
                <Pencil className="h-4 w-4" /> تعديل المستند
              </button>
            </PermissionGate>
          </div>
        </>
      )}
    </div>
  );
}

export default function BranchTransferPage() {
  usePageTour('branch_transfer');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("transfers"); // "transfers" | "items"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");

  const searchTermRef = useRef(null);
  const userIdRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const itemDateFromRef = useRef(null);
  const itemDateToRef = useRef(null);
  const handleKeyDown = useFieldNavigation();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const hasFilters = dateFrom || dateTo || userId;

  // Items tab state
  const [itemQuery, setItemQuery] = useState("");
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [itemLookupResults, setItemLookupResults] = useState([]);
  const [selectedItemFilter, setSelectedItemFilter] = useState(null);
  const [activeLookupIndex, setActiveLookupIndex] = useState(-1);
  const [isLoadingLookup, setIsLoadingLookup] = useState(false);
  const [itemRows, setItemRows] = useState([]);
  const [itemRowsLoading, setItemRowsLoading] = useState(false);
  const [itemSearched, setItemSearched] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [itemDateFrom, setItemDateFrom] = useState("");
  const [itemDateTo, setItemDateTo] = useState("");
  const itemInputRef = useRef(null);
  const debouncedItemQuery = useDebounce(itemQuery, 300);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState(null);
  const [page, setPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (userId) params.set("user_id", userId);
      const res = await api.get(`/api/branch-transfers?${params}`);
      setRows(res.data.data || []);
    } catch {
      toast.error("فشل تحميل البيانات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo, typeFilter, userId]);

  useEffect(() => { setPage(1); }, [rows]);
  useEffect(() => { setItemPage(1); }, [itemRows]);

  useEffect(() => {
    api.get("/api/users").then(r => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  function handleShowDetail(row) {
    setActiveTransfer(row);
    setDetailOpen(true);
  }

  function handleEdit(id) {
    setDetailOpen(false);
    navigate(`/operations/branch-transfer/edit/${id}`);
  }

  // Item autocomplete lookup
  useEffect(() => {
    if (!debouncedItemQuery.trim()) { setItemLookupResults([]); return; }
    setIsLoadingLookup(true);
    api.get(`/api/items?search=${encodeURIComponent(debouncedItemQuery)}&limit=20`)
      .then(r => setItemLookupResults(r.data?.data || []))
      .catch(() => setItemLookupResults([]))
      .finally(() => setIsLoadingLookup(false));
  }, [debouncedItemQuery]);

  async function loadItemRows(queryOverride) {
    const q = queryOverride ?? (selectedItemFilter
      ? (selectedItemFilter.name || selectedItemFilter.item_code || selectedItemFilter.barcode)
      : itemQuery.trim());
    if (!q) { setItemRows([]); setItemSearched(false); return; }
    setItemRowsLoading(true);
    setItemSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (itemDateFrom) params.set("date_from", itemDateFrom);
      if (itemDateTo) params.set("date_to", itemDateTo);
      if (itemTypeFilter !== "all") params.set("type", itemTypeFilter);
      const res = await api.get(`/api/branch-transfers/items-search?${params}`);
      setItemRows(res.data?.data || []);
    } catch {
      setItemRows([]);
      toast.error("فشل البحث بالأصناف");
    } finally {
      setItemRowsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "items") loadItemRows();
  }, [activeTab, selectedItemFilter, itemDateFrom, itemDateTo, itemTypeFilter]);

  const stats = useMemo(() => ({
    receiveCount: rows.filter(r => r.type === "receive").length,
    sendCount: rows.filter(r => r.type === "send").length,
    totalQty: rows.reduce((s, r) => s + Number(r.total_qty || 0), 0),
  }), [rows]);

  const totalTransferPages = Math.ceil(rows.length / PAGE_SIZE);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalItemPages = Math.ceil(itemRows.length / PAGE_SIZE);
  const pagedItemRows = itemRows.slice((itemPage - 1) * PAGE_SIZE, itemPage * PAGE_SIZE);

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-10 overflow-x-hidden font-sans bg-[var(--bg-base)]" dir="rtl">

      {/* Background light emitters */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">

        {/* Cinematic Header */}
        <motion.header initial="hidden" animate="visible" variants={FADE_UP}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm">
                <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-[11px] font-black text-zinc-400 tracking-[0.2em] uppercase">العمليات الداخلية</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">
              حركات <span className="text-emerald-600">النقل الداخلي</span>
            </h1>
            <p className="text-sm font-bold text-zinc-400 mt-2">تسجيل ومراقبة استلام وتسليم البضائع بين الفروع والمخازن.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <PermissionGate page="branch_transfer" action="add">
              <button
                data-help="add-button"
                onClick={() => navigate("/operations/branch-transfer/new?type=receive")}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-colors active:scale-95"
              >
                <ArrowDownToLine className="w-5 h-5" /> استلام
              </button>
            </PermissionGate>
            <PermissionGate page="branch_transfer" action="add">
              <button
                onClick={() => navigate("/operations/branch-transfer/new?type=send")}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-colors active:scale-95"
              >
                <ArrowUpFromLine className="w-5 h-5" /> تسليم
              </button>
            </PermissionGate>
          </div>
        </motion.header>

        {/* Tab Pill Slider */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col gap-2">
          <div className="bg-zinc-100/80 border border-zinc-200/40 p-1.5 rounded-2xl flex gap-1.5 self-start">
            <button
              onClick={() => { setActiveTab("transfers"); setSearchTerm(""); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === "transfers" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              سجل الحركات
            </button>
            <button
              onClick={() => { setActiveTab("items"); setItemQuery(""); setSelectedItemFilter(null); setItemLookupResults([]); setItemRows([]); setItemSearched(false); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeTab === "items" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              البحث التفصيلي بالأصناف
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-[11px] font-bold text-zinc-400 px-2"
            >
              {activeTab === "transfers"
                ? "عرض وبحث في جميع حركات النقل المسجلة"
                : "تتبّع حركات صنف بعينه عبر كامل سجل المستندات"}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Search & Filters Card */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP}
          className="flex flex-col bg-white border border-zinc-200/60 rounded-[2rem] shadow-sm p-4 gap-4"
        >
          {activeTab === "transfers" ? (
            <>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div data-help="search-bar" className="relative flex-1 w-full">
                  <Search className="absolute top-1/2 -translate-y-1/2 right-4 h-4 w-4 text-zinc-400" />
                  <input
                    type="text" ref={searchTermRef} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: userIdRef, prevRef: null })}
                    placeholder="البحث برقم الوصل أو الفرع..."
                    autoFocus
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 pr-10 pl-4 py-3 text-sm font-bold text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
                  {[["all", "الكل"], ["receive", "استلام"], ["send", "تسليم"]].map(([v, l]) => (
                    <button key={v} onClick={() => setTypeFilter(v)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                        typeFilter === v ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
                <button onClick={() => setFiltersOpen(v => !v)}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-xs font-black transition-all w-full md:w-auto shrink-0 ${
                    hasFilters ? "border-emerald-300 bg-emerald-50/50 text-emerald-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}>
                  <SlidersHorizontal className="w-4 h-4" /> تصفية
                  {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              {filtersOpen && (
                <div className="border-t border-zinc-100 pt-4 flex flex-wrap gap-4 items-end bg-transparent">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المستخدم</span>
                    <select ref={userIdRef} value={userId} onChange={e => setUserId(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: dateFromRef, prevRef: searchTermRef })}
                      className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]">
                      <option value="">كل المستخدمين</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
                    <input ref={dateFromRef} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: userIdRef })}
                      className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
                    <input ref={dateToRef} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, { nextRef: null, prevRef: dateFromRef })}
                      className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" />
                  </div>
                  {hasFilters && (
                    <button onClick={() => { setDateFrom(""); setDateTo(""); setUserId(""); }}
                      className="h-10 flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors">
                      <X className="w-3.5 h-3.5" /> مسح التصفية
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="relative flex-1 w-full">
                <SearchInput
                  ref={itemInputRef}
                  value={itemQuery}
                  onChange={(val) => { setItemQuery(val); setSelectedItemFilter(null); setActiveLookupIndex(-1); setItemLookupOpen(true); }}
                  onClear={() => { setItemQuery(""); setSelectedItemFilter(null); setItemLookupResults([]); setItemRows([]); setItemSearched(false); }}
                  onFocus={() => setItemLookupOpen(true)}
                  onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (itemLookupResults.length > 0 && activeLookupIndex >= 0) {
                        const picked = itemLookupResults[activeLookupIndex];
                        setSelectedItemFilter(picked); setItemQuery(picked.name); setItemLookupOpen(false);
                      } else if (itemQuery.trim()) {
                        setSelectedItemFilter(null); setItemLookupOpen(false); loadItemRows(itemQuery.trim());
                      }
                    } else if (e.key === "ArrowDown") { e.preventDefault(); setActiveLookupIndex(p => Math.min(p + 1, itemLookupResults.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveLookupIndex(p => Math.max(p - 1, 0)); }
                  }}
                  placeholder="ابحث باسم المنتج أو الباركود أو SKU..."
                  size="lg"
                  loading={isLoadingLookup}
                  autoFocus
                  className="w-full"
                />
                {itemLookupOpen && (itemLookupResults.length > 0 || itemQuery.trim()) && (
                  <SearchDropdown
                    items={itemLookupResults} activeIndex={activeLookupIndex} query={itemQuery}
                    emptyLabel="لا توجد نتائج"
                    onPick={(item) => { setSelectedItemFilter(item); setItemQuery(item.name); setItemLookupOpen(false); setActiveLookupIndex(-1); }}
                  />
                )}
                {selectedItemFilter && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-2">
                    <span className="font-mono text-[11px] font-black text-emerald-700 shrink-0">
                      {selectedItemFilter.item_code || selectedItemFilter.code || `#${selectedItemFilter.id}`}
                    </span>
                    <div className="h-3 w-px bg-emerald-300 shrink-0" />
                    <span className="text-2sm text-emerald-700 font-bold truncate">{selectedItemFilter.name}</span>
                    <button type="button" onClick={() => { setSelectedItemFilter(null); setItemQuery(""); setItemLookupResults([]); setItemRows([]); setItemSearched(false); }}
                      className="mr-auto text-emerald-400 hover:text-rose-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {[["all", "الكل"], ["receive", "استلام"], ["send", "تسليم"]].map(([v, l]) => (
                    <button key={v} onClick={() => setItemTypeFilter(v)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                        itemTypeFilter === v ? "bg-primary text-white shadow-md" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-zinc-50 rounded-2xl p-2 border border-zinc-200/50">
                  <input ref={itemDateFromRef} type="date" value={itemDateFrom} onChange={e => setItemDateFrom(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: itemDateToRef, prevRef: null })}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-zinc-600 outline-none border border-zinc-100 focus:border-emerald-300" />
                  <ArrowLeftRight className="h-4 w-4 text-zinc-300 shrink-0" />
                  <input ref={itemDateToRef} type="date" value={itemDateTo} onChange={e => setItemDateTo(e.target.value)}
                    onKeyDown={e => handleKeyDown(e, { nextRef: null, prevRef: itemDateFromRef })}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-zinc-600 outline-none border border-zinc-100 focus:border-emerald-300" />
                  {(itemDateFrom || itemDateTo) && (
                    <button onClick={() => { setItemDateFrom(""); setItemDateTo(""); }}
                      className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Results Area */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP}
          className="flex flex-col bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden min-h-[420px]"
        >
          {activeTab === "transfers" ? (
            loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                  <RotateCcw className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد حركات</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على حركات نقل مطابقة للمعايير المحددة.</p>
              </div>
            ) : (
              <div data-help="main-table" className="p-4 flex flex-col gap-4">
                <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-4">
                  <AnimatePresence mode="popLayout">
                    {pagedRows.map(row => {
                      const isReceive = row.type === "receive";
                      return (
                        <motion.div key={row.id} layout layoutId={`transfer-${row.id}`} variants={ROW_ANIMATION}
                          className="group flex flex-col md:flex-row md:items-center justify-between gap-6 border border-zinc-100 rounded-[1.5rem] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer bg-white"
                          onClick={() => handleShowDetail(row)}
                        >
                          <div className="flex items-center gap-5 lg:w-[38%]">
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                              isReceive ? "bg-emerald-600 text-white shadow-emerald-600/20" : "bg-blue-600 text-white shadow-blue-600/20"
                            }`}>
                              {isReceive ? <ArrowDownToLine className="h-6 w-6" strokeWidth={2.5} /> : <ArrowUpFromLine className="h-6 w-6" strokeWidth={2.5} />}
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[16px] font-black text-zinc-900 tracking-tight">{row.reference_no}</span>
                                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                                  isReceive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}>
                                  {isReceive ? "استلام" : "تسليم"}
                                </span>
                              </div>
                              {row.partner_branch && (
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                  <Warehouse className="h-3.5 w-3.5 shrink-0" />
                                  <span className="text-sm font-bold text-zinc-500 truncate">{row.partner_branch}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6 lg:w-[42%] bg-zinc-50 rounded-xl px-5 py-3">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">التاريخ</span>
                              <span className="text-sm font-bold text-zinc-700 mt-0.5">{formatDate(row.created_at)}</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-200 shrink-0" />
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">الأصناف</span>
                              <span className="text-[18px] font-black text-zinc-900 mt-0.5">{row.line_count}</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-200 shrink-0" />
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">الكمية</span>
                              <span className="text-[20px] number-fmt-primary text-zinc-950 mt-0.5">{formatQty(row.total_qty)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end lg:w-[20%] shrink-0 gap-2">
                            <PermissionGate page="branch_transfer" action="edit">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(row.id); }}
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all"
                                title="تعديل"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </PermissionGate>
                            <button className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400 group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all duration-300">
                              <Eye className="h-5 w-5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
                {totalTransferPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="h-4 w-4" /> السابق
                    </button>
                    <span className="text-[11px] font-black text-zinc-400">{page} / {totalTransferPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalTransferPages, p + 1))} disabled={page >= totalTransferPages}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      التالي <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Items tab results */
            itemRowsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري البحث</span>
              </div>
            ) : !itemSearched ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-zinc-400">
                <Search className="w-12 h-12 opacity-25 mb-4" />
                <h3 className="text-base font-black text-zinc-800 mb-1">بحث تفصيلي بالأصناف</h3>
                <p className="text-xs font-bold text-zinc-400 max-w-[45ch] leading-relaxed">
                  اكتب اسم المنتج أو الكود للوصول لجميع سطور حركات النقل المرتبطة به.
                </p>
              </div>
            ) : itemRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                  <Package className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد نتائج مطابقة</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي صنف يطابق بحثك عبر جميع حركات النقل.</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-zinc-50 border-b border-zinc-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3.5 font-black text-zinc-500">المستند</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">التاريخ</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">النوع</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">الفرع</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">كود الصنف</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500">اسم المنتج</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الوحدة</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">المخزن</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الكمية</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">التكلفة</th>
                      <th className="px-5 py-3.5 font-black text-zinc-500 text-center">عرض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItemRows.map((r, i) => {
                      const isReceive = r.type === "receive";
                      return (
                        <tr key={r.line_id || i} className="border-b border-zinc-100 hover:bg-emerald-50/10 transition-colors">
                          <td className="px-5 py-4 font-mono font-black text-zinc-700">{r.reference_no || "—"}</td>
                          <td className="px-5 py-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{formatDate(r.created_at)}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-[11px] font-black border ${
                              isReceive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {isReceive ? "استلام" : "تسليم"}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-zinc-600">{r.partner_branch || "—"}</td>
                          <td className="px-5 py-4 text-center font-mono text-[11px] font-black text-zinc-400">{r.item_code || r.barcode || "—"}</td>
                          <td className="px-5 py-4 font-bold text-zinc-800">{r.item_name || "—"}</td>
                          <td className="px-5 py-4 text-center font-bold text-zinc-500">{r.unit_name || "—"}</td>
                          <td className="px-5 py-4 text-center font-bold text-zinc-600">{r.warehouse_name || "—"}</td>
                          <td className="px-5 py-4 text-center number-fmt-primary text-zinc-900">{r.quantity}</td>
                          <td className="px-5 py-4 text-center number-fmt-primary text-zinc-600">{fmtMoney(r.unit_cost)}</td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => { setActiveTransfer({ id: r.transfer_id, reference_no: r.reference_no }); setDetailOpen(true); }}
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors inline-block"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalItemPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                  <button onClick={() => setItemPage(p => Math.max(1, p - 1))} disabled={itemPage <= 1}
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" /> السابق
                  </button>
                  <span className="text-[11px] font-black text-zinc-400">{itemPage} / {totalItemPages}</span>
                  <button onClick={() => setItemPage(p => Math.min(totalItemPages, p + 1))} disabled={itemPage >= totalItemPages}
                    className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                    التالي <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
              </>
            )
          )}
        </motion.div>

      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`تفاصيل حركة النقل — ${activeTransfer?.reference_no || ""}`}
        maxWidth="max-w-4xl"
      >
        <TransferDetailModal
          transfer={activeTransfer}
          onClose={() => setDetailOpen(false)}
          onEdit={handleEdit}
        />
      </Modal>
    </div>
  );
}
