import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../services/api";
import { resetApiBaseUrl } from "../services/apiBase";
import { reportClientDiag } from "../services/diag";

// Shows a fullscreen Arabic overlay when the server is unreachable.
// Triggers from three sources:
//   1. axios interceptor  → "server:unreachable" custom event (network error / ECONNREFUSED)
//   2. browser offline    → window "offline" event  (works on web + Electron)
//   3. Electron IPC       → "server:status" channel (main process crash notification)
//
// Each trigger carries a CAUSE code (from the Electron main self-diagnostic, or the
// axios classifier as a fallback). Transient causes keep auto-retrying with a
// spinner; persistent causes (DB locked / EPERM / port exhausted / loopback blocked /
// native module) STOP the endless retry and switch to a guided-fix screen with a
// specific, copyable explanation and remediation buttons — because retrying forever
// can never fix an OS/permission-level problem.

const POLL_INTERVAL = 4000;

// Causes that cannot be fixed by simply waiting/retrying — show guided fix.
const PERSISTENT_CAUSES = new Set([
  "db-eperm",
  "db-locked",
  "db-corrupt",
  "port-exhausted",
  "loopback-blocked",
  "native-module",
  "server-never-started",
]);

function isPersistent(cause) {
  return PERSISTENT_CAUSES.has(cause);
}

