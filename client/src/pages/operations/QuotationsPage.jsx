import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import api from "../../services/api";
import {
  FileText, Plus, Printer, Calendar, User, Search, X, Copy, Send,
  Trash2, AlertTriangle, TrendingUp, Sparkles, ChevronLeft,
  Download, Share2, ArrowUpDown, Filter, Pencil, ShoppingCart, Info, Eye
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { DramaticDeleteConfirm } from "../../components/ui/DramaticDeleteConfirm";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import PermissionGate from "../../components/ui/PermissionGate";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";
import {
  QUOTATION_STATUS,
  PAYMENT_TYPE_LABELS,
  formatQuotationNo,
  formatMoney,
  formatDate,
  effectiveQuotationStatus,
  buildQuotationPosState,
  buildQuotationPrintDoc,
} from "./quotationUtils";

const STATUS_TABS = [
  { value: "", label: "الكل" },
  { value: "draft", label: "مسودة", hint: QUOTATION_STATUS.draft.hint },
  { value: "sent", label: "مُرسل للعميل", hint: QUOTATION_STATUS.sent.hint },
  { value: "converted", label: "تحوّل لبيع", hint: QUOTATION_STATUS.converted.hint },
  { value: "expired", label: "منتهي", hint: QUOTATION_STATUS.expired.hint },
];

const SORT_OPTIONS = [
  { value: "q.id", label: "رقم العرض" },
  { value: "q.created_at", label: "تاريخ الإصدار" },
  { value: "q.total", label: "الإجمالي" },
  { value: "q.expires_at", label: "تاريخ الصلاحية" },
];

function StatusBadge({ status, expiresAt, showHint = false }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiry && expiry < today && status !== "converted";
  const daysLeft = expiry ? Math.ceil((expiry - today) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && status !== "converted" && !isExpired;

  const effStatus = isExpired ? "expired" : status;
  const s = QUOTATION_STATUS[effStatus] || QUOTATION_STATUS.draft;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-4 py-1.5 text-[11px] number-fmt-primary uppercase tracking-widest ${s.cls}`}>{s.label}</span>
        {expiringSoon && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1 shadow-sm">
            <AlertTriangle className="h-3 w-3" /> متبقي {daysLeft} أيام
          </span>
        )}
      </div>
      {showHint && <span className="text-[11px] font-bold text-slate-400 max-w-[50ch]">{s.hint}</span>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm animate-pulse">
      <div className="flex items-center gap-6 lg:w-[40%]">
        <div className="h-16 w-16 rounded-2xl bg-slate-200" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-12 lg:w-[40%]">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-5 w-24 bg-slate-200 rounded" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-7 w-28 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="flex gap-3 lg:w-[20%]">
        <div className="h-12 w-28 bg-slate-200 rounded-xl" />
        <div className="h-12 w-12 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};
const ROW_ANIMATION = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
};

export default function QuotationsPage() {
  usePageTour('quotations');
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState("q.id");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [activeQuotation, setActiveQuotation] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [trashMenuId, setTrashMenuId] = useState(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState({});

  const menuRef = useRef(null);
  const trashMenuRef = useRef(null);
  const searchRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data?.data || {})).catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e) {
      if (!menuRef.current?.contains(e.target)) setOpenMenu(null);
      if (!trashMenuRef.current?.contains(e.target)) setTrashMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Ctrl+N → new quotation
  useShortcut("quotation.new", () => navigate('/operations/quotations/new'));

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, sortBy, sortOrder, dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("sort", sortBy);
      params.set("order", sortOrder);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await api.get(`/api/quotations?${params}`);
      const d = res.data;
      setRows(d.data || []);
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
    } catch { toast.error("فشل تحميل البيانات"); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, statusFilter, page, sortBy, sortOrder, dateFrom, dateTo]);

  async function handleShowDetail(id) {
    try {
      const res = await api.get(`/api/quotations/${id}`);
      setActiveQuotation(res.data.data);
      return res.data.data;
    } catch {
      toast.error("خطأ في تحميل التفاصيل");
      return null;
    }
  }

  async function handleConvertToPos(quotation) {
    const row = quotation || convertTarget;
    if (!row) return;
    try {
      const res = await api.get(`/api/quotations/${row.id}`);
      const full = res.data.data;
      if (full.status === "converted") {
        toast.error("تم تحويل هذا العرض لفاتورة بيع مسبقاً");
        return;
      }
      setConvertTarget(null);
      setActiveQuotation(null);
      navigate("/pos", { state: buildQuotationPosState(full) });
      toast.success(`تم فتح نقطة البيع ببيانات ${full.doc_no || formatQuotationNo(full.id)} — راجع ثم أكّد البيع`, { duration: 5000 });
    } catch (err) {
      toast.error(err?.response?.data?.message || "تعذّر تحميل بيانات العرض");
    }
  }

  async function handleSend(id) {
    try {
      await api.patch(`/api/quotations/${id}/send`);
      toast.success("تم تحديث حالة العرض إلى مُرسل");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل تحديث الحالة");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/quotations/${deleteTarget.id}`);
      toast.success("تم حذف عرض السعر");
      setDeleteTarget(null);
      setActiveQuotation(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل الحذف");
      setDeleteTarget(null);
    }
  }

  async function handleDuplicate(id) {
    try {
      const res = await api.post(`/api/quotations/${id}/duplicate`);
      toast.success("تم نسخ العرض — جاهز للتعديل");
      navigate(`/operations/quotations/new?id=${res.data.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل نسخ العرض");
    }
  }

  function effectiveStatus(row) {
    return effectiveQuotationStatus(row);
  }

  const stats = useMemo(() => {
    const totalVal = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    const converted = rows.filter(r => r.status === "converted").length;
    const drafts = rows.filter(r => r.status === "draft").length;
    const conversionRate = rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0;
    return { total: totalVal, converted, drafts, count: rows.length, conversionRate };
  }, [rows]);

  const canDelete = row => effectiveStatus(row) !== "converted";
  const canSend = row => row.status === "draft";
  const canConvert = row => row.status !== "converted";

  function toggleSort(field) {
    if (sortBy === field) {
      setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC");
    } else {
      setSortBy(field);
      setSortOrder("DESC");
    }
  }

  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get(`/api/quotations/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotations-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("تم تصدير عروض الأسعار بنجاح");
    } catch {
      toast.error("فشل تصدير البيانات");
    }
  }

  function handleWhatsAppShare(row) {
    const text = `*عرض سعر ${row.doc_no || formatQuotationNo(row.id)}*\nالعميل: ${row.customer_name || `#${row.customer_id}`}\nالإجمالي: ${formatMoney(row.total)} ج.م\nالحالة: ${QUOTATION_STATUS[row.status]?.label || row.status}\nتاريخ الإصدار: ${formatDate(row.created_at)}${row.expires_at ? `\nصلاحية: ${formatDate(row.expires_at)}` : ''}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  async function handlePrintFromList(row) {
    const q = await handleShowDetail(row.id);
    if (q) setPrintPreviewOpen(true);
  }

  const previewDoc = useMemo(() => (
    activeQuotation ? buildQuotationPrintDoc({ quotation: activeQuotation }) : null
  ), [activeQuotation]);

  return (
    <div className="w-full max-w-[1400px] mx-auto font-sans flex flex-col gap-6 pb-10" dir="rtl">

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-5">
            <div className="bg-violet-100 p-4 rounded-[1.5rem]"><FileText className="h-8 w-8 text-violet-600" /></div>
            <div>
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight">عرض سعر</h1>
              <p className="text-sm font-bold text-slate-500 mt-1 max-w-[45ch]">إعداد عروض سعر للعملاء وتحويلها لفواتير بيع بعد اعتمادها.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 px-6 lg:border-r border-slate-200">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">القيم المعروضة</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter number-fmt">{formatMoney(stats.total)}<span className="text-2sm text-slate-400 font-sans mr-1">ج.م</span></span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-1">معدل التحويل</span>
                 <span className="text-[24px] font-black leading-none text-emerald-700 tracking-tighter number-fmt">{stats.conversionRate}%</span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">إجمالي العروض</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter number-fmt">{total}</span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate page="quotations" action="add">
                <Link data-help="add-button" to="/operations/quotations/new" className="group flex items-center justify-center gap-3 rounded-[1.2rem] bg-violet-600 px-7 py-4 text-[15px] font-black text-white hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 active:scale-95">
                  <Plus className="h-5 w-5" />
                  <span>إصدار عرض جديد</span>
                  <ShortcutKbd id="quotation.new" className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-mono text-white/80" />
                </Link>
              </PermissionGate>
            </div>
          </div>
        </div>

        <div className="px-6 pb-3 bg-white border-b border-slate-100">
          <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-slate-400" /> دليل الحالات:</span>
            <span><strong className="text-blue-600">مُرسل للعميل</strong> = أُرسل للعميل ولم يُبَع بعد</span>
            <span><strong className="text-emerald-600">تحوّل لبيع</strong> = أصبحت فاتورة POS فعلية</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-white">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full lg:w-auto px-2">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap rounded-full px-6 py-3 text-sm font-black transition-all ${
                  statusFilter === tab.value ? "bg-primary text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full lg:w-[300px]">
              <Search className="absolute top-1/2 -translate-y-1/2 right-5 h-5 w-5 text-slate-400" />
              <input ref={searchRef} type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم العميل أو رقم العرض..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pr-12 pl-6 py-3.5 text-sm font-black text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all outline-none"
                onKeyDown={e => handleKeyDown(e, { nextRef: dateFromRef })} />
            </div>
            <button onClick={handleExport} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all" title="تصدير Excel">
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 pb-4 border-b border-slate-100 bg-slate-50/30">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex items-center gap-3">
            <input ref={dateFromRef} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-violet-500"
              onKeyDown={e => handleKeyDown(e, { nextRef: dateToRef, prevRef: searchRef })} />
            <span className="text-slate-300 text-sm">—</span>
            <input ref={dateToRef} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-violet-500"
              onKeyDown={e => handleKeyDown(e, { prevRef: dateFromRef })} />
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => toggleSort(opt.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-all ${
                sortBy === opt.value ? "bg-violet-100 text-violet-700" : "text-slate-400 hover:bg-slate-100"
              }`}>
              {opt.label}
              {sortBy === opt.value && (
                <ArrowUpDown className={`h-3.5 w-3.5 transition-transform ${sortOrder === "ASC" ? "rotate-180" : ""}`} />
              )}
            </button>
          ))}
          {(dateFrom || dateTo || sortBy !== "q.id") && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); setSortBy("q.id"); setSortOrder("DESC"); }}
              className="text-xs font-black text-rose-500 hover:text-rose-700 mr-auto">
              إعادة تعيين
            </button>
          )}
        </div>
      </div>

        <div data-help="main-table" className="min-h-[500px]">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 bg-slate-50/50 rounded-[3rem] border border-slate-100 border-dashed">
              <FileText className="h-20 w-20 opacity-20 mb-6" />
              <p className="text-[16px] font-black text-slate-500">لا توجد عروض أسعار مسجلة.</p>
              <p className="text-sm font-bold text-slate-400 mt-2 mb-6">أول خطوة نحو البيع: أعد عرض سعر احترافي لعميلك.</p>
              <PermissionGate page="quotations" action="add">
                <Link to="/operations/quotations/new" className="flex items-center gap-3 rounded-[1.2rem] bg-violet-600 px-7 py-4 text-sm font-black text-white hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20">
                  <Plus className="h-5 w-5" /> إنشاء أول عرض سعر
                </Link>
              </PermissionGate>
            </div>
          ) : (
            <>
              <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-4">
                <AnimatePresence mode="popLayout">
                  {rows.map(row => {
                    const effStatus = effectiveStatus(row);
                    return (
                      <motion.div key={row.id} layout layoutId={`qtn-${row.id}`} variants={ROW_ANIMATION}
                        className="group relative flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-violet-500/5 hover:border-violet-200 transition-all duration-500 cursor-pointer"
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('a')) return;
                          handleShowDetail(row.id);
                        }}
                      >

                        <div className="flex items-center gap-6 lg:w-[40%]">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 border border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:scale-105 transition-all duration-500">
                            <FileText className="h-6 w-6" strokeWidth={1.5} />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[18px] font-black text-slate-900 tracking-tight">{row.doc_no || formatQuotationNo(row.id)}</span>
                              <StatusBadge status={effStatus} expiresAt={row.expires_at} />
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mt-1">
                              <User className="h-4 w-4 opacity-50" />
                              <span className="truncate max-w-[220px]">{row.customer_name || `عميل #${row.customer_id}`}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-12 lg:w-[40%]">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">تاريخ الإصدار</span>
                            <span className="text-[15px] font-bold text-slate-700 font-mono mt-0.5">{formatDate(row.created_at)}</span>
                          </div>
                          <div className="flex flex-col gap-1 lg:border-r border-slate-100 lg:pr-12">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">إجمالي العرض</span>
                            <span className="text-[24px] font-black text-slate-900 tracking-tighter mt-0.5">{formatMoney(row.total)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 lg:w-[20%] shrink-0">
                          {canConvert(row) && (
                            <PermissionGate page="quotations" action="edit">
                              <button data-help="convert-button" onClick={(e) => { e.stopPropagation(); setConvertTarget(row); }} className="flex h-12 px-6 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-black hover:bg-emerald-600 hover:text-white transition-all">
                                <ShoppingCart className="h-4.5 w-4.5" /> فتح في POS
                              </button>
                            </PermissionGate>
                          )}

                          {canDelete(row) && (
                            <PermissionGate page="quotations" action="delete">
                              <div className="relative" ref={trashMenuId === row.id ? trashMenuRef : null}>
                                <button onClick={(e) => { e.stopPropagation(); setTrashMenuId(trashMenuId === row.id ? null : row.id); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white transition-all" title="حذف العرض">
                                  <Trash2 className="h-5 w-5" />
                                </button>
                                <AnimatePresence>
                                  {trashMenuId === row.id && (
                                    <motion.div initial={{opacity:0, y:10, scale:0.95}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, scale:0.95}} className="absolute left-0 bottom-full mb-3 z-20 w-48 rounded-2xl border border-rose-200/60 bg-white p-2 shadow-2xl origin-bottom-left">
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); setTrashMenuId(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                                        <Trash2 className="h-4 w-4" /> حذف العرض
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </PermissionGate>
                          )}

                          <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                            <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === row.id ? null : row.id); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-primary-600 hover:text-white transition-all">
                              <Plus className="h-5 w-5" />
                            </button>
                            <AnimatePresence>
                              {openMenu === row.id && (
                                <motion.div initial={{opacity:0, y:10, scale:0.95}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, scale:0.95}} className="absolute left-0 bottom-full mb-3 z-20 w-56 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-2xl origin-bottom-left flex flex-col gap-1">
                                  <Link to={`/operations/quotations/new?id=${row.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                                    فتح للتعديل
                                  </Link>
                                  {canSend(row) && (
                                    <PermissionGate page="quotations" action="edit">
                                      <button onClick={(e) => { e.stopPropagation(); handleSend(row.id); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                                        تحديد كمُرسل
                                      </button>
                                    </PermissionGate>
                                  )}
                                  <PermissionGate page="quotations" action="print">
                                    <button onClick={(e) => { e.stopPropagation(); handlePrintFromList(row); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                                      <Printer className="h-4 w-4" /> طباعة
                                    </button>
                                  </PermissionGate>
                                  <PermissionGate page="quotations" action="view">
                                    <button onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(row); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
                                      <Share2 className="h-4 w-4" /> مشاركة واتساب
                                    </button>
                                  </PermissionGate>
                                  {canDelete(row) && (
                                    <PermissionGate page="quotations" action="delete">
                                      <div className="h-px bg-slate-100 my-1 w-full" />
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                                        حذف العرض
                                      </button>
                                    </PermissionGate>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 px-2">
                <span className="text-sm font-bold text-slate-500">
                  إجمالي {total} عرض — صفحة {page} من {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 font-black hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-sm transition-all ${
                          page === pageNum ? "bg-primary text-white shadow-md" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 font-black hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      <Modal open={!!activeQuotation} onClose={() => setActiveQuotation(null)} title={activeQuotation ? `عرض سعر ${activeQuotation.doc_no || formatQuotationNo(activeQuotation.id)}` : "عرض سعر"} maxWidth="max-w-5xl" showDetach={false}>
        {activeQuotation && (
          <div className="space-y-6 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: "العميل", value: activeQuotation.customer_name || "—" },
                { label: "تاريخ الإصدار", value: formatDate(activeQuotation.created_at) },
                { label: "صلاحية العرض", value: activeQuotation.expires_at ? formatDate(activeQuotation.expires_at) : "بدون انتهاء" },
                { label: "طريقة الدفع", value: PAYMENT_TYPE_LABELS[activeQuotation.payment_type] || activeQuotation.payment_type || "—" },
                { label: "عدد الأصناف", value: `${(activeQuotation.lines || []).length} صنف` },
                { label: "زيادة / نقصان", value: `${formatMoney(activeQuotation.increase || 0)} / ${formatMoney(activeQuotation.decrease || 0)}` },
                { label: "الضريبة", value: activeQuotation.tax_enabled ? `${formatMoney(activeQuotation.tax_amount || 0)} (${activeQuotation.tax_rate || 0}%)` : "غير مفعّلة" },
                { label: "المحرر", value: activeQuotation.created_by_name || "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{item.label}</span>
                  <span className="text-sm font-black text-slate-900">{item.value}</span>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:col-span-2 xl:col-span-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">الحالة</span>
                <StatusBadge status={effectiveStatus(activeQuotation)} expiresAt={activeQuotation.expires_at} showHint />
              </div>
            </div>

            {activeQuotation.notes && (
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200/50 p-5">
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 block mb-2">ملاحظات</span>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{activeQuotation.notes}</p>
              </div>
            )}

            <div className="rounded-[1.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col max-h-[420px]">
              <div className="grid grid-cols-[1fr_80px_90px_90px_90px_110px] bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <div className="px-4 py-3">الصنف</div>
                <div className="px-2 py-3 text-center">الكمية</div>
                <div className="px-2 py-3 text-center">السعر</div>
                <div className="px-2 py-3 text-center">خصم</div>
                <div className="px-2 py-3 text-center">الوحدة</div>
                <div className="px-4 py-3 text-left">الإجمالي</div>
              </div>
              <div className="overflow-y-auto divide-y divide-slate-100">
                {(activeQuotation.lines || []).map((line) => (
                  <div key={line.id} className="grid grid-cols-[1fr_80px_90px_90px_90px_110px] items-center px-2 py-3 hover:bg-slate-50/80">
                    <div className="px-2">
                      <p className="text-sm font-black text-slate-900 break-words leading-tight">{line.item_name}</p>
                      <p className="font-mono text-[10px] text-slate-400 break-words">{line.item_code || line.barcode || "—"}</p>
                    </div>
                    <div className="text-center font-black text-sm">{line.quantity}</div>
                    <div className="text-center font-mono text-sm text-slate-600">{formatMoney(line.unit_price)}</div>
                    <div className="text-center font-mono text-sm text-rose-500">{Number(line.discount_amount) > 0 ? formatMoney(line.discount_amount) : "—"}</div>
                    <div className="text-center text-[11px] font-bold text-slate-500">{line.unit_name || "—"}</div>
                    <div className="px-2 text-left number-fmt-primary text-sm">{formatMoney(line.line_total)}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 bg-violet-950 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black opacity-70">المجموع الفرعي</span>
                  <span className="text-lg number-fmt-primary">{formatMoney(activeQuotation.lines?.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.unit_price || 0), 0) || 0)}</span>
                </div>
                {(Number(activeQuotation.increase) > 0 || Number(activeQuotation.decrease) > 0) && (
                  <div className="flex items-center justify-end gap-4">
                    {Number(activeQuotation.increase) > 0 && (
                      <span className="text-sm font-black text-blue-300">+ {formatMoney(activeQuotation.increase)} رسوم</span>
                    )}
                    {Number(activeQuotation.decrease) > 0 && (
                      <span className="text-sm font-black text-rose-300">- {formatMoney(activeQuotation.decrease)} خصم</span>
                    )}
                    <span className="text-sm font-black opacity-70">الإجمالي النهائي:</span>
                    <span className="text-3xl number-fmt-primary">{formatMoney(activeQuotation.total)}</span>
                    <span className="text-sm font-sans opacity-50">ج.م</span>
                  </div>
                )}
                {!Number(activeQuotation.increase) && !Number(activeQuotation.decrease) && (
                  <div className="flex items-center justify-between border-t border-violet-800/50 pt-2">
                    <span className="text-sm font-black opacity-70">الإجمالي النهائي</span>
                    <span className="text-3xl number-fmt-primary">{formatMoney(activeQuotation.total)} <span className="text-sm font-sans opacity-50">ج.م</span></span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-between items-center pt-2 border-t border-slate-100">
              <div className="flex flex-wrap gap-2">
                {canConvert(activeQuotation) && (
                  <PermissionGate page="quotations" action="edit">
                    <button onClick={() => handleConvertToPos(activeQuotation)}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 shadow-md">
                      <ShoppingCart className="h-4 w-4" /> فتح في نقطة البيع
                    </button>
                  </PermissionGate>
                )}
                {activeQuotation.status !== "converted" && (
                  <PermissionGate page="quotations" action="edit">
                    <Link to={`/operations/quotations/new?id=${activeQuotation.id}`}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                      <Pencil className="h-4 w-4" /> تعديل العرض
                    </Link>
                  </PermissionGate>
                )}
                {canSend(activeQuotation) && (
                  <PermissionGate page="quotations" action="edit">
                    <button onClick={() => handleSend(activeQuotation.id)}
                      className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-100">
                      <Send className="h-4 w-4" /> تحديد كمُرسل
                    </button>
                  </PermissionGate>
                )}
                <PermissionGate page="quotations" action="print">
                  <button onClick={() => setPrintPreviewOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                    <Eye className="h-4 w-4" /> معاينة وطباعة
                  </button>
                </PermissionGate>
                {canDelete(activeQuotation) && (
                  <PermissionGate page="quotations" action="delete">
                    <button onClick={() => setDeleteTarget(activeQuotation)}
                      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-600 hover:bg-rose-600 hover:text-white transition-all">
                      <Trash2 className="h-4 w-4" /> حذف العرض
                    </button>
                  </PermissionGate>
                )}
              </div>
              <button onClick={() => setActiveQuotation(null)}
                className="flex items-center gap-2 rounded-xl bg-slate-100 px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-200">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      <PrintPreviewModal
        open={printPreviewOpen && !!previewDoc}
        onClose={() => setPrintPreviewOpen(false)}
        invoice={previewDoc || {}}
        settings={printSettings}
        docType="quotation"
        operationLabel="عرض سعر"
      />

      <ConfirmDialog
        open={!!convertTarget}
        title="فتح العرض في نقطة البيع"
        message={`سيتم فتح نقطة البيع مع كل بيانات ${convertTarget?.doc_no || formatQuotationNo(convertTarget?.id)} للعميل "${convertTarget?.customer_name}" — يمكنك مراجعة الأصناف والأسعار قبل تأكيد البيع.`}
        onConfirm={() => handleConvertToPos()}
        onCancel={() => setConvertTarget(null)}
      />

      {deleteTarget && <DramaticDeleteConfirm itemName={deleteTarget.doc_no || formatQuotationNo(deleteTarget.id)} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
