import React, { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, Info } from "lucide-react";
import StepTable from "../StepTable";


const GENERAL_ACTIONS = [
  { value: "new_code", label: "إنشاء منتجات بأكواد جديدة", desc: "كل صف إضافي يُستورد كمنتج جديد برمز مختلف. الحافظ يحتفظ بكوده." },
  { value: "skip", label: "تخطي الصفوف الإضافية", desc: "الحافظ فقط يمر. الصفوف الإضافية لا تُستورد." },
];

const ROW_OPTIONS = [
  { value: "new_code", label: "كود جديد", desc: "يُستورد هذا الصف برمز جديد" },
  { value: "skip", label: "تخطي", desc: "لا يُستورد هذا الصف" },
];

function defaultKeeper(conflict, planByCode) {
  const plan = planByCode[conflict.code];
  if (plan?.keepRowNumber) return conflict.rows.find((r) => r.__rowNumber === plan.keepRowNumber) || null;
  return conflict.rows[0] || null;
}

export default function StepSkuConflicts({ wizard }) {
  const conflicts = wizard.fileSkuConflicts || [];
  const [generalAction, setGeneralAction] = useState("new_code");
  const [planByCode, setPlanByCode] = useState({});
  const [applied, setApplied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const planFor = (conflict) => {
    const plan = planByCode[conflict.code] || {};
    const keeper = defaultKeeper(conflict, planByCode);
    return { keeper, rowOverrides: plan.rowOverrides || {}, ...plan };
  };

  const effectiveAction = (conflict, row) => {
    const plan = planFor(conflict);
    if (row.__rowNumber === plan.keeper?.__rowNumber) return "keeper";
    return plan.rowOverrides?.[row.__rowNumber] || generalAction;
  };

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  function setRowAction(code, rowNumber, action) {
    setPlanByCode((prev) => {
      const current = prev[code] || {};
      const rowOverrides = { ...(current.rowOverrides || {}), [rowNumber]: action };
      return { ...prev, [code]: { ...current, rowOverrides } };
    });
    setApplied(false);
    wizard.setSkuConflictsResolved(false);
  }

  function applyPlans() {
    const plans = conflicts.map((conflict) => {
      const plan = planFor(conflict);
      const keeper = plan.keeper;
      if (!keeper) return null;
      const otherActions = {};
      conflict.rows.forEach((row) => {
        if (row.__rowNumber === keeper.__rowNumber) return;
        const action = plan.rowOverrides?.[row.__rowNumber] || generalAction;
        if (action !== "new_code") otherActions[row.__rowNumber] = action;
      });
      return {
        code: conflict.code,
        keepRowNumber: keeper.__rowNumber,
        otherActions: Object.keys(otherActions).length ? otherActions : undefined,
      };
    }).filter(Boolean);
    wizard.applySkuConflictPlan(plans);
    setApplied(true);
  }

  const resolved = applied || !conflicts.length;

  const totalNonKeeperRows = useMemo(() => {
    return conflicts.reduce((sum, conflict) => {
      const keeper = planFor(conflict).keeper;
      return sum + conflict.rows.filter((r) => r.__rowNumber !== keeper?.__rowNumber).length;
    }, 0);
  }, [conflicts, planByCode]);

  const actionProjections = useMemo(() => {
    return {
      skip: { skipped: totalNonKeeperRows, newProducts: 0 },
      new_code: { skipped: 0, newProducts: totalNonKeeperRows },
    };
  }, [totalNonKeeperRows]);

  if (!conflicts.length) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm font-black text-emerald-800 shadow-sm flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        لم يتم العثور على تضارب في الأكواد. جميع الرموز فريدة.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-rose-200 bg-bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-text-primary font-display">تضارب الأكواد</h3>
            <p className="mt-1.5 text-sm font-bold text-text-secondary font-title">
              {conflicts.length} كود مشترك بين عدة صفوف في ملفك.
            </p>
          </div>
          {resolved ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> تم الحل
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100">
              <AlertTriangle className="h-4 w-4" /> {conflicts.length} تحتاج قرار
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-sm">
        <h4 className="text-base font-black text-text-primary font-display mb-4">قاعدة عامة لجميع التضاربات</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {GENERAL_ACTIONS.map((action) => {
            const active = generalAction === action.value;
            const proj = actionProjections[action.value];
            return (
              <button
                key={action.value}
                type="button"
                onClick={() => { setGeneralAction(action.value); setApplied(false); wizard.setSkuConflictsResolved(false); }}
                className={`rounded-xl border p-4 text-right transition-all duration-200 text-sm ${
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-border-normal bg-bg-surface hover:border-border-strong hover:shadow-sm"
                }`}
              >
                <div className="font-black text-text-primary">{action.label}</div>
                <div className="mt-1 text-xs font-semibold text-text-secondary leading-relaxed">{action.desc}</div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-black">
                  {proj.skipped > 0 && (
                    <span className={`rounded-lg px-2 py-0.5 tabular-nums ${
                      active ? "bg-amber-100 text-amber-700" : "bg-bg-overlay text-text-secondary"
                    }`}>
                      متخطى {proj.skipped}
                    </span>
                  )}
                  {proj.newProducts > 0 && (
                    <span className={`rounded-lg px-2 py-0.5 tabular-nums ${
                      active ? "bg-emerald-100 text-emerald-700" : "bg-bg-overlay text-text-secondary"
                    }`}>
                      جديد {proj.newProducts}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {!applied ? (
            <button
              type="button"
              onClick={applyPlans}
              className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]"
            >
              تأكيد الاختيار
            </button>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                تم تطبيق القرارات بنجاح
              </div>
              <button
                type="button"
                onClick={() => { setApplied(false); wizard.setSkuConflictsResolved(false); }}
                className="rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-sm font-black text-text-primary shadow-sm transition hover:bg-bg-overlay active:scale-[0.98]"
              >
                تغيير الاختيار
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-normal bg-bg-overlay/60 p-4.5 shadow-inner">
        <div className="flex items-start gap-2 text-xs font-bold text-text-secondary">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>كل تضارب يحتفظ بصف واحد كحافظ. تستخدم الصفوف الإضافية القاعدة العامة أعلاه. يمكنك تعديل الصفوف الفردية أدناه.</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border-normal bg-bg-surface overflow-hidden">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex w-full items-center justify-between gap-3 px-5 py-4.5 text-sm font-black text-text-primary hover:bg-bg-overlay transition"
        >
          <span>{expanded ? "إخفاء التفاصيل" : "إظهار التفاصيل"} — تعديل قرارات التضارب الفردية</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {expanded && (
          <div className="divide-y divide-border-subtle border-t border-border-subtle">
            {conflicts.map((conflict) => {
              const plan = planFor(conflict);
              const keeper = plan.keeper;
              if (!keeper) return null;
              const hasOverrides = Object.keys(plan.rowOverrides || {}).length > 0;

              return (
                <div key={conflict.code} className={`p-5 transition-all duration-300 ${hasOverrides ? "bg-amber-50/30 ring-1 ring-inset ring-amber-100" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-slate-950">كود {conflict.code}</span>
                      {hasOverrides && (
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">معدل</span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {conflict.rows.map((row) => {
                      const isKeeper = row.__rowNumber === keeper.__rowNumber;
                      const action = effectiveAction(conflict, row);

                      if (isKeeper) {
                        return (
                          <div key={row.__rowNumber} className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-3.5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                                <span className="font-black text-text-primary">{row.name}</span>
                                <span className="text-xs font-bold text-text-secondary font-mono">صف {row.__rowNumber}</span>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                                يحتفظ بهذا الكود
                              </span>
                            </div>
                            <div className="mt-1.5 text-xs font-bold text-text-secondary">الكمية: {Number(row.stock_quantity || 0)}</div>
                          </div>
                        );
                      }

                      const isOverridden = plan.rowOverrides?.[row.__rowNumber] !== undefined;
                      return (
                        <div key={row.__rowNumber} className={`rounded-xl border p-3.5 transition-all ${
                          isOverridden ? "border-amber-200 bg-amber-50/40 ring-1 ring-amber-100" : "border-border-subtle bg-bg-surface"
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-text-primary truncate">{row.name}</span>
                                <span className="text-xs font-bold text-text-secondary font-mono shrink-0">صف {row.__rowNumber}</span>
                              </div>
                              <div className="text-xs font-bold text-text-secondary mt-0.5">الكمية: {Number(row.stock_quantity || 0)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isOverridden ? (
                                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">معدل</span>
                              ) : null}
                              <select
                                value={action}
                                onChange={(e) => setRowAction(conflict.code, row.__rowNumber, e.target.value)}
                                className="rounded-xl border border-border-normal bg-bg-surface px-3 py-2 text-xs font-black outline-none focus:border-slate-900 min-w-[110px]"
                              >
                                {ROW_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      <StepTable
        wizard={wizard}
        rows={conflicts.flatMap((c) => c.rows)}
        columns={["code", "name", "stock_quantity", "unit_name", "warehouse_id"]}
        title="صفوف تضارب الأكواد"
        helper="يجب حل هذه الصفوف قبل المتابعة إلى الخطوات التالية."
        showActions={false}
        height={320}
      />
    </div>
  );
}
