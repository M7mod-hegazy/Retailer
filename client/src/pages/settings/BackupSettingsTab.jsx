import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UploadCloud, Eraser, HardDrive, Clock, Folder, Loader2, Save, History } from "lucide-react";
import api from "../../services/api";
import { usePermission } from "../../hooks/usePermission";
import BackupPreviewModal from "./backup/BackupPreviewModal";
import RestoreBrowser from "./backup/RestoreBrowser";
import RestoreConfirmModal from "./backup/RestoreConfirmModal";
import EmptyDatabaseDialog from "./backup/EmptyDatabaseDialog";
import { pickFolder, pickSavePath, isDesktop, formatBytes } from "./backup/helpers";

function Card({ tone = "slate", icon, title, desc, children }) {
  const toneMap = {
    slate: "border-slate-200 bg-white",
    rose: "border-rose-200 bg-rose-50/40",
    emerald: "border-emerald-200 bg-emerald-50/30",
  };
  const iconMap = {
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };
  return (
    <div className={`rounded-sm border p-5 shadow-sm transition-all ${toneMap[tone]}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${iconMap[tone]}`}>
            {icon}
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</div>
            {desc && <p className="mt-1 max-w-[460px] text-[11px] font-bold leading-relaxed text-slate-500">{desc}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function BackupSettingsTab() {
  const canView = usePermission("backup", "view");
  const canCreate = usePermission("backup", "create");
  const canRestore = usePermission("backup", "restore");
  const canExport = usePermission("backup", "export");
  const canEmpty = usePermission("backup", "empty");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [settings, setSettings] = useState({ auto_backup_enabled: 0, auto_backup_path: "", auto_backup_time: "02:00" });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api
      .get("/api/backup/settings")
      .then((res) => res.data?.data && setSettings((s) => ({ ...s, ...res.data.data })))
      .catch(() => {});
  }, []);

  const refreshList = () => setRefreshKey((k) => k + 1);

  // --- Create -----------------------------------------------------------
  const handleConfirmCreate = async (label) => {
    try {
      const res = await api.post("/api/backup/trigger", { label });
      toast.success(`تم إنشاء النسخة الاحتياطية (${formatBytes(res.data?.data?.summary?.db?.sizeBytes)})`);
      setPreviewOpen(false);
      refreshList();
    } catch {
      toast.error("تعذر إنشاء النسخة الاحتياطية، تأكد من الصلاحيات والمسار");
    }
  };

  // --- Settings ---------------------------------------------------------
  const saveSettings = async (next) => {
    setSavingSettings(true);
    try {
      const res = await api.put("/api/backup/settings", next);
      if (res.data?.data) setSettings((s) => ({ ...s, ...res.data.data }));
      toast.success("تم حفظ إعدادات النسخ التلقائي");
    } catch {
      toast.error("تعذر حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  const choosePath = async () => {
    const dir = await pickFolder();
    if (dir) setSettings((s) => ({ ...s, auto_backup_path: dir }));
  };

  // --- Restore ----------------------------------------------------------
  const handleConfirmRestore = async (snap) => {
    setBusy(true);
    try {
      const res = await api.post("/api/backup/restore", { path: snap.path });
      toast.success(res.data?.message || "تمت الاستعادة بنجاح");
      setRestoreTarget(null);
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشلت عملية الاستعادة");
    } finally {
      setBusy(false);
    }
  };

  // --- Export -----------------------------------------------------------
  const handleExport = async (snap) => {
    if (!isDesktop()) {
      toast.error("التصدير متاح فقط في تطبيق سطح المكتب");
      return;
    }
    const defaultName = snap.fileName.replace(/\.db$/i, ".zip");
    const dest = await pickSavePath(defaultName);
    if (!dest) return;
    setBusy(true);
    const t = toast.loading("جارٍ تصدير النسخة...");
    try {
      const res = await api.post("/api/backup/export", { path: snap.path, destPath: dest });
      toast.success(`تم التصدير (${formatBytes(res.data?.data?.bytes)})`, { id: t });
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل التصدير", { id: t });
    } finally {
      setBusy(false);
    }
  };

  // --- Empty ------------------------------------------------------------
  const handleConfirmEmpty = async (mode, ownerPassword) => {
    setBusy(true);
    try {
      const res = await api.post("/api/backup/empty", { mode, ownerPassword });
      toast.success(res.data?.message || "تم تفريغ قاعدة البيانات");
      setEmptyOpen(false);
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      toast.error(err?.response?.data?.message || "تعذر تفريغ قاعدة البيانات");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return (
      <div className="rounded-sm border border-slate-200 bg-white p-8 text-center text-xs font-bold text-slate-400">
        ليس لديك صلاحية لعرض النسخ الاحتياطية.
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      {/* 1. Create + auto-backup settings */}
      {canCreate && (
        <Card
          tone="slate"
          icon={<HardDrive className="h-4 w-4" />}
          title="إنشاء نسخة احتياطية"
          desc="يحفظ النظام نسخة كاملة من قاعدة البيانات والصور. ستظهر معاينة دقيقة لمحتوى النسخة قبل التأكيد."
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex h-9 shrink-0 items-center justify-center rounded-sm bg-slate-900 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-slate-800 active:scale-95"
          >
            إنشاء نسخة الآن
          </button>
        </Card>
      )}

      {canCreate && (
        <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-800">
            <Clock className="h-4 w-4 text-slate-500" /> النسخ التلقائي
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-sm border border-slate-200 px-3 py-2">
              <span className="text-[11px] font-bold text-slate-600">تفعيل النسخ اليومي</span>
              <input
                type="checkbox"
                checked={Boolean(settings.auto_backup_enabled)}
                onChange={(e) => setSettings((s) => ({ ...s, auto_backup_enabled: e.target.checked ? 1 : 0 }))}
                className="h-4 w-4 accent-slate-900"
              />
            </label>
            <label className="rounded-sm border border-slate-200 px-3 py-2">
              <span className="mb-1 block text-[11px] font-bold text-slate-500">وقت النسخة اليومية</span>
              <input
                type="time"
                value={settings.auto_backup_time || "02:00"}
                onChange={(e) => setSettings((s) => ({ ...s, auto_backup_time: e.target.value }))}
                className="w-full text-sm font-black text-slate-800 outline-none"
              />
            </label>
            <div className="rounded-sm border border-slate-200 px-3 py-2">
              <span className="mb-1 block text-[11px] font-bold text-slate-500">مجلد الحفظ</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={
                    settings.auto_backup_path && !["null", "undefined"].includes(settings.auto_backup_path)
                      ? settings.auto_backup_path
                      : ""
                  }
                  onChange={(e) => setSettings((s) => ({ ...s, auto_backup_path: e.target.value }))}
                  placeholder="افتراضي: backups/"
                  className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700 outline-none ltr:text-left"
                />
                {isDesktop() && (
                  <button type="button" onClick={choosePath} className="shrink-0 text-slate-400 hover:text-slate-700">
                    <Folder className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={savingSettings}
              onClick={() =>
                saveSettings({
                  auto_backup_enabled: settings.auto_backup_enabled ? 1 : 0,
                  auto_backup_path: settings.auto_backup_path || "",
                  auto_backup_time: settings.auto_backup_time || "02:00",
                })
              }
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 px-5 text-2sm font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {/* 2. Restore browser */}
      <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-800">
          <History className="h-4 w-4 text-slate-500" /> الاستعادة من نقطة زمنية
        </div>
        <p className="mb-4 text-[11px] font-bold leading-relaxed text-slate-500">
          تصفّح النسخ حسب السنة ثم الشهر ثم اليوم. كل نقطة تمثل حالة كاملة للنظام حتى ذلك التاريخ.
          {canExport && " يمكنك أيضاً تصدير أي نقطة كملف محمول."}
        </p>
        <RestoreBrowser
          onRestore={setRestoreTarget}
          onExport={handleExport}
          busy={busy}
          refreshKey={refreshKey}
          perms={{ restore: canRestore, export: canExport }}
        />
      </div>

      {/* 3. Import from file (fallback) */}
      {canRestore && (
        <Card
          tone="slate"
          icon={<UploadCloud className="h-4 w-4" />}
          title="استيراد من ملف خارجي"
          desc="استعد من ملف نسخة محفوظ خارج النظام (.zip كامل بالصور أو .db فقط). يتم إنشاء نسخة أمان تلقائية أولاً."
        >
          <label className="flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-slate-300 px-5 text-2sm font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50 active:scale-95">
            اختيار ملف
            <input
              type="file"
              accept=".db,.zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!window.confirm("سيتم استبدال كل البيانات الحالية بمحتوى الملف. متابعة؟")) return;
                setBusy(true);
                const t = toast.loading("جارٍ الاستيراد...");
                try {
                  const fd = new FormData();
                  fd.append("backupFile", file);
                  const res = await api.post("/api/backup/restore-upload", fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                  });
                  toast.success(res.data?.message || "تمت الاستعادة", { id: t });
                  setTimeout(() => window.location.reload(), 1800);
                } catch {
                  toast.error("فشلت عملية الاستيراد", { id: t });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </Card>
      )}

      {/* 4. Empty database (danger zone) */}
      {canEmpty && (
        <Card
          tone="rose"
          icon={<Eraser className="h-4 w-4" />}
          title="تفريغ قاعدة البيانات"
          desc="تفريغ الحركات مع الإبقاء على الإعدادات، أو إعادة ضبط كاملة. تُنشأ نسخة احتياطية إجبارية أولاً، ويتطلب كلمة مرور المالك."
        >
          <button
            type="button"
            onClick={() => setEmptyOpen(true)}
            className="flex h-9 shrink-0 items-center justify-center rounded-sm bg-rose-600 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-rose-700 active:scale-95"
          >
            تفريغ قاعدة البيانات
          </button>
        </Card>
      )}

      <BackupPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} onConfirm={handleConfirmCreate} />
      <RestoreConfirmModal
        open={Boolean(restoreTarget)}
        snapshot={restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleConfirmRestore}
      />
      <EmptyDatabaseDialog open={emptyOpen} onClose={() => setEmptyOpen(false)} onConfirm={handleConfirmEmpty} />
    </div>
  );
}
