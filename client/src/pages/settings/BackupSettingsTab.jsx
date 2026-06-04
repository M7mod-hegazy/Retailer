import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Download, UploadCloud, AlertTriangle } from 'lucide-react';
import PermissionGate from "../../components/ui/PermissionGate";

export default function BackupSettingsTab() {
  const [restoring, setRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);

  const handleCreate = async () => {
    try {
      const response = await api.post("/api/backup/trigger");
      toast.success(`تم إنشاء النسخة الاحتياطية بنجاح. المسار: ${response.data?.data?.path || ""}`);
    } catch {
      toast.error("تعذر إنشاء النسخة الاحتياطية, تأكد من الصلاحيات");
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-sm border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
        <div className="flex gap-4 items-start">
          <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-slate-100 text-slate-600">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-slate-800">النسخ الاحتياطي اليدوي</div>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500 w-full max-w-[400px]">
              يقوم النظام بتجميد العمليات وإنشاء نسخة احتياطية فورية من قاعدة البيانات الحالية داخل المسار المحدد.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <PermissionGate page="backup" action="create">
            <button type="button" onClick={handleCreate} className="flex h-9 items-center justify-center rounded-sm bg-slate-900 px-5 text-2sm font-black text-white px-6 uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">
              إنشاء نسخة الآن
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-sm border border-rose-200 bg-rose-50/50 shadow-sm transition-all hover:border-rose-300">
        <div className="flex gap-4 items-start">
          <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-rose-100 text-rose-600">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-rose-800">استعادة البيانات</div>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-rose-600/80 w-full max-w-[400px]">
              اختر ملف نسخة احتياطية صالحاً للاستعادة. تحذير: هذه العملية ستستبدل جميع البيانات الحالية بالبيانات الموجودة في النسخة.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <PermissionGate page="backup" action="restore">
            <label className="flex h-9 items-center justify-center rounded-sm bg-rose-600 px-5 text-2sm font-black text-white px-6 uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 shadow-md cursor-pointer">
              {restoring ? "جارٍ الاستعادة..." : "استعادة بيانات"}
              <input
                type="file"
                accept=".db"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPendingRestore({ file, resetInput: () => { event.target.value = ""; } });
                }}
              />
            </label>
          </PermissionGate>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        title="تحذير! استبدال البيانات"
        message="أنت على وشك استعادة البيانات. ستحل النسخة الاحتياطية محل كل ما هو مسجل في النظام حالياً بشكل نهائي ولا رجعة فيه. هل أنت متأكد من رغبتك في المتابعة؟"
        onCancel={() => {
          pendingRestore?.resetInput?.();
          setPendingRestore(null);
        }}
        onConfirm={async () => {
          if (!pendingRestore?.file) return;
          const formData = new FormData();
          formData.append("backupFile", pendingRestore.file);
          setRestoring(true);
          try {
            const response = await api.post("/api/backup/restore", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success(response.data?.message || "تمت الاستعادة بنجاح");
            setTimeout(() => window.location.reload(), 2000);
          } catch {
            toast.error("فشلت عملية الاستعادة");
          } finally {
            pendingRestore?.resetInput?.();
            setPendingRestore(null);
            setRestoring(false);
          }
        }}
        confirmText="نعم، استعاد"
        cancelText="إلغاء الأمر"
        confirmButtonClass="bg-rose-600 hover:bg-rose-700 text-white rounded-sm font-black"
        icon={<AlertTriangle className="h-6 w-6 text-rose-500" />}
      />
    </div>
  );
}
