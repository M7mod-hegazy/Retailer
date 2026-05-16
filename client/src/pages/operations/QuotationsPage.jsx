import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  FileText, Plus, Printer, Calendar, User, Search, X, Copy, Send,
  Trash2, AlertTriangle, TrendingUp, Sparkles, ChevronLeft
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { DramaticDeleteConfirm } from "../../components/ui/DramaticDeleteConfirm";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import PermissionGate from "../../components/ui/PermissionGate";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("ar-EG");
}

const STATUS_MAP = {
  draft:     { label: "مسودة",          cls: "bg-slate-100 text-slate-700 border-slate-200" },
  sent:      { label: "تم الإرسال",     cls: "bg-blue-50 text-blue-700 border-blue-100" },
  converted: { label: "تم التحويل",     cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  expired:   { label: "منتهي الصلاحية", cls: "bg-rose-50 text-rose-700 border-rose-100" },
};
const STATUS_TABS = [
  { value: "", label: "الكل" },
  { value: "draft", label: "مسودة" },
  { value: "sent", label: "مُرسل" },
  { value: "converted", label: "محوّل" },
  { value: "expired", label: "منتهي" },
];

function StatusBadge({ status, expiresAt }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const isExpired = expiry && expiry < today && status !== "converted";
  const daysLeft = expiry ? Math.ceil((expiry - today) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && status !== "converted" && !isExpired;

  if (isExpired) {
    return <span className="rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border-rose-200">منتهي الصلاحية</span>;
  }
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-widest ${s.cls}`}>{s.label}</span>
      {expiringSoon && (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1 shadow-sm">
          <AlertTriangle className="h-3 w-3" /> متبقي {daysLeft} أيام
        </span>
      )}
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

  const [activeQuotation, setActiveQuotation] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const menuRef = useRef(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    function handler(e) { if (!menuRef.current?.contains(e.target)) setOpenMenu(null); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/api/quotations?${params}`);
      setRows(res.data.data || []);
    } catch { toast.error("فشل تحميل البيانات"); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, statusFilter]);

  async function handleShowDetail(id) {
    try {
      const res = await api.get(`/api/quotations/${id}`);
      setActiveQuotation(res.data.data);
    } catch { toast.error("خطأ في تحميل التفاصيل"); }
  }

  async function handleConvert() {
    if (!convertTarget) return;
    try {
      await api.post(`/api/quotations/${convertTarget.id}/convert-to-invoice`);
      toast.success(`تم تحويل العرض إلى فاتورة بيع بنجاح`);
      setConvertTarget(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء التحويل");
      setConvertTarget(null);
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (row.status !== "converted" && row.expires_at && new Date(row.expires_at) < today) return "expired";
    return row.status;
  }

  const stats = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    const converted = rows.filter(r => r.status === "converted").length;
    const drafts = rows.filter(r => r.status === "draft").length;
    const conversionRate = rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0;
    return { total, converted, drafts, count: rows.length, conversionRate };
  }, [rows]);

  const canDelete = row => effectiveStatus(row) !== "converted";
  const canSend = row => row.status === "draft";
  const canConvert = row => row.status !== "converted";

  return (
    <div className="w-full max-w-[1400px] mx-auto font-sans flex flex-col gap-6 pb-10" dir="rtl">
      
      {/* 
        AIDA: ATTENTION (COMPACT DASHBOARD HERO)
      */}
      {/* 
        THE UNIFIED COMMAND CENTER 
      */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
        
        {/* Top Section: Title, Stats, Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-5">
            <div className="bg-violet-100 p-4 rounded-[1.5rem]"><FileText className="h-8 w-8 text-violet-600" /></div>
            <div>
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight">عروض الأسعار</h1>
              <p className="text-[14px] font-bold text-slate-500 mt-1 max-w-[45ch]">إدارة ومتابعة عروض الأسعار المرسلة للعملاء لزيادة المبيعات.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 px-6 lg:border-r border-slate-200">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">القيم المعروضة</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter font-mono">{formatMoney(stats.total)}<span className="text-[12px] text-slate-400 font-sans mr-1">ج.م</span></span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-1">معدل التحويل</span>
                 <span className="text-[24px] font-black leading-none text-emerald-700 tracking-tighter font-mono">{stats.conversionRate}%</span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate page="quotations" action="add">
                <Link data-help="add-button" to="/operations/quotations/new" className="group flex items-center justify-center gap-3 rounded-[1.2rem] bg-violet-600 px-7 py-4 text-[15px] font-black text-white hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 active:scale-95">
                  <Plus className="h-5 w-5" /> 
                  <span>إصدار عرض جديد</span>
                </Link>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Bottom Section: Filters & Search */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-white">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full lg:w-auto px-2">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap rounded-full px-6 py-3 text-[14px] font-black transition-all ${
                  statusFilter === tab.value ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div data-help="search-bar" className="relative w-full lg:w-[400px]">
            <Search className="absolute top-1/2 -translate-y-1/2 right-5 h-5 w-5 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم العميل أو رقم العرض..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 pr-12 pl-6 py-3.5 text-[14px] font-black text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all outline-none" />
          </div>
        </div>
      </div>

        <div data-help="main-table" className="min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-violet-400">
              <div className="w-12 h-12 border-[3px] border-violet-100 border-t-violet-600 rounded-full animate-spin mb-6" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 bg-slate-50/50 rounded-[3rem] border border-slate-100 border-dashed">
              <FileText className="h-20 w-20 opacity-20 mb-6" />
              <p className="text-[16px] font-black text-slate-500">لا توجد عروض أسعار مسجلة.</p>
            </div>
          ) : (
            <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {rows.map(row => {
                  const effStatus = effectiveStatus(row);
                  return (
                    <motion.div key={row.id} layout layoutId={`qtn-${row.id}`} variants={ROW_ANIMATION} 
                      className="group relative flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-violet-500/5 hover:border-violet-200 transition-all duration-500 cursor-pointer"
                      onClick={(e) => {
                        // Prevent triggering detail modal if clicking actions
                        if (e.target.closest('button') || e.target.closest('a')) return;
                        handleShowDetail(row.id);
                      }}
                    >
                      
                      <div className="flex items-center gap-6 lg:w-[40%]">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 border border-slate-100 group-hover:bg-slate-950 group-hover:text-white group-hover:scale-105 transition-all duration-500">
                          <FileText className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[18px] font-black text-slate-900 tracking-tight">QTN-{String(row.id).padStart(5, "0")}</span>
                            <StatusBadge status={effStatus} expiresAt={row.expires_at} />
                          </div>
                          <div className="flex items-center gap-2 text-[14px] font-bold text-slate-500 mt-1">
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
                          <span className="text-[24px] font-black text-slate-900 font-mono tracking-tighter mt-0.5">{formatMoney(row.total)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 lg:w-[20%] shrink-0">
                        {canConvert(row) && (
                          <PermissionGate page="quotations" action="edit">
                            <button onClick={(e) => { e.stopPropagation(); setConvertTarget(row); }} className="flex h-12 px-6 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-[14px] font-black hover:bg-emerald-600 hover:text-white transition-all">
                              <Sparkles className="h-4.5 w-4.5" /> تحويل لبيع
                            </button>
                          </PermissionGate>
                        )}

                        <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === row.id ? null : row.id); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-950 hover:text-white transition-all">
                            <Plus className="h-5 w-5" />
                          </button>
                          <AnimatePresence>
                            {openMenu === row.id && (
                              <motion.div initial={{opacity:0, y:10, scale:0.95}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, scale:0.95}} className="absolute left-0 bottom-full mb-3 z-20 w-56 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-2xl origin-bottom-left flex flex-col gap-1">
                                <Link to={`/operations/quotations/new?id=${row.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                                  فتح للتعديل
                                </Link>
                                {canSend(row) && (
                                  <PermissionGate page="quotations" action="edit">
                                    <button onClick={(e) => { e.stopPropagation(); handleSend(row.id); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                                      تحديد كمُرسل
                                    </button>
                                  </PermissionGate>
                                )}
                                <PermissionGate page="quotations" action="add">
                                  <button onClick={(e) => { e.stopPropagation(); handleDuplicate(row.id); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-black text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                                    نسخ العرض
                                  </button>
                                </PermissionGate>
                                {canDelete(row) && (
                                  <PermissionGate page="quotations" action="delete">
                                    <div className="h-px bg-slate-100 my-1 w-full" />
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
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
          )}
        </div>

      {/* Cinematic Detail Overlay */}
      <Modal open={!!activeQuotation} onClose={() => setActiveQuotation(null)} title={`عرض سعر QTN-${String(activeQuotation?.id || 0).padStart(5, "0")}`} maxWidth="max-w-4xl">
        {activeQuotation && (
          <div className="space-y-10 p-2">
            <div className="flex flex-col md:flex-row gap-8 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-200/50">
              <div className="flex-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3">العميل المُستهدف</span>
                <span className="text-[18px] font-black text-slate-900">{activeQuotation.customer_name}</span>
              </div>
              <div className="w-px bg-slate-200 hidden md:block" />
              <div className="flex-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3">الحالة الحالية</span>
                <StatusBadge status={activeQuotation.status} expiresAt={activeQuotation.expires_at} />
              </div>
              {activeQuotation.expires_at && (
                <>
                  <div className="w-px bg-slate-200 hidden md:block" />
                  <div className="flex-1">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-3">صلاحية العرض حتى</span>
                    <span className="text-[16px] font-black text-slate-900 font-mono">{formatDate(activeQuotation.expires_at)}</span>
                  </div>
                </>
              )}
            </div>

            {activeQuotation.notes && (
              <div className="rounded-3xl bg-amber-50/80 border border-amber-200/50 p-8 shadow-sm">
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 block mb-3">ملاحظات و بنود خاصة</span>
                <p className="text-[15px] font-bold text-slate-700 leading-relaxed max-w-[75ch]">{activeQuotation.notes}</p>
              </div>
            )}

            <div className="rounded-[2.5rem] border border-slate-200/60 bg-white overflow-hidden shadow-sm flex flex-col max-h-[500px]">
              <div className="grid grid-cols-[1fr_100px_120px_100px_150px] bg-slate-50 border-b border-slate-200 px-2">
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50">الصنف المقترح</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">الكمية</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">سعر الوحدة</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-rose-500/70 tracking-widest border-l border-slate-200/50 text-center">خصم ممنوح</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest text-left">صافي الإجمالي</div>
              </div>
              <div className="overflow-y-auto p-4 space-y-3">
                {(activeQuotation.lines || []).map(line => (
                  <div key={line.id} className="grid grid-cols-[1fr_100px_120px_100px_150px] items-center rounded-2xl hover:bg-slate-50 transition-colors p-4">
                    <div className="px-2 border-l border-slate-100">
                      <p className="text-[15px] font-black text-slate-900 truncate">{line.item_name}</p>
                      {line.description && <p className="text-[13px] font-bold text-slate-400 mt-1 truncate">{line.description}</p>}
                    </div>
                    <div className="px-2 text-center border-l border-slate-100 font-black text-[16px]">{line.quantity}</div>
                    <div className="px-2 text-center border-l border-slate-100 font-mono text-[15px] text-slate-500">{formatMoney(line.unit_price)}</div>
                    <div className="px-2 text-center border-l border-slate-100 font-mono text-[15px] text-rose-500">
                      {Number(line.discount_amount) > 0 ? formatMoney(line.discount_amount) : "—"}
                    </div>
                    <div className="px-2 text-left font-black font-mono text-[16px] text-slate-900">{formatMoney(line.line_total)}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-slate-950 px-10 py-8 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-violet-900/40 via-transparent to-transparent pointer-events-none" />
                <span className="text-[12px] font-black uppercase tracking-widest opacity-60 relative z-10">إجمالي قيمة العرض</span>
                <span className="text-[3rem] font-black font-mono tracking-tighter leading-none relative z-10">{formatMoney(activeQuotation.total)} <span className="text-[16px] font-sans opacity-50">ج.م</span></span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-6">
              <PermissionGate page="quotations" action="print">
                <button onClick={() => window.print()}
                  className="flex items-center gap-3 rounded-[1.5rem] border-2 border-slate-200 px-8 py-4 text-[15px] font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                  <Printer className="h-5 w-5" /> طباعة المستند
                </button>
              </PermissionGate>
              <button onClick={() => setActiveQuotation(null)}
                className="flex items-center gap-2 rounded-[1.5rem] bg-slate-100 px-12 py-4 text-[15px] font-black text-slate-900 hover:bg-slate-200 transition-all active:scale-95">
                إغلاق <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Convert Confirm */}
      <ConfirmDialog open={!!convertTarget} title="تحويل إلى فاتورة مبيعات" message={`سيتم إصدار فاتورة بيع نهائية للعميل "${convertTarget?.customer_name}" بقيمة ${formatMoney(convertTarget?.total)} ج.م. هل توافق على التنفيذ؟`} onConfirm={handleConvert} onCancel={() => setConvertTarget(null)} />
      {/* Delete Confirm */}
      {deleteTarget && <DramaticDeleteConfirm itemName={`QTN-${String(deleteTarget.id).padStart(5, "0")}`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}
