import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Home, ChevronDown, ChevronUp, Copy, Database, RefreshCw, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { queryClient } from "../../services/queryClient";

export default function ErrorFallbackPage({ error, errorInfo, resetErrorBoundary, isLooping }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const handleCopy = () => {
    const text = `${error?.name}: ${error?.message}\n\n${errorInfo?.componentStack || error?.stack || ""}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success("تم نسخ التفاصيل");
    });
  };

  // Real recovery: clearing the boundary alone re-shows the error if the page
  // re-throws from cached bad state. Drop the React Query cache first so stale
  // failed queries don't immediately throw again, THEN reset the boundary.
  const handleRetry = () => {
    try { queryClient.clear(); } catch (_e) {}
    resetErrorBoundary?.();
  };

  // When the page keeps re-throwing (loop), retry can't help — reload the window
  // to a safe route, which wipes all in-memory state.
  const handleReload = () => {
    if (window.location.protocol === "file:") {
      window.location.hash = "#/dashboard";
    } else {
      window.history.pushState({}, "", "/dashboard");
    }
    window.location.reload();
  };

  const goDashboard = () => {
    handleRetry();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-6" dir="rtl">
      <div className="relative w-full max-w-lg mx-auto">
        <div className="absolute top-[-20%] left-[50%] w-[500px] h-[500px] bg-[var(--danger)]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative bg-[var(--bg-surface)] border border-[var(--border-normal)] rounded-[2.5rem] p-12 md:p-16 shadow-[var(--shadow-card)] text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[var(--danger-bg)] text-[var(--danger)] ring-1 ring-[var(--danger-border)]/40 shadow-[0_8px_30px_-6px_rgba(220,38,38,0.15)] mb-8">
            <AlertTriangle className="h-12 w-12" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black leading-none text-[var(--text-primary)] tracking-tight">
            حدث خطأ غير متوقع
          </h1>
          <p className="mt-4 text-[15px] font-semibold text-[var(--text-secondary)] leading-relaxed">
            حدث خطأ أثناء عرض هذه الصفحة. يمكنك العودة والمحاولة مرة أخرى.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {isLooping ? (
              <button
                onClick={handleReload}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-white shadow-md shadow-[var(--primary-glow)] transition-all hover:opacity-90 active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                إعادة تحميل البرنامج
              </button>
            ) : (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-black text-white shadow-md shadow-[var(--primary-glow)] transition-all hover:opacity-90 active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                حاول مرة أخرى
              </button>
            )}
            <button
              onClick={goDashboard}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-normal)] bg-transparent px-5 py-2.5 text-sm font-black text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] active:scale-95"
            >
              <Home className="h-4 w-4" />
              لوحة التحكم
            </button>
            <button
              onClick={() => { handleRetry(); navigate(-1); }}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-normal)] bg-transparent px-5 py-2.5 text-sm font-black text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </button>
            <Link
              to="/settings?tab=maintenance"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[var(--border-normal)] bg-transparent px-5 py-2.5 text-sm font-black text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] active:scale-95"
            >
              <Database className="h-4 w-4" />
              فحص قاعدة البيانات
            </Link>
          </div>

          <div className="mt-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors tracking-wide uppercase"
            >
              {showDetails ? (
                <>إخفاء التفاصيل <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>عرض التفاصيل <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>
          </div>

          {showDetails && (
            <div className="mt-4 text-left" dir="ltr">
              <div className="relative rounded-2xl bg-[var(--bg-base)] border border-[var(--danger-border)]/30 p-4 overflow-hidden">
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <pre className="text-[11px] leading-[1.7] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-60 overflow-y-auto scrollbar-thin direction-ltr">
                  {error?.name && <span className="text-[var(--danger)] font-extrabold">{error.name}: </span>}
                  <span>{error?.message || "Unknown error"}</span>
                  {errorInfo?.componentStack && (
                    <>
                      {"\n\n"}

                      {errorInfo.componentStack}
                    </>
                  )}
                  {!errorInfo?.componentStack && error?.stack && (
                    <>
                      {"\n\n"}
                      {error.stack}
                    </>
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
