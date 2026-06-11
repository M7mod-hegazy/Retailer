import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, History, Upload, Trash2, Loader2 } from "lucide-react";
import { useAccountImportWizard } from "./useAccountImportWizard";
import AccountImportHistoryTab from "./AccountImportHistoryTab";

const FIELD_LABELS = {
  name: "الاسم",
  phone: "الهاتف",
  address: "العنوان",
  opening_balance: "الرصيد",
};

export default function AccountImportPage({ entityType }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "history" ? "history" : "upload");

  const theme = entityType === "customers"
    ? { accent: "blue", btnBg: "bg-blue-600 hover:bg-blue-700", chipNew: "bg-blue-50 text-blue-700 border-blue-200" }
    : { accent: "orange", btnBg: "bg-orange-600 hover:bg-orange-700", chipNew: "bg-orange-50 text-orange-700 border-orange-200" };

  const pageTitle = entityType === "customers" ? "استيراد العملاء" : "استيراد الموردين";
  const listPath = entityType === "customers" ? "/accounts/customers" : "/accounts/suppliers";

  const wizard = useAccountImportWizard({ entityType, onImported: () => {} });

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === "history" ? { tab: "history" } : {});
  };

  const detectedFields = Object.values(wizard.detectedMapping).filter(Boolean);

  return (
    <div className="space-y-6 p-6 w-full" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 active:scale-95 hover:translate-x-1"
            title="رجوع للقائمة"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-display">{pageTitle}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 font-title">استيراد الحسابات من Excel/CSV مع معاينة وسجل قابل للتراجع.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-slate-50 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => switchTab("upload")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "upload" ? `bg-white text-${theme.accent}-700 shadow-sm ring-1 ring-slate-100` : "text-slate-500 hover:text-slate-800"}`}
          >
            <Upload className="h-4.5 w-4.5" /> رفع جديد
          </button>
          <button
            type="button"
            onClick={() => switchTab("history")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "history" ? `bg-white text-${theme.accent}-700 shadow-sm ring-1 ring-slate-100` : "text-slate-500 hover:text-slate-800"}`}
          >
            <History className="h-4.5 w-4.5" /> السجل
          </button>
        </div>
      </div>

      <div className="w-full">
        {tab === "history" ? (
          <AccountImportHistoryTab entityType={entityType} />
        ) : (
          <>
            {wizard.step === 1 && (
              <StepUpload wizard={wizard} theme={theme} detectedFields={detectedFields} onBack={() => navigate(listPath)} />
            )}
            {wizard.step === 2 && (
              <StepPreview wizard={wizard} theme={theme} />
            )}
            {wizard.step === 3 && (
              <StepDuplicates wizard={wizard} theme={theme} />
            )}
            {wizard.step === 4 && (
              <StepResult wizard={wizard} theme={theme} onBackToList={() => navigate(listPath)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepUpload({ wizard, theme, detectedFields, onBack }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
      <input
        ref={wizard.fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={wizard.handleFile}
        className="hidden"
      />

      <div
        onDragEnter={(e) => { e.preventDefault(); wizard.setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); wizard.setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); wizard.setDragActive(false); }}
        onDrop={wizard.handleDrop}
        onClick={() => wizard.fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
          wizard.dragActive
            ? `border-${theme.accent}-400 bg-${theme.accent}-50/50 ring-4 ring-${theme.accent}-100/50`
            : `border-slate-200 bg-slate-50/50 hover:border-slate-350 hover:bg-slate-50/80`
        }`}
      >
        {wizard.reading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className={`h-10 w-10 animate-spin text-${theme.accent}-600`} />
            <p className="text-sm font-bold text-slate-600">جاري قراءة الملف...</p>
          </div>
        ) : (
          <>
            <div className={`flex h-16 w-16 items-center justify-center rounded-xl bg-${theme.accent}-50 text-${theme.accent}-600 mb-4`}>
              <Upload className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 font-display">اسحب الملف هنا أو اضغط للاختيار</h3>
            <p className="mt-2 text-xs font-semibold text-slate-500">يدعم ملفات xlsx, xls, csv — حتى 5000 صف</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-1 text-[10px] font-black text-slate-500 font-mono">xlsx / xls / csv</span>
              <span className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-1 text-[10px] font-black text-slate-500 font-mono">حتى 5000 صف</span>
            </div>
          </>
        )}
      </div>

      {detectedFields.length > 0 && (
        <div className={`mt-4 rounded-xl border border-${theme.accent}-200 bg-${theme.accent}-50 px-4 py-3`}>
          <p className={`text-xs font-black text-${theme.accent}-700`}>
            اكتشف: {detectedFields.map(f => FIELD_LABELS[f] || f).join("، ")}
          </p>
        </div>
      )}

      {wizard.error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs font-black text-rose-700">{wizard.error}</p>
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" /> العودة للقائمة
        </button>
      </div>
    </div>
  );
}

function StepPreview({ wizard, theme }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-700">
            {wizard.counts.new} جديد
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-black text-amber-700">
            {wizard.counts.duplicate} مكرر
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-700">
            {wizard.counts.error} خطأ
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => wizard.setStep(1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            رجوع
          </button>
          <button
            type="button"
            disabled={!wizard.canProceedFromPreview || wizard.loading}
            onClick={wizard.proceedFromPreview}
            className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${theme.btnBg}`}
          >
            {wizard.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            متابعة
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-450">
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">الاسم</th>
                <th className="px-4 py-3.5">الهاتف</th>
                <th className="px-4 py-3.5">العنوان</th>
                <th className="px-4 py-3.5 text-center">الرصيد</th>
                <th className="px-4 py-3.5">الحالة</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wizard.rows.map((row) => (
                <tr key={row.__rowNumber} className="transition-colors hover:bg-slate-50/40 text-slate-700 font-semibold">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.__rowNumber}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{row.name || <span className="text-rose-400 italic text-xs">بدون اسم</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{row.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{row.address || "—"}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-700">{row.opening_balance || 0}</td>
                  <td className="px-4 py-3">
                    {row.status === "new" && (
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-2xs font-black ${theme.chipNew}`}>جديد</span>
                    )}
                    {row.status === "duplicate" && (
                      <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-2xs font-black text-amber-700">مكرر</span>
                    )}
                    {row.status === "error" && (
                      <span className="inline-flex rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-2xs font-black text-rose-700">خطأ</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => wizard.removeRow(row.__rowNumber)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                      title="حذف الصف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepDuplicates({ wizard, theme }) {
  const duplicateRows = wizard.rows.filter(r => r.status === "duplicate");
  const byName = new Map(wizard.existingAccounts.map(a => [String(a.name || "").trim().toLowerCase().replace(/\s+/g, " "), a]));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
        <p className="text-sm font-black text-amber-800">
          يوجد {duplicateRows.length} حساب مكرر. اختر لكل منهم: تخطي أو تحديث البيانات.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-450">
                <th className="px-5 py-3.5">الاسم</th>
                <th className="px-5 py-3.5 text-center">الرصيد الحالي</th>
                <th className="px-5 py-3.5 text-center">الرصيد في الملف</th>
                <th className="px-5 py-3.5 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {duplicateRows.map((row) => {
                const nameKey = String(row.name || "").trim().toLowerCase().replace(/\s+/g, " ");
                const existing = byName.get(nameKey);
                const action = wizard.duplicateActions[nameKey] || "skip";
                return (
                  <tr key={row.__rowNumber} className="transition-colors hover:bg-slate-50/40 text-slate-700 font-semibold">
                    <td className="px-5 py-3.5 font-black text-slate-900">{row.name}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-slate-500">{existing?.opening_balance ?? "—"}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-slate-700">{row.opening_balance}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => wizard.setDuplicateAction(nameKey, "skip")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${action === "skip" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                        >
                          تخطي
                        </button>
                        <button
                          type="button"
                          onClick={() => wizard.setDuplicateAction(nameKey, "update")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${action === "update" ? `bg-${theme.accent}-600 text-white border-${theme.accent}-600` : `bg-white text-${theme.accent}-600 border-${theme.accent}-200 hover:bg-${theme.accent}-50`}`}
                        >
                          تحديث
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => wizard.setStep(2)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          رجوع
        </button>
        <button
          type="button"
          disabled={wizard.loading}
          onClick={wizard.runImport}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${theme.btnBg}`}
        >
          {wizard.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          تنفيذ الاستيراد
        </button>
      </div>
    </div>
  );
}

function StepResult({ wizard, theme, onBackToList }) {
  const inserted = wizard.result?.inserted ?? 0;
  const updated = wizard.result?.updated ?? 0;
  const skipped = wizard.result?.skipped ?? 0;

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-slate-200 bg-white p-12 shadow-sm text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-${theme.accent}-50 text-${theme.accent}-600 ring-4 ring-${theme.accent}-100/40`}>
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-black text-slate-900 font-display">تم الاستيراد بنجاح</h2>
        <p className="mt-2 text-sm font-medium text-slate-500">اكتملت عملية استيراد الحسابات.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <span className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
          تم إضافة {inserted}
        </span>
        <span className={`inline-flex items-center rounded-xl border border-${theme.accent}-200 bg-${theme.accent}-50 px-5 py-3 text-sm font-black text-${theme.accent}-700`}>
          تم تحديث {updated}
        </span>
        <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-600">
          تم تخطي {skipped}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" /> العودة للقائمة
        </button>
        <button
          type="button"
          onClick={wizard.reset}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-[0.98] ${theme.btnBg}`}
        >
          <Upload className="h-4 w-4" /> استيراد ملف آخر
        </button>
      </div>
    </div>
  );
}
