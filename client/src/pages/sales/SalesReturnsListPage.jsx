import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, X, Printer, Eye, Pencil, Trash2, AlertTriangle, ArrowDownLeft, FileText, Search, Package, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";

const REASON_MAP = {
  defective: "عيب في المنتج",
  wrong_order: "خطأ في الطلب",
  damaged_shipping: "تلف أثناء الشحن",
  not_as_described: "لا يطابق الوصف",
  other: "أخرى",
};

const STATUS_MAP = {
  active: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغى", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
};

const PAGE_SIZE = 20;

function fmt(v) { return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }); }
function fmtDate(d) {
  if (!d) return "—";
  const raw = d.split(".")[0].replace("T", " ");
  const [ymd, hms = "00:00"] = raw.split(" ");
  const [y, m, day] = ymd.split("-");
  const [hh, min] = hms.split(":");
  return `${day}/${m}/${y}, ${hh}:${min}`;
}

function MagneticButton({ children, onClick, className, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });
  const handleMouseMove = (e) => {
    if (disabled) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };
  return (
    <motion.button ref={ref} onMouseMove={handleMouseMove} onMouseLeave={() => { x.set(0); y.set(0); }}
      onClick={onClick} disabled={disabled} style={{ x: mouseXSpring, y: mouseYSpring }} whileTap={{ scale: 0.95 }}
      className={`relative overflow-hidden ${className}`}>{children}</motion.button>
  );
}

