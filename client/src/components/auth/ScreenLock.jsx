import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Lock, Building2 } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/authStore";

const LOCK_STATE_KEY = "retailer.screen_lock_state.v1";
const SETTINGS_CACHE_KEY = "retailer.screen_lock_settings.v1";
const EXCLUDED_ROUTES = ["/login"];
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

function isExcludedRoute(pathname) {
  return EXCLUDED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function readLockState() {
  try {
    const rawState = sessionStorage.getItem(LOCK_STATE_KEY);
    if (!rawState) return { locked: false, lastActivity: Date.now() };

    const parsed = JSON.parse(rawState);
    return {
      locked: Boolean(parsed?.locked),
      lastActivity: Number(parsed?.lastActivity) || Date.now(),
    };
  } catch {
    return { locked: false, lastActivity: Date.now() };
  }
}

function writeLockState(nextState) {
  sessionStorage.setItem(LOCK_STATE_KEY, JSON.stringify(nextState));
}

function computeShouldLock(timeoutMs) {
  const state = readLockState();
  return state.locked || Date.now() - state.lastActivity >= timeoutMs;
}

export default function ScreenLock() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  const isEligible = useMemo(() => {
    if (!token) return false;
    return !isExcludedRoute(location.pathname);
  }, [location.pathname, token]);

  const [settings, setSettings] = useState(() => {
    try {
      const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return { smart_lock_enabled: 1, smart_lock_timeout_minutes: 15 };
  });
  const [shopName, setShopName] = useState("");

  const timeoutMs = settings.smart_lock_enabled
    ? (settings.smart_lock_timeout_minutes || 15) * 60 * 1000
    : Infinity;

  const [isLocked, setIsLocked] = useState(() => {
    if (!settings.smart_lock_enabled) return false;
    return computeShouldLock(DEFAULT_TIMEOUT_MS);
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/api/settings").then((res) => {
      if (cancelled) return;
      const data = res.data?.data;
      if (data) {
        const s = {
          smart_lock_enabled: Number(data.smart_lock_enabled ?? 1),
          smart_lock_timeout_minutes: Number(data.smart_lock_timeout_minutes ?? 15),
        };
        setSettings(s);
        setShopName(data.company_name || data.app_name || "");
        try { sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s)); } catch {}
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLocked(false);
      setPassword("");
      setError(false);
      writeLockState({ locked: false, lastActivity: Date.now() });
      return;
    }

    if (!isEligible) return;

    if (!settings.smart_lock_enabled) {
      setIsLocked(false);
      writeLockState({ locked: false, lastActivity: Date.now() });
      return;
    }

    const shouldLock = computeShouldLock(timeoutMs);
    if (shouldLock) {
      setIsLocked(true);
      const current = readLockState();
      writeLockState({ locked: true, lastActivity: current.lastActivity });
    } else {
      setIsLocked(false);
      writeLockState({ locked: false, lastActivity: Date.now() });
    }
  }, [isEligible, token, settings, timeoutMs]);

  useEffect(() => {
    if (!isEligible || !settings.smart_lock_enabled) return undefined;

    const recordActivity = () => {
      if (isLocked) return;
      writeLockState({ locked: false, lastActivity: Date.now() });
    };

    const checkIdle = () => {
      if (isLocked) return;
      if (computeShouldLock(timeoutMs)) {
        const current = readLockState();
        writeLockState({ locked: true, lastActivity: current.lastActivity });
        setIsLocked(true);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkIdle();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(checkIdle, 3000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, recordActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [isEligible, isLocked, settings.smart_lock_enabled, timeoutMs]);

  useEffect(() => {
    if (!isEligible) return undefined;

    const syncFromStorage = (event) => {
      if (event.key !== LOCK_STATE_KEY) return;
      const current = readLockState();
      const shouldLock = current.locked || Date.now() - current.lastActivity >= timeoutMs;
      setIsLocked(shouldLock);
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [isEligible, timeoutMs]);

  useEffect(() => {
    if (!isEligible || !settings.smart_lock_enabled) return undefined;
    if (!window.electronAPI?.onSystemResume) return undefined;

    const unsubscribe = window.electronAPI.onSystemResume(() => {
      writeLockState({ locked: true, lastActivity: Date.now() });
      setIsLocked(true);
    });

    return () => unsubscribe?.();
  }, [isEligible, settings.smart_lock_enabled]);

  const handleUnlock = async (event) => {
    event.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/api/auth/verify-password", { password });
      if (response.data?.success) {
        setIsLocked(false);
        setPassword("");
        setError(false);
        writeLockState({ locked: false, lastActivity: Date.now() });
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token || !isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-slate-50/70 px-4 text-slate-800 backdrop-blur-[32px] transition-all duration-700">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-emerald-400/20 rounded-full blur-[140px] pointer-events-none opacity-80" />
      <div className="absolute top-1/2 left-1/2 translate-x-[-10%] translate-y-[-60%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none opacity-60" />

      <div className="relative z-10 w-full max-w-[440px] rounded-[40px] bg-white/70 p-12 text-center shadow-[0_24px_80px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5 backdrop-blur-3xl border border-white/50">
        
        <div className="mx-auto flex h-24 w-24 relative items-center justify-center rounded-[32px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 shadow-[0_8px_30px_-6px_var(--primary-glow)]">
          <div className="absolute inset-0 rounded-[32px] bg-emerald-400/20 blur-xl mix-blend-multiply" />
          <Lock className="relative z-10 h-10 w-10" strokeWidth={1.5} />
        </div>

        {shopName && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-emerald-700">
            <Building2 className="h-4 w-4" />
            <span>{shopName}</span>
          </div>
        )}

        <h2 className="mt-6 text-[32px] font-black tracking-tight text-slate-900 drop-shadow-sm">النظام مقفل</h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
          حماية الجلسة نشطة. أدخل كلمة المرور<br />للمتابعة من حيث توقفت.
        </p>

        <form onSubmit={handleUnlock} className="mt-10">
          <div className="relative group">
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(inputEvent) => {
                setPassword(inputEvent.target.value);
                setError(false);
              }}
              placeholder="••••••"
              className={`w-full rounded-[24px] border-0 bg-white/60 px-6 py-6 text-center text-4xl tracking-[0.4em] font-light text-slate-900 outline-none ring-1 ring-inset backdrop-blur-md transition-all duration-300 placeholder:text-slate-300 focus:bg-white focus:ring-2 ${
                error 
                  ? "ring-rose-500/50 focus:ring-rose-500 shadow-[0_0_30px_-5px_rgba(244,63,94,0.15)]" 
                  : "ring-slate-900/10 focus:ring-emerald-500/50 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)]"
              }`}
              autoFocus
            />
          </div>
          
          <div className="mt-4 h-5 flex justify-center items-center">
            {error && (
              <p className="animate-in fade-in slide-in-from-top-1 text-sm font-bold text-rose-500">
                كلمة المرور غير صحيحة
              </p>
            )}
          </div>

          <button 
            type="submit" 
            className="group relative mt-5 flex w-full items-center justify-center overflow-hidden rounded-[24px] bg-primary px-4 py-5 text-[16px] font-black text-white shadow-[0_8px_30px_-8px_rgba(15,23,42,0.4)] transition-all hover:bg-primary-600 hover:scale-[1.02] hover:shadow-[0_12px_40px_-10px_rgba(15,23,42,0.5)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span>فتح النظام</span>
            )}
            
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          </button>

          <button
            type="button"
            onClick={() => {
              writeLockState({ locked: false, lastActivity: Date.now() });
              logout();
            }}
            className="mt-6 text-sm font-bold text-slate-400 decoration-slate-300 decoration-wavy underline-offset-[6px] hover:text-slate-700 hover:underline transition-colors"
          >
            التبديل لمستخدم آخر (تسجيل خروج)
          </button>
        </form>
      </div>
    </div>
  );
}
