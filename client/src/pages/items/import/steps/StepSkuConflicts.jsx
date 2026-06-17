import React, { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, Info } from "lucide-react";
import StepTable from "../StepTable";
import { normalizeKey } from "../../../../utils/excelImportExport";

const GENERAL_ACTIONS = [
  { value: "skip", label: "عدم استيراد الصفوف المتضاربة", desc: "لا نلمس المنتج الموجود في النظام ولا نستورد الصفوف الجديدة المتضاربة. فقط الصفوف الخالية من التضارب هي التي ستمر." },
  { value: "new_code", label: "إنشاء منتجات جديدة بأكواد جديدة", desc: "كل صف إضافي يُستورد كمنتج جديد برمز مختلف. العدد الإجمالي للمنتجات المستوردة سيزداد." },
  { value: "stock_current", label: "إضافة الكميات فقط للمنتج الموجود", desc: "الصفوف الإضافية تزيد رصيد المنتج الموجود فقط. لا تنشئ منتجات جديدة ولا تُغير بياناته." },
];

const SYSTEM_HANDLING_OPTIONS = [
  { value: "keep_current", label: "الإبقاء كما هو", desc: "لا تغير بيانات الصنف الموجود" },
  { value: "replace_current", label: "الكتابة من الملف", desc: "استبدال الاسم والأسعار وغيرها ببيانات صف الحافظ" },
  { value: "move_current_code", label: "تحرير رمزه", desc: "إعطاء الصنف الموجود رمزا جديدا. يأخذ صف الملف الرمز الأصلي" },
];

const ROW_OPTIONS = [
  { value: "skip", label: "تخطي", desc: "لا تستورد هذا الصف" },
  { value: "new_code", label: "كود جديد", desc: "إنشاء كمنتج جديد برمز مختلف" },
  { value: "stock_current", label: "مخزون فقط", desc: "إضافة كمية للصنف الموجود، لا منتج جديد" },
];

