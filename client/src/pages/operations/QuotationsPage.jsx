import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  FileText, Plus, Printer, Calendar, User, CheckCircle2,
  Clock, MoreVertical, Eye, Search, X, Copy, Send,
  Trash2, ShoppingCart, AlertTriangle, TrendingUp
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { DramaticDeleteConfirm } from "../../components/ui/DramaticDeleteConfirm";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import PermissionGate from "../../components/ui/PermissionGate";

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
    return <span className="rounded-full border px-2 py-0.5 text-[10px] font-black bg-rose-50 text-rose-700 border-rose-100">منتهي الصلاحية</span>;
  }
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${s.cls}`}>{s.label}</span>
      {expiringSoon && (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 flex items-center gap-0.5">
          <AlertTriangle className="h-2.5 w-2.5" /> {daysLeft}ي
        </span>
      )}
    </div>
  );
}

export default function QuotationsPage() {
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

  // Compute effective status (expired if past date)
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
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-slate-800 tracking-tight">عروض الأسعار</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">تتبع عروض الأسعار المرسلة للعملاء ومعدلات التحويل للمبيعات</p>
        </div>
        <PermissionGate page="quotations" action="add">
        <Link to="/operations/quotations/new"
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-slate-700 transition-all active:scale-95">
          <Plus className="h-4 w-4" /> إنشاء عرض جديد
        </Link>
        </PermissionGate>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-slate-800 rounded-r-xl" />
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">إجمالي القيم المعروضة</span>
          <span className="text-[20px] font-black text-slate-800 mt-1">{formatMoney(stats.total)} <span className="text-[11px] text-slate-400">ج.م</span></span>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-xl" />
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">تم تحويلها لبيع</span>
          <span className="text-[20px] font-black text-slate-800 mt-1">{stats.converted}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-xl" />
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">مسودات معلقة</span>
          <span className="text-[20px] font-black text-slate-800 mt-1">{stats.drafts}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r-xl" />
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">معدل التحويل</span>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-[20px] font-black text-slate-800">{stats.conversionRate}%</span>
            <TrendingUp className="h-4 w-4 text-violet-500 mb-0.5" />
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث باسم العميل أو رقم العرض..."
              className="w-full rounded-lg border border-slate-200 bg-white pr-8 pl-3 py-1.5 text-[12px] font-bold text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none" />
          </div>
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700">
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
          <span className="mr-auto text-[11px] font-bold text-slate-400">{rows.length} عرض</span>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 border-b border-slate-100 px-5 py-2 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-black transition-all ${
                statusFilter === tab.value ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                <th className="px-5 py-3.5">رقم العرض</th>
                <th className="px-5 py-3.5">العميل</th>
                <th className="px-5 py-3.5">الأصناف</th>
                <th className="px-5 py-3.5">التاريخ</th>
                <th className="px-5 py-3.5">الصلاحية</th>
                <th className="px-5 py-3.5">الحالة</th>
                <th className="px-5 py-3.5 text-left">الإجمالي</th>
                <th className="px-5 py-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="8" className="py-20 text-center font-bold text-slate-400 animate-pulse">جاري التحميل...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileText className="h-10 w-10 opacity-30" />
                      <p className="text-[13px] font-black">لا توجد عروض أسعار</p>
                      <Link to="/operations/quotations/new" className="rounded-lg bg-slate-800 px-4 py-2 text-[12px] font-black text-white hover:bg-slate-700 transition-colors">
                        إنشاء أول عرض
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const effStatus = effectiveStatus(row);
                  return (
                    <tr key={row.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[13px] font-black text-slate-900">QTN-{String(row.id).padStart(5, "0")}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400 shrink-0"><User className="h-3.5 w-3.5" /></div>
                          <span className="text-[13px] font-bold text-slate-700">{row.customer_name || `عميل #${row.customer_id}`}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">{row.line_count || 0} صنف</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 opacity-40" />
                          <span className="text-[12px] font-medium">{formatDate(row.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.expires_at ? (
                          <span className="text-[12px] font-bold text-slate-500">{formatDate(row.expires_at)}</span>
                        ) : <span className="text-slate-300 text-[11px]">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={effStatus} expiresAt={row.expires_at} />
                      </td>
                      <td className="px-5 py-3.5 text-left font-black text-slate-900">{formatMoney(row.total)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1">
                          {canConvert(row) && (
                            <PermissionGate page="quotations" action="edit">
                            <button onClick={() => setConvertTarget(row)}
                              className="flex h-8 items-center gap-1 px-2 rounded-lg bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-500 transition-colors">
                              <ShoppingCart className="h-3.5 w-3.5" /> تحويل
                            </button>
                            </PermissionGate>
                          )}
                          <button onClick={() => handleShowDetail(row.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link to={`/operations/quotations/new?id=${row.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                            <FileText className="h-4 w-4" />
                          </Link>
                          {/* More menu */}
                          <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                            <button onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenu === row.id && (
                              <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                                {canSend(row) && (
                                  <PermissionGate page="quotations" action="edit">
                                  <button onClick={() => { handleSend(row.id); setOpenMenu(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                                    <Send className="h-3.5 w-3.5" /> تحديد كمُرسل
                                  </button>
                                  </PermissionGate>
                                )}
                                <PermissionGate page="quotations" action="add">
                                <button onClick={() => { handleDuplicate(row.id); setOpenMenu(null); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                                  <Copy className="h-3.5 w-3.5" /> نسخ العرض
                                </button>
                                </PermissionGate>
                                {canDelete(row) && (
                                  <PermissionGate page="quotations" action="delete">
                                  <button onClick={() => { setDeleteTarget(row); setOpenMenu(null); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" /> حذف العرض
                                  </button>
                                  </PermissionGate>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!activeQuotation} onClose={() => setActiveQuotation(null)} title={`عرض سعر QTN-${String(activeQuotation?.id || 0).padStart(5, "0")}`} maxWidth="max-w-2xl">
        {activeQuotation && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">العميل</span>
                <span className="text-[14px] font-black text-slate-800">{activeQuotation.customer_name}</span></div>
              <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">الحالة</span>
                <StatusBadge status={activeQuotation.status} expiresAt={activeQuotation.expires_at} /></div>
              {activeQuotation.expires_at && (
                <div><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">صالح حتى</span>
                  <span className="text-[13px] font-bold text-slate-600">{formatDate(activeQuotation.expires_at)}</span></div>
              )}
            </div>

            {activeQuotation.notes && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">ملاحظات</span>
                <p className="text-[13px] font-bold text-slate-700">{activeQuotation.notes}</p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_90px_80px_90px] bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <div className="px-3 py-2 border-l border-slate-200">الصنف</div>
                <div className="px-3 py-2 border-l border-slate-200 text-center">الكمية</div>
                <div className="px-3 py-2 border-l border-slate-200 text-center">السعر</div>
                <div className="px-3 py-2 border-l border-slate-200 text-center">خصم</div>
                <div className="px-3 py-2 text-left">الإجمالي</div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {(activeQuotation.lines || []).map(line => (
                  <div key={line.id} className="grid grid-cols-[1fr_70px_90px_80px_90px] text-[12px] font-bold text-slate-700">
                    <div className="px-3 py-2.5 border-l border-slate-100">
                      <p className="truncate">{line.item_name}</p>
                      {line.description && <p className="text-[10px] text-slate-400 truncate">{line.description}</p>}
                    </div>
                    <div className="px-3 py-2.5 border-l border-slate-100 text-center font-black">{line.quantity}</div>
                    <div className="px-3 py-2.5 border-l border-slate-100 text-center text-slate-500">{formatMoney(line.unit_price)}</div>
                    <div className="px-3 py-2.5 border-l border-slate-100 text-center text-rose-500">
                      {Number(line.discount_amount) > 0 ? formatMoney(line.discount_amount) : "—"}
                    </div>
                    <div className="px-3 py-2.5 text-left font-black">{formatMoney(line.line_total)}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">إجمالي عرض السعر</span>
                <span className="text-[20px] font-black">{formatMoney(activeQuotation.total)} ج.م</span>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <PermissionGate page="quotations" action="print">
              <button onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-[12px] font-black text-slate-700 hover:bg-slate-50 transition-colors">
                <Printer className="h-4 w-4" /> طباعة
              </button>
              </PermissionGate>
              <button onClick={() => setActiveQuotation(null)}
                className="rounded-lg bg-slate-900 px-10 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Convert Confirm */}
      <ConfirmDialog
        open={!!convertTarget}
        title="تحويل إلى فاتورة مبيعات"
        message={`سيتم إنشاء فاتورة بيع للعميل "${convertTarget?.customer_name}" بقيمة ${formatMoney(convertTarget?.total)} ج.م. هل تريد المتابعة؟`}
        onConfirm={handleConvert}
        onCancel={() => setConvertTarget(null)}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <DramaticDeleteConfirm
          itemName={`QTN-${String(deleteTarget.id).padStart(5, "0")}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
