import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Database, Loader2 } from "lucide-react";
import Step1Upload from "./steps/Step1Upload";
import Step2Columns from "./steps/Step2Columns";
import FixStep from "./steps/FixStep";
import Step5Categories from "./steps/Step5Categories";
import StepSkuConflicts from "./steps/StepSkuConflicts";
import Step6Duplicates from "./steps/Step6Duplicates";
import Step7Existing from "./steps/Step7Existing";
import StepPrices from "./steps/StepPrices";
import StepReview from "./steps/StepReview";
import Step10Done from "./steps/Step10Done";

const STEP_LABELS = {
  upload: { title: "رفع الملف", helper: "ابدأ بملف Excel أو CSV مع عناوين أعمدة واضحة." },
  columns: { title: "ربط الأعمدة", helper: "راجع كل عمود في الملف واربطه بالحقل المناسب في النظام." },
  warehouses: { title: "إعداد المخازن", helper: "أنشئ المخازن المفقودة أو اختر المخزن الذي سيستلم المخزون." },
  units: { title: "إعداد الوحدات", helper: "أنشئ الوحدات المفقودة أو اربطها بوحدات موجودة في النظام." },
  categories: { title: "تصنيفات الأكواد", helper: "راجع بادئات الأكواد، أنشئ التصنيفات المفقودة، أو عيّن رموزا للصفوف الفارغة." },
  "sku-conflicts": { title: "تضارب الأكواد", helper: "اختر أي صف يحتفظ بالرمز عندما يظهر نفس الكود لمنتجات مختلفة." },
  duplicates: { title: "تكرار المخزون", helper: "ادمج الكميات أو وزّع عبر المخازن لكل منتج مكرر." },
  existing: { title: "المنتجات الموجودة", helper: "قرّر هل تريد تحديث المنتجات المطابقة أو تخطيها أو استلام مخزون فقط." },
  prices: { title: "تحديث الأسعار", helper: "قارن أسعار الملف مع النظام واختر أي أنواع الأسعار ستتغير." },
  review: { title: "مراجعة وتنفيذ", helper: "راجع القرارات لكل صنف، غيّر الإجراء، ثم نفّذ الاستيراد بنقرة واحدة." },
  done: { title: "تم", helper: "ملخص النتائج مع رابط للسجل للتحميل والتراجع." },
};

const STEP_TITLE_SHORT = {
  upload: "الملف",
  columns: "الأعمدة",
  warehouses: "المخزن",
  units: "الوحدات",
  categories: "الأكواد",
  "sku-conflicts": "تضارب",
  duplicates: "تكرار",
  existing: "موجود",
  prices: "الأسعار",
  review: "مراجعة",
  done: "تم",
};

const STEP_ISSUE_MAP = {
  name: "columns",
  code: "categories",
  unit_name: "units",
  warehouse_id: "warehouses",
  storage_plan: "duplicates",
  category_name: "categories",
};

