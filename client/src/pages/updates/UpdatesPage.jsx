import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  CheckCircle2,
  ArrowDownCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  Server,
  Zap,
  Download,
  Database,
  ChevronDown,
  FolderOpen,
  X,
  History,
  HardDrive,
  Terminal,
} from "lucide-react";
import { useUpdateStore } from "../../stores/updateStore";
import { usePageTour } from "../../hooks/usePageTour";

const FADE_UP = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 20 } },
};

const STAGGER = {
  visible: { transition: { staggerChildren: 0.15 } },
};

// ── Byte/speed formatters (Image #2: "MB 11.2 / 1.8", "KB/s 227") ──────────
const fmtMB = (b = 0) => (b / 1048576).toFixed(1);
const fmtSpeed = (bps = 0) =>
  bps >= 1048576 ? `${(bps / 1048576).toFixed(1)} MB/s` : `${Math.round(bps / 1024)} KB/s`;

function MagneticButton({ children, onClick, className, disabled }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = (e) => {
    if (disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct * 20); // max 20px magnetic pull
    y.set(yPct * 20);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: mouseXSpring, y: mouseYSpring }}
      className={`relative overflow-hidden group ${className}`}
      whileTap={{ scale: 0.95 }}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <div className="absolute inset-0 bg-bg-surface/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0" />
    </motion.button>
  );
}

const Shimmer = () => (
  <motion.div
    animate={{ x: ["-100%", "200%"] }}
    transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
    className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 z-0"
  />
);

