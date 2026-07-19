import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, ArrowLeftRight, Ban, AlertOctagon } from "lucide-react";

export default function Step10Done({ wizard }) {
  const result = wizard.result || {};
  return (
    <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/20 p-8 md:p-12 text-center max-w-3xl mx-auto shadow-sm" dir="rtl">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm ring-8 ring-emerald-100/30 animate-bounce duration-1000">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <h3 className="mt-6 text-3xl font-black text-text-primary font-display">اكتمل استيراد الأصناف بنجاح!</h3>
      <p className="mt-2 text-sm font-semibold text-text-secondary font-title">
        تم معالجة الملف وتطبيق التغييرات على قاعدة البيانات بأمان.
      </p>

      <div className="mx-auto mt-8 grid max-w-4xl gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 text-right">
        {[
          ["مضاف جديد", result.inserted || 0, "text-emerald-700 border-emerald-200 bg-emerald-50/30", FileText],
          ["تحديث أسعار", wizard.importStats?.priceUpdates || 0, "text-violet-700 border-violet-200 bg-violet-50/30", ArrowLeftRight],
          ["تحديث بيانات", result.updated || 0, "text-sky-700 border-sky-200 bg-sky-50/30", ArrowLeftRight],
          ["تم تخطيه", result.skipped || 0, "text-text-secondary border-border-normal bg-bg-overlay/30", Ban],
          ["فشل الاستيراد", result.failed || 0, "text-rose-700 border-rose-200 bg-rose-50/30", AlertOctagon],
        ].map(([label, value, styles, Icon]) => (
          <div key={label} className={`rounded-2xl border p-4.5 shadow-sm transition hover:shadow-md ${styles}`}>
            <div className="flex items-center justify-between gap-1 text-[10px] font-black text-text-muted font-mono tracking-wide">
              <span>{label}</span>
              <Icon className="h-3.5 w-3.5 opacity-60" />
            </div>
            <div className="mt-2 text-2xl font-black">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link 
          to="/definitions/items/import?tab=history" 
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-250 bg-bg-surface px-6 py-3.5 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 hover:border-emerald-350 active:scale-[0.98]"
        >
          فتح سجل الاستيراد والتراجع
        </Link>
        <button 
          type="button" 
          onClick={wizard.reset} 
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-md shadow-slate-900/10 transition hover:bg-primary-600 active:scale-[0.98]"
        >
          رفع ملف جديد
        </button>
      </div>
    </div>
  );
}
