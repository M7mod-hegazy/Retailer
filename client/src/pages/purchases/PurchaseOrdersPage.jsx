import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Plus, Calendar, User, PackageCheck, Clock, CheckCircle2,
  MoreVertical, Eye, Warehouse, Search, X, ChevronRight,
  BadgeCheck, XCircle, Package
} from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import DataGrid from "../../components/ui/DataGrid";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import SearchInput from "../../components/ui/SearchInput";
import { adaptForServer } from "../../utils/search";
import TodayInvoicesButton from "../../components/pos/TodayInvoicesButton";
import PermissionGate from "../../components/ui/PermissionGate";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_MAP = {
  pending:            { label: "قيد الانتظار",   cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  approved:           { label: "معتمد",           cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  partially_received: { label: "مستلم جزئياً",   cls: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  received:           { label: "تم الاستلام",    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled:          { label: "ملغى",            cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
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
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${s.cls}`}>{s.label}</span>;
}

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const ROW_ANIMATION = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Receive flow
  const [activeOrder, setActiveOrder] = useState(null);
  const [receiptLines, setReceiptLines] = useState({});
  const [receiveStep, setReceiveStep] = useState("input"); // "input" | "confirm"
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  // Detail modal
  const [detailOrder, setDetailOrder] = useState(null);

  // Actions
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
      const res = await api.patch(`/api/purchase-orders/${activeOrder.id}/receive`, {
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

  // Quantities for receive confirmation
  const receiveConfirmLines = (activeOrder?.lines || []).filter(l => Number(receiptLines[l.id] || 0) > 0);
  const receiveTotal = receiveConfirmLines.reduce((acc, l) => acc + Number(receiptLines[l.id] || 0) * Number(l.unit_cost || 0), 0);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-slate-800">أوامر الشراء</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">تخطيط وجدولة وتتبع توريدات الأصناف من الموردين</p>
        </div>
        <div className="flex items-center gap-2">
          <TodayInvoicesButton variant="pill" />
          <PermissionGate page="purchase_orders" action="add">
            <Link to="/purchases/orders/new" className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-slate-700 transition-all active:scale-95">
              <Plus className="h-4 w-4" /> طلب توريد جديد
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-amber-100 bg-white p-5 shadow-sm border-r-4 border-r-amber-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Clock className="h-5 w-5" /></div>
          <div><span className="text-[11px] font-black uppercase text-slate-400 block">طلبات في الانتظار</span><span className="text-[22px] font-black text-slate-800">{stats.pending}</span></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-indigo-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><PackageCheck className="h-5 w-5" /></div>
          <div><span className="text-[11px] font-black uppercase text-slate-400 block">استلام جزئي</span><span className="text-[22px] font-black text-slate-800">{stats.partial}</span></div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
          <div><span className="text-[11px] font-black uppercase text-slate-400 block">الإجمالي الكلي</span><span className="text-[22px] font-black text-slate-800">{stats.total}</span></div>
        </div>
      </div>

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="بحث باسم المورد أو رقم الأمر..."
            className="flex-1 min-w-[160px]"
            size="md"
          />
          <span className="mr-auto text-[11px] font-bold text-slate-400">{rows.length} أمر</span>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`whitespace-nowrap rounded-xl px-4 py-1.5 text-xs font-black transition-all ${
                statusFilter === tab.value
                  ? "bg-zinc-950 text-white shadow-md shadow-zinc-900/20 scale-105"
                  : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 border border-zinc-200/50"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Industrial List Feed */}
        <div className="bg-zinc-50/30 p-2 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
              <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-950 rounded-full animate-spin mb-4" />
              <span className="text-sm font-black animate-pulse">جاري فحص أوامر التوريد...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
              <Package className="h-12 w-12 opacity-20 mb-3" />
              <p className="text-[13px] font-black">لا توجد أوامر مطابقة</p>
            </div>
          ) : (
            <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-2">
              {rows.map((row) => {
                const canApprove = row.status === "pending";
                const canReceive = row.status === "approved" || row.status === "partially_received";
                const canCancel = row.status !== "received" && row.status !== "cancelled";

                return (
                  <motion.div key={row.id} variants={ROW_ANIMATION} className="group flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-zinc-200/60 rounded-[1.25rem] p-4 shadow-sm hover:border-zinc-300 hover:shadow-md transition-all">
                    
                    {/* ID & Supplier */}
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-inner">
                        <Package className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-zinc-950">PO-{String(row.id).padStart(5, "0")}</span>
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <User className="h-3 w-3 text-zinc-400" />
                          <span className="text-xs font-bold text-zinc-500">{row.supplier_name || `مورد #${row.supplier_id}`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta & Progress */}
                    <div className="flex items-center gap-8 md:flex-1 md:justify-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-zinc-400">تاريخ الأمر</span>
                        <span className="text-xs font-bold text-zinc-700">{new Date(row.created_at).toLocaleDateString("ar-EG")}</span>
                      </div>

                      {(row.status === "partially_received" || row.status === "received") ? (
                        <div className="w-32 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-zinc-500">حالة التوريد</span>
                            <span className={row.status === "received" ? "text-emerald-500" : "text-indigo-500"}>{row.status === "received" ? "مكتمل" : "جزئي"}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${row.status === "received" ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: row.status === "received" ? "100%" : "60%" }} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-32 flex flex-col gap-1.5 opacity-30">
                          <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-zinc-500">حالة التوريد</span>
                            <span className="text-zinc-500">في الانتظار</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-zinc-200" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 md:justify-end">
                      <button onClick={() => openDetailModal(row.id)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 hover:bg-zinc-950 hover:text-white transition-all">
                        <Eye className="h-4 w-4" />
                      </button>

                      {canApprove && (
                        <PermissionGate page="purchase_orders" action="edit">
                          <button onClick={() => setConfirmApprove(row.id)} className="flex h-9 items-center gap-1.5 px-3 rounded-xl bg-blue-50 text-blue-600 text-xs font-black hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                            <BadgeCheck className="h-4 w-4" /> اعتماد
                          </button>
                        </PermissionGate>
                      )}

                      {canReceive && (
                        <PermissionGate page="purchase_orders" action="edit">
                          <button onClick={() => openReceiveModal(row.id)} className="flex h-9 items-center gap-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                            <PackageCheck className="h-4 w-4" /> استلام
                          </button>
                        </PermissionGate>
                      )}

                      {canCancel && (
                        <PermissionGate page="purchase_orders" action="edit">
                          <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                            <button onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition-all">
                              <XCircle className="h-4 w-4" />
                            </button>
                            {openMenu === row.id && (
                              <div className="absolute left-0 top-full mt-2 z-20 w-40 rounded-xl border border-rose-100 bg-white p-1 shadow-xl">
                                <button onClick={() => { setConfirmCancel(row.id); setOpenMenu(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                  <XCircle className="h-3.5 w-3.5" /> إلغاء الأمر
                                </button>
                              </div>
                            )}
                          </div>
                        </PermissionGate>
                      )}
                    </div>

                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={`تفاصيل أمر الشراء PO-${String(detailOrder?.id || 0).padStart(5, "0")}`} maxWidth="max-w-2xl">
        {detailOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">المورد</span>
                <span className="text-[13px] font-black text-slate-800">{detailOrder.supplier_name || `مورد #${detailOrder.supplier_id}`}</span></div>
              <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">الحالة</span>
                <StatusBadge status={detailOrder.status} /></div>
              <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">التاريخ</span>
                <span className="text-[13px] font-bold text-slate-600">{new Date(detailOrder.created_at).toLocaleDateString("ar-EG")}</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col h-64 min-h-0">
              <DataGrid
                data={detailOrder.lines || []}
                rowKey="id"
                emptyMessage="لا يوجد أصناف"
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                columns={[
                  {
                    id: "code", header: "الكود", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100",
                    render: (l) => l.barcode || l.code || l.item_code || "-"
                  },
                  {
                    id: "name", header: "الصنف", width: 160, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-3", headerClass: "text-right px-3",
                    render: (l) => (
                      <div className="flex flex-col w-full min-w-0">
                        <span className="truncate">{l.item_name}</span>
                        <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden text-center w-full max-w-[100px]">
                          <div className="h-full rounded-full bg-indigo-400 transition-all"
                            style={{ width: `${Math.min(100, ((l.received_quantity || 0) / l.quantity) * 100)}%` }} />
                        </div>
                      </div>
                    )
                  },
                  {
                    id: "quantity", header: "مطلوب", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-black border-l border-slate-100",
                    render: (l) => l.quantity
                  },
                  {
                    id: "received", header: "مستلم", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-black text-emerald-600 border-l border-slate-100",
                    render: (l) => l.received_quantity || 0
                  },
                  {
                    id: "remaining", header: "متبقي", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-black text-amber-600 border-l border-slate-100",
                    render: (l) => l.remaining_quantity
                  },
                  {
                    id: "total", header: "الإجمالي", width: 100, sortable: true, headerClass: "text-left px-2", cellClass: "text-left font-black font-mono border-l-0 px-2",
                    sortValue: (l) => l.quantity * l.unit_cost,
                    render: (l) => formatMoney(l.quantity * l.unit_cost)
                  }
                ]}
              />
            </div>
            <div className="flex justify-end"><button onClick={() => setDetailOrder(null)} className="rounded-lg bg-slate-800 px-8 py-2.5 text-[13px] font-black text-white hover:bg-slate-700 transition-all">إغلاق</button></div>
          </div>
        )}
      </Modal>

      {/* Receive Modal — Step 1: input quantities */}
      <Modal open={!!activeOrder && receiveStep === "input"} onClose={() => setActiveOrder(null)} title={`استلام أصناف — PO-${String(activeOrder?.id || 0).padStart(5, "0")}`}>
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <div className="flex flex-1 flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase mb-1">المخزن المستلم</span>
              <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 focus:border-slate-400 focus:outline-none">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-black text-slate-400 uppercase mb-1">الحالة</span>
              <StatusBadge status={activeOrder?.status} />
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(activeOrder?.lines || []).map(line => (
              <div key={line.id} className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[13px] font-black text-slate-800">{line.item_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">مطلوب: {line.quantity}</span>
                    <span className="text-[10px] font-bold text-indigo-500">متبقي: {line.remaining_quantity}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">استلام:</span>
                  <input type="number" min="0" max={line.remaining_quantity}
                    value={receiptLines[line.id] ?? ""}
                    onChange={e => setReceiptLines(prev => ({ ...prev, [line.id]: e.target.value }))}
                    className="w-20 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-center font-mono text-[13px] font-black text-slate-800 outline-none focus:border-slate-800 focus:bg-white" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button onClick={() => setActiveOrder(null)} className="rounded-lg px-5 py-2 text-[13px] font-bold text-slate-400 hover:text-slate-800 transition-colors">إلغاء</button>
            <button
              onClick={() => { if (receiveConfirmLines.length === 0) { toast.error("أدخل كمية لصنف واحد على الأقل"); return; } setReceiveStep("confirm"); }}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-[13px] font-black text-white hover:bg-slate-700 transition-all active:scale-95"
            >
              <PackageCheck className="h-4 w-4" /> مراجعة الاستلام
            </button>
          </div>
        </div>
      </Modal>

      {/* Receive Modal — Step 2: confirm */}
      <Modal open={!!activeOrder && receiveStep === "confirm"} onClose={() => setReceiveStep("input")} title="تأكيد استلام الكميات">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-[12px] font-bold text-slate-500 mb-3">ستستلم الأصناف التالية في مخزن <span className="font-black text-slate-800">{warehouses.find(w => String(w.id) === selectedWarehouse)?.name || selectedWarehouse}</span>:</p>
            <div className="space-y-2">
              {receiveConfirmLines.map(line => (
                <div key={line.id} className="flex items-center justify-between text-[13px] font-bold text-slate-700">
                  <span>{line.item_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">× {receiptLines[line.id]}</span>
                    <span className="font-black text-slate-800">{formatMoney(Number(receiptLines[line.id]) * line.unit_cost)} ج.م</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">إجمالي الفاتورة التي ستُنشأ</span>
              <span className="text-[16px] font-black text-slate-800">{formatMoney(receiveTotal)} ج.م</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold text-center">سيتم إنشاء فاتورة شراء تلقائياً وتحديث المخزون</p>
          <div className="flex gap-3">
            <button onClick={() => setReceiveStep("input")} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-black text-slate-500 hover:bg-slate-50 transition-colors">تعديل</button>
            <button onClick={handleReceive} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-black text-white hover:bg-emerald-500 transition-all active:scale-[0.98]">
              تأكيد الاستلام
            </button>
          </div>
        </div>
      </Modal>

      {/* Approve confirm */}
      <ConfirmDialog
        open={!!confirmApprove}
        title="اعتماد أمر الشراء"
        message="هل تريد اعتماد هذا الأمر؟ سيصبح جاهزاً للاستلام."
        onConfirm={handleApprove}
        onCancel={() => setConfirmApprove(null)}
      />

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!confirmCancel}
        title="إلغاء أمر الشراء"
        message="هل أنت متأكد من إلغاء هذا الأمر؟ لا يمكن التراجع عن هذا الإجراء."
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