function DeleteWarningModal({ row, onConfirm, onClose, deleting }) {
  return (
    <AnimatePresence>
      {row && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h2 className="text-[17px] font-black text-zinc-900 mb-1">تأكيد حذف المرتجع</h2>
                  <p className="text-[13px] font-medium text-zinc-500 leading-relaxed">
                    سيتم حذف المرتجع <span className="font-black text-zinc-800 font-mono">{row.doc_no || `RT-${String(row.id).padStart(5, "0")}`}</span> نهائياً.
                  </p>
                </div>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 mb-6 text-[12px] font-bold text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>هذا الإجراء لا يمكن التراجع عنه.</span>
              </div>
              <div className="flex gap-3">
                <button onClick={onConfirm} disabled={deleting}
                  className="flex-1 h-11 rounded-2xl bg-rose-600 text-white text-[13px] font-black hover:bg-rose-700 disabled:opacity-50 transition-all">
                  {deleting ? "جاري الحذف..." : "نعم، احذف المرتجع"}
                </button>
                <button onClick={onClose} className="h-11 px-6 rounded-2xl bg-zinc-100 text-zinc-700 text-[13px] font-black hover:bg-zinc-200 transition-colors">إلغاء</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PreviewModal({ returnId, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!returnId) return;
    setLoading(true);
    api.get(`/api/invoices/returns/${returnId}`)
      .then(r => setData(r.data.data || r.data))
      .catch(() => toast.error("تعذر تحميل تفاصيل المرتجع"))
      .finally(() => setLoading(false));
  }, [returnId]);

  return (
    <AnimatePresence>
      {returnId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl p-7 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-5">
              <h2 className="text-[17px] font-black text-zinc-900">تفاصيل المرتجع {data ? `— ${data.doc_no || `#${data.id}`}` : ""}</h2>
              <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
              </div>
            ) : !data ? (
              <div className="text-center py-12 text-zinc-400 font-bold">تعذّر تحميل البيانات</div>
            ) : (() => {
              const cashAmt   = Number(data.cash_amount   || 0);
              const creditAmt = Number(data.credit_amount || 0);
              const total     = Number(data.total         || 0);
              return (
                <div className="flex flex-col gap-5" dir="rtl">
                  {/* Header */}
                  <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100/80 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-emerald-600 tracking-wider uppercase">رقم المرتجع</span>
                      <span className="font-mono text-xl font-black text-zinc-950">{data.doc_no || `#${data.id}`}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-zinc-400 tracking-wider uppercase">التاريخ</span>
                      <span className="font-mono text-sm font-bold text-zinc-600">{fmtDate(data.created_at)}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[10px] font-black text-emerald-600 tracking-wider uppercase">إجمالي المرتجع</span>
                      <span className="font-mono text-xl font-black text-emerald-700">{fmt(total)} ج.م</span>
                    </div>
                  </div>

                  {data.invoice_id && (
                    <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200/70 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-500 tracking-wider uppercase">رقم الفاتورة الأصلية</span>
                          <Link to={`/pos/invoices/${data.invoice_id}`} className="font-mono text-sm font-black text-indigo-700 hover:underline">
                            {data.original_invoice_no || `#${data.invoice_id}`}
                          </Link>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 border border-indigo-200 text-[10px] font-black text-indigo-700">أصلية</span>
                    </div>
                  )}
                  {/* Details grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-zinc-100 rounded-2xl p-4 bg-white flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">بيانات العميل والمرتجع</span>
                      <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">العميل</span><span className="font-black text-zinc-800">{data.customer_name || "—"}</span></div>
                      <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">بواسطة</span><span className="font-black text-zinc-700">{data.created_by_username || "—"}</span></div>
                      {data.reason && <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">سبب الإرجاع</span><span className="font-black text-zinc-700">{REASON_MAP[data.reason] || data.reason}</span></div>}
                      {data.notes && <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">ملاحظات</span><span className="font-black text-zinc-500 text-left max-w-[55%] text-right">{data.notes}</span></div>}
                    </div>
                    <div className="border border-zinc-100 rounded-2xl p-4 bg-white flex flex-col gap-2.5">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">الموقف المالي</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-2 text-center">
                          <span className="text-[9px] font-black text-zinc-400 block mb-1">الإجمالي</span>
                          <span className="font-mono text-xs font-black text-zinc-800">{fmt(total)}</span>
                        </div>
                        <div className={`rounded-xl border p-2 text-center ${cashAmt > 0.005 ? "bg-emerald-50/50 border-emerald-100" : "bg-zinc-50 border-zinc-100"}`}>
                          <span className={`text-[9px] font-black block mb-1 ${cashAmt > 0.005 ? "text-emerald-600" : "text-zinc-400"}`}>نقداً</span>
                          <span className={`font-mono text-xs font-black ${cashAmt > 0.005 ? "text-emerald-700" : "text-zinc-400"}`}>{fmt(cashAmt)}</span>
                        </div>
                        <div className={`rounded-xl border p-2 text-center ${creditAmt > 0.005 ? "bg-blue-50/50 border-blue-100" : "bg-zinc-50 border-zinc-100"}`}>
                          <span className={`text-[9px] font-black block mb-1 ${creditAmt > 0.005 ? "text-blue-600" : "text-zinc-400"}`}>رصيد حساب</span>
                          <span className={`font-mono text-xs font-black ${creditAmt > 0.005 ? "text-blue-700" : "text-zinc-400"}`}>{fmt(creditAmt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border border-zinc-100 rounded-2xl overflow-hidden bg-white">
                    <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-100">
                      <span className="text-xs font-black text-zinc-800">أصناف المرتجع ({(data.lines || []).length})</span>
                    </div>
                    <div className="overflow-x-auto max-h-[260px]">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-100">
                          <tr>
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">الكود</th>
                            <th className="px-4 py-3 font-black text-zinc-500">الصنف</th>
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">الكمية</th>
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">السعر</th>
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.lines || []).map((l, i) => (
                            <tr key={i} className="border-t border-zinc-100 hover:bg-emerald-50/10">
                              <td className="px-4 py-3 text-center font-mono text-[11px] font-black text-zinc-400">{l.item_code || "—"}</td>
                              <td className="px-4 py-3 font-bold text-zinc-800">{l.item_name || "—"}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-zinc-700">{l.quantity}</td>
                              <td className="px-4 py-3 text-center font-mono text-zinc-600">{fmt(l.unit_price)}</td>
                              <td className="px-4 py-3 text-center font-mono font-black text-emerald-700">{fmt(l.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                    <button onClick={onClose} className="h-10 px-5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black transition-colors">رجوع</button>
                    <button onClick={() => { navigate(`/pos/sales-returns/${returnId}`); onClose(); }}
                      className="h-10 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors flex items-center gap-2">
                      <Eye className="w-4 h-4" /> عرض المرتجع كاملاً
                    </button>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReturnRow({ row, navigate, onDeleteRequest, onPreviewRequest }) {
  const cashAmt   = Number(row.cash_amount   || 0);
  const creditAmt = Number(row.credit_amount || 0);
  const total     = Number(row.total         || 0);
  return (
    <motion.div variants={FADE_UP}
      className="group relative flex items-center justify-between gap-6 px-6 py-5 bg-white border-b border-zinc-100 hover:bg-emerald-50/30 transition-colors duration-300 overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />
      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
          <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">{row.doc_no || `RT-${String(row.id).padStart(5, "0")}`}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${STATUS_MAP[row.status]?.cls || STATUS_MAP.active.cls}`}>
              {STATUS_MAP[row.status]?.label || "نشط"}
            </span>
            {row.invoice_id
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-200"><FileText className="w-3 h-3" /> من فاتورة سابقة</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black bg-amber-50 text-amber-700 border-amber-200"><RotateCcw className="w-3 h-3" /> مرتجع مباشر</span>
            }
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            {row.customer_id
              ? <Link to={`/definitions/customers/${row.customer_id}`} className="text-zinc-600 hover:text-emerald-600 hover:underline truncate">{row.customer_name || `عميل #${row.customer_id}`}</Link>
              : <span>{row.customer_name || "—"}</span>
            }
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span className="text-zinc-500">{row.created_by_username || "—"}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span dir="ltr">{fmtDate(row.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-start gap-1 flex-1 z-10">
        <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400">السبب</span>
          {REASON_MAP[row.reason] || "أخرى"}
        </p>
        {row.original_invoice_no && (
          <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">الفاتورة الأصلية</span>
            <Link to={`/pos/invoices/${row.invoice_id}`} className="font-mono text-zinc-700 hover:text-emerald-600">{row.original_invoice_no}</Link>
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 z-10">
        <div className="flex items-stretch gap-0 bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="flex flex-col items-end justify-center px-3 py-2 min-w-[90px]">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">إجمالي المرتجع</span>
            <div className="text-[15px] font-black text-slate-800 font-mono leading-none flex items-baseline gap-0.5">
              <span>{fmt(total)}</span><span className="text-[8px] font-bold text-slate-400 mr-0.5">ج.م</span>
            </div>
          </div>
          {cashAmt > 0.005 && (
            <><div className="w-px self-stretch bg-slate-200/80" />
            <div className="flex flex-col items-end justify-center px-3 py-2 bg-emerald-50/80 min-w-[90px]">
              <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> نقداً</span>
              <div className="text-[14px] font-black text-emerald-700 font-mono leading-none"><span>{fmt(cashAmt)}</span></div>
            </div></>
          )}
          {creditAmt > 0.005 && (
            <><div className="w-px self-stretch bg-slate-200/80" />
            <div className="flex flex-col items-end justify-center px-3 py-2 bg-blue-50/80 min-w-[90px]">
              <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" /> رصيد حساب</span>
              <div className="text-[14px] font-black text-blue-700 font-mono leading-none"><span>{fmt(creditAmt)}</span></div>
            </div></>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button onClick={() => onPreviewRequest(row.id)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"><Eye className="w-4 h-4" /></button>
          <button onClick={() => navigate(`/pos/sales-returns/${row.id}`)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"><Printer className="w-4 h-4" /></button>
          <PermissionGate page="sales_returns" action="edit">
            <button onClick={() => navigate("/sales/returns/new", { state: { edit_return_id: row.id } })} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Pencil className="w-4 h-4" /></button>
          </PermissionGate>
          <PermissionGate page="sales_returns" action="delete">
            <button onClick={() => onDeleteRequest(row)} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
          </PermissionGate>
        </div>
      </div>
    </motion.div>
  );
}

export default function SalesReturnsListPage() {
  usePageTour('sales_returns');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdFilter = searchParams.get("invoice_id") || "";

  const [activeTab, setActiveTab] = useState("returns");
  const [rows, setRows]           = useState([]);
  const [itemRows, setItemRows]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searched, setSearched]   = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const customerInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [page, setPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter(c => c.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [customerQuery, customers]);

  // Item autocomplete
  const [itemQuery, setItemQuery]           = useState("");
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [itemResults, setItemResults]       = useState([]);
  const [selectedItem, setSelectedItem]     = useState(null);
  const [activeLookupIndex, setActiveLookupIndex] = useState(-1);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const itemInputRef = useRef(null);

  const debouncedSearch    = useDebounce(searchTerm, 300);
  const debouncedItemQuery = useDebounce(itemQuery, 300);

  useEffect(() => {
    if (!debouncedItemQuery.trim()) { setItemResults([]); return; }
    setIsLoadingItems(true);
    api.get(`/api/items?search=${encodeURIComponent(debouncedItemQuery)}&limit=20`)
      .then(r => setItemResults(r.data?.data || r.data || []))
      .catch(() => setItemResults([]))
      .finally(() => setIsLoadingItems(false));
  }, [debouncedItemQuery]);

  useEffect(() => {
    api.get("/api/users").then(r => setUsers(r.data.data || [])).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  async function loadReturns() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo)   params.set("date_to", dateTo);
      if (invoiceIdFilter) params.set("invoice_id", invoiceIdFilter);
      if (customerId) params.set("customer_id", customerId);
      if (userId) params.set("user_id", userId);
      const res = await api.get(`/api/invoices/returns?${params}`);
      setRows(res.data.data || []);
    } catch { toast.error("فشل تحميل بيانات المرتجعات"); }
    setLoading(false);
  }

  async function loadItemRows(qOverride) {
    const q = qOverride ?? (selectedItem
      ? (selectedItem.name || selectedItem.code)
      : itemQuery.trim());
    if (!q) { setItemRows([]); setSearched(false); setLoading(false); return; }
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ q });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo)   params.set("date_to", dateTo);
      const res = await api.get(`/api/invoices/returns/items-search?${params}`);
      setItemRows(res.data?.data || []);
    } catch { setItemRows([]); toast.error("فشل البحث بالأصناف"); }
    setLoading(false);
  }

  useEffect(() => {
    if (activeTab === "returns") loadReturns();
    else loadItemRows();
  }, [activeTab, debouncedSearch, selectedItem, dateFrom, dateTo, invoiceIdFilter]);

  useEffect(() => { setPage(1); }, [rows]);
  useEffect(() => { setItemPage(1); }, [itemRows]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/invoices/returns/${deleteTarget.id}`);
      toast.success(`تم حذف المرتجع ${deleteTarget.doc_no || `#${deleteTarget.id}`} بنجاح`);
      setDeleteTarget(null);
      loadReturns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل حذف المرتجع"); }
    finally { setDeleting(false); }
  }

  const clearItemSelection = () => { setSelectedItem(null); setItemQuery(""); setItemResults([]); setItemRows([]); setSearched(false); };

  const handlePickCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerId(c.id);
    setCustomerQuery(c.name);
    setCustomerLookupOpen(false);
  };

  const totalReturnsPages = Math.ceil(rows.length / PAGE_SIZE);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalItemPages = Math.ceil(itemRows.length / PAGE_SIZE);
  const pagedItemRows = itemRows.slice((itemPage - 1) * PAGE_SIZE, itemPage * PAGE_SIZE);

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[#f8fafc]" dir="rtl">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">

        {/* Header */}
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
            <MagneticButton data-help="add-button" onClick={() => navigate("/sales/returns/new")}
              className="flex items-center gap-2 bg-zinc-950 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-zinc-950/20 hover:bg-zinc-900 transition-colors">
              <Plus className="w-5 h-5" /> إصدار إشعار مرتجع
            </MagneticButton>
          </PermissionGate>
        </motion.header>

        {invoiceIdFilter && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <span className="text-sm font-black text-emerald-800">تصفية نشطة: مرتجعات الفاتورة #{invoiceIdFilter}</span>
            <button onClick={() => { searchParams.delete("invoice_id"); setSearchParams(searchParams); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100/50 hover:bg-emerald-100 rounded-lg transition-colors">
              <X className="w-4 h-4" /> إلغاء
            </button>
          </motion.div>
        )}

        {/* Tab switcher */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col gap-2">
          <div className="bg-zinc-100/80 border border-zinc-200/40 p-1.5 rounded-2xl flex gap-1.5 self-start">
            <button
              onClick={() => { setActiveTab("returns"); setItemQuery(""); setSelectedItem(null); setItemResults([]); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === "returns" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
            >سجل المرتجعات</button>
            <button
              onClick={() => { setActiveTab("items"); setSearchTerm(""); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === "items" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
            >البحث التفصيلي بالأصناف</button>
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={activeTab} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }} className="text-[11px] font-bold text-zinc-400 px-2">
              {activeTab === "returns" ? "عرض جميع إشعارات المرتجعات المسجلة" : "تتبّع مرتجعات صنف بعينه عبر كامل السجل"}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Search bar */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col bg-white border border-zinc-200/60 rounded-[2rem] shadow-sm p-4 gap-4">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div data-help="search-bar" className="relative flex-1 w-full">
              {activeTab === "returns" ? (
                <SearchInput value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm("")}
                  placeholder="ابحث برقم المرتجع أو اسم العميل..." size="lg" autoFocus className="w-full" />
              ) : (
                <div className="relative">
                  <SearchInput ref={itemInputRef} value={itemQuery}
                    onChange={(val) => { setItemQuery(val); setSelectedItem(null); setActiveLookupIndex(-1); setItemLookupOpen(true); }}
                    onClear={clearItemSelection} onFocus={() => setItemLookupOpen(true)}
                    onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (itemResults.length > 0 && activeLookupIndex >= 0) {
                          const p = itemResults[activeLookupIndex];
                          setSelectedItem(p); setItemQuery(p.name); setItemLookupOpen(false);
                        } else if (itemQuery.trim()) { setSelectedItem(null); setItemLookupOpen(false); loadItemRows(itemQuery.trim()); }
                      } else if (e.key === "ArrowDown") { e.preventDefault(); setActiveLookupIndex(p => Math.min(p + 1, itemResults.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveLookupIndex(p => Math.max(p - 1, 0)); }
                    }}
                    placeholder="ابحث باسم المنتج أو الباركود..." size="lg" loading={isLoadingItems} autoFocus className="w-full" />
                  {itemLookupOpen && (itemResults.length > 0 || itemQuery.trim()) && (
                    <SearchDropdown items={itemResults} activeIndex={activeLookupIndex} query={itemQuery} emptyLabel="لا توجد نتائج"
                      onPick={(item) => { setSelectedItem(item); setItemQuery(item.name); setItemLookupOpen(false); setActiveLookupIndex(-1); }} />
                  )}
                  {selectedItem && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-2">
                      <span className="font-mono text-[11px] font-black text-emerald-700 shrink-0">{selectedItem.code || `#${selectedItem.id}`}</span>
                      <div className="h-3 w-px bg-emerald-300 shrink-0" />
                      <span className="text-[12px] text-emerald-700 font-bold truncate">{selectedItem.name}</span>
                      <button type="button" onClick={clearItemSelection} className="mr-auto text-emerald-400 hover:text-rose-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-xs font-black transition-all shrink-0 ${(dateFrom || dateTo || customerId || userId) ? "border-emerald-300 bg-emerald-50/50 text-emerald-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              <SlidersHorizontal className="w-4 h-4" /> تصفية
              {(dateFrom || dateTo || customerId || userId) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {filtersOpen && (
            <div className="border-t border-zinc-100 pt-4 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">المستخدم</span>
                <select value={userId} onChange={e => setUserId(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]">
                  <option value="">كل المستخدمين</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">العميل</span>
                <div className="relative">
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); setSelectedCustomer(null); setCustomerId(""); }}
                    onFocus={() => setCustomerLookupOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerLookupOpen(false), 200)}
                    placeholder="جميع العملاء"
                    className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500 min-w-[180px]"
                  />
                  {customerLookupOpen && (
                    <SearchDropdown items={filteredCustomers} onPick={handlePickCustomer} emptyLabel="لا يوجد عملاء" />
                  )}
                </div>
                {selectedCustomer && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 mt-1">
                    <span className="text-[11px] text-emerald-700 font-bold truncate">{selectedCustomer.name}</span>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerId(""); setCustomerQuery(""); }}>
                      <X className="w-3 h-3 text-emerald-400 hover:text-rose-500" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-emerald-500" />
              </div>
              {(dateFrom || dateTo || customerId || userId) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setCustomerId(""); setCustomerQuery(""); setSelectedCustomer(null); setUserId(""); }}
                  className="h-10 flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-600 hover:bg-rose-100 transition-colors">
                  <X className="w-3.5 h-3.5" /> مسح التصفية
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Results */}
        <motion.div data-help="main-table" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="flex flex-col bg-white rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
            </div>
          ) : activeTab === "returns" ? (
            rows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100"><FileText className="w-8 h-8 text-zinc-300" /></div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد مرتجعات</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي إشعارات مرتجع تطابق بحثك.</p>
              </div>
            ) : (
              <>
                {pagedRows.map(row => <ReturnRow key={row.id} row={row} navigate={navigate} onDeleteRequest={setDeleteTarget} onPreviewRequest={setPreviewId} />)}
                {totalReturnsPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="h-4 w-4" /> السابق
                    </button>
                    <span className="text-[11px] font-black text-zinc-400">{page} / {totalReturnsPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalReturnsPages, p + 1))} disabled={page >= totalReturnsPages}
                      className="flex items-center gap-2 text-xs font-black text-zinc-700 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 shadow-sm hover:shadow-md transition-shadow disabled:opacity-30 disabled:cursor-not-allowed">
                      التالي <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )
          ) : !searched ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-zinc-400">
              <Search className="w-12 h-12 opacity-25 mb-4" />
              <h3 className="text-base font-black text-zinc-800 mb-1">بحث تفصيلي ببيانات الصنف</h3>
              <p className="text-xs font-bold text-zinc-400 max-w-[45ch] leading-relaxed">اكتب اسم المنتج أو الكود للوصول لجميع سطور مرتجعات المبيعات المرتبطة به.</p>
            </div>
          ) : itemRows.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100"><Package className="w-8 h-8 text-zinc-300" /></div>
              <h3 className="text-xl font-black text-zinc-900 mb-2">لا توجد نتائج مطابقة</h3>
              <p className="text-sm font-medium text-zinc-500 max-w-sm">لم يتم العثور على أي مرتجع يحتوي على هذا الصنف.</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-5 py-3.5 font-black text-zinc-500">رقم المرتجع</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500">التاريخ</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500">العميل</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">كود الصنف</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500">اسم المنتج</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الكمية المرتجعة</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">سعر الوحدة</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الإجمالي</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">معاينة</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItemRows.map((r, i) => (
                    <tr key={r.line_id || i} className="border-b border-zinc-100 hover:bg-emerald-50/10 transition-colors">
                      <td className="px-5 py-4 font-mono font-black text-zinc-700">{r.doc_no || "—"}</td>
                      <td className="px-5 py-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-5 py-4 font-bold text-zinc-700">{r.customer_name || "—"}</td>
                      <td className="px-5 py-4 text-center font-mono text-[11px] font-black text-zinc-400">{r.item_code || r.barcode || "—"}</td>
                      <td className="px-5 py-4 font-bold text-zinc-800">{r.item_name || "—"}</td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-zinc-700">{r.quantity}</td>
                      <td className="px-5 py-4 text-center font-mono text-zinc-600">{fmt(r.unit_price)}</td>
                      <td className="px-5 py-4 text-center font-mono font-black text-emerald-700">{fmt(r.line_total)}</td>
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => setPreviewId(r.sales_return_id)} className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors inline-block">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
          )}
        </motion.div>
      </div>

      <DeleteWarningModal row={deleteTarget} onConfirm={handleConfirmDelete} onClose={() => setDeleteTarget(null)} deleting={deleting} />
      <PreviewModal returnId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}
