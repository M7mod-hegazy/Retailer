import React from "react";
import { useHelpStore } from "../../stores/helpStore";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Sparkles, Route, RotateCcw, ShieldOff } from 'lucide-react';

export function HelpSettingsTab() {
  const lang = document.documentElement.lang || "ar";
  const { toursDisabledGlobally, tooltipsDisabledGlobally, disableAllTours, disableAllTooltips } = useHelpStore();

  const resetAllTours = async () => {
    try {
      await api.patch("/api/help/state/reset");
      toast.success(lang === "ar" ? "تمت إعادة تعيين الشروحات" : "Tours reset successfully");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error(lang === "ar" ? "حدث خطأ" : "Error resetting help state");
    }
  };

  return (
    <div className="space-y-4 font-sans" dir={lang === "ar" ? "rtl" : "ltr"}>
      
      {/* Tours */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-sm border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
        <div className="flex gap-4 items-start">
          <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-blue-50 text-blue-600">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === "ar" ? "الشروحات التوجيهية (Tours)" : "Page Onboarding Tours"}
            </div>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500 max-w-[400px]">
              {lang === "ar" 
                ? "تعرض سلسلة من الخطوات الإرشادية عند زيارة الصفحات لأول مرة" 
                : "Shows a step-by-step walkthrough automatically on first visit"}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3 border-r border-slate-100 pr-4">
           <span className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest ${toursDisabledGlobally ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
            {toursDisabledGlobally ? (lang === "ar" ? "معطل" : "Disabled") : lang === "ar" ? "مفعل" : "Enabled"}
          </span>
          {!toursDisabledGlobally && (
             <button onClick={disableAllTours} className="flex h-8 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 text-[11px] font-black text-rose-600 shadow-sm transition-all hover:bg-rose-50 hover:border-rose-200 active:scale-95">
               <ShieldOff size={12} />
               {lang === "ar" ? "تعطيل الشروحات" : "Disable"}
             </button>
          )}
        </div>
      </div>

      {/* Tooltips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-sm border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
        <div className="flex gap-4 items-start">
          <div className="mt-0.5 flex shrink-0 h-10 w-10 items-center justify-center rounded-sm bg-violet-50 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === "ar" ? "التلميحات السريعة (Tooltips)" : "Smart Tooltips"}
            </div>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500 max-w-[400px]">
              {lang === "ar" 
                ? "تلميحات نصية تظهر بجانب الحقول المعقدة لتوضيح وظيفتها" 
                : "Shows quick contextual hints near complex fields"}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3 border-r border-slate-100 pr-4">
           <span className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-black uppercase tracking-widest ${tooltipsDisabledGlobally ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
            {tooltipsDisabledGlobally ? (lang === "ar" ? "معطل" : "Disabled") : lang === "ar" ? "مفعل" : "Enabled"}
          </span>
          {!tooltipsDisabledGlobally && (
             <button onClick={disableAllTooltips} className="flex h-8 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 text-[11px] font-black text-rose-600 shadow-sm transition-all hover:bg-rose-50 hover:border-rose-200 active:scale-95">
               <ShieldOff size={12} />
               {lang === "ar" ? "تعطيل التلميحات" : "Disable"}
             </button>
          )}
        </div>
      </div>

      {/* Reset */}
      <div className="flex items-center justify-between gap-4 p-5 rounded-sm border border-amber-200 bg-amber-50/50 transition-all hover:border-amber-300">
         <div className="flex items-center gap-2 text-2sm font-bold text-amber-800">
            <RotateCcw size={16} className="text-amber-600" />
            {lang === "ar" ? "إعادة تعيين وعرض جميع الشروحات التوجيهية للواجهة" : "Reset all tour steps"}
         </div>
         <button onClick={resetAllTours} className="flex h-9 items-center justify-center rounded-sm bg-amber-600 px-5 text-2sm font-black text-white px-6 uppercase tracking-widest hover:bg-amber-700 transition-all active:scale-95 shadow-md">
            إعادة الضبط
         </button>
      </div>

    </div>
  );
}
