import { useEffect, useRef, useState } from "react";
import api from "../services/api";

// Shows a fullscreen Arabic overlay when the server is unreachable.
// Triggers from three sources:
//   1. axios interceptor  → "server:unreachable" custom event (network error / ECONNREFUSED)
//   2. browser offline    → window "offline" event  (works on web + Electron)
//   3. Electron IPC       → "server:status" channel (main process crash notification)

const POLL_INTERVAL = 4000;

const MESSAGES = {
  server: {
    title: "انقطع الاتصال بالبرنامج",
    body: "توقف الخادم الداخلي عن الاستجابة. يتم إعادة المحاولة تلقائياً — لا تغلق البرنامج.",
  },
  offline: {
    title: "انقطع اتصال الشبكة",
    body: "يبدو أن الجهاز غير متصل بالشبكة. تأكد من الاتصال ثم سيتم الاستئناف تلقائياً.",
  },
  restarting: {
    title: "جاري إعادة تشغيل الخادم...",
    body: "اكتُشف خطأ وتتم إعادة تشغيل الخادم الداخلي تلقائياً. انتظر لحظة.",
  },
  fatal: {
    title: "فشل تشغيل الخادم",
    body: "تعذّر إعادة تشغيل الخادم الداخلي بعد عدة محاولات. يرجى إغلاق البرنامج وإعادة تشغيله.",
  },
};

export default function ServerDownOverlay() {
  const [down, setDown] = useState(false);
  const [reason, setReason] = useState("server"); // "server" | "offline" | "restarting" | "fatal"
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const clearTimers = () => {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  };

  const tryPing = async () => {
    setRetrying(true);
    try {
      await api.get("/api/health", { timeout: 3000 });
      setDown(false);
      setRetrying(false);
      clearTimers();
    } catch {
      setRetrying(false);
      scheduleNextPing();
    }
  };

  const scheduleNextPing = () => {
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
  };

  const showOverlay = (cause) => {
    setDown(true);
    setReason(cause);
    if (cause !== "restarting" && cause !== "fatal") {
      scheduleNextPing();
    }
  };

  useEffect(() => {
    // axios network error
    const handleServerDown = () => showOverlay("server");
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

    // Electron IPC — main process reports server status changes
    const removeIpc = window.electronAPI?.on?.("server:status", (data) => {
      if (data?.status === "restarting") {
        clearTimers();
        showOverlay("restarting");
      } else if (data?.status === "down") {
        showOverlay("server");
      } else if (data?.status === "fatal") {
        clearTimers();
        showOverlay("fatal");
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

  if (!down) return null;

  const msg = MESSAGES[reason] ?? MESSAGES.server;
  const isFatal = reason === "fatal";
  const isRestarting = reason === "restarting";
  const iconColor = isFatal ? "text-red-400" : isRestarting ? "text-amber-400" : "text-red-400";
  const iconBg = isFatal ? "bg-red-500/10" : isRestarting ? "bg-amber-500/10" : "bg-red-500/10";

  return (
    <div
      dir="rtl"
      style={{ zIndex: 99999 }}
      className="fixed inset-0 bg-gray-950/95 flex flex-col items-center justify-center gap-6 text-center px-6"
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
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{msg.title}</h1>
        <p className="text-gray-400 text-sm max-w-sm leading-relaxed">{msg.body}</p>
      </div>

      {/* Countdown / spinner — only when auto-retrying */}
      {!isFatal && !isRestarting && (
        <div className="flex items-center gap-3">
          {retrying ? (
            <svg className="w-5 h-5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <span className="text-gray-500 text-sm">إعادة المحاولة خلال {countdown} ثوان...</span>
          )}
        </div>
      )}

      {/* Manual retry — not shown when fatal or while auto-restarting via Electron */}
      {!isFatal && !isRestarting && (
        <button
          onClick={tryPing}
          disabled={retrying}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {retrying ? "جارٍ الاتصال..." : "إعادة المحاولة الآن"}
        </button>
      )}

      {/* Fatal: tell user to restart manually */}
      {isFatal && (
        <p className="text-red-400 text-sm font-medium">
          أغلق البرنامج من شريط المهام وأعد تشغيله
        </p>
      )}

      {!isFatal && (
        <p className="text-gray-600 text-xs">
          إذا استمرت المشكلة، أغلق البرنامج وأعد تشغيله
        </p>
      )}
    </div>
  );
}
