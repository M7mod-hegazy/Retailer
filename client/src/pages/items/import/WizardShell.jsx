import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Database, Loader2 } from "lucide-react";
import Step1Upload from "./steps/Step1Upload";
import Step2Columns from "./steps/Step2Columns";
import FixStep from "./steps/FixStep";
import Step5Categories from "./steps/Step5Categories";
import StepSkuConflicts from "./steps/StepSkuConflicts";
import Step6Duplicates from "./steps/Step6Duplicates";
import Step7Existing from "./steps/Step7Existing";
import Step8FinalTable from "./steps/Step8FinalTable";
import Step9Preview from "./steps/Step9Preview";
import Step10Done from "./steps/Step10Done";

function makeSteps(wizard) {
  return [
    { id: "upload", title: "اختيار الملف", helper: "ابدأ بملف Excel أو CSV واضح العناوين.", always: true, Component: Step1Upload },
    { id: "columns", title: "ربط الأعمدة", helper: "راجع كل عمود من الملف واربطه بحقل النظام المناسب.", always: true, Component: Step2Columns },
    { id: "warehouses", title: "تحديد المخازن", helper: "أنشئ مخازن الملف الناقصة أو اختر مخزن النظام الذي سيستلم الكمية.", isApplicable: () => wizard.warehouseErrorRows.length > 0, Component: (props) => <FixStep {...props} type="warehouse" /> },
    { id: "units", title: "تحديد الوحدات", helper: "أنشئ وحدات الملف الناقصة أو حولها إلى وحدات موجودة داخل النظام، أو اختر وحدة افتراضية لكل الصفوف.", always: true, Component: (props) => <FixStep {...props} type="unit" /> },
    { id: "categories", title: "الفئات والأكواد", helper: "راجع بادئات SKU وأنشئ الفئات الناقصة أو عين أكوادا للصفوف الفارغة.", isApplicable: () => wizard.missingSkuCategories.length > 0 || wizard.codelessRows.length > 0, Component: Step5Categories },
    { id: "sku-conflicts", title: "تعارضات SKU", helper: "اختر أي صف يحتفظ بالكود عندما يظهر نفس SKU لأكثر من صنف.", isApplicable: () => wizard.fileSkuConflicts.length > 0, Component: StepSkuConflicts },
    { id: "duplicates", title: "تكرارات المخزون", helper: "اختر دمج الكميات أو توزيعها على المخازن لكل منتج مكرر.", isApplicable: () => wizard.duplicateGroups.length > 0, Component: Step6Duplicates },
    { id: "existing", title: "الأصناف الموجودة", helper: "قرر هل يتم تحديث الأصناف المطابقة أم تخطيها أم استلام مخزونها فقط.", isApplicable: () => wizard.exactExistingRows.length > 0, Component: Step7Existing },
    { id: "final", title: "الجدول النهائي", helper: "راجع الصفوف، عدل القيم، غير الإجراءات، واحذف ما لا تريد استيراده.", always: true, Component: Step8FinalTable },
    { id: "preview", title: "معاينة وتنفيذ", helper: "تشغيل dry-run تلقائيا قبل أي كتابة فعلية في قاعدة البيانات.", always: true, Component: Step9Preview },
    { id: "done", title: "تم", helper: "ملخص النتيجة ورابط السجل حيث التنزيل والتراجع.", always: true, Component: Step10Done },
  ];
}

function firstProblemStep(wizard) {
  if (!Object.values(wizard.mapping).includes("name")) return "columns";
  if (wizard.warehouseErrorRows.length) return "warehouses";
  if (wizard.unitErrorRows.length) return "units";
  if (wizard.fileSkuConflicts?.length) return "sku-conflicts";
  if (wizard.storageErrorRows.length) return "duplicates";
  return null;
}

function transitionCopyForStep(targetStep, uploadMode) {
  return {
    title: uploadMode ? "جاري تهيئة الأعمدة والحقول..." : `جاري الانتقال إلى خطوة ${targetStep.title}...`,
    duration: 500,
  };
}

