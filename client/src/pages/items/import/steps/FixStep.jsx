import React, { useState, useCallback } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import StepTable from "../StepTable";
import WarehouseChoicePanel from "./WarehouseChoicePanel";

function UnitFixPanel({ wizard, rowsCount }) {
  const fileUnits = wizard.fileUnitOptions || [];
  const [createNames, setCreateNames] = useState({});
  const [selectedUnits, setSelectedUnits] = useState({});
  const [resolvedKeys, setResolvedKeys] = useState(new Set());
  const [resolvingKey, setResolvingKey] = useState(null);
  const [appliedQuickFix, setAppliedQuickFix] = useState(false);

  const markResolved = useCallback((key) => {
    setResolvedKeys((prev) => new Set(prev).add(key));
    setResolvingKey((prev) => prev === key ? null : prev);
  }, []);

  const resolvedCount = resolvedKeys.size + (appliedQuickFix ? 1 : 0);
  const totalCount = fileUnits.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-black text-slate-900 font-display">اختر ماذا نفعل بالوحدات</h4>
          <p className="mt-1 text-sm font-bold text-slate-500 font-title">
            النظام قرأ الوحدة من ملفك. اختر اعتمادها كما هي، أو أنشئها إذا كانت غير موجودة.
          </p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
          {rowsCount} صف يحتاج مراجعة
        </span>
      </div>

      {/* Decision progress */}
      {fileUnits.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${totalCount ? (resolvedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-black text-slate-500 whitespace-nowrap">{resolvedCount} / {totalCount} تم</span>
        </div>
      )}

      {fileUnits.length ? (
        <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/40">
          {fileUnits.map((entry) => {
            const isResolved = resolvedKeys.has(entry.name);
            const createName = createNames[entry.name] ?? entry.name;
            const selectedUnit = selectedUnits[entry.name] || "";
            const isResolving = resolvingKey === entry.name && wizard.categorySyncing;

            if (isResolved) {
              const chosenText = selectedUnits[entry.name]
                ? `مرتبطة بوحدة: ${selectedUnits[entry.name]}`
                : `سيُنشئ باسم: ${createNames[entry.name] || entry.name}`;
              return (
                <div key={entry.name} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-sm font-black text-slate-900">{entry.name}</span>
                        <div className="mt-0.5 text-xs font-bold text-emerald-700">{chosenText}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResolvedKeys((prev) => { const n = new Set(prev); n.delete(entry.name); return n; })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition"
                    >
                      تغيير
                    </button>
                  </div>
                </div>
              );
            }

            return (
            <div key={entry.name} className="grid gap-4 p-4 xl:grid-cols-[minmax(180px,1fr)_minmax(260px,0.95fr)_minmax(260px,0.95fr)] xl:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-900 font-display">{entry.name}</span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${entry.exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {entry.exists ? "موجودة في النظام" : "غير موجودة"}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  {entry.rows.length} صف {entry.sample ? `- مثال: ${entry.sample}` : ""}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-slate-500">إنشاء أو استخدام بهذا الاسم</label>
                <div className="flex gap-2">
                  <input
                    value={createName}
                    onChange={(event) => setCreateNames((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setResolvingKey(entry.name);
                      if (entry.exists && createName.trim() === entry.name) {
                        wizard.applyFileUnitChoice(entry.name, entry.name);
                      } else {
                        await wizard.createAndApplyUnit(entry.name, createName);
                      }
                      markResolved(entry.name);
                    }}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white transition hover:bg-primary-600 active:scale-[0.98] disabled:opacity-40 inline-flex items-center gap-1.5"
                    disabled={wizard.categorySyncing || !String(createName || "").trim()}
                  >
                    {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {entry.exists && createName.trim() === entry.name ? "استخدام" : "إنشاء واستخدام"}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-slate-500">أو اربطها بوحدة موجودة</label>
                <div className="flex gap-2">
                  <select
                    value={selectedUnit}
                    onChange={(event) => setSelectedUnits((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">اختر وحدة</option>
                    {wizard.units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      wizard.applyFileUnitChoice(entry.name, selectedUnit);
                      setResolvedKeys((prev) => new Set(prev).add(entry.name));
                    }}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40"
                    disabled={!selectedUnit}
                  >
                    استخدامها
                  </button>
                </div>
              </div>

            </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
          لم نجد وحدة واضحة داخل الملف. افتح الخيارات المتقدمة لتطبيق وحدة واحدة على الصفوف الناقصة.
        </div>
      )}

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <summary className="cursor-pointer text-sm font-black text-slate-700">خيارات متقدمة</summary>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={wizard.quickUnitValue}
            onChange={(event) => wizard.setQuickUnitValue(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
          >
            <option value="">أول وحدة متاحة</option>
            {wizard.units.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { wizard.applyQuickUnitFix(); setAppliedQuickFix(true); }}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-primary-600 active:scale-[0.98]"
            >
              تطبيق على الصفوف الناقصة
            </button>
            {wizard.missingUnits.length ? (
              <button
                type="button"
                onClick={wizard.createAllMissingUnits}
                disabled={wizard.categorySyncing}
                className="rounded-xl border border-amber-200 bg-white px-5 py-2.5 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-50 active:scale-[0.98] disabled:opacity-40"
              >
                إنشاء كل الوحدات الناقصة
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}

function WarehouseQuickPanel({ wizard }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
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
        className="w-full rounded-xl bg-primary py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-600 active:scale-[0.98]"
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
      <div className="text-center text-[10px] font-bold leading-normal text-amber-700 font-title">
        تنبيه: زر الاستبدال يغير مخزن كل صفوف الاستيراد.
      </div>
    </div>
  );
}

export default function FixStep({ wizard, type, goNext }) {
  const isUnit = type === "unit";
  const isWarehouse = type === "warehouse";
  const rows = isUnit ? wizard.unitErrorRows : isWarehouse ? wizard.warehouseErrorRows : wizard.storageErrorRows;
  const resolved = rows.length === 0;
  const tableRows = resolved ? wizard.workingRows : rows;
  const title = isUnit ? "إصلاح الوحدات" : isWarehouse ? "إصلاح المخازن" : "إصلاح قرارات المخزون";
  const helper = rows.length
    ? `${rows.length} صف يحتاج قرارا هنا.`
    : "لا توجد صفوف تحتاج إصلاحا هنا.";

  return (
    <div className="space-y-5">
      <div className={`grid gap-4 ${isUnit ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-slate-900 font-display">{title}</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">{helper}</p>
          </div>
          {wizard.lastAppliedFix ? (
            <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 ring-1 ring-emerald-250/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              آخر تطبيق: {wizard.lastAppliedFix.label} على {wizard.lastAppliedFix.count} صف
            </div>
          ) : null}
        </div>

        {isWarehouse ? <WarehouseQuickPanel wizard={wizard} /> : null}
      </div>

      {resolved ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <h4 className="text-sm font-black text-emerald-900">تم حل مشاكل هذه الخطوة</h4>
              <p className="mt-1 text-xs font-bold text-emerald-700">يمكنك المتابعة أو تعديل الصفوف من الجدول بالأسفل.</p>
            </div>
          </div>
          <button type="button" onClick={() => goNext?.()} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]">
            متابعة ←
          </button>
        </div>
      ) : null}

      {isUnit ? <UnitFixPanel wizard={wizard} rowsCount={rows.length} /> : null}

      {isWarehouse ? (
        <WarehouseChoicePanel
          wizard={wizard}
          title="مخازن الملف"
          helper="أنشئ المخزن بنفس الاسم أو باسم مختلف، أو اربطه بمخزن موجود في النظام."
        />
      ) : null}

      <StepTable
        wizard={wizard}
        rows={tableRows}
        columns={isUnit ? ["code", "name", "unit_name"] : ["code", "name", "store_name", "warehouse_id", "storage_plan"]}
        title={title}
        helper={helper}
        showActions={false}
        height={360}
      />
    </div>
  );
}
