import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, RotateCcw, Loader2 } from "lucide-react";
import api from "../../../services/api";
import { usePermission } from "../../../hooks/usePermission";

const ACTIVITY_REASONS = {
  sold: "تم بيع أحد الأصناف المستوردة.",
  stock_moved: "حدثت حركة مخزون على أحد الأصناف.",
  transferred: "تم تحويل أحد الأصناف بين المخازن.",
  purchased: "تم شراء أحد الأصناف في فاتورة أخرى.",
};

function hoursSince(createdAt) {
  const t = new Date(String(createdAt).replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 36e5;
}

export default function ImportHistoryTab() {
  const canUndo = usePermission("items", "import_undo");
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/items/import/batches");
      setBatches(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      toast.error("تعذر تحميل سجل الاستيراد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const download = async (batch) => {
    try {
      const res = await api.get(`/api/items/import/batches/${batch.id}/file`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = batch.file_name || `import-${batch.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("الملف الأصلي غير متاح لإعادة التنزيل");
    }
  };

  const undo = async (batch) => {
    if (!window.confirm("سيتم التراجع عن هذه العملية وحذف الأصناف التي أُنشئت فيها. متابعة؟")) return;
    setBusyId(batch.id);
    try {
      await api.post(`/api/items/import/batches/${batch.id}/undo`);
      toast.success("تم التراجع عن العملية");
      await load();
    } catch (error) {
      const body = error?.response?.data;
      if (body?.reason === "expired") toast.error("انتهت مهلة التراجع (24 ساعة).");
      else if (body?.reason === "already_undone") toast.error("سبق التراجع عن هذه العملية.");
      else if (body?.reason === "activity") toast.error(`لا يمكن التراجع: ${ACTIVITY_REASONS[body.detail] || "حدث نشاط على الأصناف."}`);
      else toast.error(body?.message || "تعذر التراجع.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-12 text-2sm font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...</div>;
  }

  if (!batches.length) {
    return <div className="py-12 text-center text-2sm font-bold text-slate-400">لا توجد عمليات استيراد سابقة.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-2sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400">
            <th className="px-3 py-2">الملف</th>
            <th className="px-3 py-2">المستخدم</th>
            <th className="px-3 py-2">التاريخ</th>
            <th className="px-3 py-2">إضافة</th>
            <th className="px-3 py-2">تحديث</th>
            <th className="px-3 py-2">الحالة</th>
            <th className="px-3 py-2">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => {
            const undoable = b.status === "active" && hoursSince(b.created_at) <= 24;
            return (
              <tr key={b.id} className="border-b border-slate-100 font-bold text-slate-700">
                <td className="px-3 py-2.5">{b.file_name || `#${b.id}`}</td>
                <td className="px-3 py-2.5 text-slate-500">{b.user_name || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500">{String(b.created_at || "").slice(0, 16)}</td>
                <td className="px-3 py-2.5 text-emerald-700">{b.inserted}</td>
                <td className="px-3 py-2.5 text-sky-700">{b.updated}</td>
                <td className="px-3 py-2.5">
                  {b.status === "undone" ? (
                    <span className="rounded-sm bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">تم التراجع</span>
                  ) : undoable ? (
                    <span className="rounded-sm bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">نشطة</span>
                  ) : (
                    <span className="rounded-sm bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">منتهية المهلة</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => download(b)} className="flex items-center gap-1 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50" title="إعادة تنزيل الملف">
                      <Download className="h-3.5 w-3.5" /> تنزيل
                    </button>
                    {canUndo && undoable ? (
                      <button type="button" disabled={busyId === b.id} onClick={() => undo(b)} className="flex items-center gap-1 rounded-sm border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="تراجع">
                        {busyId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} تراجع
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
