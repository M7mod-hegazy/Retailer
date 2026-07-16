import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, RotateCcw, Loader2 } from "lucide-react";
import api from "../../../services/api";
import { usePermission } from "../../../hooks/usePermission";
import { DramaticDeleteConfirm } from "../../../components/ui/DramaticDeleteConfirm";

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
  const [undoTarget, setUndoTarget] = useState(null);

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
    setUndoTarget(batch);
  };

  const handleUndoConfirm = async () => {
    if (!undoTarget) return;
    const batch = undoTarget;
    setUndoTarget(null);
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-card duration-300">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-450">
              <th className="px-6 py-4.5">الملف</th>
              <th className="px-6 py-4.5">المستخدم</th>
              <th className="px-6 py-4.5">التاريخ</th>
              <th className="px-6 py-4.5 text-center">إضافة</th>
              <th className="px-6 py-4.5 text-center">تحديث</th>
              <th className="px-6 py-4.5">الحالة</th>
              <th className="px-6 py-4.5 text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((b) => {
              const undoable = b.status === "active" && hoursSince(b.created_at) <= 24;
              return (
                <tr key={b.id} className="transition-colors hover:bg-slate-50/40 text-slate-700 font-semibold">
                  <td className="px-6 py-4 font-black text-slate-900 truncate max-w-[240px]" title={b.file_name || `#${b.id}`}>{b.file_name || `#${b.id}`}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{b.user_name || "—"}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{String(b.created_at || "").slice(0, 16)}</td>
                  <td className="px-6 py-4 text-center font-mono font-black text-emerald-600">{b.inserted}</td>
                  <td className="px-6 py-4 text-center font-mono font-black text-sky-600">{b.updated}</td>
                  <td className="px-6 py-4">
                    {b.status === "undone" ? (
                      <span className="inline-flex items-center rounded-lg bg-slate-150 border border-slate-200 px-2.5 py-1 text-2xs font-black text-slate-600 shadow-sm ring-1 ring-slate-100/50">
                        تم التراجع
                      </span>
                    ) : undoable ? (
                      <span className="inline-flex items-center rounded-lg bg-emerald-55 border border-emerald-200 px-2.5 py-1 text-2xs font-black text-emerald-800 shadow-sm ring-1 ring-emerald-150/40 animate-pulse">
                        نشطة
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-amber-55 border border-amber-250 px-2.5 py-1 text-2xs font-black text-amber-800 shadow-sm ring-1 ring-amber-150/40">
                        منتهية المهلة
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2.5">
                      <button 
                        type="button" 
                        onClick={() => download(b)} 
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]" 
                        title="إعادة تنزيل الملف"
                      >
                        <Download className="h-3.5 w-3.5" /> تنزيل
                      </button>
                      {canUndo && undoable ? (
                        <button 
                          type="button" 
                          disabled={busyId === b.id} 
                          onClick={() => undo(b)} 
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 shadow-sm transition hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] disabled:opacity-40" 
                          title="تراجع"
                        >
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
      {undoTarget && (
        <DramaticDeleteConfirm
          itemName={undoTarget.file_name || `#${undoTarget.id}`}
          onConfirm={handleUndoConfirm}
          onCancel={() => setUndoTarget(null)}
        />
      )}
    </div>
  );
}
