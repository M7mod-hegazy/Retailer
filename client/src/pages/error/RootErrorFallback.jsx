import React, { useState } from "react";
import { useTranslation } from "react-i18next";

// Last-resort fallback for the TOP-LEVEL boundary (crashes in gates / AppShell /
// providers). It must NOT depend on react-router or any app context — those may
// be exactly what crashed — so it recovers by reloading the window to a safe
// route, which also wipes the in-memory state that caused the crash.
export default function RootErrorFallback({ error, errorInfo }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const detailText = `${error?.name || "Error"}: ${error?.message || "Unknown error"}\n\n${
    errorInfo?.componentStack || error?.stack || ""
  }`;

  const reloadToDashboard = () => {
    // file:// (packaged) uses HashRouter; http(s) (web/dev) uses BrowserRouter.
    if (window.location.protocol === "file:") {
      window.location.hash = "#/dashboard";
    } else {
      window.history.pushState({}, "", "/dashboard");
    }
    window.location.reload();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_e) {
      /* ignore */
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6"
    >
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-800 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-black mb-2">
          {t("rootError.title", "حدث خطأ في البرنامج")}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          {t(
            "rootError.body",
            "حدث خطأ غير متوقع أوقف الواجهة. أعد تحميل البرنامج للمتابعة — لن تفقد بياناتك.",
          )}
        </p>

        <button
          onClick={reloadToDashboard}
          className="w-full px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors"
        >
          {t("rootError.reload", "إعادة تحميل البرنامج")}
        </button>

        <button
          onClick={() => setShowDetails((s) => !s)}
          className="mt-4 text-xs font-bold text-gray-500 hover:text-gray-300 uppercase tracking-wide"
        >
          {showDetails
            ? t("rootError.hideDetails", "إخفاء التفاصيل")
            : t("rootError.showDetails", "عرض التفاصيل")}
        </button>

        {showDetails && (
          <div className="mt-3 text-left" dir="ltr">
            <div className="relative rounded-xl bg-gray-950 border border-gray-800 p-4">
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                {copied ? t("rootError.copied", "تم النسخ ✓") : t("rootError.copy", "نسخ")}
              </button>
              <pre className="text-[11px] leading-[1.7] font-mono text-gray-300 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {detailText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
