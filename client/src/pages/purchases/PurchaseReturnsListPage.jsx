import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, RotateCcw, X, Eye, Pencil, Trash2, AlertTriangle, ArrowUpRight, FileText, Search, Package, SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";
import WhatsAppIcon from "../../components/ui/WhatsAppIcon";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import useDebounce from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { usePageTour } from "../../hooks/usePageTour";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";
import SearchInput from "../../components/ui/SearchInput";
import SearchDropdown from "../../components/ui/SearchDropdown";
import { formatNumber } from "../../utils/currency";
import { usePermission } from "../../hooks/usePermission";
import WhatsAppSendModal from "../../components/whatsapp/WhatsAppSendModal";

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

const PAGE_SIZE = 20;

function fmt(v) { return formatNumber(v); }
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
  const [reason, setReason] = useState("");
  const PRESETS = ["خطأ في البيانات", "خطأ في الكمية", "مرتجع مكرر", "تسوية مع المورد", "أخرى"];
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
                  <h2 className="text-[17px] font-black text-zinc-900 mb-1">تأكيد إلغاء المرتجع</h2>
                  <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                    سيتم إلغاء مرتجع الشراء <span className="font-black text-zinc-800 font-mono">{row.doc_no || `PR-${String(row.id).padStart(5, "0")}`}</span>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setReason(p)}
                    className={`px-3 py-1.5 rounded-lg text-2sm font-bold border transition-colors ${reason === p ? "bg-rose-600 text-white border-rose-600" : "border-slate-200 text-slate-600 hover:border-rose-300"}`}
                  >{p}</button>
                ))}
              </div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="أو اكتب سبب الإلغاء..."
                className="w-full border border-slate-200 rounded-xl p-3 text-2sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300 mb-4" />
              <div className="flex gap-3">
                <button onClick={() => reason.trim() && onConfirm(reason)} disabled={deleting || !reason.trim()}
                  className="flex-1 h-11 rounded-2xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50 transition-all">
                  {deleting ? "جاري الإلغاء..." : "تأكيد الإلغاء"}
                </button>
                <button onClick={onClose} className="h-11 px-6 rounded-2xl bg-zinc-100 text-zinc-700 text-sm font-black hover:bg-zinc-200 transition-colors">إلغاء</button>
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
    api.get(`/api/purchases/returns/${returnId}`)
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
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
              </div>
            ) : !data ? (
              <div className="text-center py-12 text-zinc-400 font-bold">تعذّر تحميل البيانات</div>
            ) : (() => {
              const settlementType = data.settlement_type || "account";
              const cashAmt   = settlementType === "cash"  ? Number(data.total || 0)
                              : settlementType === "split" ? Number(data.cash_amount || 0) : 0;
              const creditAmt = settlementType === "account" ? Number(data.total || 0)
                              : settlementType === "split"   ? Number(data.credit_amount || 0) : 0;
              const total = Number(data.total || 0);
              return (
                <div className="flex flex-col gap-5" dir="rtl">
                  <div className="rounded-2xl bg-blue-50/50 border border-blue-100/80 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">رقم المرتجع</span>
                      <span className="font-mono text-xl font-black text-zinc-950">{data.doc_no || `#${data.id}`}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-zinc-400 tracking-wider uppercase">التاريخ</span>
                      <span className="font-mono text-sm font-bold text-zinc-600">{fmtDate(data.created_at)}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">صافي المرتجع</span>
                      <span className="number-fmt text-xl font-black text-blue-700">{fmt(total)} ج.م</span>
                      {(Number(data.discount) > 0 || Number(data.increase) > 0) && (
                        <span className="text-[11px] font-bold text-slate-500">
                          {fmt(Number(data.total) + Number(data.discount || 0) - Number(data.increase || 0))} أصناف
                          {Number(data.discount) > 0 && <span className="text-rose-500"> · خصم −{fmt(data.discount)}</span>}
                          {Number(data.increase) > 0 && <span className="text-emerald-600"> · زيادة +{fmt(data.increase)}</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  {data.purchase_id && (
                    <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200/70 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-indigo-500 tracking-wider uppercase">رقم مستند الشراء الأصلي</span>
                          <Link to={`/purchases/${data.purchase_id}`} className="font-mono text-sm font-black text-indigo-700 hover:underline">
                            {data.original_purchase_no || `#${data.purchase_id}`}
                          </Link>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 border border-indigo-200 text-[11px] font-black text-indigo-700">أصلية</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-zinc-100 rounded-2xl p-4 bg-white flex flex-col gap-2.5">
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-1">بيانات المورد والمرتجع</span>
                      <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">المورد</span><span className="font-black text-zinc-800">{data.supplier_name || "—"}</span></div>
                      <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">بواسطة</span><span className="font-black text-zinc-700">{data.created_by_username || "—"}</span></div>
                      {data.reason && <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">سبب الإرجاع</span><span className="font-black text-zinc-700">{REASON_MAP[data.reason] || data.reason}</span></div>}
                      {data.notes && <div className="flex justify-between text-sm"><span className="font-bold text-zinc-400">ملاحظات</span><span className="font-black text-zinc-500 text-right max-w-[55%]">{data.notes}</span></div>}
                    </div>
                    <div className="border border-zinc-100 rounded-2xl p-4 bg-white flex flex-col gap-2.5">
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-1">الموقف المالي</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-2 text-center">
                          <span className="text-[9px] font-black text-zinc-400 block mb-1">الإجمالي</span>
                          <span className="number-fmt text-xs font-black text-zinc-800">{fmt(total)}</span>
                        </div>
                        <div className={`rounded-xl border p-2 text-center ${cashAmt > 0.005 ? "bg-emerald-50/50 border-emerald-100" : "bg-zinc-50 border-zinc-100"}`}>
                          <span className={`text-[9px] font-black block mb-1 ${cashAmt > 0.005 ? "text-emerald-600" : "text-zinc-400"}`}>نقداً</span>
                          <span className={`number-fmt text-xs font-black ${cashAmt > 0.005 ? "text-emerald-700" : "text-zinc-400"}`}>{fmt(cashAmt)}</span>
                        </div>
                        <div className={`rounded-xl border p-2 text-center ${creditAmt > 0.005 ? "bg-amber-50/50 border-amber-100" : "bg-zinc-50 border-zinc-100"}`}>
                          <span className={`text-[9px] font-black block mb-1 ${creditAmt > 0.005 ? "text-amber-600" : "text-zinc-400"}`}>حساب المورد</span>
                          <span className={`number-fmt text-xs font-black ${creditAmt > 0.005 ? "text-amber-700" : "text-zinc-400"}`}>{fmt(creditAmt)}</span>
                        </div>
                      </div>
                      {/* Before → adjustments → after (only when a discount or increase is applied) */}
                      {(Number(data.discount) > 0 || Number(data.increase) > 0) && (
                        <div className="mt-3 pt-3 border-t border-zinc-100 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-zinc-500">إجمالي الأصناف المرتجعة</span>
                            <span className="number-fmt text-zinc-700">{fmt(Number(total) + Number(data.discount || 0) - Number(data.increase || 0))} ج.م</span>
                          </div>
                          {Number(data.discount) > 0 && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-black text-rose-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> خصم المرتجع</span>
                              <span className="number-fmt font-black text-rose-600">− {fmt(data.discount)} ج.م</span>
                            </div>
                          )}
                          {Number(data.increase) > 0 && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-black text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> زيادة المرتجع</span>
                              <span className="number-fmt font-black text-emerald-600">+ {fmt(data.increase)} ج.م</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100">
                            <span className="font-black text-zinc-800">صافي المرتجع</span>
                            <span className="number-fmt-primary font-black text-zinc-900">{fmt(total)} ج.م</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">سعر التكلفة</th>
                            <th className="px-4 py-3 font-black text-zinc-500 text-center">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.lines || []).map((l, i) => (
                            <tr key={i} className="border-t border-zinc-100 hover:bg-blue-50/10">
                              <td className="px-4 py-3 text-center font-mono text-[11px] font-black text-zinc-400">{l.item_code || "—"}</td>
                              <td className="px-4 py-3 font-bold text-zinc-800">{l.item_name || "—"}</td>
                              <td className="px-4 py-3 text-center number-fmt text-zinc-700">{l.quantity}</td>
                              <td className="px-4 py-3 text-center number-fmt text-zinc-600">{fmt(l.unit_cost)}</td>
                              <td className="px-4 py-3 text-center number-fmt-primary text-blue-700">{fmt(l.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                    <button onClick={onClose} className="h-10 px-5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-black transition-colors">رجوع</button>
                    <button onClick={() => { navigate(`/purchases/returns/${returnId}`); onClose(); }}
                      className="h-10 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-colors flex items-center gap-2">
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

function ReturnRow({ row, navigate, onDeleteRequest, onPreviewRequest, onPrintRequest, onWhatsAppRequest }) {
  const canSendWhatsApp = usePermission("whatsapp_receipt", "send");
  const settlementType = row.settlement_type || "account";
  const cashAmt   = settlementType === "cash"  ? Number(row.total || 0)
                  : settlementType === "split"  ? Number(row.cash_amount || 0) : 0;
  const creditAmt = settlementType === "account" ? Number(row.total || 0)
                  : settlementType === "split"    ? Number(row.credit_amount || 0) : 0;
  const total = Number(row.total || 0);

  return (
    <motion.div variants={FADE_UP}
      className="group relative flex items-center justify-between gap-6 px-6 py-5 bg-white border-b border-zinc-100 hover:bg-blue-50/30 transition-colors duration-300 overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 ease-out z-10" />
      <div className="flex items-center gap-5 flex-1 min-w-0 z-10">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
          <ArrowUpRight className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-black text-zinc-900 font-mono tracking-tight">{row.doc_no || `PR-${String(row.id).padStart(5, "0")}`}</span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black ${STATUS_MAP[row.status]?.cls || STATUS_MAP.active.cls}`}>
              {STATUS_MAP[row.status]?.label || "نشط"}
            </span>
            {row.purchase_id
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-indigo-50 text-indigo-700 border-indigo-200"><FileText className="w-3 h-3" /> من أمر شراء</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black bg-amber-50 text-amber-700 border-amber-200"><RotateCcw className="w-3 h-3" /> مرتجع مباشر</span>
            }
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
            {row.supplier_id
              ? <Link to={`/definitions/suppliers/${row.supplier_id}`} className="text-zinc-600 hover:text-blue-600 hover:underline truncate">{row.supplier_name || `مورد #${row.supplier_id}`}</Link>
              : <span>{row.supplier_name || "—"}</span>
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
          <span className="text-[11px] uppercase tracking-widest text-zinc-400">السبب</span>
          {REASON_MAP[row.reason] || "أخرى"}
        </p>
        {row.original_purchase_no && (
          <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-zinc-400">المستند الأصلي</span>
            <Link to={`/purchases/${row.purchase_id}`} className="font-mono text-zinc-700 hover:text-blue-600">{row.original_purchase_no}</Link>
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 z-10">
        <div className="flex items-stretch gap-0 bg-slate-50/80 border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="flex flex-col items-end justify-center px-3 py-2 min-w-[90px]">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">صافي المرتجع</span>
            <div className="text-[15px] font-black text-slate-800 number-fmt leading-none flex items-baseline gap-0.5">
              <span>{fmt(total)}</span><span className="text-[8px] font-bold text-slate-400 mr-0.5">ج.م</span>
            </div>
            {Number(row.discount) > 0 && <span className="text-[8px] font-black text-rose-500 mt-0.5">خصم −{fmt(row.discount)}</span>}
            {Number(row.increase) > 0 && <span className="text-[8px] font-black text-emerald-600 mt-0.5">زيادة +{fmt(row.increase)}</span>}
          </div>
          {cashAmt > 0.005 && (
            <><div className="w-px self-stretch bg-slate-200/80" />
            <div className="flex flex-col items-end justify-center px-3 py-2 bg-emerald-50/80 min-w-[90px]">
              <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> نقداً للمورد</span>
              <div className="text-sm font-black text-emerald-700 number-fmt leading-none"><span>{fmt(cashAmt)}</span></div>
            </div></>
          )}
          {creditAmt > 0.005 && (
            <><div className="w-px self-stretch bg-slate-200/80" />
            <div className="flex flex-col items-end justify-center px-3 py-2 bg-amber-50/80 min-w-[90px]">
              <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> حساب المورد</span>
              <div className="text-sm font-black text-amber-700 number-fmt leading-none"><span>{fmt(creditAmt)}</span></div>
            </div></>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button onClick={() => onPreviewRequest(row.id)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"><Eye className="w-4 h-4" /></button>
          <PermissionGate page="purchase_returns" action="print">
            <button onClick={() => onPrintRequest(row)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"><Printer className="w-4 h-4" /></button>
          </PermissionGate>
          {canSendWhatsApp && (
            <button onClick={(e) => { e.stopPropagation(); onWhatsAppRequest?.(row); }} className="p-2 text-zinc-400 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded-xl transition-colors" title="إرسال عبر واتساب">
              <WhatsAppIcon className="w-4 h-4" />
            </button>
          )}
          <PermissionGate page="purchase_returns" action="edit">
            <button onClick={() => navigate("/purchases/returns/new", { state: { edit_return_id: row.id } })} className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Pencil className="w-4 h-4" /></button>
          </PermissionGate>
          <PermissionGate page="purchase_returns" action="delete">
            <button onClick={() => onDeleteRequest(row)} className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
          </PermissionGate>
        </div>
      </div>
    </motion.div>
  );
}

export default function PurchaseReturnsListPage() {
  usePageTour('purchase_returns');
  const handleKeyDown = useFieldNavigation();
  const filterUserIdRef = useRef(null);
  const filterDateFromRef = useRef(null);
  const filterDateToRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseIdFilter = searchParams.get("purchase_id") || "";

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
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const supplierInputRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [printSettings, setPrintSettings] = useState({});
  const [waSendTarget, setWaSendTarget] = useState(null);
  const canSendWhatsApp = usePermission("whatsapp_receipt", "send");
  const [page, setPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);

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
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
  }, []);

  async function handlePrintClick(row) {
    const tid = toast.loading("جاري تحميل تفاصيل المرتجع...");
    try {
      const res = await api.get(`/api/purchases/returns/${row.id}`);
      setPrintTarget(res.data?.data || res.data);
      toast.dismiss(tid);
    } catch {
      toast.error("تعذر تحميل تفاصيل المرتجع");
      toast.dismiss(tid);
    }
  }

  async function handleWhatsAppClick(row) {
    const tid = toast.loading("جاري تحميل تفاصيل المرتجع...");
    try {
      const res = await api.get(`/api/purchases/returns/${row.id}`);
      setWaSendTarget(res.data?.data || res.data);
      toast.dismiss(tid);
    } catch {
      toast.error("تعذر تحميل تفاصيل المرتجع");
      toast.dismiss(tid);
    }
  }

  useEffect(() => {
    api.get("/api/users").then(r => setUsers(r.data.data || [])).catch(() => {});
    api.get("/api/suppliers?limit=500").then(r => setSuppliers(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!debouncedItemQuery.trim()) { setItemResults([]); return; }
    setIsLoadingItems(true);
    api.get(`/api/items?search=${encodeURIComponent(debouncedItemQuery)}&limit=20`)
      .then(r => setItemResults(r.data?.data || r.data || []))
      .catch(() => setItemResults([]))
      .finally(() => setIsLoadingItems(false));
  }, [debouncedItemQuery]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => s.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [supplierQuery, suppliers]);

  async function loadReturns() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo)   params.set("date_to", dateTo);
      if (supplierId) params.set("supplier_id", supplierId);
      if (userId) params.set("user_id", userId);
      if (purchaseIdFilter) params.set("purchase_id", purchaseIdFilter);
      const res = await api.get(`/api/purchases/returns?${params}`);
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
      const res = await api.get(`/api/purchases/returns/items-search?${params}`);
      setItemRows(res.data?.data || []);
    } catch { setItemRows([]); toast.error("فشل البحث بالأصناف"); }
    setLoading(false);
  }

  useEffect(() => {
    if (activeTab === "returns") loadReturns();
    else loadItemRows();
  }, [activeTab, debouncedSearch, selectedItem, dateFrom, dateTo, userId, supplierId, purchaseIdFilter]);

  useEffect(() => { setPage(1); }, [rows]);
  useEffect(() => { setItemPage(1); }, [itemRows]);

  async function handleConfirmDelete(reason) {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.post(`/api/purchases/returns/${deleteTarget.id}/cancel`, { reason });
      toast.success(`تم إلغاء المرتجع ${deleteTarget.doc_no || `#${deleteTarget.id}`} بنجاح`);
      setDeleteTarget(null);
      loadReturns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل إلغاء المرتجع"); }
    finally { setDeleting(false); }
  }

  const clearItemSelection = () => { setSelectedItem(null); setItemQuery(""); setItemResults([]); setItemRows([]); setSearched(false); };

  const handlePickSupplier = (s) => {
    setSelectedSupplier(s);
    setSupplierId(s.id);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
  };

  const totalReturnsPages = Math.ceil(rows.length / PAGE_SIZE);
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalItemPages = Math.ceil(itemRows.length / PAGE_SIZE);
  const pagedItemRows = itemRows.slice((itemPage - 1) * PAGE_SIZE, itemPage * PAGE_SIZE);

  return (
    <div className="relative min-h-[100dvh] p-6 lg:p-12 overflow-x-hidden font-sans bg-[var(--bg-base)]" dir="rtl">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <motion.header initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-zinc-200 shadow-sm">
                <RotateCcw className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[11px] font-black text-zinc-400 tracking-[0.2em] uppercase">المشتريات</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight">مرتجعات <span className="text-blue-600">الموردين</span></h1>
          </div>
          <PermissionGate page="purchase_returns" action="add">
            <MagneticButton data-help="add-button" onClick={() => navigate("/purchases/returns/new")}
              className="flex items-center gap-2 bg-primary text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-zinc-950/20 hover:bg-primary-600 transition-colors">
              <Plus className="w-5 h-5" /> إرجاع مشتريات
            </MagneticButton>
          </PermissionGate>
        </motion.header>

        {purchaseIdFilter && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <span className="text-sm font-black text-blue-800">تصفية نشطة: مرتجعات الفاتورة #{purchaseIdFilter}</span>
            <button onClick={() => { searchParams.delete("purchase_id"); setSearchParams(searchParams); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-100/50 hover:bg-blue-100 rounded-lg transition-colors">
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
              {activeTab === "returns" ? "عرض جميع إشعارات مرتجعات الموردين المسجلة" : "تتبّع مرتجعات صنف بعينه عبر كامل السجل"}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Search bar */}
        <motion.div initial="hidden" animate="visible" variants={FADE_UP} className="flex flex-col bg-white border border-zinc-200/60 rounded-[2rem] shadow-sm p-4 gap-4">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div data-help="search-bar" className="relative flex-1 w-full">
              {activeTab === "returns" ? (
                <SearchInput value={searchTerm} onChange={setSearchTerm} onClear={() => setSearchTerm("")}
                  placeholder="ابحث برقم المرتجع أو اسم المورد..." size="lg" autoFocus className="w-full" />
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
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mt-2">
                      <span className="font-mono text-[11px] font-black text-blue-700 shrink-0">{selectedItem.code || `#${selectedItem.id}`}</span>
                      <div className="h-3 w-px bg-blue-300 shrink-0" />
                      <span className="text-2sm text-blue-700 font-bold truncate">{selectedItem.name}</span>
                      <button type="button" onClick={clearItemSelection} className="mr-auto text-blue-400 hover:text-rose-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-xs font-black transition-all shrink-0 ${(supplierId || userId || dateFrom || dateTo) ? "border-blue-300 bg-blue-50/50 text-blue-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              <SlidersHorizontal className="w-4 h-4" /> تصفية
              {(dateFrom || dateTo || supplierId || userId) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {filtersOpen && (
            <div className="border-t border-zinc-100 pt-4 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المستخدم</span>
                <select ref={filterUserIdRef} value={userId} onChange={e => setUserId(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-blue-500 min-w-[180px]" onKeyDown={e => handleKeyDown(e, { nextRef: supplierInputRef })}>
                  <option value="">كل المستخدمين</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">المورد</span>
                <div className="relative">
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierQuery}
                    onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); setSelectedSupplier(null); setSupplierId(""); }}
                    onFocus={() => setSupplierLookupOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                    placeholder="جميع الموردين"
                    className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-blue-500 min-w-[180px]"
                    onKeyDown={e => handleKeyDown(e, { nextRef: filterDateFromRef, prevRef: filterUserIdRef })}
                  />
                  {supplierLookupOpen && (
                    <SearchDropdown items={filteredSuppliers} onPick={handlePickSupplier} emptyLabel="لا يوجد موردين" />
                  )}
                </div>
                {selectedSupplier && (
                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mt-1">
                    <span className="text-[11px] text-blue-700 font-bold truncate">{selectedSupplier.name}</span>
                    <button onClick={() => { setSelectedSupplier(null); setSupplierId(""); setSupplierQuery(""); }}>
                      <X className="w-3 h-3 text-blue-400 hover:text-rose-500" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">من تاريخ</span>
                <input ref={filterDateFromRef} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-blue-500" onKeyDown={e => handleKeyDown(e, { nextRef: filterDateToRef, prevRef: supplierInputRef })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-1">إلى تاريخ</span>
                <input ref={filterDateToRef} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-zinc-50 border border-zinc-200/60 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-blue-500" onKeyDown={e => handleKeyDown(e, { prevRef: filterDateFromRef })} />
              </div>
              {(dateFrom || dateTo || supplierId || userId) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setSupplierId(""); setSupplierQuery(""); setSelectedSupplier(null); setUserId(""); }}
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
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                {pagedRows.map(row => <ReturnRow key={row.id} row={row} navigate={navigate} onDeleteRequest={setDeleteTarget} onPreviewRequest={setPreviewId} onPrintRequest={handlePrintClick} onWhatsAppRequest={handleWhatsAppClick} />)}
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
              <p className="text-xs font-bold text-zinc-400 max-w-[45ch] leading-relaxed">اكتب اسم المنتج أو الكود للوصول لجميع سطور مرتجعات المشتريات المرتبطة به.</p>
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
                    <th className="px-5 py-3.5 font-black text-zinc-500">المورد</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">كود الصنف</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500">اسم المنتج</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الكمية المرتجعة</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">سعر التكلفة</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">الإجمالي</th>
                    <th className="px-5 py-3.5 font-black text-zinc-500 text-center">معاينة</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItemRows.map((r, i) => (
                    <tr key={r.line_id || i} className="border-b border-zinc-100 hover:bg-blue-50/10 transition-colors">
                      <td className="px-5 py-4 font-mono font-black text-zinc-700">{r.doc_no || "—"}</td>
                      <td className="px-5 py-4 text-zinc-500 font-mono text-[11px] whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-5 py-4 font-bold text-zinc-700">{r.supplier_name || "—"}</td>
                      <td className="px-5 py-4 text-center font-mono text-[11px] font-black text-zinc-400">{r.item_code || r.barcode || "—"}</td>
                      <td className="px-5 py-4 font-bold text-zinc-800">{r.item_name || "—"}</td>
                      <td className="px-5 py-4 text-center number-fmt text-zinc-700">{r.quantity}</td>
                      <td className="px-5 py-4 text-center number-fmt text-zinc-600">{fmt(r.unit_cost)}</td>
                      <td className="px-5 py-4 text-center number-fmt-primary text-blue-700">{fmt(r.line_total)}</td>
                      <td className="px-5 py-4 text-center">
                        <button onClick={() => setPreviewId(r.purchase_return_id)} className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors inline-block">
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

      {printTarget && (
        <PrintPreviewModal
          open={Boolean(printTarget)}
          onClose={() => setPrintTarget(null)}
          docType="purchase_return"
          invoice={{
            ...printTarget,
            invoice_no: printTarget.doc_no || "",
            customer_name: printTarget.supplier_name || "",
            cashier_name: printTarget.created_by_username || "",
            subtotal: printTarget.total || 0,
            total: printTarget.total || 0,
            discount: printTarget.discount || 0,
            increase: printTarget.increase || 0,
            notes: printTarget.notes || "",
            lines: (printTarget.lines || []).map(l => ({
              ...l,
              item_name: l.item_name || l.name,
              quantity: l.quantity,
              unit_price: l.unit_cost || l.unit_price,
              discount_amount: 0,
              code: l.item_code || l.code || "",
            })),
          }}
          settings={printSettings}
          operationLabel="مرتجع مشتريات"
        />
      )}
      {waSendTarget && (
        <WhatsAppSendModal
          open={Boolean(waSendTarget)}
          onClose={() => setWaSendTarget(null)}
          kind="purchase_return_receipt"
          invoice={waSendTarget}
        />
      )}
    </div>
  );
}
