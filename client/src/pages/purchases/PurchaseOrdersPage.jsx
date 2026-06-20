import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Plus, Calendar, User, PackageCheck, Clock, CheckCircle2,
  MoreVertical, Eye, Warehouse, Search, X, BadgeCheck, XCircle, Package,
  ChevronRight, Pencil, Printer
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { adaptForServer } from "../../utils/search";
import PermissionGate from "../../components/ui/PermissionGate";
import Highlight from "../../components/ui/Highlight";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import { formatNumber } from "../../utils/currency";

// Single shared vocabulary used by the badges, filters and counter.
const STATUS_MAP = {
  pending:            { label: "معلق",          cls: "bg-amber-100/50 text-amber-700 border-amber-200/50" },
  approved:           { label: "معلق",          cls: "bg-amber-100/50 text-amber-700 border-amber-200/50" },
  partially_received: { label: "مستلم جزئياً",  cls: "bg-indigo-100/50 text-indigo-700 border-indigo-200/50" },
  received:           { label: "مستلم",         cls: "bg-emerald-100/50 text-emerald-700 border-emerald-200/50" },
  cancelled:          { label: "ملغى",          cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const STATUS_TABS = [
  { value: "", label: "الكل" },
  { value: "open", label: "معلق" },
  { value: "received", label: "مستلم" },
];

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`px-2.5 py-1 rounded-md text-[11px] number-fmt-primary uppercase tracking-widest border ${s.cls}`}>
      {s.label}
    </span>
  );
}

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};
const ROW_ANIMATION = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 120, damping: 20, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
};

function formatMoney(v) {
  return formatNumber(v);
}

