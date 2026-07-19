import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UploadCloud, Eraser, HardDrive, Clock, Folder, Loader2, Save, History, Info, BarChart3 } from "lucide-react";
import { getHint, getPlaceholder } from "../../utils/fieldMeta";
import api from "../../services/api";
import { usePermission } from "../../hooks/usePermission";
import BackupPreviewModal from "./backup/BackupPreviewModal";
import RestoreBrowser from "./backup/RestoreBrowser";
import RestoreConfirmModal from "./backup/RestoreConfirmModal";
import EmptyDatabaseDialog from "./backup/EmptyDatabaseDialog";
import { pickFolder, pickSavePath, isDesktop, formatBytes, formatDateTime } from "./backup/helpers";
import { useConfirm } from "../../hooks/useConfirm";
import { DramaticDeleteConfirm } from "../../components/ui/DramaticDeleteConfirm";

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative cursor-help shrink-0">
      <Info className="h-3 w-3 text-text-muted hover:text-text-secondary transition-colors" />
      <div className="absolute bottom-full right-0 mb-2 z-20 hidden w-56 rounded-lg bg-slate-900 p-3 text-[11px] font-bold text-white shadow-xl leading-relaxed group-hover:block">
        {text}
        <div className="absolute top-full right-3 -mt-1 h-2 w-2 rotate-45 bg-slate-900" />
      </div>
    </span>
  );
}

