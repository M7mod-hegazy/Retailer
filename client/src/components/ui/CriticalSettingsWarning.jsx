import { AlertTriangle, Settings2, ArrowLeft } from "lucide-react";
import { findMissingCritical } from "../../utils/fieldMeta";

export default function CriticalSettingsWarning({ settings, onNavigate, lang = "ar" }) {
  const missing = findMissingCritical(settings, lang);

  if (missing.length === 0) return null;

  const isRTL = lang === "ar";

  return (
    <div className="rounded-sm border border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-amber-500 text-white">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-black text-amber-900">
            {isRTL ? "تحذير: الإعدادات الأساسية غير مكتملة" : "Warning: Critical Settings Missing"}
          </div>
          <p className="mt-1 text-[11px] font-bold text-amber-700 leading-relaxed">
            {isRTL
              ? "الحقول التالية لا تزال فارغة. يجب إكمالها قبل تشغيل النظام بشكل طبيعي — تظهر في الفواتير والتقارير الرسمية."
              : "The following fields are still empty. Complete them before running the system — they appear on invoices and official reports."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate?.(key)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-800 shadow-sm transition-all hover:border-amber-500 hover:bg-amber-100 active:scale-95"
              >
                {label}
                <ArrowLeft className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