export default function WizardShell({ wizard }) {
  const [currentId, setCurrentId] = useState("upload");
  const [keptStepIds, setKeptStepIds] = useState(() => new Set(["upload"]));
  const [transition, setTransition] = useState(null);
  const [shake, setShake] = useState(false);

  // ── Derived step state (must come BEFORE validationStatus) ──────────────
  const allSteps = useMemo(() => makeSteps(wizard), [wizard]);
  const visibleSteps = useMemo(() => allSteps.filter((step) => step.always || keptStepIds.has(step.id) || step.id === currentId || step.isApplicable?.()), [allSteps, currentId, keptStepIds]);
  const currentIndex = visibleSteps.findIndex((step) => step.id === currentId);
  const currentStep = visibleSteps[currentIndex] ?? visibleSteps[0];
  const nextStep = visibleSteps[currentIndex + 1] ?? null;
  const prevStep = visibleSteps[currentIndex - 1] ?? null;
  const CurrentComponent = currentStep?.Component ?? (() => null);

  function rememberStep(id) {
    setKeptStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function setActiveStep(id) {
    rememberStep(id);
    setCurrentId(id);
  }

  function goToStepId(id) {
    const target = visibleSteps.find((step) => step.id === id);
    if (!target) return;
    const copy = transitionCopyForStep(target, false);
    setTransition(copy);
    setTimeout(() => {
      setActiveStep(id);
      setTransition(null);
    }, copy.duration);
  }

  function goNext(mode = "normal") {
    if (!nextStep) return;
    const isUpload = currentStep.id === "upload";
    const triggeredByUpload = mode === "upload";
    if (!validationStatus.isValid && !(isUpload && triggeredByUpload)) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }
    const copy = transitionCopyForStep(nextStep, isUpload);
    setTransition(copy);
    setTimeout(() => {
      setActiveStep(nextStep.id);
      setTransition(null);
    }, copy.duration);
  }

  // ── Auto-redirect to done on successful import ─────────────────────────
  const prevResultRef = useRef(wizard.result);
  useEffect(() => {
    if (!prevResultRef.current && wizard.result) {
      setActiveStep("done");
    }
    prevResultRef.current = wizard.result;
  }, [wizard.result]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validationStatus = useMemo(() => {
    if (currentStep.id === "upload") {
      if (!wizard.fileName) {
        return { isValid: false, reason: "الرجاء رفع أو اختيار ملف Excel/CSV للمتابعة.", shortReason: "مطلوب اختيار ملف" };
      }
      return { isValid: true, reason: "تم رفع الملف بنجاح وهو جاهز للمعالجة.", shortReason: "الملف جاهز" };
    }

    if (currentStep.id === "columns") {
      const hasName = Object.values(wizard.mapping).includes("name");
      if (!hasName) {
        return { isValid: false, reason: "يجب ربط عمود واحد على الأقل من ملفك بحقل 'اسم الصنف' بالنظام.", shortReason: "اربط حقل الاسم" };
      }
      return { isValid: true, reason: "تم ربط عمود اسم الصنف بنجاح، الأعمدة جاهزة.", shortReason: "الأعمدة جاهزة" };
    }

    if (currentStep.id === "warehouses") {
      const count = wizard.warehouseErrorRows?.length || 0;
      if (count > 0) {
        return { isValid: false, reason: `يوجد عدد ${count} صفوف تحتوي مخازن ناقصة أو غير مربوطة. يرجى إصلاحها للمتابعة.`, shortReason: `إصلاح ${count} مخزن` };
      }
      return { isValid: true, reason: "تمت مطابقة وتعيين جميع المخازن بنجاح.", shortReason: "المخازن جاهزة" };
    }

    if (currentStep.id === "units") {
      const count = wizard.unitErrorRows?.length || 0;
      if (count > 0) {
        return { isValid: false, reason: `يوجد عدد ${count} صفوف تحتوي وحدات غير مطابقة بالنظام. يرجى مطابقتها للمتابعة.`, shortReason: `إصلاح ${count} وحدة` };
      }
      return { isValid: true, reason: "تمت مطابقة جميع الوحدات مع النظام بنجاح.", shortReason: "الوحدات جاهزة" };
    }

    if (currentStep.id === "categories") {
      const missingSku = wizard.missingSkuCategories?.length || 0;
      const codeless = wizard.codelessRows?.length || 0;
      const unnamedSku = wizard.missingSkuCategories?.filter((entry) => !String(wizard.skuCategoryNames?.[entry.prefix] ?? entry.name ?? "").trim()).length || 0;
      if (codeless > 0 || unnamedSku > 0) {
        let reasons = [];
        if (unnamedSku > 0) reasons.push(`${unnamedSku} فئات بدون اسم`);
        if (codeless > 0) reasons.push(`${codeless} صفوف بدون أكواد`);
        return { isValid: false, reason: `يوجد ${reasons.join(" و ")} بحاجة لمعالجة قبل المتابعة.`, shortReason: "إصلاح فئات/أكواد" };
      }
      if (missingSku > 0) {
        return { isValid: true, reason: `سيتم إنشاء ${missingSku} فئة SKU بالاسم المعروض في هذه الخطوة. يمكنك تعديل الاسم أو المتابعة كما هو.`, shortReason: "فئات SKU جاهزة" };
      }
      return { isValid: true, reason: "الفئات وبادئات SKU والأكواد مكتملة وجاهزة.", shortReason: "الأكواد جاهزة" };
    }

    if (currentStep.id === "sku-conflicts") {
      const conflicts = wizard.fileSkuConflicts?.length || 0;
      if (conflicts > 0) {
        return { isValid: false, reason: `يوجد ${conflicts} كود SKU مستخدم لأكثر من صنف. اختر الصف الذي يحتفظ بالكود أو طبق قرارا جماعيا.`, shortReason: `إصلاح ${conflicts} تعارض SKU` };
      }
      return { isValid: true, reason: "تم حل تعارضات SKU ويمكن متابعة خطوات الاستيراد.", shortReason: "تعارضات SKU محلولة" };
    }

    if (currentStep.id === "duplicates") {
      const count = wizard.duplicateGroups?.length || 0;
      return { isValid: true, reason: `يوجد عدد ${count} أصناف مكررة بالملف بانتظار قرار الدمج أو التوزيع.`, shortReason: `${count} تكرارات معلقة` };
    }

    if (currentStep.id === "existing") {
      const count = wizard.exactExistingRows?.length || 0;
      return { isValid: true, reason: `وجدنا عدد ${count} أصناف مطابقة لبيانات مسجلة بالنظام مسبقاً للتحديث أو التخطي.`, shortReason: `${count} أصناف مطابقة` };
    }

    if (currentStep.id === "final") {
      const errorRows = wizard.workingRows?.filter((row) => wizard.issuesForRow(row.__rowNumber).some((iss) => iss.severity === "error")).length || 0;
      if (errorRows > 0) {
        return { isValid: false, reason: `يوجد عدد ${errorRows} صفوف تحتوي على أخطاء بالجدول النهائي. يرجى إصلاحها للمتابعة.`, shortReason: `إصلاح ${errorRows} خطأ بالجدول` };
      }
      return { isValid: true, reason: "الجدول خالي من الأخطاء وجاهز للمعاينة النهائية.", shortReason: "الجدول جاهز" };
    }

    return { isValid: true, reason: "", shortReason: "" };
  }, [currentStep.id, wizard]);

  return (
    <div className="space-y-6" dir="rtl">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-slate-400 font-mono">الخطوة {currentIndex + 1} من {visibleSteps.length}</div>
            <h2 className="mt-1.5 text-2xl font-black text-slate-900 font-display">{currentStep.title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 font-title">{currentStep.helper}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4.5 py-2 text-xs font-black text-slate-600 font-mono shadow-sm">
            التالي: {nextStep?.title || "نهاية الاستيراد"}
          </div>
        </div>

        <div 
          className="grid gap-2.5 w-full grid-cols-2 sm:grid-cols-3 lg:grid-flow-col"
          style={{ gridAutoColumns: "minmax(0, 1fr)" }}
        >
          {visibleSteps.map((step, index) => {
            const active = step.id === currentStep.id;
            const done = index < currentIndex || (step.id === "done" && wizard.result);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                disabled={Boolean(transition) || (step.id === "done" && !wizard.result)}
                className={`group flex-1 min-w-[140px] md:min-w-0 min-h-[64px] rounded-xl border p-3 text-right transition-all duration-300 relative overflow-hidden ${
                  active
                    ? "border-primary bg-primary text-white shadow-md shadow-slate-900/10"
                    : done
                    ? "border-emerald-150 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50"
                    : "border-slate-200 bg-slate-50/50 text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className={`text-[10px] font-black font-mono transition-colors ${active ? "text-emerald-400" : done ? "text-emerald-600" : "text-slate-400"}`}>
                  #{index + 1}
                </div>
                <div className="mt-1.5 truncate text-[12px] font-black tracking-tight">{step.title}</div>
                {active && (
                  <span className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {wizard.error ? (
        <div className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm font-bold text-amber-800 shadow-sm backdrop-blur-sm ${shake ? "animate-shake border-amber-400 bg-amber-100/50" : ""}`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <span>{wizard.error}</span>
        </div>
      ) : null}

      <div className="relative">
        <div className={`transition-all duration-300 ${shake ? "animate-shake" : ""} ${transition ? "blur-[2px] pointer-events-none scale-[0.995]" : ""}`}>
          <CurrentComponent wizard={wizard} goNext={goNext} goToStepId={goToStepId} />
        </div>
        {transition ? (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/60 p-6 text-center backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
            <div className="flex flex-col items-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/10">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <h3 className="mt-3.5 text-sm font-black text-slate-800 font-display">{transition.title}</h3>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-4.5 shadow-elevated backdrop-blur-md transition-all duration-300">
        <button
          type="button"
          onClick={() => prevStep && setActiveStep(prevStep.id)}
          disabled={!prevStep || wizard.loading || Boolean(transition)}
          className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronRight className="h-5 w-5" /> السابق
        </button>
        <div className="text-sm font-bold text-slate-500 font-title">{nextStep ? `بعدها: ${nextStep.title}` : "انتهت الخطوات"}</div>
        {currentStep.id !== "preview" && currentStep.id !== "done" ? (
          <div className="relative group/next flex items-center gap-3.5">
            {/* Tooltip containing clear reason preview */}
            {validationStatus.reason && (
              <div className={`absolute bottom-full left-0 mb-3.5 z-40 w-72 p-4 rounded-2xl border bg-white shadow-elevated text-xs font-bold leading-relaxed transition-all duration-350 transform origin-bottom-left scale-90 opacity-0 pointer-events-none group-hover/next:scale-100 group-hover/next:opacity-100 group-hover/next:pointer-events-auto ${
                shake ? "scale-100 opacity-100 pointer-events-auto animate-shake" : ""
              } ${
                validationStatus.isValid 
                  ? "border-emerald-250 text-emerald-950" 
                  : "border-amber-250 text-amber-950"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${validationStatus.isValid ? "bg-emerald-500 shadow-sm" : "bg-amber-500 animate-pulse shadow-sm"}`} />
                  <div>
                    <div className="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                      {validationStatus.isValid ? "حالة التحقق: جاهز" : "حالة التحقق: غير مكتمل"}
                    </div>
                    <div>{validationStatus.reason}</div>
                  </div>
                </div>
                {/* Tooltip Arrow */}
                <div className={`absolute top-full left-6 -mt-1.5 h-3 w-3 rotate-45 border-r border-b bg-white ${
                  validationStatus.isValid ? "border-emerald-250" : "border-amber-250"
                }`} />
              </div>
            )}

            {/* Micro-badge for quick status review */}
            {validationStatus.reason && (
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all duration-300 ${
                validationStatus.isValid 
                  ? "border-emerald-150 bg-emerald-50/50 text-emerald-700" 
                  : "border-amber-200 bg-amber-50/70 text-amber-800 animate-pulse"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${validationStatus.isValid ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span>{validationStatus.shortReason}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => goNext()}
              disabled={!nextStep || wizard.loading || Boolean(transition)}
              className={`inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                shake 
                  ? "animate-shake bg-rose-700 hover:bg-rose-800 shadow-rose-900/10" 
                  : ""
              }`}
            >
              التالي <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        ) : currentStep.id === "preview" ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveStep("final")}
              disabled={wizard.loading || Boolean(transition)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-40"
            >
              رجوع للجدول
            </button>
            <button
              type="button"
              onClick={() => wizard.runImport({ dryRun: false })}
              disabled={!wizard.preview || wizard.loading || Boolean(transition)}
              className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white shadow-md shadow-emerald-700/10 transition-all duration-200 hover:bg-emerald-800 hover:shadow-lg active:scale-95 disabled:opacity-40"
            >
              <Database className="h-4.5 w-4.5" />
              {wizard.loading ? "جاري التنفيذ..." : "تنفيذ فعلي الآن"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveStep("final")}
            disabled={wizard.loading || currentStep.id === "done" || Boolean(transition)}
            className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-40"
          >
            رجوع للجدول
          </button>
        )}
      </div>
    </div>
  );
}
