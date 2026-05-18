import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  Eye, Warehouse,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw,
  Search, ArrowLeftRight
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import PermissionGate from "../../components/ui/PermissionGate";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import { adaptForServer } from "../../utils/search";
import { useNavigate } from "react-router-dom";
import { usePageTour } from "../../hooks/usePageTour";
import { motion, AnimatePresence } from "framer-motion";

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
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(d));
}
function formatQty(v) {
  return Number(v || 0).toLocaleString("ar-EG");
}

export default function BranchTransferPage() {
  usePageTour('branch_transfer');
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


  const stats = useMemo(() => ({
    receiveCount: rows.filter(r => r.type === "receive").length,
    sendCount: rows.filter(r => r.type === "send").length,
    totalQty: rows.reduce((s, r) => s + Number(r.total_qty || 0), 0),
  }), [rows]);

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
            <div className="bg-emerald-100 p-4 rounded-[1.5rem]"><ArrowLeftRight className="h-8 w-8 text-emerald-600" /></div>
            <div>
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight">حركات النقل الداخلي</h1>
              <p className="text-[14px] font-bold text-slate-500 mt-1 max-w-[45ch]">تسجيل ومراقبة استلام وتسليم البضائع بين الفروع والمخازن.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-8 px-6 lg:border-r border-slate-200">
               <div className="flex flex-col items-center">
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">الكميات المتداولة</span>
                 <span className="text-[24px] font-black leading-none text-slate-900 tracking-tighter font-mono">{formatQty(stats.totalQty)}</span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <PermissionGate page="branch_transfer" action="add">
                <button data-help="add-button" onClick={() => navigate("/operations/branch-transfer/new?type=receive")} className="group flex items-center justify-center gap-2 rounded-[1.2rem] bg-emerald-600 px-6 py-4 text-[15px] font-black text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                  <ArrowDownToLine className="h-5 w-5" />
                  <span>استلام</span>
                </button>
              </PermissionGate>
              <PermissionGate page="branch_transfer" action="add">
                <button onClick={() => navigate("/operations/branch-transfer/new?type=send")} className="group flex items-center justify-center gap-2 rounded-[1.2rem] bg-blue-600 px-6 py-4 text-[15px] font-black text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                  <ArrowUpFromLine className="h-5 w-5" />
                  <span>تسليم</span>
                </button>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Bottom Section: Filters & Search */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-white">
          <div data-help="search-bar" className="relative w-full lg:w-[350px]">
            <Search className="absolute top-1/2 -translate-y-1/2 right-5 h-5 w-5 text-slate-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="البحث برقم الوصل..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 pr-12 pl-6 py-3.5 text-[14px] font-black text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all outline-none" />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full lg:w-auto px-2">
            {[["all", "الكل"], ["receive", "استلام فقط"], ["send", "تسليم فقط"]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={`whitespace-nowrap rounded-full px-6 py-3 text-[14px] font-black transition-all ${
                  typeFilter === v ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto bg-slate-50 rounded-full p-2 border border-slate-200/50">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-600 outline-none border border-slate-100 focus:border-emerald-300" />
            <ArrowLeftRight className="h-4 w-4 text-slate-300" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-slate-600 outline-none border border-slate-100 focus:border-emerald-300" />
          </div>
        </div>
      </div>

        <div data-help="main-table" className="min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <div className="w-16 h-16 border-[4px] border-slate-100 border-t-slate-900 rounded-full animate-spin mb-8" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] bg-slate-50/50 rounded-[3rem] border border-slate-200 border-dashed">
              <RotateCcw className="h-24 w-24 opacity-10 mb-6 text-slate-900" />
              <p className="text-[18px] font-black text-slate-400">لا توجد حركات نقل مسجلة ضمن هذا النطاق.</p>
            </div>
          ) : (
            <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="visible" className="flex flex-col gap-6">
              <AnimatePresence mode="popLayout">
                {rows.map(row => {
                  const isReceive = row.type === "receive";
                  
                  return (
                    <motion.div key={row.id} layout layoutId={`transfer-${row.id}`} variants={ROW_ANIMATION} 
                      className="group flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white border border-slate-200/60 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                      onClick={() => handleShowDetail(row.id)}
                    >
                      
                      <div className="flex items-center gap-6 lg:w-[35%]">
                        <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl transition-transform duration-500 group-hover:scale-105 shadow-lg ${
                          isReceive ? "bg-emerald-600 text-white shadow-emerald-600/20" : "bg-blue-600 text-white shadow-blue-600/20"
                        }`}>
                          {isReceive ? <ArrowDownToLine className="h-8 w-8" strokeWidth={2} /> : <ArrowUpFromLine className="h-8 w-8" strokeWidth={2} />}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[20px] font-black text-slate-900 tracking-tight">{row.reference_no}</span>
                            <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border ${
                              isReceive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {isReceive ? "استلام" : "تسليم"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-slate-400" />
                            <span className="text-[15px] font-bold text-slate-600">{row.warehouse_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-12 lg:w-[50%] bg-slate-50/80 rounded-[2rem] p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">التاريخ</span>
                          <span className="text-[15px] font-bold text-slate-700 mt-1">{formatDate(row.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center gap-12 border-r border-slate-200/60 pr-12">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">الأصناف</span>
                            <span className="text-[20px] font-black text-slate-900 mt-1">{row.line_count}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">إجمالي الكمية</span>
                            <span className="text-[24px] font-black font-mono tracking-tighter text-slate-950 mt-1">{formatQty(row.total_qty)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end lg:w-[15%] shrink-0">
                        <button className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white border-2 border-slate-100 text-slate-400 group-hover:bg-slate-950 group-hover:border-slate-950 group-hover:text-white transition-all duration-300">
                          <Eye className="h-6 w-6" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

      {/* Cinematic Details Overlay */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`تفاصيل حركة النقل — ${activeTransfer?.reference_no || ""}`} maxWidth="max-w-4xl">
        {activeTransfer && (
          <div className="space-y-10 p-2">
            
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden ${
              activeTransfer.type === "receive" ? "bg-emerald-950 text-white shadow-emerald-900/20" : "bg-blue-950 text-white shadow-blue-900/20"
            }`}>
              <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" />
              
              <div className="flex flex-col relative z-10">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">نوع الحركة</span>
                <span className="text-[20px] font-black flex items-center gap-3">
                  {activeTransfer.type === "receive" ? <><ArrowDownToLine className="h-6 w-6" /> استلام بضاعة</> : <><ArrowUpFromLine className="h-6 w-6" /> تسليم بضاعة</>}
                </span>
              </div>
              
              <div className="flex flex-col md:border-r border-white/20 md:pr-8 relative z-10">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">المخزن المستهدف</span>
                <span className="text-[20px] font-black truncate">{activeTransfer.warehouse_name}</span>
              </div>
              
              <div className="flex flex-col md:border-r border-white/20 md:pr-8 relative z-10">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">تاريخ التنفيذ</span>
                <span className="text-[18px] font-bold">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "full" }).format(new Date(activeTransfer.created_at))}</span>
              </div>
            </div>

            {activeTransfer.notes && (
              <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-8">
                <span className="text-[12px] font-black uppercase tracking-widest text-slate-500 block mb-3">ملاحظات مسجلة</span>
                <span className="text-[16px] font-bold text-slate-700 leading-relaxed max-w-[65ch]">{activeTransfer.notes}</span>
              </div>
            )}

            <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col max-h-[500px]">
              <div className="grid grid-cols-[120px_1fr_120px_150px] bg-slate-50 border-b border-slate-200 px-2">
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">الباركود</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50">الصنف المنقول</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest border-l border-slate-200/50 text-center">وحدة القياس</div>
                <div className="px-6 py-5 text-[11px] font-black uppercase text-slate-900 tracking-widest text-center">الكمية</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(activeTransfer.lines || []).length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 text-[15px] font-black">القائمة خالية</div>
                ) : (
                  (activeTransfer.lines || []).map(l => (
                    <div key={l.id} className="grid grid-cols-[120px_1fr_120px_150px] items-center rounded-2xl hover:bg-slate-50 transition-colors p-4">
                      <div className="px-2 text-center border-l border-slate-100 font-mono text-[13px] text-slate-400">{l.barcode || "—"}</div>
                      <div className="px-4 border-l border-slate-100 text-[15px] font-black text-slate-900">{l.item_name}</div>
                      <div className="px-2 text-center border-l border-slate-100 text-[13px] font-bold text-slate-500">{l.unit_name || "—"}</div>
                      <div className="px-2 text-center font-black font-mono text-[18px] text-slate-900">{formatQty(l.quantity)}</div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex items-center justify-between bg-slate-950 px-10 py-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-slate-800 via-transparent to-transparent pointer-events-none" />
                <span className="text-[12px] font-black uppercase tracking-widest opacity-60 relative z-10">الكمية الكلية المنقولة</span>
                <span className="text-[3rem] font-black font-mono tracking-tighter leading-none relative z-10">
                  {formatQty(activeTransfer.lines?.reduce((s, l) => s + Number(l.quantity || 0), 0))}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => setDetailOpen(false)} className="rounded-[1.5rem] bg-slate-100 px-16 py-5 text-[15px] font-black text-slate-900 hover:bg-slate-200 transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
