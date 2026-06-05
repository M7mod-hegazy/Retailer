import React from "react";
import { AlertTriangle, CheckCircle2, PencilLine, Wand2 } from "lucide-react";

export default function Step5Categories({ wizard }) {
  const namedSkuCategories = wizard.missingSkuCategories.filter((entry) => String(wizard.skuCategoryNames?.[entry.prefix] ?? entry.name ?? "").trim());
  const unnamedSkuCategories = wizard.missingSkuCategories.length - namedSkuCategories.length;
  const canContinueWithNames = namedSkuCategories.length > 0 && !unnamedSkuCategories && !wizard.codelessRows.length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-display">الفئات والأكواد SKU</h3>
              <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">
                راجع بادئة كل SKU. إذا كان اسم الفئة موجودا من الملف فليس مطلوبا تغييره، وسيتم إنشاء الفئة بهذا الاسم وقت المعاينة والتنفيذ.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ring-1 ${
              canContinueWithNames || (!wizard.missingSkuCategories.length && !wizard.codelessRows.length)
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}>
              {canContinueWithNames || (!wizard.missingSkuCategories.length && !wizard.codelessRows.length) ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {canContinueWithNames ? "يمكنك المتابعة كما هي" : wizard.codelessRows.length ? "أكواد تحتاج قرار" : "راجع الأسماء"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["فئات ستنشأ", wizard.missingSkuCategories.length, "text-amber-700"],
              ["لها اسم جاهز", namedSkuCategories.length, "text-emerald-700"],
              ["صفوف بلا كود", wizard.codelessRows.length, "text-sky-700"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-slate-150 bg-slate-50/60 p-4">
                <div className="text-[10px] font-black text-slate-400 font-mono">{label}</div>
                <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-inner">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 font-title">
            <Wand2 className="h-4.5 w-4.5 text-slate-500" />
            ماذا سيحدث؟
          </div>
          <div className="mt-4 space-y-3 text-xs font-bold leading-relaxed text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              الفئة ذات الاسم الجاهز يمكن تركها كما هي؛ لن نجبرك على تغييرها.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              الصفوف بدون SKU صالح تحتاج اختيار بادئة حتى نستطيع توليد أكواد آمنة.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              عند المعاينة سيتم إنشاء فئات SKU الناقصة ثم ربط الصفوف بها تلقائيا.
            </div>
          </div>
        </div>
      </div>

      {wizard.missingSkuCategories.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {wizard.missingSkuCategories.map((entry) => {
            const value = wizard.skuCategoryNames[entry.prefix] ?? entry.name;
            const ready = String(value || "").trim();
            return (
              <div key={entry.prefix} className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${ready ? "border-emerald-200 bg-emerald-50/35" : "border-amber-200 bg-amber-50/50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-slate-900 font-display">فئة SKU #{entry.prefix}</div>
                    <div className="mt-0.5 text-xs font-bold text-slate-500 font-mono">{entry.rows.length} صف</div>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                    {ready ? "جاهزة للإنشاء" : "تحتاج اسم"}
                  </span>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-slate-600 font-title">
                    <PencilLine className="h-3.5 w-3.5" />
                    اسم الفئة التي ستنشأ
                  </span>
                  <input
                    value={value}
                    onChange={(event) => wizard.setSkuCategoryNames((prev) => ({ ...prev, [entry.prefix]: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                </label>

                {entry.names.length ? (
                  <div className="mt-3 rounded-xl border border-white/70 bg-white/80 px-3.5 py-2 text-xs font-bold leading-normal text-slate-600">
                    أسماء مقترحة من الملف: {entry.names.join("، ")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-250 bg-emerald-50/60 p-5 text-sm font-black text-emerald-800 shadow-sm">
          كل بادئات SKU لها فئات موجودة.
        </div>
      )}

      {wizard.codelessRows.length ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <h4 className="text-base font-black text-sky-950 font-display">صفوف بلا كود صالح</h4>
          <p className="mt-1 text-sm font-medium text-sky-750 font-title">
            وجدنا {wizard.codelessRows.length} صف يحتاج كودا. اختر بادئة فئة وسيتم تعيين تسلسل متاح تلقائيا.
          </p>
          <div className="mt-4.5 max-w-md">
            <select
              onChange={(event) => wizard.autoAssignCodes(event.target.value)}
              defaultValue=""
              className="w-full rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-sky-350 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">اختر بادئة للتعيين</option>
              {wizard.systemCategories.filter((category) => category.sku_prefix).map((category) => (
                <option key={category.id} value={category.sku_prefix}>
                  {category.sku_prefix} - {category.name}
                </option>
              ))}
              {wizard.missingSkuCategories.map((entry) => (
                <option key={entry.prefix} value={entry.prefix}>
                  {entry.prefix} - {wizard.skuCategoryNames[entry.prefix] || entry.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
