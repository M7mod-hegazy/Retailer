import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Eye, Link2, MinusCircle } from "lucide-react";

function sampleValues(wizard, columnIndex) {
  return (wizard.rawRows || [])
    .slice((wizard.headerIndex || 0) + 1, (wizard.headerIndex || 0) + 7)
    .map((row) => row?.[columnIndex])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .slice(0, 4);
}

export default function Step2Columns({ wizard }) {
  const mappedFields = useMemo(() => Object.values(wizard.mapping).filter(Boolean), [wizard.mapping]);
  const mappedName = mappedFields.includes("name");
  const mappedCount = mappedFields.length;
  const totalColumns = wizard.headers.length || 0;
  const ignoredColumns = Math.max(0, totalColumns - mappedCount);
  const confidence = Math.max(0, Math.min(100, wizard.importStats.confidence || 0));
  const usefulIgnored = wizard.headers.filter((header, index) => !wizard.mapping[index] && sampleValues(wizard, index).length).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-display">معاينة وربط أعمدة الملف</h3>
              <p className="mt-1 text-sm font-medium text-slate-500 font-title">
                راجع كل عمود قبل المتابعة. أي عمود تختار له "غير مستورد" لن يدخل في عملية الاستيراد.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ring-1 transition-all ${
              mappedName 
                ? "bg-emerald-50 text-emerald-700 ring-emerald-250/30" 
                : "bg-rose-50 text-rose-700 ring-rose-250/30 animate-pulse"
            }`}>
              {mappedName ? <CheckCircle2 className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
              {mappedName ? "اسم الصنف مربوط" : "اسم الصنف مطلوب"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              ["الأعمدة", totalColumns, "text-slate-900"],
              ["المربوط", mappedCount, "text-emerald-700"],
              ["غير مستورد", ignoredColumns, "text-slate-500"],
              ["ثقة الربط", `${confidence}%`, "text-indigo-650"],
            ].map(([label, value, colorClass]) => (
              <div key={label} className="rounded-xl border border-slate-150 bg-slate-50/60 p-4 transition-all duration-200 hover:bg-slate-50">
                <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{label}</div>
                <div className={`mt-1.5 text-2xl font-black ${colorClass}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${mappedName ? "bg-gradient-to-r from-emerald-555 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-amber-400"}`} 
              style={{ width: `${confidence}%` }} 
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-inner">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 font-title">
            <Eye className="h-4.5 w-4.5 text-slate-500" />
            ملخص ما سيحدث
          </div>
          <div className="mt-4 space-y-3 text-sm font-semibold text-slate-650">
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">سيتم قراءة البيانات بعد صف العناوين رقم {(wizard.headerIndex || 0) + 1}.</div>
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">ربط عمود جديد بنفس الحقل ينقل الربط إليه تلقائيا ويزيل الربط القديم.</div>
            <div className={`rounded-xl border px-4 py-3 shadow-sm transition-all duration-300 ${usefulIgnored ? "border-amber-250 bg-amber-50/70 text-amber-800" : "border-slate-200/60 bg-white"}`}>
              {usefulIgnored ? `${usefulIgnored} عمود يحتوي بيانات لكنه غير مستورد. راجعه قبل المتابعة.` : "لا توجد أعمدة ذات بيانات واضحة متروكة بدون ربط."}
            </div>
          </div>
        </div>
      </div>

      {!mappedName ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-250 bg-rose-50/80 px-5 py-4 text-sm font-black text-rose-800 shadow-sm backdrop-blur-sm animate-bounce">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <span>عمود اسم الصنف مطلوب. اربط أحد أعمدة الملف بحقل اسم الصنف للمتابعة.</span>
        </div>
      ) : null}

      <div className="grid gap-3.5">
        {wizard.headers.map((header, index) => {
          const field = wizard.mapping[index] || "";
          const samples = sampleValues(wizard, index);
          const selectedField = wizard.ITEM_FIELDS.find((itemField) => itemField.key === field);
          const hasUsefulData = samples.length > 0;

          return (
            <div 
              key={`${header}-${index}`} 
              className={`rounded-2xl border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                field 
                  ? "border-emerald-250 ring-1 ring-emerald-50/40" 
                  : hasUsefulData 
                  ? "border-amber-250 ring-1 ring-amber-50/40" 
                  : "border-slate-200 hover:border-slate-350"
              }`}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black font-mono text-slate-500">عمود {index + 1}</span>
                    <h4 className="truncate text-base font-black text-slate-900 font-display">{header || `بدون عنوان ${index + 1}`}</h4>
                    {field ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200/50 shadow-sm">
                        <Link2 className="h-3.5 w-3.5" /> {selectedField?.label || field}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                        <MinusCircle className="h-3.5 w-3.5" /> غير مستورد
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
                    {samples.length ? samples.map((sample, sampleIndex) => (
                      <div key={`${sampleIndex}-${sample}`} className="min-h-[44px] rounded-xl border border-slate-150 bg-slate-50/40 px-3 py-2.5 text-xs font-bold text-slate-650 transition hover:bg-slate-50">
                        <div className="text-[9px] font-black text-slate-400 font-mono tracking-wide">عينة {sampleIndex + 1}</div>
                        <div className="mt-1 truncate font-mono text-slate-700" title={String(sample)}>{String(sample)}</div>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-3 text-xs font-bold text-slate-400 md:col-span-4 text-center">لا توجد عينات واضحة في أول الصفوف.</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-center border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:border-r lg:pr-4">
                  <label className="mb-1.5 block text-xs font-black text-slate-500 font-title">حقل النظام</label>
                  <select 
                    value={field} 
                    onChange={(event) => wizard.updateMapping(index, event.target.value)} 
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-350 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">غير مستورد</option>
                    {wizard.ITEM_FIELDS.map((itemField) => <option key={itemField.key} value={itemField.key}>{itemField.label}</option>)}
                  </select>
                  <div className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition-all ${
                    field 
                      ? "bg-emerald-50/70 text-emerald-700 ring-emerald-100/50" 
                      : hasUsefulData 
                      ? "bg-amber-50/70 text-amber-700 ring-amber-100/50" 
                      : "bg-slate-50 text-slate-400 ring-slate-100"
                  }`}>
                    {field ? `سيستخدم كحقل: ${selectedField?.label || field}` : hasUsefulData ? "هذا العمود سيترك خارج الاستيراد." : "يمكن تركه خارج الاستيراد."}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
