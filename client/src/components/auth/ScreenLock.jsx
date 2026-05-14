import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import { SESSION_TIMEOUT_MS } from "../../constants/config";

const LOCK_STATE_KEY = "retailer.screen_lock_state.v1";
const EXCLUDED_ROUTES = ["/login", "/activate-license"];
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

function isExcludedRoute(pathname) {
  return EXCLUDED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function readLockState() {
  try {
    const rawState = localStorage.getItem(LOCK_STATE_KEY);
    if (!rawState) return { locked: false, lastActivity: Date.now() };

    const parsed = JSON.parse(rawState);
    return {
      locked: Boolean(parsed?.locked),
      lastActivity: Number(parsed?.lastActivity) || Date.now(),
    };
  } catch (_error) {
    return { locked: false, lastActivity: Date.now() };
  }
}

function writeLockState(nextState) {
  localStorage.setItem(LOCK_STATE_KEY, JSON.stringify(nextState));
}

function computeShouldLock() {
  const state = readLockState();
  return state.locked || Date.now() - state.lastActivity >= SESSION_TIMEOUT_MS;
}

export default function ScreenLock() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  const isEligible = useMemo(() => {
    if (!token) return false;
    return !isExcludedRoute(location.pathname);
  }, [location.pathname, token]);

  // Initialize synchronously from localStorage to prevent flash of unlocked content on reload
  const [isLocked, setIsLocked] = useState(() => computeShouldLock());
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // On mount and whenever eligibility changes, re-evaluate lock state.
  // Only clear the persisted lock when the user has no token (logout).
  // Do NOT clear it merely because we're on an excluded route — that would
  // allow a bypass by navigating to /login while locked.
  useEffect(() => {
    if (!token) {
      // Logged out — reset everything
      setIsLocked(false);
      setPassword("");
      setError(false);
      writeLockState({ locked: false, lastActivity: Date.now() });
      return;
    }

    if (!isEligible) {
      // On an excluded route but still authenticated — keep lock state intact,
      // just don't show the overlay here
      return;
    }

    const shouldLock = computeShouldLock();
    if (shouldLock) {
      setIsLocked(true);
      const current = readLockState();
      writeLockState({ locked: true, lastActivity: current.lastActivity });
    } else {
      setIsLocked(false);
      writeLockState({ locked: false, lastActivity: Date.now() });
    }
  }, [isEligible, token]);

  // Activity tracking and idle-lock polling
  useEffect(() => {
    if (!isEligible) return undefined;

    const recordActivity = () => {
      if (isLocked) return;
      writeLockState({ locked: false, lastActivity: Date.now() });
    };

    const checkIdle = () => {
      if (isLocked) return;
      if (computeShouldLock()) {
        const current = readLockState();
        writeLockState({ locked: true, lastActivity: current.lastActivity });
        setIsLocked(true);
      }
    };

    // Also check immediately when the page becomes visible (tab switch / Electron restore)
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
  }, [isEligible, isLocked]);

  // Cross-tab sync via storage events
  useEffect(() => {
    if (!isEligible) return undefined;

    const syncFromStorage = (event) => {
      if (event.key !== LOCK_STATE_KEY) return;
      const current = readLockState();
      // Also re-check elapsed time in case the other tab didn't write locked:true yet
      const shouldLock = current.locked || Date.now() - current.lastActivity >= SESSION_TIMEOUT_MS;
      setIsLocked(shouldLock);
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [isEligible]);

  // Electron: listen for system resume (wake from sleep) to force lock immediately
  useEffect(() => {
    if (!isEligible) return undefined;
    if (!window.electronAPI?.onSystemResume) return undefined;

    const unsubscribe = window.electronAPI.onSystemResume(() => {
      writeLockState({ locked: true, lastActivity: Date.now() });
      setIsLocked(true);
    });

    return () => unsubscribe?.();
  }, [isEligible]);

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
    } catch (_error) {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show lock overlay whenever locked, regardless of current route,
  // as long as the user is authenticated
  if (!token || !isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-slate-50/70 px-4 text-slate-800 backdrop-blur-[32px] transition-all duration-700">
      
      {/* Avant-Garde Background Mesh (Light Mode) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-emerald-400/20 rounded-full blur-[140px] pointer-events-none opacity-80" />
      <div className="absolute top-1/2 left-1/2 translate-x-[-10%] translate-y-[-60%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none opacity-60" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-[440px] rounded-[40px] bg-white/70 p-12 text-center shadow-[0_24px_80px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/5 backdrop-blur-3xl border border-white/50">
        
        {/* Glow-infused Icon */}
        <div className="mx-auto flex h-24 w-24 relative items-center justify-center rounded-[32px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 shadow-[0_8px_30px_-6px_rgba(16,185,129,0.15)]">
          <div className="absolute inset-0 rounded-[32px] bg-emerald-400/20 blur-xl mix-blend-multiply" />
          <Lock className="relative z-10 h-10 w-10" strokeWidth={1.5} />
        </div>

        <h2 className="mt-8 text-[32px] font-black tracking-tight text-slate-900 drop-shadow-sm">النظام مقفل</h2>
        <p className="mt-3 text-[13px] font-medium leading-relaxed text-slate-500">
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
              <p className="animate-in fade-in slide-in-from-top-1 text-[13px] font-bold text-rose-500">
                كلمة المرور غير صحيحة
              </p>
            )}
          </div>

          <button 
            type="submit" 
            className="group relative mt-5 flex w-full items-center justify-center overflow-hidden rounded-[24px] bg-slate-900 px-4 py-5 text-[16px] font-black text-white shadow-[0_8px_30px_-8px_rgba(15,23,42,0.4)] transition-all hover:bg-slate-800 hover:scale-[1.02] hover:shadow-[0_12px_40px_-10px_rgba(15,23,42,0.5)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span>فتح النظام</span>
            )}
            
            {/* Hover reflection */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          </button>

          {/* Logout Option */}
          <button
            type="button"
            onClick={() => {
              writeLockState({ locked: false, lastActivity: Date.now() });
              logout();
            }}
            className="mt-6 text-[13px] font-bold text-slate-400 decoration-slate-300 decoration-wavy underline-offset-[6px] hover:text-slate-700 hover:underline transition-colors"
          >
            التبديل لمستخدم آخر (تسجيل خروج)
          </button>
        </form>
      </div>
    </div>
  );
}