function defaultKeeper(conflict, planByCode) {
  const plan = planByCode[conflict.code];
  if (plan?.keepRowNumber) return conflict.rows.find((r) => r.__rowNumber === plan.keepRowNumber) || null;
  if (conflict.existing) return conflict.rows.find((r) => normalizeKey(r.name) === normalizeKey(conflict.existing.name)) || null;
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
    return { keeper, systemHandling: plan.systemHandling || (conflict.existing ? "keep_current" : null), rowOverrides: plan.rowOverrides || {}, ...plan };
  };

  const effectiveAction = (conflict, row) => {
    const plan = planFor(conflict);
    if (row.__rowNumber === plan.keeper?.__rowNumber) return "keeper";
    return plan.rowOverrides?.[row.__rowNumber] || generalAction;
  };

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  function setConflictPlan(code, patch) {
    setPlanByCode((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), ...patch } }));
    setApplied(false);
  }

  function setRowAction(code, rowNumber, action) {
    setPlanByCode((prev) => {
      const current = prev[code] || {};
      const rowOverrides = { ...(current.rowOverrides || {}), [rowNumber]: action };
      return { ...prev, [code]: { ...current, rowOverrides } };
    });
    setApplied(false);
  }

  function applyBulkPreset(mode) {
    const presets = {};
    conflicts.forEach((conflict) => {
      const keeper = mode === "system" && conflict.existing
        ? conflict.rows.find((r) => normalizeKey(r.name) === normalizeKey(conflict.existing.name)) || conflict.rows[0]
        : conflict.rows[0];
      presets[conflict.code] = {
        keepRowNumber: keeper?.__rowNumber,
        systemHandling: conflict.existing ? (mode === "file" ? "replace_current" : "keep_current") : null,
        rowOverrides: {},
      };
    });
    setPlanByCode(presets);
    setApplied(false);
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
      const allowTakeover = Boolean(conflict.existing && plan.systemHandling === "replace_current" && normalizeKey(keeper.name) !== normalizeKey(conflict.existing.name));
      return {
        code: conflict.code,
        keepRowNumber: keeper.__rowNumber,
        currentHandling: plan.systemHandling || "keep_current",
        allowTakeover,
        otherActions: Object.keys(otherActions).length ? otherActions : undefined,
      };
    }).filter(Boolean);
    wizard.applySkuConflictPlan(plans);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  }

  const resolved = applied || !conflicts.length;
  const overriddenCount = conflicts.filter((c) => {
    const plan = planByCode[c.code];
    return plan && Object.keys(plan.rowOverrides || {}).length > 0;
  }).length;

  const actionCounts = useMemo(() => {
    const counts = { skip: 0, new_code: 0, stock_current: 0 };
    conflicts.forEach((conflict) => {
      const plan = planFor(conflict);
      conflict.rows.forEach((row) => {
        if (row.__rowNumber === plan.keeper?.__rowNumber) return;
        const action = plan.rowOverrides?.[row.__rowNumber] || generalAction;
        counts[action] = (counts[action] || 0) + 1;
      });
    });
    return counts;
  }, [conflicts, planByCode, generalAction]);

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
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-display">تضارب الأكواد</h3>
              <p className="mt-1.5 text-sm font-bold text-slate-500 font-title">
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
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{conflicts.length} الإجمالي</span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">{Object.keys(planByCode).length} مخطط</span>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">{overriddenCount} معدل</span>
          </div>
        </div>

        <div className="grid gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          <button
            type="button"
            onClick={() => applyBulkPreset("system")}
            disabled={!conflicts.length}
            className="rounded-xl bg-primary py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-600 active:scale-[0.98] disabled:opacity-40"
          >
            الإبقاء على عنصر النظام، رموز جديدة للباقي
          </button>
          <button
            type="button"
            onClick={() => applyBulkPreset("file")}
            disabled={!conflicts.length}
            className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40"
          >
            الكتابة من الملف، رموز جديدة للباقي
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            الإعدادات المسبقة تملأ الخطط فقط. لا يزال بإمكانك تعديل الصفوف الفردية أدناه.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-base font-black text-slate-900 font-display mb-4">قاعدة عامة لجميع التضاربات</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {GENERAL_ACTIONS.map((action) => {
            const active = generalAction === action.value;
            const count = actionCounts[action.value] || 0;
            return (
              <button
                key={action.value}
                type="button"
                onClick={() => setGeneralAction(action.value)}
                className={`rounded-xl border p-4 text-right transition-all duration-200 text-sm ${
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-900">{action.label}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-black tabular-nums ${
                    active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">{action.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 text-xs font-bold text-slate-600">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>كل تضارب يحتفظ بصف واحد كحافظ. تستخدم الصفوف الإضافية القاعدة العامة أعلاه. يمكنك تعديل الصفوف الفردية أدناه.</span>
          </div>
          <button
            type="button"
            onClick={applyPlans}
            disabled={!conflicts.length}
            className="shrink-0 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-40 inline-flex items-center gap-2"
          >
            {applied ? <CheckCircle2 className="h-4 w-4" /> : null}
            تطبيق على {conflicts.length} تضارب
          </button>
        </div>
        {applied ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-200 animate-in fade-in zoom-in-75 duration-200">
            <CheckCircle2 className="h-4 w-4" />
            تم تطبيق القرارات بنجاح
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex w-full items-center justify-between gap-3 px-5 py-4.5 text-sm font-black text-slate-700 hover:bg-slate-50 transition"
        >
          <span>{expanded ? "إخفاء التفاصيل" : "إظهار التفاصيل"} — تعديل قرارات التضارب الفردية</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {expanded && (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {conflicts.map((conflict) => {
              const plan = planFor(conflict);
              const keeper = plan.keeper;
              if (!keeper) return null;
              const hasOverrides = Object.keys(plan.rowOverrides || {}).length > 0;
              const sysItem = conflict.existing;

              return (
                <div key={conflict.code} className={`p-5 transition-all duration-300 ${hasOverrides ? "bg-amber-50/30 ring-1 ring-inset ring-amber-100" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black text-slate-950">كود {conflict.code}</span>
                      {hasOverrides && (
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">معدل</span>
                      )}
                    </div>
                    {sysItem ? (
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 font-mono">
                        في النظام: {sysItem.name}
                      </span>
                    ) : null}
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
                                <span className="font-black text-slate-900">{row.name}</span>
                                <span className="text-xs font-bold text-slate-500 font-mono">صف {row.__rowNumber}</span>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                                يحتفظ بهذا الكود
                              </span>
                            </div>
                            <div className="mt-1.5 text-xs font-bold text-slate-500">الكمية: {Number(row.stock_quantity || 0)}</div>
                          </div>
                        );
                      }

                      const isOverridden = plan.rowOverrides?.[row.__rowNumber] !== undefined;
                      return (
                        <div key={row.__rowNumber} className={`rounded-xl border p-3.5 transition-all ${
                          isOverridden ? "border-amber-200 bg-amber-50/40 ring-1 ring-amber-100" : "border-slate-100 bg-white"
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-slate-900 truncate">{row.name}</span>
                                <span className="text-xs font-bold text-slate-500 font-mono shrink-0">صف {row.__rowNumber}</span>
                              </div>
                              <div className="text-xs font-bold text-slate-500 mt-0.5">الكمية: {Number(row.stock_quantity || 0)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isOverridden ? (
                                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">معدل</span>
                              ) : null}
                              <select
                                value={action}
                                onChange={(e) => setRowAction(conflict.code, row.__rowNumber, e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black outline-none focus:border-slate-900 min-w-[110px]"
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

                  {sysItem && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-slate-500 mb-2">مصير عنصر النظام</div>
                          <div className="flex flex-wrap gap-2">
                            {SYSTEM_HANDLING_OPTIONS.map((opt) => {
                              const active = (plan.systemHandling || "keep_current") === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setConflictPlan(conflict.code, { systemHandling: opt.value })}
                                  className={`rounded-xl border px-3.5 py-2 text-xs font-black transition-all ${
                                    active
                                      ? "border-primary bg-primary text-white shadow-sm"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                                  title={opt.desc}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-slate-500 max-w-[200px] text-left">
                          {SYSTEM_HANDLING_OPTIONS.find((o) => o.value === (plan.systemHandling || "keep_current"))?.desc}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {["sale_price", "purchase_price"].map((field) => {
                          const fileVal = Number(keeper[field] ?? 0);
                          const sysVal = Number(sysItem[field] ?? 0);
                          if (fileVal === sysVal) return null;
                          return (
                            <div key={field} className="rounded-xl border border-amber-200/60 bg-amber-50/40 px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm">
                              {field === "sale_price" ? "سعر البيع" : "سعر الشراء"}: {sysVal} ← {fileVal}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