function Card({ tone = "slate", icon, title, desc, children }) {
  const toneMap = {
    slate: "border-border-normal bg-bg-surface",
    rose: "border-rose-200 bg-rose-50/40",
    emerald: "border-emerald-200 bg-emerald-50/30",
  };
  const iconMap = {
    slate: "bg-bg-overlay text-text-secondary",
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };
  return (
    <div className={`rounded-lg border p-5 shadow-sm transition-all ${toneMap[tone]}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconMap[tone]}`}>
            {icon}
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-text-primary">{title}</div>
            {desc && <p className="mt-1 max-w-[460px] text-[11px] font-bold leading-relaxed text-text-secondary">{desc}</p>}
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
  const { dramaticConfirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [refreshKey, setRefreshKey] = useState(0);

  const [settings, setSettings] = useState({
    auto_backup_enabled: 0,
    auto_backup_path: "",
    auto_backup_interval_hours: 24,
    last_auto_backup_at: null,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [backupSummary, setBackupSummary] = useState(null);

  useEffect(() => {
    api
      .get("/api/backup/settings")
      .then((res) => res.data?.data && setSettings((s) => ({ ...s, ...res.data.data })))
      .catch(() => { });
  }, []);

  useEffect(() => {
    api
      .get("/api/backup/list")
      .then((res) => {
        const tree = res.data?.data;
        if (!tree?.years) { setBackupSummary(null); return; }
        let totalSnapshots = 0;
        let totalSize = 0;
        let totalDays = 0;
        const triggerTypes = new Set();
        for (const y of tree.years) {
          for (const m of y.months) {
            for (const d of m.days) {
              totalDays += 1;
              for (const snap of d.snapshots) {
                totalSnapshots += 1;
                totalSize += snap.sizeBytes || 0;
                if (snap.triggerType) triggerTypes.add(snap.triggerType);
              }
            }
          }
        }
        setBackupSummary({ totalSnapshots, totalSize, totalDays, triggerGroups: triggerTypes.size });
      })
      .catch(() => setBackupSummary(null));
  }, [refreshKey]);

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
      toast.success("تم حفظ إعدادات أخر النسخ التلقائي");
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
  const handleConfirmEmpty = async (categories, ownerPassword) => {
    setBusy(true);
    try {
      const res = await api.post("/api/backup/empty", { categories, ownerPassword });
      toast.success(res.data?.message || "تم حذف البيانات المحددة");
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
      <div className="rounded-lg border border-border-normal bg-bg-surface p-8 text-center text-xs font-bold text-text-muted">
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
          title="تاخد نسخة احتياطية (باك أب)"
          desc="النظام هيحفظ نسخة كاملة من كل الداتا والصور بتاعتك. وهتشوف تفاصيل النسخة قبل ما تأكد."
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex h-9 shrink-0 items-center justify-center rounded-sm bg-primary px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-primary-600 active:scale-95"
          >
            خد نسخة دلوقتي
          </button>
        </Card>
      )}

      {canCreate && (
        <div className="rounded-lg border border-border-normal bg-bg-surface p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary">
            <Clock className="h-4 w-4 text-text-secondary" /> إعدادات الباك أب التلقائي
          </div>
          <p className="mb-4 text-[11px] font-bold leading-relaxed text-text-secondary">
            النظام بياخد باك أب لوحده أول ما تفتح البرنامج ولما تقفله، وكمان وهو شغال لو عدّى وقت طويل على آخر نسخة. مش بيعتمد على وقت معين عشان ميقعش لو الجهاز مقفول.
            {settings.last_auto_backup_at && (
              <span className="mt-1 block text-text-muted">آخر نسخة تلقائية: {formatDateTime(settings.last_auto_backup_at)}</span>
            )}
          </p>
          {backupSummary && backupSummary.totalSnapshots > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-bg-overlay/50 px-4 py-2.5 text-[11px] font-bold text-text-secondary">
              <BarChart3 className="h-3.5 w-3.5 text-text-muted" />
              <span>{backupSummary.totalSnapshots} مستند</span>
              <span className="text-text-muted">·</span>
              <span>{formatBytes(backupSummary.totalSize)} حجم</span>
              <span className="text-text-muted">·</span>
              <span>{backupSummary.totalDays} مجموعات</span>
              <span className="text-text-muted">·</span>
              <span>{backupSummary.triggerGroups} نسخة</span>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex items-center justify-between rounded-md border border-border-normal bg-bg-input px-3 py-2 group hover:border-border-strong focus-within:bg-bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-pointer">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
                شغّل الباك أب التلقائي
                <InfoTip text={getHint("auto_backup_enabled")} />
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings.auto_backup_enabled)}
                onChange={(e) => setSettings((s) => ({ ...s, auto_backup_enabled: e.target.checked ? 1 : 0 }))}
                className="h-4 w-4 accent-slate-900"
              />
            </label>
            <label className="rounded-md border border-border-normal bg-bg-input px-3 py-2 group hover:border-border-strong focus-within:bg-bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-text">
              <span className="flex items-center gap-1.5 mb-1 block text-[11px] font-bold text-text-secondary">
                ياخد نسخة كل كام ساعة؟
                <InfoTip text="أقل مدة عشان ياخد نسخة جديدة لوحده. الافتراضي 24 ساعة (يعني كل يوم نسخة)." />
              </span>
              <input
                type="number"
                min={1}
                max={168}
                value={settings.auto_backup_interval_hours ?? 24}
                onChange={(e) => setSettings((s) => ({ ...s, auto_backup_interval_hours: e.target.value }))}
                className="w-full text-sm font-black text-text-primary bg-transparent outline-none"
              />
            </label>
            <div className="rounded-md border border-border-normal bg-bg-input px-3 py-2 group hover:border-border-strong focus-within:bg-bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all cursor-text">
              <span className="flex items-center gap-1.5 mb-1 block text-[11px] font-bold text-text-secondary">
                المكان اللي بيتحفظ فيه الباك أب
                <InfoTip text={getHint("auto_backup_path")} />
              </span>
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
                  placeholder="المكان الطبيعي: backups/"
                  className="min-w-0 flex-1 truncate text-[11px] font-bold text-text-primary bg-transparent outline-none ltr:text-left"
                />
                {isDesktop() && (
                  <button type="button" onClick={choosePath} className="shrink-0 text-text-muted hover:text-text-primary">
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
                  auto_backup_interval_hours: Number(settings.auto_backup_interval_hours) || 24,
                })
              }
              className="flex h-9 items-center gap-2 rounded-sm border border-border-strong px-5 text-2sm font-black uppercase tracking-widest text-text-primary transition-all hover:bg-bg-overlay active:scale-95 disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {/* 2. Restore browser */}
      <div className="rounded-lg border border-border-normal bg-bg-surface p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary">
          <History className="h-4 w-4 text-text-secondary" /> الاسترجاع (ترجّع داتا قديمة)
        </div>
        <p className="mb-4 text-[11px] font-bold leading-relaxed text-text-secondary">
          دور في النسخ القديمة بالسنة والشهر واليوم. كل نقطة من دول بترجعلك النظام زي ما كان بالظبط في الوقت ده.
          {canExport && " وممكن كمان تصدر أي نسخة لملف عشان تنقله لجهاز تاني."}
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
          title="استيراد داتا من ملف خارجي"
          desc="لو معاك ملف باك أب (.zip فيه صور أو .db بس) تقدر ترجعه هنا. والنظام هياخد باك أب احتياطي الأول عشان الأمان."
        >
          <label className="flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-border-strong px-5 text-2sm font-black uppercase tracking-widest text-text-primary transition-all hover:bg-bg-overlay active:scale-95">
            اختار الملف
            <input
              type="file"
              accept=".db,.zip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const ok = await dramaticConfirm({ itemName: file.name });
                if (!ok) return;
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
          title="تصفير البرنامج (امسح الداتا)"
          desc="اختار بالظبط اللي عايز تمسحه (مبيعات، مشتريات، مخزن، أو عملاء). قبل ما يمسح هياخد باك أب غصب عنه للحماية، ولازم باسورد صاحب المحل."
        >
          <button
            type="button"
            onClick={() => setEmptyOpen(true)}
            className="flex h-9 shrink-0 items-center justify-center rounded-sm bg-rose-600 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-rose-700 active:scale-95"
          >
            امسح الداتا
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
      {confirmState.open && (
        <DramaticDeleteConfirm itemName={confirmState.itemName} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </div>
  );
}