// ── Phase stepper (فحص → تحميل → تثبيت) ────────────────────────────────────
function PhaseStepper({ checkStatus, downloadStatus, installStatus }) {
  const steps = [
    { key: "check", label: "فحص", Icon: CheckCircle2, status: checkStatus },
    { key: "download", label: "تحميل", Icon: Download, status: downloadStatus },
    { key: "install", label: "تثبيت", Icon: Zap, status: installStatus },
  ];

  const circleClass = (status) =>
    status === "done"
      ? "bg-emerald-500 text-white border-emerald-500"
      : status === "active"
      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
      : "bg-zinc-100 text-zinc-300 border-zinc-200";

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 select-none">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors duration-300 ${circleClass(
                step.status
              )}`}
            >
              {step.status === "done" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : step.status === "active" && step.key === "check" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <step.Icon className="h-5 w-5" />
              )}
            </div>
            <span
              className={`text-xs font-black ${
                step.status === "pending" ? "text-zinc-400" : "text-zinc-700"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 flex-1 min-w-[24px] max-w-[80px] rounded-full bg-zinc-200 overflow-hidden mb-6">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: steps[i].status === "done" ? "100%" : "0%" }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Install Progress Overlay (ظهر التثبيت) ─────────────────────────────────
function InstallProgressOverlay({ phase, error, version, onRetry, onDismiss }) {
  const steps = [
    { key: "closing-db", label: "إغلاق قاعدة البيانات", Icon: Database },
    { key: "installing", label: "تثبيت التحديث", Icon: Zap },
    { key: "done", label: "اكتمل التثبيت", Icon: CheckCircle2 },
  ];

  const currentIdx = phase === "error"
    ? steps.findIndex((s) => s.key === "installing")
    : phase === "idle"
    ? -1
    : steps.findIndex((s) => s.key === phase);
  const isError = phase === "error";

  const stepStatus = (key) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (isError && key === steps[currentIdx]?.key) return "error";
    if (idx < currentIdx) return "done";
    if (idx === currentIdx) return "active";
    return "pending";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md bg-bg-surface/95 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-border-normal/50 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        {/* Ambient glow */}
        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none transition-colors duration-700 ${isError ? "bg-red-500/10" : "bg-emerald-500/10"}`} />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isError ? "bg-red-50 text-red-600" : "bg-primary text-white"}`}>
              {isError ? (
                <AlertCircle className="h-6 w-6" />
              ) : phase === "done" ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-zinc-950">
                {isError ? "تعذّر التثبيت" : phase === "done" ? "تم التثبيت بنجاح" : "جاري تثبيت التحديث"}
              </h3>
              {version && (
                <p className="text-sm font-bold text-zinc-400 mt-0.5 font-mono">
                  الإصدار {version}
                </p>
              )}
            </div>
          </div>

          {/* Steps timeline */}
          <div className="space-y-0">
            {steps.map(({ key, label, Icon }, i) => {
              const st = stepStatus(key);
              return (
                <div key={key} className="flex items-start gap-4 py-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                      st === "done"
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : st === "active"
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                        : st === "error"
                        ? "bg-red-500 border-red-500 text-white"
                        : "bg-zinc-50 border-zinc-200 text-zinc-300"
                    }`}>
                      {st === "done" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : st === "active" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : st === "error" ? (
                        <X className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-0.5 flex-1 min-h-[16px] rounded-full bg-zinc-100 overflow-hidden mt-1">
                        <div
                          className="w-full bg-emerald-500 transition-all duration-700"
                          style={{ height: st === "done" ? "100%" : st === "active" || st === "error" ? "50%" : "0%" }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className={`text-sm font-black transition-colors duration-300 ${
                      st === "done" ? "text-emerald-700"
                        : st === "active" ? "text-zinc-900"
                        : st === "error" ? "text-red-700"
                        : "text-zinc-400"
                    }`}>
                      {label}
                      {st === "active" && key === "closing-db" && (
                        <span className="block text-xs font-bold text-zinc-400 mt-0.5">جارٍ إنهاء اتصال قاعدة البيانات...</span>
                      )}
                      {st === "active" && key === "installing" && (
                        <span className="block text-xs font-bold text-zinc-400 mt-0.5">سيتم إعادة تشغيل البرنامج تلقائياً...</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error details */}
          {isError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden mt-6"
            >
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                <p className="text-sm font-bold text-red-700 mb-2">
                  {error || "حدث خطأ غير متوقع أثناء التثبيت."}
                </p>
                <p className="text-xs font-medium text-red-600 leading-relaxed">
                  يمكنك استعادة النسخة الاحتياطية من شاشة الإعدادات، أو تنزيل التحديث يدوياً من صفحة التحديثات وإعادة المحاولة.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={onDismiss}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-black border border-zinc-200 bg-bg-surface text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          )}

          {/* Done state */}
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center"
            >
              <p className="text-sm font-bold text-emerald-600">سيتم إعادة تشغيل البرنامج تلقائياً...</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function UpdatesPage() {
  usePageTour('updates');
  const {
    available, info, error, checking,
    setChecking,
    manualDownloading, manualProgress, manualFilePath, manualError, downloadUrl, fileSize,
    setManualInfo,
    installPhase, installError, installVersion,
    setInstallPhase, setInstallError, clearInstallState,
  } = useUpdateStore();

  const [currentVersion, setCurrentVersion] = useState("1.0.0");
  const [lastCheckedAt, setLastCheckedAt] = useState(Date.now() - 86400000);
  const [backupState, setBackupState] = useState("idle"); // idle | running | done | error
  const [installing, setInstalling] = useState(false);

  // ── Version rollback / install-specific-version state ──
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [releases, setReleases] = useState(null); // null = not loaded yet
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [rbVersion, setRbVersion] = useState(null); // version currently being installed
  const [rbStage, setRbStage] = useState("idle"); // idle | backup | download
  const [rbError, setRbError] = useState(null);

  useEffect(() => {
    window.electronAPI?.getVersion?.().then((v) => {
      if (v) setCurrentVersion(v);
    });
  }, []);

  // Fetch manual-download metadata (url + size + sha512) once an update exists.
  useEffect(() => {
    if (available && !downloadUrl && window.electronAPI) {
      window.electronAPI.invoke("update:get-manual-info").then((d) => {
        if (d?.available) setManualInfo(d);
      });
    }
  }, [available, downloadUrl, setManualInfo]);

  const safetyTimer = useRef(null);

  // Never leave the spinner hanging: if no update:* event arrives within 30s,
  // release the checking state so the UI stays usable.
  const armSafetyTimeout = () => {
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => setChecking(false), 30000);
  };

  useEffect(() => () => {
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
  }, []);

  // Subscribe to real-time install:status events pushed from main process
  useEffect(() => {
    const cleanup = window.electronAPI?.on("install:status", (data) => {
      if (data?.status && data.status !== "idle") {
        setInstallPhase(data.status, { version: data.version });
        if (data.status === "error" && data.error) {
          setInstallError(data.error);
        }
      }
    });
    return () => cleanup?.();
  }, [setInstallPhase, setInstallError]);

  const handleCheckNow = async () => {
    setChecking(true);
    setLastCheckedAt(Date.now());
    if (window.electronAPI) {
      armSafetyTimeout();
      await window.electronAPI.invoke("update:check");
    } else {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  const handleBackup = async () => {
    if (backupState === "running") return;
    setBackupState("running");
    try {
      const res = await window.electronAPI?.invoke("backup:create");
      setBackupState(res?.success ? "done" : "error");
    } catch {
      setBackupState("error");
    }
  };

  const handleManualDownload = () => {
    window.electronAPI?.invoke("update:start-manual-download");
  };

  const handleCancelManual = () => {
    window.electronAPI?.invoke("update:cancel-manual-download");
  };

  const handleOpenInstaller = () => {
    setInstalling(true);
    window.electronAPI?.invoke("update:open-installer");
  };

  // ── Version rollback handlers ──
  const loadReleases = async () => {
    setReleasesLoading(true);
    try {
      const list = await window.electronAPI?.invoke("update:list-releases");
      setReleases(Array.isArray(list) ? list : []);
    } catch {
      setReleases([]);
    } finally {
      setReleasesLoading(false);
    }
  };

  const toggleRollback = () => {
    const next = !rollbackOpen;
    setRollbackOpen(next);
    if (next && releases === null) loadReleases();
  };

  // Best practice: always snapshot the DB before installing another version,
  // then download + install that version (reusing the robust manual pipeline).
  const handleInstallVersion = async (version) => {
    setRbError(null);
    setRbVersion(version);
    setRbStage("backup");
    try {
      const res = await window.electronAPI?.invoke("backup:create");
      if (!res?.success) throw new Error("backup_failed");
    } catch {
      setRbError("تعذّر إنشاء النسخة الاحتياطية. أُلغيت العملية حفاظاً على بياناتك.");
      setRbStage("idle");
      setRbVersion(null);
      return;
    }
    setRbStage("download");
    window.electronAPI?.invoke("update:download-version", { version });
  };

  const handleCancelRollback = () => {
    window.electronAPI?.invoke("update:cancel-manual-download");
    setRbStage("idle");
    setRbVersion(null);
  };

  // ── Derived states (manual pipeline is now the primary, robust path) ──────
  // The auto-updater path (electron-updater download + quitAndInstall) was
  // removed from the UI because it was unreliable. We now drive the whole flow
  // off the manual download → integrity-checked installer → clean-close install
  // pipeline, which verifies the file (sha512) and checkpoints the DB safely.
  const mDownloading = manualDownloading;
  const mReady = !!manualFilePath;
  const mProgress = manualProgress;
  const showStepper = available || checking;

  const checkStatus = available ? "done" : checking ? "active" : "pending";
  const downloadStatus = mReady ? "done" : mDownloading ? "active" : "pending";
  const installStatus = mReady ? "active" : "pending";

  // Ultra-premium mesh background
  const BackgroundMesh = () => (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-60">
      <div className="absolute inset-0 bg-[var(--bg-base)] z-[-1]" />
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-20%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-[radial-gradient(circle,var(--primary-glow)_0%,transparent_70%)] blur-[80px]"
      />
      <motion.div
        animate={{ rotate: -360, scale: [1, 1.3, 1] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-30%] left-[-20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.4)_0%,transparent_70%)] blur-[100px]"
      />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50 z-10" />
    </div>
  );

  return (
    <div dir="rtl" className="relative min-h-[100dvh] px-4 md:px-8 py-6 lg:py-12 overflow-x-hidden font-sans" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      <BackgroundMesh />
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to_right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to_bottom,var(--border-subtle) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 70% at 50% 40%,transparent 0%,var(--bg-base) 100%)" }} />

      <motion.div
        variants={STAGGER}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto"
      >
        {/* Cinematic Header with Splitting Text Effect */}
        <motion.header variants={FADE_UP} className="mb-14">
          <div className="flex items-center gap-4 mb-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center justify-center w-12 h-12 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100" style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <Zap className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
            </motion.div>
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              مركز التحكم
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[1.1] max-w-5xl" style={{ color: "var(--text-primary)" }}>
            تحديثات <span className="text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-500">النظام</span>
          </h1>
          <p className="text-zinc-500 mt-6 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            حافظ على استقرار وسرعة نظامك. تحديثات ذكية تُطبق بسلاسة دون مقاطعة سير عملك.
          </p>
        </motion.header>

        {/* Bento Grid with Liquid Glass & Precision Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 grid-flow-dense">

          {/* Main Status Panel (Col-span-8) */}
          <motion.div
            data-help="version-section"
            variants={FADE_UP}
            className="md:col-span-8 bg-bg-surface/70 backdrop-blur-2xl rounded-[2.5rem] p-10 border border-border-normal/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] relative overflow-hidden group"
          >
            {/* Interactive Ambient Light */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/60 group-hover:to-transparent transition-colors duration-1000 pointer-events-none" />

            <div className="relative z-10 flex flex-col h-full justify-between gap-10">
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-primary text-white shadow-xl overflow-hidden">
                    {mReady ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    ) : mDownloading ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : available ? (
                      <ArrowDownCircle className="h-7 w-7 text-emerald-400" />
                    ) : checking ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7" />
                    )}
                    {available && !mDownloading && !mReady && <Shimmer />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-950">
                      {mReady
                        ? "التحديث جاهز للتثبيت"
                        : mDownloading
                        ? "جاري تحميل التحديث..."
                        : available
                        ? "تحديث جديد متاح!"
                        : checking
                        ? "جاري فحص الخوادم..."
                        : "النظام محدث بالكامل"}
                    </h2>
                    <p className="text-zinc-500 font-bold text-sm mt-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {available ? `إصدار ${info?.version || "جديد"}` : `إصدار ${currentVersion}`}
                    </p>
                  </div>
                </div>

                <div className="text-zinc-600 leading-relaxed font-medium text-lg max-w-xl">
                  {error ? (
                    <span className="text-red-600 flex items-center gap-2 font-bold bg-red-50 p-4 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5" />
                      {typeof error === "string" ? error : "فشل التحقق من التحديثات. يرجى مراجعة اتصال الإنترنت."}
                    </span>
                  ) : mReady ? (
                    <span className="text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 inline-block">
                      تم تنزيل ملف التحديث والتأكد من سلامته. اضغط «تثبيت التحديث الآن» بالأسفل —
                      سيُغلق البرنامج تلقائياً، يُثبَّت التحديث، ثم يُعاد فتحه. لا تُطفئ الجهاز أثناء التثبيت.
                    </span>
                  ) : mDownloading ? (
                    <span>
                      جارٍ تنزيل ملف التحديث إلى مجلد التنزيلات. سيتم التحقق من سلامة الملف تلقائياً
                      بعد اكتمال التنزيل، ثم يصبح زر «تثبيت التحديث الآن» جاهزاً.
                    </span>
                  ) : available ? (
                    <div>
                      <p>
                        الإصدار <strong className="text-zinc-900">{info?.version}</strong>
                        {fileSize ? <span className="text-zinc-400"> ({fmtMB(fileSize)} MB)</span> : null} متاح للتثبيت.
                        اتبع الخطوات التالية:
                      </p>
                      <ol className="mt-6 space-y-3">
                        {[
                          "اضغط زر «تحميل التحديث» بالأسفل وانتظر حتى يكتمل التنزيل.",
                          "ننصح بإنشاء نسخة احتياطية لبياناتك أولاً (الزر في الأسفل).",
                          "اضغط «تثبيت التحديث الآن» — سيُغلق البرنامج، يُثبَّت التحديث، ثم يُعاد فتحه تلقائياً.",
                        ].map((t, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-black">
                              {i + 1}
                            </span>
                            <span className="text-base font-bold text-zinc-700 leading-relaxed pt-0.5">{t}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    "أنت تستخدم أحدث نسخة من النظام. جميع الميزات تعمل بأعلى كفاءة واستقرار تام."
                  )}
                </div>

                {/* Phase stepper */}
                {showStepper && (
                  <div className="mt-8 max-w-md">
                    <PhaseStepper
                      checkStatus={checkStatus}
                      downloadStatus={downloadStatus}
                      installStatus={installStatus}
                    />
                  </div>
                )}

                {/* Inline download progress (%, size, speed) — replaces the old overlay */}
                <AnimatePresence>
                  {mProgress && mDownloading && !mReady && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 28 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التحميل</span>
                        <span className="text-2xl number-fmt text-zinc-950">{(mProgress.percent || 0).toFixed(0)}%</span>
                      </div>
                      <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-primary rounded-full shadow-sm transition-all duration-300 ease-linear"
                          style={{ width: `${mProgress.percent || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-2 text-xs font-bold text-zinc-400 font-mono">
                        <span>{mProgress.transferred != null ? `MB ${fmtMB(mProgress.transferred)} / ${fmtMB(mProgress.total)}` : ""}</span>
                        <span>{mProgress.bytesPerSecond ? fmtSpeed(mProgress.bytesPerSecond) : ""}</span>
                      </div>
                      <button
                        onClick={handleCancelManual}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-zinc-600 border border-zinc-200 bg-bg-surface hover:bg-zinc-50 transition-colors"
                      >
                        <X className="h-4 w-4" /> إيقاف التحميل
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Calm backup notice + one-click backup (NOT a warning) */}
                {available && !mReady && (
                  <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-surface border border-zinc-100 text-zinc-500">
                        <Database className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-zinc-600 leading-relaxed">
                        ننصح بإنشاء نسخة احتياطية قبل التحديث للاطمئنان على بياناتك.
                      </p>
                    </div>
                    {backupState === "done" ? (
                      <span className="flex items-center gap-2 text-sm font-black shrink-0" style={{ color: "var(--success, #10b981)" }}>
                        <CheckCircle2 className="h-4 w-4" /> تم إنشاء النسخة الاحتياطية
                      </span>
                    ) : (
                      <button
                        onClick={handleBackup}
                        disabled={backupState === "running"}
                        className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black border border-zinc-200 bg-bg-surface text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-60"
                      >
                        {backupState === "running" ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإنشاء...</>
                        ) : (
                          <><Database className="h-4 w-4" /> إنشاء نسخة احتياطية الآن</>
                        )}
                      </button>
                    )}
                  </div>
                )}
                {backupState === "error" && (
                  <p className="mt-2 text-xs font-bold text-red-500">تعذّر إنشاء النسخة الاحتياطية. يمكنك المتابعة أو المحاولة من الإعدادات.</p>
                )}
              </div>

              {/* Primary action */}
              <div className="flex items-center gap-4">
                {error ? (
                  <MagneticButton
                    data-help="check-button"
                    onClick={handleCheckNow}
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-xl transition-shadow text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> إعادة الفحص
                  </MagneticButton>
                ) : mReady ? (
                  <MagneticButton
                    data-help="install-button"
                    onClick={handleOpenInstaller}
                    disabled={installing}
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-black hover:shadow-xl transition-shadow disabled:opacity-70 text-sm"
                  >
                    {installing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> جاري بدء التثبيت...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> تثبيت التحديث الآن</>
                    )}
                  </MagneticButton>
                ) : available ? (
                  <MagneticButton
                    data-help="download-button"
                    onClick={handleManualDownload}
                    disabled={checking || mDownloading}
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-xl transition-shadow disabled:opacity-50 text-sm"
                  >
                    <Download className="w-4 h-4" /> {mDownloading ? "جاري التحميل..." : "تحميل التحديث"}
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    data-help="check-button"
                    onClick={handleCheckNow}
                    disabled={checking}
                    className="px-8 py-4 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-colors disabled:opacity-50 text-sm shadow-sm" style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                  >
                    <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
                    فحص الخوادم
                  </MagneticButton>
                )}
              </div>

              {/* Manual-pipeline error surface (download / integrity-check failures) */}
              {manualError && !rbVersion && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-red-700">
                      {typeof manualError === "string" ? manualError : "تعذّر تنزيل التحديث. حاول مرة أخرى."}
                    </p>
                    <button
                      onClick={handleManualDownload}
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-red-700 border border-red-200 bg-bg-surface hover:bg-red-50 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Technical Info Card (Col-span-4) */}
          <motion.div
            data-help="tech-card"
            variants={FADE_UP}
            className="md:col-span-4 bg-zinc-950 rounded-[2.5rem] p-10 relative overflow-hidden flex flex-col justify-between shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiIvPjwvc3ZnPg==')] pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm tracking-widest uppercase">التشخيص التقني</h3>
                </div>
                <div className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    نسخة النواة
                  </p>
                  <p className="font-mono text-3xl font-black text-white tracking-tight">{currentVersion}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    قناة التحديث
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-surface/5 border border-border-normal/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-zinc-300">Stable (الرئيسية)</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">
                    آخر تزامن
                  </p>
                  <p className="text-sm font-bold text-zinc-300 font-mono">
                    {lastCheckedAt
                      ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
                          hour12: true,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }).format(new Date(lastCheckedAt))
                      : "--:--:--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-12 pt-6 border-t border-border-normal/10 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">حالة النظام</span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">ممتازة</span>
            </div>
          </motion.div>

          {/* Release Notes (Col-span-12) */}
          <motion.div
            data-help="release-notes"
            variants={FADE_UP}
            className="md:col-span-12 bg-bg-surface/70 backdrop-blur-2xl rounded-[2.5rem] p-10 lg:p-14 border border-border-normal/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)]"
          >
            <div className="flex items-center gap-4 mb-10 pb-8 border-b border-zinc-100">
              <div className="h-12 w-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" style={{ color: "var(--text-primary)" }} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-zinc-950">سجل التغييرات الشامل</h3>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Release Notes</p>
              </div>
            </div>

            <div className="prose prose-zinc prose-lg max-w-none text-zinc-600 font-medium leading-[2] prose-h3:text-zinc-950 prose-h3:font-black prose-h3:tracking-tight prose-a:text-emerald-600 hover:prose-a:text-emerald-700 [&_ul]:list-disc [&_ul]:pr-6 [&_li]:my-1 [&_p]:my-2">
              {info?.releaseNotes ? (
                <div
                  dir="rtl"
                  dangerouslySetInnerHTML={{
                    __html: typeof info.releaseNotes === "string"
                      ? info.releaseNotes
                      : Array.isArray(info.releaseNotes)
                        ? info.releaseNotes.map((n) => n.note || "").join("<br/>")
                        : "",
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="h-20 w-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-100 shadow-sm"
                  >
                    <Server className="w-8 h-8 text-zinc-300" />
                  </motion.div>
                  <p className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>لا توجد تفاصيل متاحة لهذا الإصدار</p>
                  <p className="text-zinc-400 mt-2 font-medium">سيتم عرض قائمة الميزات والإصلاحات هنا عند توفرها.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Version rollback / install a specific release (Col-span-12) */}
          <motion.div
            variants={FADE_UP}
            className="md:col-span-12 bg-bg-surface/70 backdrop-blur-2xl rounded-[2.5rem] p-8 lg:p-10 border border-border-normal/50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)]"
          >
            <button
              onClick={toggleRollback}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                  <History className="w-6 h-6 text-zinc-700" />
                </div>
                <div className="text-right">
                  <h3 className="text-2xl font-black tracking-tight text-zinc-950">تثبيت إصدار محدد</h3>
                  <p className="text-xs font-bold text-zinc-400 mt-1">الرجوع لإصدار أقدم أو إعادة تثبيت إصدار معيّن</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${rollbackOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {rollbackOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-8">
                    {/* Calm data-safety note */}
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 mb-6">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface border border-zinc-100 text-zinc-500">
                        <Database className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-zinc-600 leading-relaxed">
                        يتم إنشاء نسخة احتياطية تلقائياً قبل التثبيت. ملاحظة: البيانات التي أُضيفت في الإصدار الأحدث قد لا تظهر بالكامل بعد الرجوع لإصدار أقدم.
                      </p>
                    </div>

                    {/* Active rollback in progress */}
                    {rbVersion ? (
                      <div className="p-5 rounded-2xl border border-zinc-200 bg-bg-surface">
                        <p className="text-sm font-black text-zinc-800 mb-4">
                          {rbStage === "backup"
                            ? `جاري إنشاء نسخة احتياطية قبل تثبيت الإصدار ${rbVersion}...`
                            : manualFilePath
                            ? `تم تنزيل الإصدار ${rbVersion} وهو جاهز للتثبيت.`
                            : `جاري تنزيل الإصدار ${rbVersion}...`}
                        </p>

                        {rbStage === "backup" && (
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> يرجى الانتظار...
                          </span>
                        )}

                        {rbStage === "download" && !manualFilePath && (
                          <>
                            {manualProgress && (
                              <>
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">جاري التنزيل</span>
                                  <span className="text-lg number-fmt text-zinc-900">{(manualProgress.percent || 0).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-zinc-900 rounded-full transition-all duration-300 ease-linear" style={{ width: `${manualProgress.percent || 0}%` }} />
                                </div>
                                <div className="flex justify-between items-center mt-2 text-xs font-bold text-zinc-400 font-mono">
                                  <span>{manualProgress.transferred != null ? `MB ${fmtMB(manualProgress.transferred)} / ${fmtMB(manualProgress.total)}` : ""}</span>
                                  <span>{manualProgress.bytesPerSecond ? fmtSpeed(manualProgress.bytesPerSecond) : ""}</span>
                                </div>
                              </>
                            )}
                            <button
                              onClick={handleCancelRollback}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-zinc-600 border border-zinc-200 bg-bg-surface hover:bg-zinc-50 transition-colors"
                            >
                              <X className="h-4 w-4" /> إيقاف
                            </button>
                          </>
                        )}

                        {manualFilePath && (
                          <button
                            onClick={handleOpenInstaller}
                            disabled={installing}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black bg-primary text-white hover:shadow-xl transition-shadow disabled:opacity-70"
                          >
                            {installing ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> جاري بدء التثبيت...</>
                            ) : (
                              <><FolderOpen className="h-4 w-4" /> تثبيت الإصدار {rbVersion}</>
                            )}
                          </button>
                        )}

                        {manualError && (
                          <p className="mt-3 text-xs font-bold text-red-500">
                            {typeof manualError === "string" ? manualError : "تعذّر التنزيل. حاول مرة أخرى."}
                          </p>
                        )}
                      </div>
                    ) : releasesLoading ? (
                      <div className="flex items-center justify-center py-12 text-zinc-400 gap-3">
                        <Loader2 className="h-5 w-5 animate-spin" /> <span className="font-bold">جاري جلب قائمة الإصدارات...</span>
                      </div>
                    ) : releases && releases.length > 0 ? (
                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {releases.map((r) => {
                          const isCurrent = r.version === currentVersion;
                          return (
                            <div key={r.version} className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-100 hover:bg-zinc-50 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-lg font-black text-zinc-900">{r.version}</span>
                                {isCurrent && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">الحالي</span>
                                )}
                                {r.prerelease && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">تجريبي</span>
                                )}
                                {r.publishedAt && (
                                  <span className="text-xs font-bold text-zinc-400 font-mono">
                                    {new Intl.DateTimeFormat("en-CA").format(new Date(r.publishedAt))}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleInstallVersion(r.version)}
                                disabled={isCurrent}
                                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black border border-zinc-200 bg-bg-surface text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Download className="h-4 w-4" /> {isCurrent ? "مُثبّت" : "تثبيت"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="font-bold text-zinc-500">تعذّر جلب قائمة الإصدارات.</p>
                        <button onClick={loadReleases} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black border border-zinc-200 bg-bg-surface text-zinc-700 hover:bg-zinc-50 transition-colors">
                          <RefreshCw className="h-4 w-4" /> إعادة المحاولة
                        </button>
                      </div>
                    )}

                    {rbError && (
                      <p className="mt-4 text-xs font-bold text-red-500">{rbError}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>

      {/* Install progress overlay */}
      <AnimatePresence>
        {installPhase !== "idle" && (
          <InstallProgressOverlay
            phase={installPhase}
            error={installError}
            version={installVersion}
            onDismiss={clearInstallState}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
