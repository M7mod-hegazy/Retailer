import React, { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, History, Upload, Trash2, Loader2, CheckCircle2, AlertTriangle, Link2, MinusCircle, Eye } from "lucide-react";
import { useAccountImportWizard } from "./useAccountImportWizard";
import { useFieldNavigation } from "../../../hooks/useFieldNavigation";
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

  const detectedFields = Object.values(wizard.mapping).filter(Boolean);

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
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "upload" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Upload className="h-4.5 w-4.5" /> رفع جديد
          </button>
          <button
            type="button"
            onClick={() => switchTab("history")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-250 ${tab === "history" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:text-slate-800"}`}
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
            {/* Step Indicator Bar */}
            <div className="mb-6 grid grid-cols-4 gap-2.5">
              {[
                { num: 1, label: "رفع الملف" },
                { num: 2, label: "ربط الأعمدة" },
                { num: 3, label: "معاينة" },
                { num: 4, label: "تنفيذ" },
              ].map((s) => {
                const isActive = wizard.step === s.num;
                const isDone = wizard.step > s.num || (s.num === 4 && wizard.result);
                return (
                  <div key={s.num} className={`rounded-xl border p-3 text-center transition-all duration-300 ${isActive ? "border-primary bg-primary text-white shadow-md" : isDone ? "border-emerald-150 bg-emerald-50/50 text-emerald-800" : "border-slate-200 bg-slate-50/50 text-slate-400"}`}>
                    <div className={`text-[10px] font-black font-mono ${isActive ? "text-emerald-400" : isDone ? "text-emerald-600" : "text-slate-400"}`}>
                      {isDone ? "✓" : `#${s.num}`}
                    </div>
                    <div className="mt-1 text-xs font-black">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Step 1: Upload */}
            {wizard.step === 1 && (
              <StepUpload wizard={wizard} theme={theme} onBack={() => navigate(listPath)} />
            )}

            {/* Step 2: Column Mapping (NEW) */}
            {wizard.step === 2 && (
              <StepColumns wizard={wizard} theme={theme} />
            )}

            {/* Step 3: Preview */}
            {wizard.step === 3 && (
              <StepPreview wizard={wizard} theme={theme} />
            )}

            {/* Step 4: Duplicates (was step 3) */}
            {wizard.step === 4 && (
              <StepDuplicates wizard={wizard} theme={theme} />
            )}

            {/* Step 5: Result (was step 4) */}
            {wizard.step === 5 && (
              <StepResult wizard={wizard} theme={theme} onBackToList={() => navigate(listPath)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepUpload({ wizard, theme, onBack }) {
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
            ? "border-slate-500 bg-slate-50/80 ring-4 ring-slate-100/50"
            : "border-slate-200 bg-slate-50/50 hover:border-slate-350 hover:bg-slate-50/80"
        }`}
      >
        {wizard.reading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-slate-600" />
            <p className="text-sm font-bold text-slate-600">جاري قراءة الملف...</p>
          </div>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-600 mb-4">
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

      {wizard.error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs font-black text-rose-700">{wizard.error}</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
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

/* ── NEW: Column Mapping Step ───────────────────────────────── */
function StepColumns({ wizard }) {
  const columnRefs = useRef([]);
  const proceedRef = useRef(null);
  const handleKeyDown = useFieldNavigation();
  const mappedName = wizard.hasNameMapped;
  const mappedCount = wizard.mappedFieldsCount;
  const totalColumns = wizard.totalColumns || 0;
  const ignoredColumns = Math.max(0, totalColumns - mappedCount);

  const usefulIgnored = wizard.headers.filter((header, index) => {
    if (wizard.mapping[index]) return false;
    return wizard.sampleValues(index).length > 0;
  }).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-display">ربط أعمدة الملف</h3>
              <p className="mt-1 text-sm font-medium text-slate-500 font-title">
                اختر حقل النظام المناسب لكل عمود من ملفك. الأعمدة غير المربوطة لن تُستورد.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ring-1 transition-all ${
              mappedName
                ? "bg-emerald-50 text-emerald-700 ring-emerald-250/30"
                : "bg-rose-50 text-rose-700 ring-rose-250/30 animate-pulse"
            }`}>
              {mappedName ? <CheckCircle2 className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
              {mappedName ? "الاسم مربوط" : "الاسم مطلوب"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              ["الأعمدة", totalColumns, "text-slate-900"],
              ["المربوط", mappedCount, "text-emerald-700"],
              ["غير مستورد", ignoredColumns, "text-slate-500"],
              ["البيانات", wizard.totalDataRows, "text-indigo-650"],
            ].map(([label, value, colorClass]) => (
              <div key={label} className="rounded-xl border border-slate-150 bg-slate-50/60 p-4 transition-all duration-200 hover:bg-slate-50">
                <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{label}</div>
                <div className={`mt-1.5 text-2xl font-black ${colorClass}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 shadow-inner">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 font-title">
            <Eye className="h-4.5 w-4.5 text-slate-500" />
            ماذا يعني كل حقل؟
          </div>
          <div className="mt-4 space-y-3 text-xs font-bold leading-relaxed text-slate-600">
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
              <span className="text-emerald-700">الاسم</span> — اسم العميل/المورد (مطلوب)
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
              <span className="text-slate-700">الهاتف</span> — رقم الجوال أو الهاتف
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
              <span className="text-slate-700">العنوان</span> — عنوان الحساب
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
              <span className="text-sky-700">الرصيد</span> — الرصيد الافتتاحي (رقم فقط)
            </div>
          </div>
        </div>
      </div>

      {!mappedName ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-250 bg-rose-50/80 px-5 py-4 text-sm font-black text-rose-800 shadow-sm backdrop-blur-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <span>حقل الاسم مطلوب. اربط أحد أعمدة الملف بحقل "الاسم" للمتابعة.</span>
        </div>
      ) : null}

      {usefulIgnored > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-250 bg-amber-50/80 px-5 py-4 text-sm font-black text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <span>{usefulIgnored} عمود يحتوي بيانات لكنه غير مستورد. راجعه قبل المتابعة.</span>
        </div>
      ) : null}

      <div className="grid gap-3.5">
        {wizard.headers.map((header, index) => {
          const field = wizard.mapping[index] || "";
          const samples = wizard.sampleValues(index);
          const hasUsefulData = samples.length > 0;
          const selectedField = wizard.ACCOUNT_FIELDS.find((itemField) => itemField.key === field);

          return (
            <div
              key={`${header}-${index}`}
              className={`rounded-2xl border bg-white p-4.5 shadow-sm transition-all duration-300 ${
                field
                  ? "border-emerald-250 ring-1 ring-emerald-50/40"
                  : hasUsefulData
                  ? "border-amber-250 ring-1 ring-amber-50/40"
                  : "border-slate-200 hover:border-slate-350"
              }`}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black font-mono text-slate-500">عمود {index + 1}</span>
                    <h4 className="truncate text-base font-black text-slate-900 font-display">{String(header || `بدون عنوان ${index + 1}`)}</h4>
                    {field ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200/50 shadow-sm">
                        <Link2 className="h-3.5 w-3.5" /> {selectedField?.label || field}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
                        <MinusCircle className="h-3.5 w-3.5" /> غير مستورد
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
                    {samples.length ? samples.map((sample, sampleIndex) => (
                      <div key={`${sampleIndex}-${sample}`} className="min-h-[44px] rounded-xl border border-slate-150 bg-slate-50/40 px-3 py-2.5 text-xs font-bold text-slate-650 transition hover:bg-slate-50">
                        <div className="text-[9px] font-black text-slate-400 font-mono tracking-wide">عينة {sampleIndex + 1}</div>
                        <div className="mt-1 truncate font-mono text-slate-700" title={String(sample)}>{String(sample)}</div>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-3 text-xs font-bold text-slate-400 md:col-span-4 text-center">لا توجد عينات واضحة.</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-center border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0 lg:border-r lg:pr-4">
                  <label className="mb-1.5 block text-xs font-black text-slate-500 font-title">حقل النظام</label>
                  <select
                    ref={el => { columnRefs.current[index] = el; }}
                    value={field}
                    onChange={(event) => wizard.updateMapping(index, event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-350 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                    onKeyDown={e => {
                      const next = columnRefs.current[index + 1];
                      const prev = columnRefs.current[index - 1];
                      const last = columnRefs.current[index - 1] || columnRefs.current[columnRefs.current.length - 1];
                      if (index === wizard.headers.length - 1) {
                        handleKeyDown(e, { nextRef: proceedRef, prevRef: prev });
                      } else {
                        handleKeyDown(e, { nextRef: next, prevRef: prev });
                      }
                    }}
                  >
                    <option value="">غير مستورد</option>
                    {wizard.ACCOUNT_FIELDS.map((accountField) => <option key={accountField.key} value={accountField.key}>{accountField.label}</option>)}
                  </select>
                  <div className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 transition-all ${
                    field
                      ? "bg-emerald-50/70 text-emerald-700 ring-emerald-100/50"
                      : hasUsefulData
                      ? "bg-amber-50/70 text-amber-700 ring-amber-100/50"
                      : "bg-slate-50 text-slate-400 ring-slate-100"
                  }`}>
                    {field ? `سيستخدم كحقل: ${selectedField?.label || field}` : hasUsefulData ? "هذا العمود سيترك خارج الاستيراد." : "يمكن تركه خارج الاستيراد."}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sticky bottom-4 z-10">
        <button
          type="button"
          onClick={() => wizard.setStep(1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          رجوع
        </button>
        <div className="text-sm font-bold text-slate-500">
          {mappedName ? "✓ تم ربط الاسم. يمكنك المتابعة." : "اربط حقل الاسم أولا"}
        </div>
        <button
          ref={proceedRef}
          type="button"
          disabled={!mappedName || wizard.loading}
          onClick={wizard.proceedFromColumns}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-primary-600 active:scale-95 disabled:opacity-40"
        >
          متابعة ←
        </button>
      </div>
    </div>
  );
}

/* ── Preview Step ─────────────────────────────────────────── */
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
            onClick={() => wizard.setStep(2)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            رجوع للأعمدة
          </button>
          <button
            type="button"
            disabled={!wizard.canProceedFromPreview || wizard.loading}
            onClick={wizard.proceedFromPreview}
            className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 bg-primary hover:bg-primary-600`}
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
                      <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-2xs font-black text-emerald-700">جديد</span>
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

/* ── Duplicates Step ──────────────────────────────────────── */
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
                  <tr key={row.__rowNumber} className={`transition-colors hover:bg-slate-50/40 font-semibold ${action === "update" ? "bg-blue-50/40" : "text-slate-700"}`}>
                    <td className="px-5 py-3.5 font-black text-slate-900">{row.name}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-slate-500">{existing?.opening_balance ?? "—"}</td>
                    <td className="px-5 py-3.5 text-center font-mono text-slate-700">{row.opening_balance}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => wizard.setDuplicateAction(nameKey, "skip")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-black transition inline-flex items-center gap-1.5 ${action === "skip" ? "bg-primary text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                        >
                          {action === "skip" ? <CheckCircle2 className="h-3 w-3" /> : null}
                          تخطي
                        </button>
                        <button
                          type="button"
                          onClick={() => wizard.setDuplicateAction(nameKey, "update")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-black transition inline-flex items-center gap-1.5 ${action === "update" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"}`}
                        >
                          {action === "update" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
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
          onClick={() => wizard.setStep(3)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          رجوع للمعاينة
        </button>
        <button
          type="button"
          disabled={wizard.loading}
          onClick={wizard.runImport}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40 hover:bg-primary-600"
        >
          {wizard.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          تنفيذ الاستيراد
        </button>
      </div>
    </div>
  );
}

/* ── Result Step ──────────────────────────────────────────── */
function StepResult({ wizard, theme, onBackToList }) {
  const inserted = wizard.result?.inserted ?? 0;
  const updated = wizard.result?.updated ?? 0;
  const skipped = wizard.result?.skipped ?? 0;

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-slate-200 bg-white p-12 shadow-sm text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100/40">
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
        <span className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700">
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
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-[0.98] hover:bg-primary-600"
        >
          <Upload className="h-4 w-4" /> استيراد ملف آخر
        </button>
      </div>
    </div>
  );
}
