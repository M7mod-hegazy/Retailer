import React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import StepTable from "../StepTable";

const FIX_STEP_LABELS = {
  columns: "ربط الأعمدة",
  warehouses: "المخازن",
  units: "الوحدات",
  categories: "تصنيفات الأكواد",
  "sku-conflicts": "تضارب الأكواد",
  duplicates: "تكرار المخزون",
  existing: "المنتجات الموجودة",
  final: "الجدول النهائي",
};

export default function Step8FinalTable({ wizard, goToStepId }) {
  const blockingIssues = wizard.blockingIssuesByType || [];
  const totalBlocking = blockingIssues.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="space-y-4">
      {totalBlocking > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="text-sm font-black text-rose-900">
              {totalBlocking} خطأ محظور — أصلحها قبل المعاينة
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {blockingIssues.map((issue) => (
              <div
                key={issue.stepId}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-800 shadow-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[10px] font-black text-rose-700">
                  {issue.count}
                </span>
                <span>{FIX_STEP_LABELS[issue.stepId] || issue.sample || issue.field}</span>
                {goToStepId && issue.stepId !== "final" && (
                  <button
                    type="button"
                    onClick={() => goToStepId(issue.stepId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1 text-[10px] font-black text-rose-800 hover:bg-rose-200 transition"
                  >
                    اذهب للإصلاح <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-emerald-800">لا توجد أخطاء محظورة — الجدول جاهز للمعاينة</span>
        </div>
      )}

      <StepTable
        wizard={wizard}
        rows={wizard.sortedEditableRows}
        columns={wizard.orderedFields}
        title="الجدول النهائي القابل للتعديل"
        helper="راجع الصفوف بحثا عن أي مشكلات متبقية، عدّل الخلايا مباشرة، غيّر الإجراء لكل صف، واحذف أو استعد أي صف قبل المعاينة."
        showActions
        height={560}
      />
    </div>
  );
}
