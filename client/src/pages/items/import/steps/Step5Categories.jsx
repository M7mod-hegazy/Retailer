import React from "react";

export default function Step5Categories({ wizard }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 font-display">الفئات والأكواد SKU</h3>
        <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">كل بادئة SKU تمثل فئة. يمكنك تسمية الفئات الجديدة أو تعيين أكواد للصفوف التي لا تحتوي كودا صالحا.</p>
      </div>

      {wizard.missingSkuCategories.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {wizard.missingSkuCategories.map((entry) => (
            <div key={entry.prefix} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-black text-amber-900 font-display">فئة #{entry.prefix}</div>
                  <div className="mt-0.5 text-xs font-bold text-amber-700 font-mono">{entry.rows.length} صف</div>
                </div>
                {entry.names.length > 1 ? (
                  <span className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-200/30">
                    أكثر من اسم في الملف
                  </span>
                ) : null}
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-black text-slate-500 font-title">اسم الفئة التي ستنشأ</span>
                <input 
                  value={wizard.skuCategoryNames[entry.prefix] ?? entry.name} 
                  onChange={(event) => wizard.setSkuCategoryNames((prev) => ({ ...prev, [entry.prefix]: event.target.value }))} 
                  className="w-full rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-amber-350 focus:border-amber-600 focus:ring-4 focus:ring-amber-100" 
                />
              </label>
              {entry.names.length ? (
                <div className="mt-3 text-xs font-bold text-amber-800 font-title leading-normal">
                  أسماء الملف: {entry.names.join("، ")}
                </div>
              ) : null}
            </div>
          ))}
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
                  {entry.prefix} - {entry.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
