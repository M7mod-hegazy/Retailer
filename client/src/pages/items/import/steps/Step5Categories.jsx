import React, { useState, useCallback, useRef, useEffect } from "react";
import { AlertTriangle, CheckCircle2, PencilLine, Save, Wand2, XCircle } from "lucide-react";

export default function Step5Categories({ wizard }) {
  const [draftNames, setDraftNames] = useState({});
  const [savedPrefixes, setSavedPrefixes] = useState(new Set());

  useEffect(() => {
    setDraftNames((prev) => {
      const next = { ...prev };
      wizard.missingSkuCategories.forEach((entry) => {
        const key = entry.prefix;
        if (next[key] === undefined) {
          next[key] = wizard.skuCategoryNames[key] ?? entry.name ?? "";
        }
      });
      return next;
    });
  }, [wizard.missingSkuCategories, wizard.skuCategoryNames]);

  const commitName = useCallback((prefix) => {
    const value = draftNames[prefix] ?? "";
    wizard.setSkuCategoryNames((prev) => ({ ...prev, [prefix]: value }));
    setSavedPrefixes((prev) => new Set(prev).add(prefix));
    setTimeout(() => {
      setSavedPrefixes((prev) => {
        const next = new Set(prev);
        next.delete(prefix);
        return next;
      });
    }, 1200);
  }, [draftNames, wizard]);

  const namedSkuCategories = wizard.missingSkuCategories.filter((entry) => {
    const draft = draftNames[entry.prefix];
    if (draft !== undefined) return String(draft).trim();
    return String(wizard.skuCategoryNames?.[entry.prefix] ?? entry.name ?? "").trim();
  });
  const unnamedSkuCategories = wizard.missingSkuCategories.length - namedSkuCategories.length;
  const canContinueWithNames = namedSkuCategories.length > 0 && !unnamedSkuCategories && !wizard.codelessRows.length;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-text-primary font-display">الفئات والأكواد</h3>
              <p className="mt-1.5 text-sm font-medium text-text-secondary font-title">
                راجع بادئة كل كود. إذا كان اسم الفئة موجودا من الملف فليس مطلوبا تغييره، وسيتم إنشاء الفئة بهذا الاسم وقت المعاينة والتنفيذ.
              </p>
            </div>
            {wizard.missingSkuCategories.length > 0 || wizard.codelessRows.length > 0 ? (
              <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ring-1 ${
                canContinueWithNames
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}>
                {canContinueWithNames ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {unnamedSkuCategories > 0
                  ? `${unnamedSkuCategories} فئة بلا اسم`
                  : wizard.codelessRows.length > 0
                  ? `${wizard.codelessRows.length} صف بلا كود`
                  : "جميع الفئات جاهزة"}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                كل بادئات الأكواد لها فئات موجودة
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["فئات ستنشأ", wizard.missingSkuCategories.length, "text-amber-700", "bg-amber-50"],
              ["لها اسم جاهز", namedSkuCategories.length, "text-emerald-700", "bg-emerald-50"],
              ["صفوف بلا كود", wizard.codelessRows.length, "text-sky-700", "bg-sky-50"],
            ].map(([label, value, color, bg]) => (
              <div key={label} className={`rounded-xl border border-slate-150 ${bg}/60 p-4`}>
                <div className="text-[10px] font-black text-text-muted font-mono">{label}</div>
                <div className={`mt-1 text-2xl font-black ${value > 0 ? color : "text-text-muted"}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-normal bg-bg-overlay/60 p-5 shadow-inner">
          <div className="flex items-center gap-2 text-sm font-black text-text-primary font-title">
            <Wand2 className="h-4.5 w-4.5 text-text-secondary" />
            ماذا سيحدث؟
          </div>
          <div className="mt-4 space-y-3 text-xs font-bold leading-relaxed text-text-secondary">
            <div className="rounded-xl border border-border-normal bg-bg-surface px-4 py-3 shadow-sm">
              1. كل فئة لها اسم ستُنشأ تلقائيا في النظام بالاسم الذي كتبته.
            </div>
            <div className="rounded-xl border border-border-normal bg-bg-surface px-4 py-3 shadow-sm">
              2. الصفوف بدون كود تحتاج اختيار بادئة لتوليد أكواد آمنة تلقائيا.
            </div>
            <div className="rounded-xl border border-border-normal bg-bg-surface px-4 py-3 shadow-sm">
              3. عند النقر على "التالي" أو "معاينة" سيتم حفظ كل الأسماء التي أدخلتها.
            </div>
          </div>
        </div>
      </div>

      {wizard.missingSkuCategories.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {wizard.missingSkuCategories.map((entry) => {
            const draft = draftNames[entry.prefix] !== undefined ? draftNames[entry.prefix] : (wizard.skuCategoryNames[entry.prefix] ?? entry.name ?? "");
            const ready = String(draft || "").trim();
            const justSaved = savedPrefixes.has(entry.prefix);
            return (
              <div key={entry.prefix} className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${ready ? "border-emerald-200 bg-emerald-50/35" : "border-amber-200 bg-amber-50/50"} ${justSaved ? "ring-2 ring-emerald-300 scale-[1.01]" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-text-primary font-display">فئة الكود #{entry.prefix}</div>
                    <div className="mt-0.5 text-xs font-bold text-text-secondary font-mono">{entry.rows.length} صف</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {justSaved ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700 animate-in fade-in zoom-in duration-200">
                        <Save className="h-3 w-3" /> تم الحفظ
                      </span>
                    ) : (
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {ready ? "جاهزة للإنشاء" : "تحتاج اسم"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-text-secondary font-title">
                    <PencilLine className="h-3.5 w-3.5" />
                    اسم الفئة التي ستنشأ
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(event) => setDraftNames((prev) => ({ ...prev, [entry.prefix]: event.target.value }))}
                      onBlur={() => commitName(entry.prefix)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitName(entry.prefix); }}
                      placeholder="اكتب اسم الفئة الجديدة..."
                      className="flex-1 rounded-xl border border-border-normal bg-bg-surface px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-border-strong focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => commitName(entry.prefix)}
                      disabled={!String(draft || "").trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-primary-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Save className="h-3.5 w-3.5" />
                      حفظ
                    </button>
                  </div>
                </div>

                {entry.names.length ? (
                  <div className="mt-3 rounded-xl border border-border-normal/70 bg-bg-surface/80 px-3.5 py-2 text-xs font-bold leading-normal text-text-secondary">
                    أسماء مقترحة من الملف: {entry.names.join("، ")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-250 bg-emerald-50/60 p-5 text-sm font-black text-emerald-800 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          كل بادئات الأكواد لها فئات موجودة. ليست هناك حاجة لإنشاء فئات جديدة.
        </div>
      )}

      {wizard.codelessRows.length ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-sky-950 font-display">صفوف بلا كود صالح</h4>
              <p className="mt-1 text-sm font-medium text-sky-750 font-title">
                وجدنا {wizard.codelessRows.length} صف يحتاج كودا. اختر بادئة فئة وسيتم تعيين تسلسل متاح تلقائيا.
              </p>
            </div>
            <span className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-black text-sky-700 whitespace-nowrap">{wizard.codelessRows.length} صف</span>
          </div>
          <div className="mt-4.5 max-w-md">
            <select
              onChange={(event) => wizard.autoAssignCodes(event.target.value)}
              defaultValue=""
              className="w-full rounded-xl border border-sky-200 bg-bg-surface px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-sky-350 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">اختر بادئة للتعيين التلقائي</option>
              {wizard.systemCategories.filter((category) => category.sku_prefix).map((category) => (
                <option key={category.id} value={category.sku_prefix}>
                  {category.sku_prefix} - {category.name}
                </option>
              ))}
              {wizard.missingSkuCategories.map((entry) => (
                <option key={entry.prefix} value={entry.prefix}>
                  {entry.prefix} - {draftNames[entry.prefix] || wizard.skuCategoryNames[entry.prefix] || entry.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs font-bold text-sky-600">
              <AlertTriangle className="inline h-3 w-3 ml-1" />
              سيتم توليد أكواد مثل <span className="font-mono">1.1, 1.2, ...</span> حسب البادئة المختارة
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
