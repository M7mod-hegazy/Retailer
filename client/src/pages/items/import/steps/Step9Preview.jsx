import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, Loader2 } from "lucide-react";

function actionLabel(action) {
  const labels = {
    insert: "إضافة",
    create: "إضافة",
    update: "تحديث",
    skip: "تخطي",
    warehouse_stock: "استلام مخزون",
    warning: "تحذير",
  };
  return labels[action] || action || "تغيير";
}

function previewTitle(item) {
  return item.name || item.item_name || item.code || item.sku || `صف ${item.source_row || item.row || "-"}`;
}

function previewDetails(item) {
  return Object.entries(item)
    .filter(([key]) => !["name", "item_name", "code", "sku", "action", "type", "source_row", "row"].includes(key))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
}

export default function Step9Preview({ wizard, goToStepId }) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !wizard.workingRows.length || wizard.preview) return;
    ranRef.current = true;
    wizard.runImport({ dryRun: true }).then((result) => {
      if (!result?.ok && result?.reason === "server_validation") goToStepId?.("final");
    });
  }, [goToStepId, wizard]);

  const preview = wizard.preview || {};
  const exactPreview = Array.isArray(preview.preview) ? preview.preview : [];
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const canExecute = Boolean(wizard.preview) && !wizard.loading;

  return (
    <div className="space-y-5">
      {wizard.loading && !wizard.preview ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center py-12 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
          <h4 className="text-lg font-black text-slate-900 font-display">جاري تشغيل المعاينة الآمنة</h4>
          <p className="mt-1 text-sm font-medium text-slate-500 font-title">هذا فحص محاكاة سريع بدون كتابة فعلية في قاعدة البيانات.</p>
          <div className="mt-8 grid gap-4 w-full sm:grid-cols-3 max-w-4xl">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-2xl bg-slate-50/60 border border-slate-150" />
            ))}
          </div>
        </div>
      ) : null}

      {wizard.error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-250 bg-amber-50/80 px-5 py-4 text-sm font-bold text-amber-800 shadow-sm backdrop-blur-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <span>{wizard.error}</span>
        </div>
      ) : null}

      <div className="grid gap-3.5 grid-cols-2 sm:grid-cols-4">
        {[
          ["إضافة", preview.inserted ?? 0, "أصناف جديدة", "text-emerald-700", "border-emerald-150 bg-emerald-50/10"],
          ["تحديث", preview.updated ?? 0, "أصناف موجودة", "text-sky-700", "border-sky-150 bg-sky-50/10"],
          ["تخطي", preview.skipped ?? 0, "لن تكتب", "text-slate-500", "border-slate-150 bg-slate-50/10"],
          ["تحذيرات", warnings.length, "تستدعي المراجعة", warnings.length ? "text-amber-700 font-black animate-pulse" : "text-slate-450", warnings.length ? "border-amber-200 bg-amber-50/10" : "border-slate-150 bg-slate-50/10"],
        ].map(([label, value, helper, colorClass, borderClass]) => (
          <div key={label} className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${borderClass}`}>
            <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{label}</div>
            <div className={`mt-2 text-3xl font-black ${colorClass} font-display`}>{value}</div>
            <div className="mt-1 text-xs font-bold text-slate-550 font-title">{helper}</div>
          </div>
        ))}
      </div>

      {warnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm backdrop-blur-sm animate-in fade-in duration-300">
          <h3 className="text-base font-black text-amber-900 font-display">تحذيرات المعاينة</h3>
          <div className="mt-3 grid gap-2.5">
            {warnings.slice(0, 6).map((warning, index) => (
              <div key={index} className="rounded-xl border border-amber-200/60 bg-white px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm leading-normal">
                {typeof warning === "string" ? warning : warning.message || JSON.stringify(warning)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4.5">
          <div>
            <h3 className="text-base font-black text-slate-900 font-display">تفاصيل ما سيحدث</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500 font-title">هذه نتيجة dry-run. التنفيذ الفعلي لن يحدث إلا بزر التأكيد بالأسفل.</p>
          </div>
          <button 
            type="button" 
            onClick={() => wizard.runImport({ dryRun: true })} 
            disabled={wizard.loading} 
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40"
          >
            <RefreshCcw className="h-4 w-4" /> إعادة الفحص
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {exactPreview.length ? exactPreview.map((item, index) => (
            <div key={index} className="px-5 py-4 transition hover:bg-slate-50/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900 font-display">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                  <span className="truncate">{previewTitle(item)}</span>
                </div>
                <div className="rounded-lg bg-slate-100 border border-slate-200/50 px-2.5 py-1 text-[10px] font-black font-mono text-slate-650">
                  {actionLabel(item.action || item.type)} - صف {item.source_row || item.row || "-"}
                </div>
              </div>
              <div className="mt-3.5 grid gap-2 md:grid-cols-2">
                {previewDetails(item).length ? previewDetails(item).map((detail) => (
                  <div key={detail} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-650 font-mono">{detail}</div>
                )) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/30 px-3.5 py-2 text-xs font-bold text-slate-400 md:col-span-2 text-center">لا توجد تفاصيل إضافية من الخادم.</div>
                )}
              </div>
            </div>
          )) : (
            <div className="px-6 py-12 text-center text-sm font-bold text-slate-400 font-title">ستظهر تفاصيل المعاينة هنا بعد تشغيل الفحص.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-semibold text-slate-500 font-title">
          زر التنفيذ سيكتب التغييرات في قاعدة البيانات. استخدم رجوع للجدول إذا أردت تعديل أي صف قبل ذلك.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            type="button" 
            onClick={() => goToStepId?.("final")} 
            disabled={wizard.loading} 
            className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40"
          >
            رجوع للجدول
          </button>
          <button 
            type="button" 
            onClick={() => wizard.runImport({ dryRun: false })} 
            disabled={!canExecute} 
            className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-700 px-8 py-3.5 text-sm font-black text-white shadow-md shadow-emerald-700/10 transition-all duration-200 hover:bg-emerald-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-40"
          >
            <Database className="h-4.5 w-4.5" />
            {wizard.loading ? "جاري التنفيذ..." : "تنفيذ فعلي الآن"}
          </button>
        </div>
      </div>
    </div>
  );
}
