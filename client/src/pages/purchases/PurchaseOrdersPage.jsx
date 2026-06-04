import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Plus, Calendar, User, PackageCheck, Clock, CheckCircle2,
  MoreVertical, Eye, Warehouse, Search, X, BadgeCheck, XCircle, Package,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { adaptForServer } from "../../utils/search";
import PermissionGate from "../../components/ui/PermissionGate";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";

const STATUS_MAP = {
  pending:            { label: "قيد الانتظار",   cls: "bg-amber-100/50 text-amber-700 border-amber-200/50" },
  approved:           { label: "معتمد",           cls: "bg-blue-100/50 text-blue-700 border-blue-200/50" },
  partially_received: { label: "مستلم جزئياً",   cls: "bg-indigo-100/50 text-indigo-700 border-indigo-200/50" },
  received:           { label: "تم الاستلام",    cls: "bg-emerald-100/50 text-emerald-700 border-emerald-200/50" },
  cancelled:          { label: "ملغى",            cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const STATUS_TABS = [
  { value: "", label: "الكل" },
  { value: "pending", label: "معلق" },
  { value: "approved", label: "معتمد" },
  { value: "partially_received", label: "جزئي" },
  { value: "received", label: "مستلم" },
  { value: "cancelled", label: "ملغى" },
];

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-widest border ${s.cls}`}>
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
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export default function PurchaseOrdersPage() {
  usePageTour('purchase_orders');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [activeOrder, setActiveOrder] = useState(null);
  const [receiptLines, setReceiptLines] = useState({});
  const [receiveStep, setReceiveStep] = useState("input");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  const [detailOrder, setDetailOrder] = useState(null);
  const [confirmApprove, setConfirmApprove] = useState(null);
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
      const [r, w] = await Promise.all([
        api.get(`/api/purchase-orders?${params}`),
        api.get("/api/warehouses"),
      ]);
      setRows(r.data.data || []);
      const wh = w.data.data || [];
      setWarehouses(wh);
      if (wh.length && !selectedWarehouse) setSelectedWarehouse(String(wh[0].id));
    } catch { toast.error("فشل تحميل البيانات"); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, statusFilter]);

  async function openReceiveModal(id) {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      const order = res.data.data;
      setActiveOrder(order);
      setReceiptLines(Object.fromEntries((order.lines || []).map(l => [l.id, l.remaining_quantity])));
      setReceiveStep("input");
    } catch { toast.error("خطأ في تحميل بيانات الأمر"); }
  }

  async function openDetailModal(id) {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      setDetailOrder(res.data.data);
    } catch { toast.error("خطأ في تحميل التفاصيل"); }
  }

  async function handleReceive() {
    if (!activeOrder) return;
    try {
      await api.patch(`/api/purchase-orders/${activeOrder.id}/receive`, {
        warehouse_id: Number(selectedWarehouse),
        lines: activeOrder.lines.map(l => ({
          purchase_order_line_id: l.id,
          quantity: Number(receiptLines[l.id] || 0),
        })),
      });
      setActiveOrder(null);
      loadData();
      toast.success(
        <span>تم الاستلام بنجاح — <span className="font-black">فاتورة شراء جديدة أنشئت تلقائياً</span></span>,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء الاستلام");
    }
  }

  async function handleApprove() {
    try {
      await api.patch(`/api/purchase-orders/${confirmApprove}/approve`);
      toast.success("تم اعتماد الأمر");
      setConfirmApprove(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل الاعتماد");
      setConfirmApprove(null);
    }
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
    pending: rows.filter(r => r.status === "pending" || r.status === "approved").length,
    partial: rows.filter(r => r.status === "partially_received").length,
    total: rows.length,
  }), [rows]);

  const receiveConfirmLines = (activeOrder?.lines || []).filter(l => Number(receiptLines[l.id] || 0) > 0);
  const receiveTotal = receiveConfirmLines.reduce((acc, l) => acc + Number(receiptLines[l.id] || 0) * Number(l.unit_cost || 0), 0);

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
              <p className="text-sm font-bold text-slate-500 mt-1 max-w-[45ch]">تسجيل ومتابعة طلبات شراء البضاعة من الموردين قبل استلامها.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-8 px-6 lg:border-r border-slate-200">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-1">في الانتظار</span>
                 <span className="text-[24px] font-black leading-none text-amber-700 tracking-tighter font-mono">{stats.pending}</span>
               </div>
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">إجمالي الأوامر</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter font-mono">{stats.total}</span>
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
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-white">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full lg:w-auto px-2">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap rounded-full px-6 py-3 text-sm font-black transition-all ${
                  statusFilter === tab.value ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div data-help="search-bar" className="relative w-full lg:w-[400px]">
            <Search className="absolute top-1/2 -translate-y-1/2 right-5 h-5 w-5 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الأمر أو المورد..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 pr-12 pl-6 py-3.5 text-sm font-black text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none" />
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
                  const canApprove = row.status === "pending";
                  const canReceive = row.status === "approved" || row.status === "partially_received";
                  const canCancel = row.status !== "received" && row.status !== "cancelled";

                  return (
                    <motion.div key={row.id} layout layoutId={`row-${row.id}`} variants={ROW_ANIMATION} 
                      className="group relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white border border-slate-200/60 rounded-[1.5rem] p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200/60 transition-all duration-500">
                      
                      <div className="flex items-center gap-6 lg:w-[35%]">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-900 border border-slate-100 group-hover:bg-slate-950 group-hover:text-white group-hover:scale-105 transition-all duration-500">
                          <Package className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[18px] font-black text-slate-900 tracking-tight">PO-{String(row.id).padStart(5, "0")}</span>
                            <StatusBadge status={row.status} />
                          </div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                            <User className="h-4 w-4 opacity-50" />
                            <span className="truncate max-w-[200px]">{row.supplier_name || `مورد #${row.supplier_id}`}</span>
                          </div>
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
                        {canApprove && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <button onClick={() => setConfirmApprove(row.id)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-black hover:bg-blue-600 hover:text-white transition-all">
                              اعتماد
                            </button>
                          </PermissionGate>
                        )}
                        {canReceive && (
                          <PermissionGate page="purchase_orders" action="edit">
                            <button data-help="convert-button" onClick={() => openReceiveModal(row.id)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-black hover:bg-emerald-600 hover:text-white transition-all">
                              استلام
                            </button>
                          </PermissionGate>
                        )}

                        <button onClick={() => openDetailModal(row.id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-950 hover:text-white transition-all">
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

      {/* Detail Modal (Liquid Core Design) */}
      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={`طلب التوريد PO-${String(detailOrder?.id || 0).padStart(5, "0")}`} maxWidth="max-w-4xl">
        {detailOrder && (
          <div className="space-y-8 p-2">
            <div className="flex flex-col md:flex-row gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/50">
              <div className="flex-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">المورد</span>
                <span className="text-[16px] font-black text-slate-900">{detailOrder.supplier_name || `مورد #${detailOrder.supplier_id}`}</span>
              </div>
              <div className="w-px bg-slate-200 hidden md:block" />
              <div className="flex-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">تاريخ الإصدار</span>
                <span className="text-[16px] font-black font-mono text-slate-900 tracking-tight">{new Date(detailOrder.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</span>
              </div>
              <div className="w-px bg-slate-200 hidden md:block" />
              <div className="flex-1">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">حالة الأمر</span>
                <StatusBadge status={detailOrder.status} />
              </div>
            </div>
            
            <div className="rounded-[2rem] border border-slate-200/60 bg-white overflow-hidden shadow-sm flex flex-col h-[400px]">
              <div className="grid grid-cols-[1fr_100px_100px_100px_120px] bg-slate-50 border-b border-slate-200 px-2">
                <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50">الصنف المورد</div>
                <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">مطلوب</div>
                <div className="px-4 py-4 text-[11px] font-black uppercase text-emerald-600/70 tracking-widest border-l border-slate-200/50 text-center">مستلم</div>
                <div className="px-4 py-4 text-[11px] font-black uppercase text-amber-600/70 tracking-widest border-l border-slate-200/50 text-center">متبقي</div>
                <div className="px-4 py-4 text-[11px] font-black uppercase text-slate-400 tracking-widest text-left">التكلفة</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(detailOrder.lines || []).map(l => (
                  <div key={l.id} className="grid grid-cols-[1fr_100px_100px_100px_120px] items-center rounded-2xl hover:bg-slate-50 transition-colors p-3">
                    <div className="px-3 border-l border-slate-100">
                      <p className="text-sm font-black text-slate-900 truncate">{l.item_name}</p>
                      <p className="text-2sm font-mono font-bold text-slate-400 mt-1">{l.item_code || l.code || l.barcode || "—"}</p>
                    </div>
                    <div className="px-3 text-center border-l border-slate-100 font-black text-[15px]">{l.quantity}</div>
                    <div className="px-3 text-center border-l border-slate-100 font-black text-[15px] text-emerald-600">{l.received_quantity || 0}</div>
                    <div className="px-3 text-center border-l border-slate-100 font-black text-[15px] text-amber-500">{l.remaining_quantity}</div>
                    <div className="px-3 text-left font-black font-mono text-[15px] text-slate-900">{formatMoney(l.quantity * l.unit_cost)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Receive Modal — Step 1: Input */}
      <Modal open={!!activeOrder && receiveStep === "input"} onClose={() => setActiveOrder(null)} title={`تسجيل استلام — PO-${String(activeOrder?.id || 0).padStart(5, "0")}`} maxWidth="max-w-3xl">
        <div className="space-y-8 p-2">
          <div className="flex flex-col md:flex-row gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/50">
            <div className="flex-1 flex flex-col">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">المخزن المستلم الوجهة</span>
              <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-sm">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="w-px bg-slate-200 hidden md:block" />
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">حالة الأمر الحالية</span>
              <StatusBadge status={activeOrder?.status} />
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {(activeOrder?.lines || []).map(line => (
              <div key={line.id} className="rounded-2xl border border-slate-200/60 bg-white p-5 flex items-center justify-between shadow-sm hover:border-indigo-300 transition-colors">
                <div>
                  <p className="text-[15px] font-black text-slate-900 mb-1">{line.item_name}</p>
                  {(line.item_code || line.code) && <p className="font-mono text-[11px] text-slate-400 mb-2">{line.item_code || line.code}</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg">مطلوب: {line.quantity}</span>
                    <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-lg">متبقي: {line.remaining_quantity}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2sm font-black text-slate-400 uppercase tracking-widest">المستلم:</span>
                  <input type="number" min="0" max={line.remaining_quantity}
                    value={receiptLines[line.id] ?? ""}
                    onChange={e => setReceiptLines(prev => ({ ...prev, [line.id]: e.target.value }))}
                    className="w-28 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-center font-mono text-[16px] font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setActiveOrder(null)} className="rounded-2xl px-8 py-4 text-sm font-black text-slate-500 hover:bg-slate-100 transition-colors">تراجع وإلغاء</button>
            <button
              onClick={() => { if (receiveConfirmLines.length === 0) { toast.error("أدخل كمية لصنف واحد على الأقل"); return; } setReceiveStep("confirm"); }}
              className="flex items-center gap-3 rounded-2xl bg-slate-950 px-10 py-4 text-sm font-black text-white hover:bg-slate-800 transition-all shadow-xl hover:shadow-slate-900/20 active:scale-95"
            >
              مراجعة الاستلام النهائي <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* Receive Modal — Step 2: Confirm */}
      <Modal open={!!activeOrder && receiveStep === "confirm"} onClose={() => setReceiveStep("input")} title="التأكيد النهائي للاستلام" maxWidth="max-w-md">
        <div className="space-y-8 p-2">
          <div className="rounded-3xl bg-slate-950 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-transparent pointer-events-none" />
            
            <p className="text-sm font-bold text-slate-400 mb-6 leading-relaxed relative z-10">
              استلام الأصناف في <span className="font-black text-white">{warehouses.find(w => String(w.id) === selectedWarehouse)?.name || selectedWarehouse}</span> سيقوم بتوليد فاتورة شراء تلقائية وتحديث رصيد المخزون فوراً.
            </p>
            
            <div className="space-y-4 relative z-10 mb-8">
              {receiveConfirmLines.map(line => (
                <div key={line.id} className="flex items-center justify-between text-sm font-bold text-slate-300">
                  <span className="flex flex-col max-w-[150px]">
                    <span className="truncate">{line.item_name}</span>
                    {(line.item_code || line.code) && <span className="font-mono text-[11px] text-slate-400 truncate">{line.item_code || line.code}</span>}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-2sm opacity-60">× {receiptLines[line.id]}</span>
                    <span className="font-black text-white font-mono">{formatMoney(Number(receiptLines[line.id]) * line.unit_cost)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-800 flex items-center justify-between relative z-10">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">إجمالي الفاتورة المتوقعة</span>
              <span className="text-[24px] font-black text-white font-mono tracking-tight">{formatMoney(receiveTotal)} <span className="text-2sm font-sans opacity-50">ج.م</span></span>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setReceiveStep("input")} className="flex-1 rounded-2xl border-2 border-slate-200 py-4 text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors">تعديل الكميات</button>
            <button onClick={handleReceive} className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.98]">
              تأكيد وإصدار الفاتورة
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmations */}
      <ConfirmDialog open={!!confirmApprove} title="اعتماد طلب التوريد" message="هل أنت متأكد من اعتماد طلب التوريد هذا؟" onConfirm={handleApprove} onCancel={() => setConfirmApprove(null)} />
      <ConfirmDialog open={!!confirmCancel} title="إلغاء طلب التوريد" message="سيتم إيقاف طلب التوريد هذا نهائياً. هل تود الاستمرار؟" onConfirm={handleCancel} onCancel={() => setConfirmCancel(null)} />
    </div>
  );
}
