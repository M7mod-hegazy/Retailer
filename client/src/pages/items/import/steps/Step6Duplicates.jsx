import React from "react";
import StepTable from "../StepTable";

export default function Step6Duplicates({ wizard }) {
  const rows = wizard.workingRows.filter((row) => wizard.duplicateRowNumbers.has(row.__rowNumber) || row.__combinedRows?.length);
  const duplicatePolicyLabel = wizard.duplicateMode === "warehouse" ? "توزيع كل صف على مخزن" : "دمج كميات الصفوف المتكررة";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 font-display">تكرارات وتوزيع المخزون</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">
              وجدنا {wizard.duplicateGroups.length} صنف ظهر في أكثر من صف. اختر هل تجمع كمياته في صف واحد، أو تبقي الصفوف منفصلة حسب المخزن.
            </p>
          </div>
          <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            الاختيار العام الحالي: {duplicatePolicyLabel}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          <button 
            type="button" 
            onClick={() => wizard.applyDuplicatePolicyToAll("combine")} 
            className={`w-full rounded-xl py-3 text-sm font-black transition-all duration-200 ${wizard.duplicateMode === "combine" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"}`}
          >
            دمج كل التكرارات
          </button>
          <div className="text-[10px] font-bold text-slate-400 font-title text-center leading-normal">يجمع كميات نفس الصنف في صف واحد ويستخدم مخزنا واحدا.</div>
          <button 
            type="button" 
            onClick={() => wizard.applyDuplicatePolicyToAll("warehouse")} 
            className={`w-full rounded-xl py-3 text-sm font-black transition-all duration-200 ${wizard.duplicateMode === "warehouse" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"}`}
          >
            توزيع كل التكرارات على المخازن
          </button>
          <div className="text-[10px] font-bold text-slate-400 font-title text-center leading-normal">يحافظ على كل صف مخزون، وكل صف يحتاج مخزنا موجودا أو منشأ الآن.</div>
        </div>
      </div>

      {wizard.missingWarehouses.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-amber-900 font-display">قبل التوزيع: أنشئ مخازن الملف الناقصة</h4>
              <p className="mt-1 text-sm font-medium text-amber-750 font-title">
                عند اختيار التوزيع، لا نستبدل اسم مخزن الملف بالمخزن الافتراضي. أنشئ المخازن الناقصة أو اختر مخزنا بديلا لكل صف.
              </p>
            </div>
            <button 
              type="button" 
              onClick={wizard.createAllMissingWarehouses} 
              disabled={wizard.categorySyncing} 
              className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-amber-800 active:scale-[0.98] disabled:opacity-40"
            >
              إنشاء كل المخازن
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {wizard.missingWarehouses.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-white p-3.5 shadow-sm transition hover:shadow-md">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-800 font-display">{entry.name}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-400 font-mono">{entry.rows.length} صف</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => wizard.createMissingWarehouse(entry.name)} 
                  disabled={wizard.categorySyncing} 
                  className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-40"
                >
                  إنشاء
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {wizard.duplicateGroups.slice(0, 8).map((group) => {
          const row = group[0];
          const policy = wizard.productStoragePolicy(row);
          return (
            <div key={row.__rowNumber} className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm hover:shadow-md transition-all duration-350 flex flex-col justify-between">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-base font-black text-slate-900 font-display">{row.name || row.code}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400 font-mono">
                    {group.length} صفوف، إجمالي الكمية {group.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0)}
                  </div>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${policy === "warehouse" ? "bg-indigo-50 text-indigo-750 ring-indigo-200/30" : "bg-slate-50 text-slate-500 ring-slate-200/55"}`}>
                  {policy === "warehouse" ? "موزع" : "مدمج"}
                </span>
              </div>
              <div className="mt-4 grid gap-2.5 grid-cols-2">
                <button 
                  type="button" 
                  onClick={() => wizard.setDuplicatePolicyForGroup(row, "combine")} 
                  className={`rounded-xl py-2.5 text-xs font-black transition-all duration-200 ${policy === "combine" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  دمج هذا الصنف
                </button>
                <button 
                  type="button" 
                  onClick={() => wizard.setDuplicatePolicyForGroup(row, "warehouse")} 
                  className={`rounded-xl py-2.5 text-xs font-black transition-all duration-200 ${policy === "warehouse" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                >
                  توزيع هذا الصنف
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <StepTable wizard={wizard} rows={rows} columns={["code", "name", "stock_quantity", "warehouse_id", "storage_plan"]} title="صفوف التكرار" helper="راجع المخزن والكمية بعد اختيار الدمج أو التوزيع. عمود ما سيحدث يوضح أثر كل صف عند التنفيذ." showActions height={360} />
    </div>
  );
}
