import React from "react";
import StepTable from "../StepTable";

export default function FixStep({ wizard, type }) {
  const isUnit = type === "unit";
  const isWarehouse = type === "warehouse";
  const rows = isUnit ? wizard.unitErrorRows : isWarehouse ? wizard.warehouseErrorRows : wizard.storageErrorRows;
  const title = isUnit ? "إصلاح الوحدات" : isWarehouse ? "إصلاح المخازن" : "إصلاح قرارات المخزون";
  const helper = rows.length
    ? `${rows.length} صف يحتاج قرارا هنا. ابدأ بإنشاء القيم الناقصة من الملف، ثم استخدم التطبيق الجماعي عند الحاجة.`
    : "لا توجد صفوف تحتاج إصلاحا هنا.";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 font-display">{title}</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">{helper}</p>
          </div>
          {wizard.lastAppliedFix ? (
            <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 ring-1 ring-emerald-250/20">
              آخر تطبيق جماعي: {wizard.lastAppliedFix.label} على {wizard.lastAppliedFix.count} صف
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          {isUnit ? (
            <>
              <select 
                value={wizard.quickUnitValue} 
                onChange={(event) => wizard.setQuickUnitValue(event.target.value)} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-350 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              >
                <option value="">أول وحدة متاحة</option>
                {wizard.units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
              </select>
              <button 
                type="button" 
                onClick={wizard.applyQuickUnitFix} 
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                تطبيق الوحدة على الصفوف
              </button>
              <div className="text-[10px] font-bold text-slate-400 font-title text-center">يغير فقط الصفوف التي لا تملك وحدة صالحة.</div>
            </>
          ) : (
            <>
              <select 
                value={wizard.quickWarehouseValue} 
                onChange={(event) => wizard.setQuickWarehouseValue(event.target.value)} 
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-350 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              >
                <option value="">المخزن الافتراضي</option>
                {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
              <button 
                type="button" 
                onClick={wizard.applyQuickWarehouseFix} 
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                تطبيق المخزن على الصفوف الناقصة
              </button>
              <button 
                type="button" 
                onClick={wizard.applyQuickWarehouseToAll} 
                className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
              >
                استبدال مخزن كل الصفوف
              </button>
              <div className="text-[10px] font-bold text-amber-700 font-title text-center leading-normal">
                تنبيه: زر الاستبدال يغير مخزن كل صفوف الاستيراد.
              </div>
            </>
          )}
        </div>
      </div>

      {isUnit && wizard.missingUnits.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-amber-900 font-display">وحدات موجودة في الملف وليست في النظام</h4>
              <p className="mt-1 text-sm font-medium text-amber-750 font-title">
                إنشاء الوحدة يجعل نفس اسم الوحدة صالحا لكل الصفوف التي تستخدمه تلقائيا.
              </p>
            </div>
            <button 
              type="button" 
              onClick={wizard.createAllMissingUnits} 
              disabled={wizard.categorySyncing} 
              className="rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-amber-800 active:scale-[0.98] disabled:opacity-40"
            >
              إنشاء كل الوحدات
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {wizard.missingUnits.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-white p-3.5 shadow-sm transition hover:shadow-md">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-800 font-display">{entry.name}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-400 font-mono">{entry.rows.length} صف</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => wizard.createMissingUnit(entry.name)} 
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

      {isWarehouse && wizard.missingWarehouses.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-amber-900 font-display">مخازن موجودة في الملف وليست في النظام</h4>
              <p className="mt-1 text-sm font-medium text-amber-750 font-title">
                إنشاء المخزن يحافظ على توزيع الملف كما هو. هذا مهم عند وجود نفس الصنف في أكثر من مخزن.
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

      <StepTable
        wizard={wizard}
        rows={rows}
        columns={isUnit ? ["code", "name", "unit_name"] : ["code", "name", "store_name", "warehouse_id", "storage_plan"]}
        title={title}
        helper={helper}
        showActions={false}
        height={360}
      />
    </div>
  );
}