function makeSteps(wizard) {
  return [
    { id: "upload", title: STEP_LABELS.upload.title, helper: STEP_LABELS.upload.helper, always: true, Component: Step1Upload },
    { id: "columns", title: STEP_LABELS.columns.title, helper: STEP_LABELS.columns.helper, always: true, Component: Step2Columns },
    { id: "warehouses", title: STEP_LABELS.warehouses.title, helper: STEP_LABELS.warehouses.helper, isApplicable: () => wizard.warehouseErrorRows.length > 0, Component: (props) => <FixStep {...props} type="warehouse" /> },
    { id: "units", title: STEP_LABELS.units.title, helper: STEP_LABELS.units.helper, always: true, Component: (props) => <FixStep {...props} type="unit" /> },
    { id: "categories", title: STEP_LABELS.categories.title, helper: STEP_LABELS.categories.helper, isApplicable: () => wizard.missingSkuCategories.length > 0 || wizard.codelessRows.length > 0, Component: Step5Categories },
    { id: "sku-conflicts", title: STEP_LABELS["sku-conflicts"].title, helper: STEP_LABELS["sku-conflicts"].helper, isApplicable: () => wizard.fileSkuConflicts.length > 0 && !wizard.skuConflictsResolved, Component: StepSkuConflicts },
    { id: "duplicates", title: STEP_LABELS.duplicates.title, helper: STEP_LABELS.duplicates.helper, isApplicable: () => wizard.duplicateGroups.length > 0, Component: Step6Duplicates },
    { id: "existing", title: STEP_LABELS.existing.title, helper: STEP_LABELS.existing.helper, isApplicable: () => wizard.exactExistingRows.length > 0, Component: Step7Existing },
    { id: "prices", title: STEP_LABELS.prices.title, helper: STEP_LABELS.prices.helper, isApplicable: () => {
      const hasPriced = wizard.pricedRows?.length > 0;
      const hasUnmapped = wizard.unmappedPriceFields?.length > 0;
      const hasUpdatingRows = wizard.exactExistingRows?.some(row => wizard.rowAction(row) === "update");
      const hasInsertRows = wizard.workingRows?.some(row => wizard.rowAction(row) === "insert");
      return hasPriced || (hasUnmapped && ((hasUpdatingRows && wizard.updateExistingPrices) || hasInsertRows));
    }, Component: StepPrices },
    { id: "review", title: STEP_LABELS.review.title, helper: STEP_LABELS.review.helper, always: true, Component: StepReview },
    { id: "done", title: STEP_LABELS.done.title, helper: STEP_LABELS.done.helper, always: true, Component: Step10Done },
  ];
}

function firstProblemStep(wizard, blockingIssuesByType) {
  if (!Object.values(wizard.mapping).includes("name")) return "columns";
  if (wizard.warehouseErrorRows.length) return "warehouses";
  if (wizard.unitErrorRows.length) return "units";
  if (wizard.fileSkuConflicts?.length && !wizard.skuConflictsResolved) return "sku-conflicts";
  if (wizard.storageErrorRows.length) return "duplicates";
  if (blockingIssuesByType?.length) {
    const first = blockingIssuesByType[0];
    return first.stepId || "review";
  }
  return null;
}

function transitionCopyForStep(targetStep, uploadMode) {
  return {
    title: uploadMode ? "تحضير الأعمدة والحقول..." : `جارٍ الانتقال إلى ${targetStep.title}...`,
    duration: 500,
  };
}

