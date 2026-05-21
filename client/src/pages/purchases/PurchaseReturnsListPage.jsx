import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, X, Eye, Pencil, Search, Trash2, AlertTriangle, ArrowUpRight, FileText } from "lucide-react";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";

const REASON_MAP = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  damaged_shipping: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};


const STATUS_MAP = {
  active: { label: "نشط", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "ملغى", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

function MagneticButton({ children, onClick, className, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e) => {
    if (disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    x.set(mouseX * 0.3);
    y.set(mouseY * 0.3);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: mouseXSpring, y: mouseYSpring }}
      whileTap={{ scale: 0.95 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}

function DeleteWarningModal({ row, onConfirm, onClose, deleting }) {
  return (
    <AnimatePresence>
      {row && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-zinc-900 mb-1">تأكيد حذف المرتجع</h2>
                  <p className="text-[13px] font-medium text-zinc-500 leading-relaxed">
                    سيتم حذف مرتجع الشراء <span className="font-black text-zinc-800 font-mono">{row.doc_no || `PR-${String(row.id).padStart(5, "0")}`}</span> نهائياً.
                    سيؤدي ذلك إلى عكس تأثيره على المخزون ورصيد المورد.
                  </p>
                </div>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 mb-6 text-[12px] font-bold text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>هذا الإجراء لا يمكن التراجع عنه. تأكد من صحة قرارك قبل المتابعة.</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onConfirm}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-2xl bg-rose-600 text-white text-[13px] font-black hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm shadow-rose-200"
                >
                  {deleting ? "جاري الحذف..." : "نعم، احذف المرتجع"}
                </button>
                <button
                  onClick={onClose}
                  className="h-11 px-6 rounded-2xl bg-zinc-100 text-zinc-700 text-[13px] font-black hover:bg-zinc-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReturnRow({ row, navigate, onDeleteRequest }) {
  return (
    <motion.div
      variants={FADE_UP}
      className="group relative flex items-center justify-between gap-6 px-6 py-5 bg-white border-b border-zinc-100 hover:bg-blue-50/30 transition-colors duration-300 overflow-hidden"
    >
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />
      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
          <ArrowUpRight className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">
              {row.doc_no || `PR-${String(row.id).padStart(5, "0")}`}
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${STATUS_MAP[row.status]?.cls || STATUS_MAP.active.cls}`}>
              {STATUS_MAP[row.status]?.label || "نشط"}
            </span>
            {row.purchase_id ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-200">
                <FileText className="w-3 h-3" /> من أمر شراء
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-amber-50 text-amber-700 border-amber-200">
                <RotateCcw className="w-3 h-3" /> مرتجع مباشر
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            {row.supplier_id ? (
              <Link to={`/definitions/suppliers/${row.supplier_id}`} className="text-zinc-600 hover:text-blue-600 hover:underline truncate">
                {row.supplier_name || `مورد #${row.supplier_id}`}
              </Link>
            ) : (
              <span>{row.supplier_name || "—"}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span dir="ltr">{new Date(row.created_at).toLocaleDateString("ar-EG")}</span>
          </div>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-start gap-1 flex-1 z-10">
        <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400">السبب</span>
          {REASON_MAP[row.reason] || "أخرى"}
        </p>
        {row.original_purchase_no && (
          <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">المصدر</span>
            <Link to={`/purchases/${row.purchase_id}`} className="font-mono text-zinc-700 hover:text-blue-600">
              {row.original_purchase_no}
            </Link>
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 z-10">
        {(() => {
          const settlementType = row.settlement_type || "account";
          const cashAmt   = settlementType === "cash"    ? Number(row.total || 0)
                          : settlementType === "split"   ? Number(row.cash_amount || 0)
                          : 0;
          const creditAmt = settlementType === "account" ? Number(row.total || 0)
                          : settlementType === "split"   ? Number(row.credit_amount || 0)
                          : 0;
          const total     = Number(row.total || 0);
          return (
            <div className="flex items-stretch gap-0 bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col items-end justify-center px-3 py-2 min-w-[90px]">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">إجمالي المرتجع</span>
                <div className="text-[15px] font-black text-slate-800 font-mono leading-none flex items-baseline gap-0.5">
                  <span>{formatMoney(total)}</span>
                  <span className="text-[8px] font-bold text-slate-400 mr-0.5">ج.م</span>
                </div>
              </div>
              {cashAmt > 0.005 && (
                <>
                  <div className="w-px self-stretch bg-slate-200/80" />
                  <div className="flex flex-col items-end justify-center px-3 py-2 bg-emerald-50/80 min-w-[90px]">
                    <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      نقداً للمورد
                    </span>
                    <div className="text-[14px] font-black text-emerald-700 font-mono leading-none flex items-baseline gap-0.5">
                      <span>{formatMoney(cashAmt)}</span>
                      <span className="text-[8px] font-bold mr-0.5">ج.م</span>
                    </div>
                  </div>
                </>
              )}
              {creditAmt > 0.005 && (
                <>
                  <div className="w-px self-stretch bg-slate-200/80" />
                  <div className="flex flex-col items-end justify-center px-3 py-2 bg-amber-50/80 min-w-[90px]">
                    <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      حساب المورد
                    </span>
                    <div className="text-[14px] font-black text-amber-700 font-mono leading-none flex items-baseline gap-0.5">
                      <span>{formatMoney(creditAmt)}</span>
                      <span className="text-[8px] font-bold mr-0.5">ج.م</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button onClick={() => navigate(`/purchases/returns/${row.id}`)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <PermissionGate page="purchase_returns" action="edit">
            <button onClick={() => navigate("/purchases/returns/new", { state: { edit_return_id: row.id } })} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
          </PermissionGate>
          <PermissionGate page="purchase_returns" action="delete">
            <button onClick={() => onDeleteRequest(row)} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </PermissionGate>
        </div>
      </div>
    </motion.div>
  );
}

export default function PurchaseReturnsListPage() {
  usePageTour('purchase_returns');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseIdFilter = searchParams.get("purchase_id") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (purchaseIdFilter) params.set("purchase_id", purchaseIdFilter);
      const res = await api.get(`/api/purchases/returns?${params}`);
      setRows(res.data.data || []);
    } catch {
      toast.error("فشل تحميل بيانات المرتجعات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo, purchaseIdFilter]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/purchases/returns/${deleteTarget.id}`);
      toast.success(`تم حذف المرتجع ${deleteTarget.doc_no || `#${deleteTarget.id}`} بنجاح`);
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل حذف المرتجع");
    } finally {
      setDeleting(false);
    }
  }

  function clearPurchaseFilter() {
    searchParams.delete("purchase_id");
    setSearchParams(searchParams);
  }

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[#f8fafc]" dir="rtl">
      
      {/* Background ambient */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Cinematic Header */}
        <motion.header initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm">
                <RotateCcw className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-black text-zinc-400 tracking-[0.2em] uppercase">المشتريات</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">مرتجعات <span className="text-blue-600">الموردين</span></h1>
          </div>

          <PermissionGate page="purchase_returns" action="add">
            <MagneticButton
              data-help="add-button"
              onClick={() => navigate("/purchases/returns/new")}
              className="flex items-center gap-2 bg-zinc-950 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-zinc-950/20 hover:bg-zinc-900 transition-colors"
            >
              <Plus className="w-5 h-5" /> إرجاع مشتريات
            </MagneticButton>
          </PermissionGate>
        </motion.header>

        {purchaseIdFilter && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <span className="text-sm font-black text-blue-800">تصفية نشطة: مرتجعات الفاتورة #{purchaseIdFilter}</span>
            <button onClick={clearPurchaseFilter} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-100/50 hover:bg-blue-100 rounded-lg transition-colors">
              <X className="w-4 h-4" /> إلغاء
            </button>
          </motion.div>
        )}

        {/* Action Bar */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-[2rem] border border-white shadow-sm">
          <div data-help="search-bar" className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم المرتجع أو اسم المورد..."
              className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto px-2">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-sm font-bold text-zinc-700 outline-none cursor-pointer" />
            </div>
            <div className="w-px h-8 bg-zinc-200" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-sm font-bold text-zinc-700 outline-none cursor-pointer" />
            </div>
          </div>
        </motion.div>

        {/* The List */}
        <motion.div
          data-help="main-table"
          initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="flex flex-col bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden min-h-[400px]"
        >
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
              <RotateCcw className="w-8 h-8 animate-spin text-zinc-400" />
              <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100">
                <FileText className="w-8 h-8 text-zinc-300" />
              </div>
              <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد مرتجعات</h3>
              <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي إشعارات مرتجع تطابق بحثك الحالي.</p>
            </div>
          ) : (
            rows.map(row => <ReturnRow key={row.id} row={row} navigate={navigate} onDeleteRequest={setDeleteTarget} />)
          )}
        </motion.div>
      </div>

      <DeleteWarningModal
        row={deleteTarget}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
        deleting={deleting}
      />
    </div>
  );
}
