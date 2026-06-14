import React, { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import StepTable from "../StepTable";
import { normalizeKey } from "../../../../utils/excelImportExport";

const OTHER_ACTION_LABELS = {
  new_code: "صنف جديد بكود جديد",
  skip: "تخطي هذا الصف",
  stock_current: "مخزون فقط للصنف الحالي",
};

export default function StepSkuConflicts({ wizard }) {
  const conflicts = wizard.fileSkuConflicts || [];
  const [plans, setPlans] = useState({});
  const [applied, setApplied] = useState(false);
  const conflictRows = useMemo(() => {
    const byRow = new Map();
    conflicts.forEach((conflict) => conflict.rows.forEach((row) => byRow.set(row.__rowNumber, row)));
    return [...byRow.values()];
  }, [conflicts]);

  function defaultKeepRow(conflict, mode = "system") {
    if (mode === "system" && conflict.existing) {
      return conflict.rows.find((row) => normalizeKey(row.name) === normalizeKey(conflict.existing.name)) || null;
    }
    return conflict.rows[0];
  }

  function planFor(conflict) {
    const existing = plans[conflict.code];
    const keepRow = conflict.rows.find((row) => String(row.__rowNumber) === String(existing?.keepRowNumber)) || defaultKeepRow(conflict, "system");
    return {
      keepRowNumber: keepRow?.__rowNumber,
      currentHandling: existing?.currentHandling || (conflict.existing ? "keep_current" : "file_keeps_code"),
      otherActions: existing?.otherActions || {},
    };
  }

  function setPlan(code, patch) {
    setPlans((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), ...patch } }));
    setApplied(false);
  }

  function setOtherAction(code, rowNumber, action) {
    setPlans((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        otherActions: { ...(prev[code]?.otherActions || {}), [rowNumber]: action },
      },
    }));
    setApplied(false);
  }

  function applyBulkPreset(mode) {
    const next = {};
    conflicts.forEach((conflict) => {
      const keep = defaultKeepRow(conflict, mode);
      const currentHandling = conflict.existing ? (mode === "file" ? "replace_current" : "keep_current") : "file_keeps_code";
      const otherActions = {};
      conflict.rows.forEach((row) => {
        if (row.__rowNumber !== keep?.__rowNumber) otherActions[row.__rowNumber] = "new_code";
      });
      next[conflict.code] = { keepRowNumber: keep?.__rowNumber || "", currentHandling, otherActions };
    });
    setPlans(next);
    setApplied(false);
  }

  function applyPlans() {
    wizard.applySkuConflictPlan(conflicts.map((conflict) => {
      const plan = planFor(conflict);
      const systemRow = conflict.existing ? defaultKeepRow(conflict, "system") : null;
      const keepRowNumber = conflict.existing && plan.currentHandling === "keep_current" ? systemRow?.__rowNumber || null : plan.keepRowNumber;
      const keepRow = conflict.rows.find((row) => row.__rowNumber === keepRowNumber);
      return {
        code: conflict.code,
        keepRowNumber,
        currentHandling: plan.currentHandling,
        allowTakeover: Boolean(conflict.existing && plan.currentHandling === "replace_current" && normalizeKey(keepRow?.name) !== normalizeKey(conflict.existing.name)),
        otherActions: plan.otherActions,
      };
    }));
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }

  const hasResolvedConflicts = conflicts.length > 0 && wizard.fileSkuConflicts.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-display">تعارض أكواد SKU</h3>
              <p className="mt-1.5 text-sm font-bold text-slate-500 font-title">
                اختر الصف الذي سيحتفظ بالكود، ثم قرر ماذا يحدث لباقي الصفوف: كود جديد، تخطي، أو مخزون فقط للصنف الحالي.
              </p>
            </div>
            {hasResolvedConflicts ? (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                تم حل جميع التعارضات
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                <AlertTriangle className="h-4 w-4" />
                {conflicts.length} كود يحتاج قرارا
              </div>
            )}
          </div>
          {applied && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-200 animate-in fade-in zoom-in-75 duration-200">
              <CheckCircle2 className="h-4 w-4" />
              تم تطبيق القرارات بنجاح
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          <button type="button" onClick={() => applyBulkPreset("system")} disabled={!conflicts.length} className="rounded-xl bg-primary py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-600 active:scale-[0.98] disabled:opacity-40">
            ابدأ بإبقاء الصنف الحالي
          </button>
          <button type="button" onClick={() => applyBulkPreset("file")} disabled={!conflicts.length} className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40">
            ابدأ بإبقاء أول صف من الملف
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            هذه الأزرار تملأ الخطة فقط. يمكنك تعديل قرار كل صف قبل التطبيق.
          </div>
          <button type="button" onClick={applyPlans} disabled={!conflicts.length} className="rounded-xl bg-emerald-700 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {applied ? <CheckCircle2 className="h-4 w-4" /> : null}
            تطبيق قرارات التعارضات
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {conflicts.map((conflict) => {
          const plan = planFor(conflict);
          const systemRow = conflict.existing ? defaultKeepRow(conflict, "system") : null;
          const effectiveKeepRowNumber = conflict.existing && plan.currentHandling === "keep_current" ? systemRow?.__rowNumber || null : plan.keepRowNumber;
          const keepRow = conflict.rows.find((row) => row.__rowNumber === effectiveKeepRowNumber);
          const replacesSystem = Boolean(conflict.existing && plan.currentHandling === "replace_current" && normalizeKey(keepRow?.name) !== normalizeKey(conflict.existing.name));
          const movesSystemCode = Boolean(conflict.existing && plan.currentHandling === "move_current_code");
          const isResolved = applied;
          return (
            <div key={conflict.code} className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${isResolved ? "border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-100" : "border-rose-200 bg-rose-50/60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-slate-950 font-display">SKU {conflict.code}</span>
                  {isResolved ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> تم الحل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">
                      <AlertTriangle className="h-3 w-3" /> يحتاج قرار
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-500">الصفوف: {conflict.rows.map((row) => row.__rowNumber).join("، ")}</p>

              <div className="grid gap-4 mt-4 xl:grid-cols-[1fr_360px]">
                <div>
                  {conflict.existing ? (
                    <p className="rounded-xl bg-white/80 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100">
                      الصنف الحالي في النظام: {conflict.existing.name}
                    </p>
                  ) : null}
                  {conflict.existing && plan.currentHandling === "keep_current" && !systemRow ? (
                    <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black leading-normal text-emerald-800 ring-1 ring-emerald-100">
                      سيتم إبقاء صنف النظام كما هو، وكل صفوف الملف لهذا الكود ستأخذ قرارا من القائمة بالأسفل.
                    </p>
                  ) : null}
                  {replacesSystem ? (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black leading-normal text-amber-800 ring-1 ring-amber-100">
                      تنبيه: سيتم تحديث نفس الصنف الموجود في النظام. أي فواتير أو حركات قديمة ستبقى مرتبطة بنفس رقم الصنف، وقد تظهر باسم/كود الصف الجديد.
                    </p>
                  ) : null}
                  {movesSystemCode ? (
                    <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black leading-normal text-emerald-800 ring-1 ring-emerald-100">
                      سيتم إعطاء الصنف الحالي كودا جديدا أولا، ثم إنشاء صف الملف بالكود الأصلي. السجلات القديمة ستبقى على الصنف القديم.
                    </p>
                  ) : null}
                </div>

                <div>
                  {conflict.existing ? (
                    <>
                      <label className="mb-1.5 block text-xs font-black text-slate-600">مصير الصنف الحالي في النظام</label>
                      <select
                        value={plan.currentHandling}
                        onChange={(event) => setPlan(conflict.code, { currentHandling: event.target.value })}
                        className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-black outline-none shadow-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                      >
                        <option value="keep_current">إبقاء الصنف الحالي بدون تغيير بياناته</option>
                        <option value="move_current_code">إعطاء الصنف الحالي كودا جديدا ثم استخدام الكود للملف</option>
                        <option value="replace_current">تحديث الصنف الحالي من صف في الملف</option>
                        <option disabled value="delete_current">حذف الصنف الحالي غير متاح لأنه قد يملك سجلات</option>
                      </select>
                    </>
                  ) : null}
                  {(!conflict.existing || plan.currentHandling === "replace_current" || plan.currentHandling === "move_current_code") ? (
                    <div className={conflict.existing ? "mt-3" : ""}>
                      <label className="mb-1.5 block text-xs font-black text-slate-600">{conflict.existing && plan.currentHandling === "replace_current" ? "صف الملف الذي سيحدث الصنف الحالي" : "صف الملف الذي سيستخدم الكود الأصلي"}</label>
                      <select value={plan.keepRowNumber || ""} onChange={(event) => setPlan(conflict.code, { keepRowNumber: Number(event.target.value) })} className="w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm font-black outline-none shadow-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                        {conflict.rows.map((row) => (
                          <option key={row.__rowNumber} value={row.__rowNumber}>صف {row.__rowNumber} - {row.name} - كمية {Number(row.stock_quantity || 0)}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {conflict.rows.map((row) => {
                  const active = row.__rowNumber === effectiveKeepRowNumber;
                  const action = plan.otherActions[row.__rowNumber] || "new_code";
                  const canStockCurrent = Boolean(conflict.existing && plan.currentHandling !== "move_current_code");
                  return (
                    <div key={row.__rowNumber} className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 ${active ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-100"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-900">{row.name}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">صف {row.__rowNumber} - كمية {Number(row.stock_quantity || 0)}</div>
                        </div>
                        {active ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> يحتفظ بالكود
                          </span>
                        ) : null}
                      </div>
                      {!active ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-[10px] font-black text-slate-500">ماذا يحدث لهذا الصف؟</label>
                          <select value={action} onChange={(event) => setOtherAction(conflict.code, row.__rowNumber, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black outline-none focus:border-slate-900">
                            <option value="new_code">{OTHER_ACTION_LABELS.new_code}</option>
                            <option value="skip">{OTHER_ACTION_LABELS.skip}</option>
                            {canStockCurrent ? <option value="stock_current">{OTHER_ACTION_LABELS.stock_current}</option> : null}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <StepTable
        wizard={wizard}
        rows={conflictRows}
        columns={["code", "name", "stock_quantity", "unit_name", "warehouse_id"]}
        title="صفوف تعارض SKU"
        helper="هذه الصفوف لن تمر للخطوات التالية حتى تضغط تطبيق قرارات التعارضات."
        showActions={false}
        height={320}
      />
    </div>
  );
}