export default function WizardShell({ wizard }) {
  const [currentId, setCurrentId] = useState("upload");
  const [keptStepIds, setKeptStepIds] = useState(() => new Set(["upload"]));
  const [transition, setTransition] = useState(null);
  const [shake, setShake] = useState(false);

  const allSteps = useMemo(() => makeSteps(wizard), [wizard]);
  const visibleSteps = useMemo(() => allSteps.filter((step) => step.always || keptStepIds.has(step.id) || step.id === currentId || step.isApplicable?.()), [allSteps, currentId, keptStepIds]);
  const currentIndex = visibleSteps.findIndex((step) => step.id === currentId);
  const currentStep = visibleSteps[currentIndex] ?? visibleSteps[0];
  const nextStep = visibleSteps[currentIndex + 1] ?? null;
  const prevStep = visibleSteps[currentIndex - 1] ?? null;
  const CurrentComponent = currentStep?.Component ?? (() => null);

  const blockingIssuesByType = wizard.blockingIssuesByType || [];

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

  const prevResultRef = useRef(wizard.result);
  useEffect(() => {
    if (!prevResultRef.current && wizard.result) {
      setActiveStep("done");
    }
    prevResultRef.current = wizard.result;
  }, [wizard.result]);

  function stepHasBlockingIssues(stepId) {
    if (stepId === "upload" || stepId === "columns") return false;
    if (stepId === "warehouses") return wizard.warehouseErrorRows?.length > 0;
    if (stepId === "units") return wizard.unitErrorRows?.length > 0;
    if (stepId === "categories") return wizard.codelessRows?.length > 0 || wizard.missingSkuCategories?.some((entry) => !String(wizard.skuCategoryNames?.[entry.prefix] ?? entry.name ?? "").trim());
    if (stepId === "sku-conflicts") return wizard.fileSkuConflicts?.length > 0 && !wizard.skuConflictsResolved;
    if (stepId === "duplicates") return wizard.storageErrorRows?.length > 0;
    if (stepId === "existing") return wizard.exactExistingRows?.length > 0;
    if (stepId === "prices") return false;
    if (stepId === "review") return wizard.hasBlockingIssues;
    if (stepId === "done") return false;
    return false;
  }

  function canNavigateToStep(stepId) {
    if (stepId === currentId) return true;
    if (stepId === "done" && !wizard.result) return false;
    const targetIndex = visibleSteps.findIndex((s) => s.id === stepId);
    if (targetIndex === -1) return false;
    if (targetIndex <= currentIndex) return true;
    if (stepId === "review") return !wizard.hasBlockingIssues;
    return true;
  }

  const validationStatus = useMemo(() => {
    if (currentStep.id === "upload") {
      if (!wizard.fileName) {
        return { isValid: false, reason: "الرجاء رفع أو اختيار ملف Excel/CSV للمتابعة.", shortReason: "الملف مطلوب" };
      }
      return { isValid: true, reason: "تم رفع الملف بنجاح وجاهز للمعالجة.", shortReason: "الملف جاهز" };
    }

    if (currentStep.id === "columns") {
      const hasName = Object.values(wizard.mapping).includes("name");
      if (!hasName) {
        return { isValid: false, reason: "يجب ربط عمود واحد على الأقل بحقل 'اسم الصنف'.", shortReason: "اربط حقل الاسم" };
      }
      return { isValid: true, reason: "تم ربط عمود اسم الصنف بنجاح. الأعمدة جاهزة.", shortReason: "الأعمدة جاهزة" };
    }

    if (currentStep.id === "warehouses") {
      const count = wizard.warehouseErrorRows?.length || 0;
      if (count > 0) {
        return { isValid: false, reason: `${count} صفوف تحتوي مخازن مفقودة أو غير مرتبطة. أصلحها للمتابعة.`, shortReason: `أصلح ${count} مخزن` };
      }
      return { isValid: true, reason: "تمت مطابقة جميع المخازن وتعيينها بنجاح.", shortReason: "المخازن جاهزة" };
    }

    if (currentStep.id === "units") {
      const count = wizard.unitErrorRows?.length || 0;
      if (count > 0) {
        return { isValid: false, reason: `${count} صفوف تحتوي وحدات غير موجودة في النظام. اربطها للمتابعة.`, shortReason: `أصلح ${count} وحدة` };
      }
      return { isValid: true, reason: "تمت مطابقة جميع الوحدات مع النظام بنجاح.", shortReason: "الوحدات جاهزة" };
    }

    if (currentStep.id === "categories") {
      const missingSku = wizard.missingSkuCategories?.length || 0;
      const codeless = wizard.codelessRows?.length || 0;
      const unnamedSku = wizard.missingSkuCategories?.filter((entry) => !String(wizard.skuCategoryNames?.[entry.prefix] ?? entry.name ?? "").trim()).length || 0;
      if (codeless > 0 || unnamedSku > 0) {
        const reasons = [];
        if (unnamedSku > 0) reasons.push(`${unnamedSku} تصنيف بدون اسم`);
        if (codeless > 0) reasons.push(`${codeless} صف بدون رموز`);
        return { isValid: false, reason: `${reasons.join(" و ")} تحتاج إلى اهتمام قبل المتابعة.`, shortReason: "أصلح التصنيفات/الرموز" };
      }
      if (missingSku > 0) {
        return { isValid: true, reason: `سيتم إنشاء ${missingSku} تصنيف كود بالأسماء المعروضة في هذه الخطوة. يمكنك تعديل الأسماء أو المتابعة.`, shortReason: "تصنيفات الأكواد جاهزة" };
      }
      return { isValid: true, reason: "التصنيفات وبادئات الأكواد والرموز مكتملة وجاهزة.", shortReason: "الرموز جاهزة" };
    }

    if (currentStep.id === "sku-conflicts") {
      const conflicts = wizard.fileSkuConflicts?.length || 0;
      if (conflicts > 0 && !wizard.skuConflictsResolved) {
        return { isValid: false, reason: `${conflicts} كود مستخدم من قبل عدة منتجات. اختر أي صف يحتفظ بكل كود أو طبق قرارا جماعيا.`, shortReason: `أصلح ${conflicts} تضارب أكواد` };
      }
      return { isValid: true, reason: "تم حل جميع تضاربات الأكواد. يمكنك المتابعة مع الاستيراد.", shortReason: "تم حل التضاربات" };
    }

    if (currentStep.id === "duplicates") {
      const count = wizard.duplicateGroups?.length || 0;
      if (count > 0 && !wizard.duplicatesConfirmed) {
        return { isValid: false, reason: `${count} منتج مكرر — اختر قراراً لكل مجموعة واضغط تأكيد للمتابعة.`, shortReason: `أكّد قرار ${count} تكرار` };
      }
      return { isValid: true, reason: "تم تأكيد قرارات التكرار.", shortReason: "التكرارات مؤكدة" };
    }

    if (currentStep.id === "existing") {
      const count = wizard.exactExistingRows?.length || 0;
      return { isValid: true, reason: `تم العثور على ${count} منتج يطابق السجلات الموجودة. جاهز للتحديث أو التخطي أو استلام مخزون فقط.`, shortReason: `${count} منتج مطابق` };
    }

    if (currentStep.id === "prices") {
      const activeFields = Array.from(wizard.changedPriceFields || []);
      const unmappedFields = wizard.unmappedPriceFields || [];
      const allFieldsToConfirm = [...activeFields, ...unmappedFields];
      const missingConfirmations = allFieldsToConfirm.filter((f) => !wizard.pricePolicies?.[f]);

      if (missingConfirmations.length > 0) {
        return { isValid: false, reason: `الرجاء تحديد إجراء (تحديث، تصفير، أو تجاهل) لجميع حقول الأسعار.`, shortReason: "حدد قراراً للأسعار" };
      }

      const count = wizard.pricedRows?.length || 0;
      const fields = wizard.changedPriceFields?.size || 0;
      const updateCount = ["sale_price", "purchase_price", "wholesale_price"].filter((f) => wizard.changedPriceFields?.has(f) && wizard.pricePolicies?.[f] === "update").length;
      return { isValid: true, reason: `${count} منتج بفروق أسعار في ${fields} نوع. ${updateCount} نوع سعر سيتحدث.`, shortReason: `${count} فرق سعر` };
    }

    if (currentStep.id === "review") {
      const errorRows = wizard.blockingIssues?.length || 0;
      if (errorRows > 0) {
        return { isValid: false, reason: `${errorRows} أخطاء محظورة. أصلحها قبل الاستيراد.`, shortReason: `أصلح ${errorRows} خطأ` };
      }
      return { isValid: true, reason: "جميع البيانات جاهزة للاستيراد.", shortReason: "جاهز للاستيراد" };
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
      <div className="rounded-2xl border border-border-normal/60 bg-bg-surface p-5 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-text-muted font-mono">الخطوة {currentIndex + 1} من {visibleSteps.length}</div>
            <h2 className="mt-1.5 text-2xl font-black text-text-primary font-display">{currentStep.title}</h2>
            <p className="mt-1 text-sm font-semibold text-text-secondary font-title">{currentStep.helper}</p>
          </div>
          <div className="rounded-xl border border-border-normal/80 bg-bg-overlay/50 px-4.5 py-2 text-xs font-black text-text-secondary font-mono shadow-sm">
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
            const blocked = !canNavigateToStep(step.id);
            const hasBlocking = step.id !== "upload" && step.id !== "done" && stepHasBlockingIssues(step.id);
            const blocking = blockingIssuesByType.find((b) => b.stepId === step.id);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                disabled={blocked || Boolean(transition) || (step.id === "done" && !wizard.result)}
                className={`group flex-1 min-w-[140px] md:min-w-0 min-h-[64px] rounded-xl border p-3 text-right transition-all duration-300 relative overflow-hidden ${
                  active
                    ? "border-primary bg-primary text-white shadow-md shadow-slate-900/10"
                    : done
                    ? "border-emerald-150 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50"
                    : blocked
                    ? "border-border-normal bg-bg-overlay text-text-muted cursor-not-allowed"
                    : "border-border-normal bg-bg-overlay/50 text-text-muted hover:bg-bg-overlay hover:text-text-secondary hover:border-border-strong"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={blocked ? "أكمل الخطوات المطلوبة أولا" : step.helper}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-[10px] font-black font-mono transition-colors ${active ? "text-emerald-400" : done ? "text-emerald-600" : "text-text-muted"}`}>
                    #{index + 1}
                  </div>
                  {hasBlocking && !done && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[9px] font-black text-rose-700">
                      {blocking?.count || "!"}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 truncate text-[12px] font-black tracking-tight">{STEP_TITLE_SHORT[step.id] || step.title}</div>
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
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-bg-surface/60 p-6 text-center backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
            <div className="flex flex-col items-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-500/10">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <h3 className="mt-3.5 text-sm font-black text-text-primary font-display">{transition.title}</h3>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-normal/80 bg-bg-surface/90 px-6 py-4.5 shadow-elevated backdrop-blur-md transition-all duration-300">
        <button
          type="button"
          onClick={() => prevStep && setActiveStep(prevStep.id)}
          disabled={!prevStep || wizard.loading || Boolean(transition)}
          className="inline-flex items-center gap-2.5 rounded-xl border border-border-normal bg-bg-surface px-5 py-3 text-sm font-black text-text-primary shadow-sm transition-all duration-200 hover:bg-bg-overlay hover:border-border-strong active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronRight className="h-5 w-5" /> السابق
        </button>
        <div className="text-sm font-bold text-text-secondary font-title">
          {currentStep.id === "review" ? "مراجعة القرارات والتنفيذ" : currentStep.id === "done" ? "اكتمل الاستيراد" : nextStep ? `التالي: ${nextStep.title}` : "لا توجد خطوات أخرى"}
        </div>
        {currentStep.id !== "done" ? (
          <div className="relative group/next flex items-center gap-3.5">
            {validationStatus.reason && (
              <div className={`absolute bottom-full left-0 mb-3.5 z-40 w-72 p-4 rounded-2xl border bg-bg-surface shadow-elevated text-xs font-bold leading-relaxed transition-all duration-350 transform origin-bottom-left scale-90 opacity-0 pointer-events-none group-hover/next:scale-100 group-hover/next:opacity-100 group-hover/next:pointer-events-auto ${
                shake ? "scale-100 opacity-100 pointer-events-auto animate-shake" : ""
              } ${
                validationStatus.isValid
                  ? "border-emerald-250 text-emerald-950"
                  : "border-amber-250 text-amber-950"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${validationStatus.isValid ? "bg-emerald-500 shadow-sm" : "bg-amber-500 animate-pulse shadow-sm"}`} />
                  <div>
                    <div className="font-black text-[10px] uppercase tracking-wider text-text-muted mb-1">
                      {validationStatus.isValid ? "التحقق: جاهز" : "التحقق: غير مكتمل"}
                    </div>
                    <div>{validationStatus.reason}</div>
                  </div>
                </div>
                <div className={`absolute top-full left-6 -mt-1.5 h-3 w-3 rotate-45 border-r border-b bg-bg-surface ${
                  validationStatus.isValid ? "border-emerald-250" : "border-amber-250"
                }`} />
              </div>
            )}

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

            {currentStep.id === "review" ? (
              <button
                type="button"
                onClick={() => wizard.runImport({ dryRun: false })}
                disabled={wizard.loading || wizard.hasBlockingIssues || Boolean(transition)}
                className={`inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                  shake ? "animate-shake bg-rose-700 hover:bg-rose-800 shadow-rose-900/10" : ""
                }`}
              >
                {wizard.loading ? (
                  <><Loader2 className="h-4.5 w-4.5 animate-spin" /> جاري التنفيذ...</>
                ) : (
                  <><Database className="h-4.5 w-4.5" /> استيراد الآن</>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goNext()}
                disabled={!nextStep || wizard.loading || Boolean(transition)}
                className={`inline-flex items-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-md transition-all duration-200 hover:bg-primary-600 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                  shake ? "animate-shake bg-rose-700 hover:bg-rose-800 shadow-rose-900/10" : ""
                }`}
              >
                التالي <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