export default function ServerDownOverlay() {
  const { t } = useTranslation();
  const [down, setDown] = useState(false);
  const [cause, setCause] = useState("transient-disconnect");
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [showDetails, setShowDetails] = useState(false);
  const [diag, setDiag] = useState(null);
  const [fixing, setFixing] = useState(false);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const pingAttemptsRef = useRef(0);

  const clearTimers = () => {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  };

  const hasElectron = typeof window !== "undefined" && !!window.electronAPI?.invoke;

  // Translatable text per cause. Arabic strings are the defaults so the overlay
  // always renders something meaningful even before locale keys are loaded.
  const causeText = (c) => {
    const map = {
      "transient-disconnect": {
        title: t("serverDown.transient.title", "انقطع الاتصال بالبرنامج"),
        body: t(
          "serverDown.transient.body",
          "توقف الخادم الداخلي عن الاستجابة. يتم إعادة المحاولة تلقائياً — لا تغلق البرنامج.",
        ),
      },
      restarting: {
        title: t("serverDown.restarting.title", "جاري إعادة تشغيل الخادم..."),
        body: t(
          "serverDown.restarting.body",
          "اكتُشف خطأ وتتم إعادة تشغيل الخادم الداخلي تلقائياً. انتظر لحظة.",
        ),
      },
      offline: {
        title: t("serverDown.offline.title", "انقطع اتصال الشبكة"),
        body: t(
          "serverDown.offline.body",
          "يبدو أن الجهاز غير متصل بالشبكة. تأكد من الاتصال ثم سيتم الاستئناف تلقائياً.",
        ),
      },
      "db-eperm": {
        title: t("serverDown.dbEperm.title", "تعذّر الوصول لملفات البرنامج"),
        body: t(
          "serverDown.dbEperm.body",
          "ليس لدى البرنامج صلاحية الكتابة في مجلد البيانات. شغّل البرنامج كمسؤول (Run as administrator)، أو انقله خارج مجلد Program Files.",
        ),
      },
      "db-locked": {
        title: t("serverDown.dbLocked.title", "قاعدة البيانات مشغولة"),
        body: t(
          "serverDown.dbLocked.body",
          "ملف قاعدة البيانات مفتوح من نسخة أخرى للبرنامج أو من برنامج آخر. أغلق أي نسخة أخرى ثم اضغط إعادة المحاولة.",
        ),
      },
      "db-corrupt": {
        title: t("serverDown.dbCorrupt.title", "تلف في قاعدة البيانات"),
        body: t(
          "serverDown.dbCorrupt.body",
          "تعذّر فتح قاعدة بيانات سليمة. استخدم صفحة النسخ الاحتياطي لاستعادة نسخة سليمة.",
        ),
      },
      "port-exhausted": {
        title: t("serverDown.portExhausted.title", "المنافذ مشغولة"),
        body: t(
          "serverDown.portExhausted.body",
          "كل المنافذ المتاحة للبرنامج مشغولة ببرامج أخرى. أغلق البرامج المتعارضة ثم اضغط إعادة المحاولة.",
        ),
      },
      "loopback-blocked": {
        title: t("serverDown.loopbackBlocked.title", "الاتصال المحلي محجوب"),
        body: t(
          "serverDown.loopbackBlocked.body",
          "يبدو أن برنامج الحماية (Antivirus) أو إعداد البروكسي يمنع الاتصال المحلي (127.0.0.1). أضف البرنامج لقائمة الاستثناءات في برنامج الحماية.",
        ),
      },
      "native-module": {
        title: t("serverDown.nativeModule.title", "مكوّن داخلي مفقود"),
        body: t(
          "serverDown.nativeModule.body",
          "تعذّر تحميل مكوّن قاعدة البيانات. قد تحتاج لتثبيت Microsoft Visual C++ Redistributable أو إعادة تثبيت البرنامج.",
        ),
      },
      "server-never-started": {
        title: t("serverDown.fatal.title", "فشل تشغيل الخادم"),
        body: t(
          "serverDown.fatal.body",
          "تعذّر تشغيل الخادم الداخلي بعد عدة محاولات. جرّب التشخيص والإصلاح أدناه أو أعد تشغيل البرنامج.",
        ),
      },
    };
    return map[c] || map["transient-disconnect"];
  };

  const tryPing = useCallback(async () => {
    setRetrying(true);
    pingAttemptsRef.current += 1;
    // The server may have restarted on a different port — drop the cached base URL so
    // the health ping re-resolves the live port instead of hitting a dead one.
    resetApiBaseUrl();
    try {
      // Generous timeout: a busy (but alive) server can take several seconds to answer
      // because better-sqlite3 blocks the event loop during heavy queries.
      await api.get("/api/health", { timeout: 8000 });
      reportClientDiag({ type: "recovered", cause, pings: pingAttemptsRef.current });
      pingAttemptsRef.current = 0;
      setDown(false);
      setRetrying(false);
      clearTimers();
    } catch {
      setRetrying(false);
      scheduleNextPing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cause]);

  const scheduleNextPing = useCallback(() => {
    clearTimers();
    setCountdown(4);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    timerRef.current = setTimeout(tryPing, POLL_INTERVAL);
  }, [tryPing]);

  const showOverlay = useCallback(
    (nextCause) => {
      reportClientDiag({ type: "overlay-shown", cause: nextCause });
      setDown(true);
      setCause(nextCause);
      // Persistent causes: stop blind retrying, show guided fix instead.
      if (isPersistent(nextCause)) {
        clearTimers();
      } else if (nextCause !== "restarting") {
        scheduleNextPing();
      }
    },
    [scheduleNextPing],
  );

  useEffect(() => {
    // axios network error (web fallback path). On Electron the authoritative cause
    // arrives via server:status; here (web) we only know it's a disconnect.
    const handleServerDown = () => showOverlay("transient-disconnect");
    window.addEventListener("server:unreachable", handleServerDown);

    // Browser / OS offline event — works on both web and Electron
    const handleOffline = () => showOverlay("offline");
    window.addEventListener("offline", handleOffline);

    // When the OS reports the connection is back, ping immediately
    const handleOnline = () => {
      clearTimers();
      setRetrying(true);
      tryPing();
    };
    window.addEventListener("online", handleOnline);

    // Electron IPC — main process reports server status changes (authoritative cause)
    const removeIpc = window.electronAPI?.on?.("server:status", (data) => {
      if (data?.status === "restarting") {
        clearTimers();
        showOverlay("restarting");
      } else if (data?.status === "down") {
        showOverlay(data?.cause || "transient-disconnect");
      } else if (data?.status === "fatal") {
        clearTimers();
        showOverlay(data?.cause || "server-never-started");
      } else if (data?.status === "online") {
        setDown(false);
        clearTimers();
      }
    });

    return () => {
      window.removeEventListener("server:unreachable", handleServerDown);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      removeIpc?.();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load the diagnostic report when the user opens the details panel.
  const loadDiag = useCallback(async () => {
    if (!hasElectron) return;
    try {
      const data = await window.electronAPI.invoke("diag:get-report");
      setDiag(data);
    } catch (_e) {
      /* ignore — details just stay empty */
    }
  }, [hasElectron]);

  const toggleDetails = () => {
    const next = !showDetails;
    setShowDetails(next);
    if (next && !diag) loadDiag();
  };

  const buildReportText = () => {
    const lines = [
      `cause: ${cause}`,
      `port: ${diag?.port ?? "?"}`,
      `dbPath: ${diag?.dbPath ?? "?"}`,
      `appVersion: ${diag?.appVersion ?? "?"}`,
      "",
      "── diagnostic-report.json ──",
      diag?.report ? JSON.stringify(diag.report, null, 2) : "(غير متوفر)",
      "",
      "── log tail ──",
      diag?.logTail || "(غير متوفر)",
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      if (!diag) await loadDiag();
      await navigator.clipboard.writeText(buildReportText());
      toast.success(t("serverDown.copied", "تم نسخ تقرير التشخيص"));
    } catch (_e) {
      toast.error(t("serverDown.copyFailed", "تعذّر النسخ"));
    }
  };

  const handleOpenLogs = async () => {
    if (!hasElectron) return;
    try {
      await window.electronAPI.invoke("diag:open-logs");
    } catch (_e) {
      toast.error(t("serverDown.openLogsFailed", "تعذّر فتح مجلد السجلات"));
    }
  };

  const handleRunFix = async () => {
    setFixing(true);
    try {
      if (hasElectron) {
        const res = await window.electronAPI.invoke("diag:run-and-fix");
        setDiag((prev) => ({ ...(prev || {}), report: res?.report || prev?.report }));
        if (res?.cause) setCause(res.cause);
      }
      // Whether or not a fix was applied, probe the server — it may now be up.
      await tryPing();
    } catch (_e) {
      toast.error(t("serverDown.fixFailed", "تعذّر إكمال التشخيص"));
    } finally {
      setFixing(false);
    }
  };

  if (!down) return null;

  const persistent = isPersistent(cause);
  const isRestarting = cause === "restarting";
  const msg = causeText(cause);
  const iconColor = isRestarting ? "text-amber-400" : "text-red-400";
  const iconBg = isRestarting ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div
      dir="rtl"
      style={{ zIndex: 99999 }}
      className="fixed inset-0 bg-gray-950/95 flex flex-col items-center justify-center gap-5 text-center px-6 overflow-y-auto py-10"
    >
      {/* Icon */}
      <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center`}>
        {isRestarting ? (
          <svg className={`w-10 h-10 ${iconColor} animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <svg className={`w-10 h-10 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        )}
      </div>

      {/* Title & body */}
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">{msg.title}</h1>
        <p className="text-gray-400 text-sm leading-relaxed">{msg.body}</p>
      </div>

      {/* Countdown / spinner — only while auto-retrying a transient failure */}
      {!persistent && !isRestarting && (
        <div className="flex items-center gap-3">
          {retrying ? (
            <svg className="w-5 h-5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <span className="text-gray-500 text-sm">
              {t("serverDown.retryIn", "إعادة المحاولة خلال {{n}} ثوان...", { n: countdown })}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {!isRestarting && (
          <button
            onClick={tryPing}
            disabled={retrying || fixing}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {retrying ? t("serverDown.connecting", "جارٍ الاتصال...") : t("serverDown.retryNow", "إعادة المحاولة الآن")}
          </button>
        )}

        {hasElectron && persistent && (
          <button
            onClick={handleRunFix}
            disabled={fixing}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {fixing ? t("serverDown.fixing", "جارٍ التشخيص...") : t("serverDown.diagnoseFix", "تشخيص وإصلاح")}
          </button>
        )}

        {hasElectron && (
          <button
            onClick={handleOpenLogs}
            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            {t("serverDown.openLogs", "فتح مجلد السجلات")}
          </button>
        )}
      </div>

      {/* Details toggle */}
      <button
        onClick={toggleDetails}
        className="text-xs font-bold text-gray-400 hover:text-gray-200 transition-colors uppercase tracking-wide"
      >
        {showDetails ? t("serverDown.hideDetails", "إخفاء التفاصيل") : t("serverDown.showDetails", "عرض التفاصيل")}
      </button>

      {showDetails && (
        <div className="w-full max-w-2xl" dir="ltr">
          <div className="relative rounded-xl bg-gray-900 border border-gray-700 p-4 text-left">
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              {t("serverDown.copyReport", "نسخ التقرير")}
            </button>
            <pre className="text-[11px] leading-[1.7] font-mono text-gray-300 whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
              {diag ? buildReportText() : t("serverDown.loadingDetails", "جارٍ تحميل التفاصيل...")}
            </pre>
          </div>
        </div>
      )}

      <p className="text-gray-600 text-xs max-w-sm">
        {persistent
          ? t("serverDown.persistentHint", "إذا استمرت المشكلة، انسخ التقرير وأرسله للدعم الفني.")
          : t("serverDown.transientHint", "إذا استمرت المشكلة، أغلق البرنامج وأعد تشغيله.")}
      </p>
    </div>
  );
}
