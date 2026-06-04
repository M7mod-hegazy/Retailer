import React from "react";
import { HardDrive, Download, UploadCloud, AlertTriangle, RefreshCw, Globe, LayoutGrid, Clock, History } from "lucide-react";
import BackupSettingsTab from "./BackupSettingsTab";

function DenseInput({ label, ...props }) {
  return (
    <label className="block space-y-1 focus-within:text-slate-900 text-slate-500 transition-colors">
      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">{label}</span>
      <input {...props} className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all" />
    </label>
  );
}

export default function MaintenanceTab({ settings, onChange }) {
  return (
    <div className="space-y-8">

      {/* Auto Backup */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-slate-800 text-white">
            <HardDrive className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">النسخ الاحتياطي التلقائي</h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              جدولة زمنية لحفظ نسخة من قاعدة البيانات تلقائياً — يوصى به يومياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.auto_backup_enabled)}
              onChange={(e) => onChange("auto_backup_enabled", e.target.checked)}
              className="h-4 w-4 rounded-sm accent-slate-900 border-slate-300"
            />
            <span className="text-sm font-bold text-slate-700">تفعيل النسخ الاحتياطي التلقائي</span>
          </label>
        </div>

        {settings.auto_backup_enabled && (
          <div className="max-w-md">
            <DenseInput
              label="مسار الحفظ التلقائي"
              value={settings.auto_backup_path || ""}
              onChange={(e) => onChange("auto_backup_path", e.target.value)}
              placeholder="C:\Backups"
            />
            <p className="mt-1.5 text-[11px] font-bold text-slate-400 leading-relaxed">
              مسار كامل على القرص الصلب حيث سيتم حفظ النسخ الاحتياطية. تأكد من وجود المسار وصلاحية الكتابة.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-sm border border-orange-200 bg-orange-50 p-3 text-orange-600">
          <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-[11px] font-bold leading-relaxed text-orange-700">
            النسخ الاحتياطي التلقائي يعمل مرة واحدة يومياً في وقت متأخر. استخدم النسخ اليدوي أسفله لأخذ نسخة فورية في أي وقت.
          </div>
        </div>
      </section>

      {/* Manual Backup & Restore */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-white">
            <Download className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">النسخ الاحتياطي اليدوي والاستعادة</h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              إنشاء نسخة احتياطية فورية أو استعادة بيانات من نسخة سابقة
            </p>
          </div>
        </div>

        <BackupSettingsTab />
      </section>

    </div>
  );
}