export default function PurchaseOrdersPage() {
  usePageTour('purchase_orders');
  const navigate = useNavigate();
  const handleKeyDown = useFieldNavigation();
  const searchRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [warehouses, setWarehouses] = useState([]);
  const [convertingId, setConvertingId] = useState(null);

  const [detailOrder, setDetailOrder] = useState(null);
  const [printPreview, setPrintPreview] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
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
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const [r, w] = await Promise.all([
        api.get(`/api/purchase-orders?${params}`),
        api.get("/api/warehouses"),
      ]);
      setRows(r.data.data || []);
      setWarehouses(w.data.data || []);
    } catch { toast.error("فشل تحميل البيانات"); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, statusFilter, dateFrom, dateTo]);

  async function handleConvert(id) {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      const order = res.data.data;
      setConvertingId(id); // triggers the row success animation
      const prefill = {
        source_purchase_order_id: order.id,
        po_doc_no: order.doc_no || `PO-${String(order.id).padStart(5, "0")}`,
        supplier_id: order.supplier_id,
        supplier_name: order.supplier_name,
        warehouse_id: order.warehouse_id || null,
        discount: order.discount || 0,
        increase: order.increase || 0,
        lines: (order.lines || [])
          .filter(l => Number(l.remaining_quantity) > 0)
          .map(l => ({
            purchase_order_line_id: l.id,
            item_id: l.item_id,
            name: l.item_name,
            code: l.item_code,
            quantity: l.remaining_quantity,
            unit_cost: l.unit_cost,
            selling_price: l.selling_price || 0,
            wholesale_price: l.wholesale_price || 0,
            unit_id: l.unit_id || null,
            warehouse_id: l.warehouse_id || null,
          })),
      };
      setTimeout(() => navigate("/purchases/new", { state: { fromPurchaseOrder: prefill } }), 650);
    } catch {
      toast.error("تعذر تجهيز الفاتورة من أمر التوريد");
      setConvertingId(null);
    }
  }

  async function openDetailModal(id) {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      setDetailOrder(res.data.data);
    } catch { toast.error("خطأ في تحميل التفاصيل"); }
  }

  async function handleCancel() {
    try {
      await api.patch(`/api/purchase-orders/${confirmCancel}/cancel`);
      toast.success("تم إلغاء الأمر");
      setConfirmCancel(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل الإلغاء");
      setConfirmCancel(null);
    }
  }

  const stats = useMemo(() => ({
    open: rows.filter(r => r.status === "pending" || r.status === "approved" || r.status === "partially_received").length,
    total: rows.length,
  }), [rows]);

  return (
    <div className="w-full max-w-[1400px] mx-auto font-sans flex flex-col gap-6 pb-10" dir="rtl">
      
      {/* 
        THE UNIFIED COMMAND CENTER 
      */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 flex flex-col overflow-hidden">
        
        {/* Top Section: Title, Stats, Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-100 p-4 rounded-[1.5rem]"><Package className="h-8 w-8 text-indigo-600" /></div>
            <div>
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight">طلبات التوريد</h1>
              <p className="text-sm font-bold text-slate-500 mt-1 max-w-[50ch]">أوامر توريد — ليست فواتير. تُحوَّل إلى فاتورة مشتريات عند الاستلام.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 px-6 lg:border-r border-slate-200">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-1">معلق</span>
                 <span className="text-[24px] font-black leading-none text-amber-700 tracking-tighter number-fmt">{stats.open}</span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">إجمالي الأوامر</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter number-fmt">{stats.total}</span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate page="purchase_orders" action="add">
                <Link data-help="add-button" to="/purchases/orders/new" className="group flex items-center justify-center gap-3 rounded-[1.2rem] bg-indigo-600 px-7 py-4 text-[15px] font-black text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                  <Plus className="h-5 w-5" /> 
                  <span>أمر توريد جديد</span>
                </Link>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Bottom Section: Filters & Search */}
        <div className="flex flex-col gap-3 p-4 bg-white">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
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
            <div data-help="search-bar" className="relative w-full lg:w-[420px]">
              <Search className="absolute top-1/2 -translate-y-1/2 right-5 h-5 w-5 text-slate-400" />
              <input ref={searchRef} type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم الأمر، المورد، اسم الصنف أو الكود/الباركود..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 pr-12 pl-10 py-3.5 text-sm font-black text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none" />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute top-1/2 -translate-y-1/2 left-4 text-slate-400 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Date period filter */}
          <div className="flex flex-wrap items-center gap-2 px-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">الفترة</span>
            <div className="flex items-center gap-1.5">
              <span className="text-2sm font-bold text-slate-500">من</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2sm font-bold text-slate-500">إلى</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
            </div>
            {(dateFrom || dateTo || searchTerm) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setSearchTerm(""); }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 text-rose-600 px-3 py-2 text-2sm font-black hover:bg-rose-100 transition-colors">
                <X className="h-3.5 w-3.5" /> مسح الفلاتر
              </button>
            )}
          </div>
        </div>
      </div>

        <div data-help="main-table" className="min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-indigo-400">
              <div className="w-12 h-12 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 bg-slate-50/50 rounded-[2rem] border border-slate-100 border-dashed">
              <Package className="h-20 w-20 opacity-20 mb-6" />
              <p className="text-[16px] font-black text-slate-500">الشبكة خالية. لا توجد أوامر مطابقة للبحث.</p>
            </div>
          ) : (
            <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {rows.map((row) => {
                  const canReceive = row.status === "pending" || row.status === "approved" || row.status === "partially_received";
                  const canCancel = row.status !== "received" && row.status !== "cancelled";
                  const canEdit = row.status === "pending" || row.status === "approved";

                  return (
                    <motion.div key={row.id} layout layoutId={`row-${row.id}`} variants={ROW_ANIMATION}
                      animate={convertingId === row.id ? { scale: [1, 1.02, 1], boxShadow: "0 0 0 3px rgba(16,185,129,0.45)" } : undefined}
                      transition={convertingId === row.id ? { duration: 0.6 } : undefined}
                      className="group relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white border border-slate-200/60 rounded-[1.5rem] p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200/60 transition-all duration-500">
                      
                      <div className="flex items-center gap-6 lg:w-[35%]">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 border border-slate-100 group-hover:bg-primary group-hover:text-white group-hover:scale-105 transition-all duration-500">
                          <Package className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[18px] font-black text-slate-900 tracking-tight">
                              <Highlight text={row.doc_no || `PO-${String(row.id).padStart(5, "0")}`} query={searchTerm} />
                            </span>
                            <StatusBadge status={row.status} />
                          </div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                            <User className="h-4 w-4 opacity-50" />
                            <span className="truncate max-w-[200px]">
                              {row.supplier_name
                                ? <Highlight text={row.supplier_name} query={searchTerm} />
                                : (row.supplier_id ? `مورد #${row.supplier_id}` : "بدون مورد")}
                            </span>
                          </div>
                          {searchTerm && row.matched_lines?.length > 0 && (
                            <div className="flex flex-col gap-1 mt-0.5">
                              {row.matched_lines.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-2 text-2sm font-bold bg-indigo-50/70 rounded-lg px-2.5 py-1 w-fit max-w-[360px]">
                                  <Package className="h-3.5 w-3.5 shrink-0 text-indigo-500 opacity-80" />
                                  <span className="truncate text-indigo-700">
                                    <Highlight text={m.name} query={searchTerm} />
                                  </span>
                                  {m.code && (
                                    <span className="shrink-0 font-mono text-[11px] text-slate-500 bg-white/70 border border-slate-200 rounded px-1.5 py-0.5">
                                      <Highlight text={m.code} query={searchTerm} />
                                    </span>
                                  )}
                                  <span className="shrink-0 number-fmt text-[11px] font-black text-indigo-600">×{m.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-8 lg:w-[40%] px-4">
                        <div className="flex flex-col gap-1 w-full max-w-[200px]">
                          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                            <span>معدل الإنجاز</span>
                            <span className="text-slate-900">{row.status === "received" ? "100%" : row.status === "partially_received" ? "60%" : "0%"}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden relative">
                            <div className={`absolute top-0 bottom-0 left-0 transition-all duration-1000 ease-out ${
                              row.status === "received" ? "bg-emerald-500 w-full" : row.status === "partially_received" ? "bg-indigo-500 w-[60%]" : "bg-transparent w-0"
                            }`} />
                          </div>
                        </div>
                        
                        <div className="hidden xl:flex flex-col gap-1 border-r border-slate-100 pr-8">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">تاريخ الأمر</span>
                          <span className="text-sm font-bold text-slate-700 font-mono tracking-tight">{new Date(row.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 lg:justify-end lg:w-[25%]">
                        {canReceive && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <button data-help="convert-button" onClick={() => handleConvert(row.id)} disabled={convertingId === row.id}
                              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-black hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-100">
                              {convertingId === row.id
                                ? (<><CheckCircle2 className="h-5 w-5 animate-pulse" /> جاري التحويل…</>)
                                : (<>استلام / تحويل لفاتورة</>)}
                            </button>
                          </PermissionGate>
                        )}

                        {canEdit && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <button onClick={() => navigate(`/purchases/orders/${row.id}/edit`)} title="تعديل الأمر" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-amber-500 hover:text-white transition-all">
                              <Pencil className="h-5 w-5" />
                            </button>
                          </PermissionGate>
                        )}

                        <button onClick={() => openDetailModal(row.id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-primary-600 hover:text-white transition-all">
                          <Eye className="h-5 w-5" />
                        </button>

                        {canCancel && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                              <button onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all">
                                <XCircle className="h-5 w-5" />
                              </button>
                              <AnimatePresence>
                                {openMenu === row.id && (
                                  <motion.div initial={{opacity:0, y:10, scale:0.95}} animate={{opacity:1, y:0, scale:1}} exit={{opacity:0, scale:0.95}} className="absolute left-0 bottom-full mb-3 z-20 w-48 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-2xl origin-bottom-left">
                                    <button onClick={() => { setConfirmCancel(row.id); setOpenMenu(null); }} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                                      <XCircle className="h-4.5 w-4.5" /> إلغاء الأمر
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </PermissionGate>
                        )}
                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

      {/* Detail Modal — full breakdown */}
      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={`طلب التوريد ${detailOrder?.doc_no || ""}`} maxWidth="max-w-4xl">
        {detailOrder && (
          <div className="space-y-6 p-2">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-slate-900">{detailOrder.doc_no}</span>
              <StatusBadge status={detailOrder.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200/50">
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">المورد</span>
                <span className="text-sm font-black text-slate-900">{detailOrder.supplier_name || (detailOrder.supplier_id ? `مورد #${detailOrder.supplier_id}` : "بدون مورد")}</span>
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">الحالة</span>
                <StatusBadge status={detailOrder.status} />
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">تاريخ الإصدار</span>
                <span className="text-sm font-black font-mono text-slate-900">{new Date(detailOrder.created_at).toLocaleString("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">المخزن المقترح</span>
                <span className="text-sm font-black text-slate-900">{warehouses.find(w => String(w.id) === String(detailOrder.warehouse_id))?.name || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">المحرر</span>
                <span className="text-sm font-black text-slate-900">{detailOrder.created_by_name || "—"}</span>
              </div>
            </div>

            {detailOrder.notes && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2.5 text-2sm font-bold text-amber-800">📝 {detailOrder.notes}</div>
            )}

            <div className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_60px_60px_80px_80px_80px_80px_90px_100px] bg-slate-50 border-b border-slate-200">
                {["الكود", "الصنف", "الكمية", "الوحدة", "التكلفة", "سعر البيع", "سعر الجملة", "الربح", "المخزن", "الإجمالي"].map((h, i) => (
                  <div key={i} className={`px-2 py-3 text-[11px] font-black uppercase text-slate-400 tracking-widest ${i === 9 ? "text-left" : "text-center"} ${i < 9 ? "border-l border-slate-200/50" : ""} ${i === 1 ? "!text-right" : ""}`}>{h}</div>
                ))}
              </div>
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
                {(detailOrder.lines || []).map(l => {
                  const profit = Number(l.selling_price || 0) - Number(l.unit_cost || 0);
                  const pct = Number(l.unit_cost) > 0 ? (profit / Number(l.unit_cost)) * 100 : 0;
                  return (
                    <div key={l.id} className="grid grid-cols-[80px_1fr_60px_60px_80px_80px_80px_80px_90px_100px] items-center px-1 py-2 hover:bg-slate-50/60">
                      <div className="px-2 text-center font-mono text-2sm text-slate-500">{l.item_code || "—"}</div>
                      <div className="px-2 text-sm font-bold text-slate-800 break-words leading-tight">{l.item_name}</div>
                      <div className="px-2 text-center font-black text-sm">{l.quantity}</div>
                      <div className="px-2 text-center text-2sm font-bold text-slate-600">{l.unit_name || "أساسية"}</div>
                      <div className="px-2 text-center number-fmt-primary text-sm text-slate-500">{formatMoney(l.unit_cost)}</div>
                      <div className="px-2 text-center number-fmt-primary text-sm text-emerald-700">{formatMoney(l.selling_price || 0)}</div>
                      <div className="px-2 text-center number-fmt-primary text-sm text-slate-600">{formatMoney(l.wholesale_price || 0)}</div>
                      <div className="px-2 text-center">
                        <span className={`number-fmt-primary text-sm ${profit > 0 ? "text-emerald-600" : profit < 0 ? "text-rose-600" : "text-slate-400"}`}>
                          {formatMoney(profit)}{Number(l.selling_price) > 0 && Number(l.unit_cost) > 0 ? ` (${pct.toFixed(1)}%)` : ""}
                        </span>
                      </div>
                      <div className="px-2 text-center text-2sm font-bold text-slate-600 truncate">{l.warehouse_name || "—"}</div>
                      <div className="px-2 text-left number-fmt-primary text-sm text-slate-900">{formatMoney(l.quantity * l.unit_cost)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 px-5 py-3 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-2sm font-bold text-slate-500">عدد الأصناف: <span className="font-black text-slate-800">{(detailOrder.lines || []).length}</span></span>
                  <div className="flex items-center gap-2">
                    <span className="text-2sm font-bold text-slate-400">المجموع الفرعي:</span>
                    <span className="number-fmt-primary text-sm font-black text-slate-700">{formatMoney((detailOrder.lines || []).reduce((a, l) => a + l.quantity * l.unit_cost, 0))}</span>
                  </div>
                </div>
                {(Number(detailOrder.discount) > 0 || Number(detailOrder.increase) > 0) && (
                  <div className="flex items-center justify-end gap-4">
                    {Number(detailOrder.discount) > 0 && (
                      <span className="text-2sm font-black text-rose-500 number-fmt">- {formatMoney(detailOrder.discount)} خصم</span>
                    )}
                    {Number(detailOrder.increase) > 0 && (
                      <span className="text-2sm font-black text-blue-500 number-fmt">+ {formatMoney(detailOrder.increase)} رسوم</span>
                    )}
                    <span className="text-2sm font-bold text-slate-500">الإجمالي النهائي:</span>
                    <span className="number-fmt-primary text-[18px] font-black text-emerald-700">
                      {formatMoney(Math.max(0, (detailOrder.lines || []).reduce((a, l) => a + l.quantity * l.unit_cost, 0) - Number(detailOrder.discount || 0) + Number(detailOrder.increase || 0)))}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">ج.م</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <PermissionGate page="purchase_orders" action="print">
                <button onClick={() => { setPrintOrder(detailOrder); setPrintPreview(true); }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all shadow-sm">
                  <Printer className="h-4 w-4" /> طباعة
                </button>
              </PermissionGate>
              {(detailOrder.status === "pending" || detailOrder.status === "approved" || detailOrder.status === "partially_received") && (
                <PermissionGate page="purchase_orders" action="edit">
                  <button onClick={() => { const oid = detailOrder.id; setDetailOrder(null); handleConvert(oid); }}
                    className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 px-5 py-3 text-sm font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                    تحويل لفاتورة
                  </button>
                </PermissionGate>
              )}
              {(detailOrder.status === "pending" || detailOrder.status === "approved") && (
                <PermissionGate page="purchase_orders" action="edit">
                  <button onClick={() => { const oid = detailOrder.id; setDetailOrder(null); navigate(`/purchases/orders/${oid}/edit`); }}
                    className="flex items-center gap-2 rounded-xl bg-amber-50 text-amber-700 px-5 py-3 text-sm font-black hover:bg-amber-500 hover:text-white transition-all shadow-sm">
                    <Pencil className="h-4 w-4" /> تعديل الأمر
                  </button>
                </PermissionGate>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Print Preview */}
      <PrintPreviewModal
        open={printPreview}
        onClose={() => { setPrintPreview(false); setPrintOrder(null); }}
        docType="purchase_order"
        invoice={{
          invoice_no: printOrder?.doc_no || "",
          customer_name: printOrder?.supplier_name || "",
          created_at: printOrder?.created_at || new Date().toISOString(),
          lines: (printOrder?.lines || []).map(l => ({
            item_name: l.item_name,
            code: l.item_code || "",
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_amount: 0,
          })),
          discount: printOrder?.discount || 0,
          increase: printOrder?.increase || 0,
        }}
        operationLabel="أمر توريد"
      />

      {/* Confirmations */}
      <ConfirmDialog open={!!confirmCancel} title="إلغاء طلب التوريد" message="سيتم إيقاف طلب التوريد هذا نهائياً. هل تود الاستمرار؟" onConfirm={handleCancel} onCancel={() => setConfirmCancel(null)} />
    </div>
  );
}
