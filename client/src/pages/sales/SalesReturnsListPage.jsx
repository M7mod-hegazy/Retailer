import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, X, Printer, Eye, Pencil, Search, SlidersHorizontal, ArrowDownLeft, FileText } from "lucide-react";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";

const REASON_MAP = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  damaged_shipping: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};

const REFUND_MAP = {
  cash_back: "نقداً",
  credit_note: "رصيد حساب",
};

const STATUS_MAP = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
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

function ReturnRow({ row, navigate }) {
  return (
    <motion.div
      variants={FADE_UP}
      className="group relative flex items-center justify-between gap-6 px-6 py-5 bg-white border-b border-zinc-100 hover:bg-emerald-50/30 transition-colors duration-300 overflow-hidden"
    >
      {/* Animated Left Border */}
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />

      {/* Main Info */}
      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
          <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
        </div>
        
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">
              {row.doc_no || `RT-${String(row.id).padStart(5, "0")}`}
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${STATUS_MAP[row.status]?.cls || STATUS_MAP.active.cls}`}>
              {STATUS_MAP[row.status]?.label || "نشط"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            {row.customer_id ? (
              <Link to={`/definitions/customers/${row.customer_id}`} className="text-zinc-600 hover:text-emerald-600 hover:underline truncate">
                {row.customer_name || `عميل #${row.customer_id}`}
              </Link>
            ) : (
              <span>{row.customer_name || "—"}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span dir="ltr">{new Date(row.created_at).toLocaleDateString("ar-EG")}</span>
          </div>
        </div>
      </div>

      {/* Meta Specs */}
      <div className="hidden md:flex flex-col items-start gap-1 flex-1 z-10">
        <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400">السبب</span>
          {REASON_MAP[row.reason] || "أخرى"}
        </p>
        <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400">الفاتورة</span>
          {row.original_invoice_no ? (
            <Link to={`/pos/invoices/${row.invoice_id}`} className="font-mono text-zinc-700 hover:text-emerald-600">
              {row.original_invoice_no}
            </Link>
          ) : "—"}
        </p>
      </div>

      {/* Financials & Actions */}
      <div className="flex items-center gap-8 flex-shrink-0 z-10">
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-black text-zinc-900 font-mono">
            {formatMoney(row.total)} <span className="text-xs text-zinc-400 font-sans">ج.م</span>
          </span>
          <span className="text-[10px] font-black text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-100">
            {REFUND_MAP[row.refund_method] || row.refund_method || "—"}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button onClick={() => navigate(`/pos/sales-returns/${row.id}`)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(`/pos/sales-returns/${row.id}`)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors">
            <Printer className="w-4 h-4" />
          </button>
          <PermissionGate page="sales_returns" action="edit">
            <button onClick={() => navigate("/sales/returns/new", { state: { edit_return_id: row.id } })} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
          </PermissionGate>
        </div>
      </div>
    </motion.div>
  );
}

export default function SalesReturnsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdFilter = searchParams.get("invoice_id") || "";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debouncedSearch = useDebounce(searchTerm, 300);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (invoiceIdFilter) params.set("invoice_id", invoiceIdFilter);
      const res = await api.get(`/api/invoices/returns?${params}`);
      setRows(res.data.data || []);
    } catch {
      toast.error("فشل تحميل بيانات المرتجعات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo, invoiceIdFilter]);

  function clearInvoiceFilter() {
    searchParams.delete("invoice_id");
    setSearchParams(searchParams);
  }

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[#f8fafc]" dir="rtl">
      
      {/* Background ambient */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Cinematic Header */}
        <motion.header initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm">
                <RotateCcw className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-black text-zinc-400 tracking-[0.2em] uppercase">المبيعات</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">مرتجعات <span className="text-emerald-600">العملاء</span></h1>
          </div>

          <PermissionGate page="sales_returns" action="add">
            <MagneticButton
              onClick={() => navigate("/sales/returns/new")}
              className="flex items-center gap-2 bg-zinc-950 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-zinc-950/20 hover:bg-zinc-900 transition-colors"
            >
              <Plus className="w-5 h-5" /> إصدار إشعار مرتجع
            </MagneticButton>
          </PermissionGate>
        </motion.header>

        {invoiceIdFilter && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <span className="text-sm font-black text-emerald-800">تصفية نشطة: مرتجعات الفاتورة #{invoiceIdFilter}</span>
            <button onClick={clearInvoiceFilter} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100/50 hover:bg-emerald-100 rounded-lg transition-colors">
              <X className="w-4 h-4" /> إلغاء
            </button>
          </motion.div>
        )}

        {/* Action Bar */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-[2rem] border border-white shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم المرتجع أو اسم العميل..."
              className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 pr-12 pl-4 text-sm font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
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
            rows.map(row => <ReturnRow key={row.id} row={row} navigate={navigate} />)
          )}
        </motion.div>
      </div>
    </div>
  );
}
