import React, { useState, useCallback, useMemo } from "react";
import { CheckCircle2, Loader2, Info, ChevronDown } from "lucide-react";
import StepTable from "../StepTable";
import WarehouseChoicePanel from "./WarehouseChoicePanel";

function UnitGeneralRule({ wizard, rowsCount, fileUnits, missingUnits }) {
  const hasNoUnits = fileUnits.length === 0;
  const [generalAction, setGeneralAction] = useState(() => hasNoUnits ? "apply_first" : "create_missing");
  const [applied, setApplied] = useState(false);
  const [specificUnit, setSpecificUnit] = useState("");

  const allUnits = wizard.units || [];
  const missingCount = missingUnits.length;
  const missingRowsCount = missingUnits.reduce((sum, u) => sum + u.rows.length, 0);
  const totalRows = wizard.workingRows?.length || 0;

  const actions = useMemo(() => {
    const list = [];
    if (hasNoUnits) {
      list.push(
        { value: "apply_first", label: "تطبيق أول وحدة", desc: `تطبيق أول وحدة متاحة في النظام على جميع الصفوف.` },
      );
      if (allUnits.length > 1) {
        list.push(
          { value: "apply_specific", label: "تطبيق وحدة محددة", desc: "اختر وحدة من النظام لتطبيقها على جميع الصفوف." },
        );
      }
      list.push(
        { value: "create_new", label: "إنشاء وحدة جديدة", desc: "إنشاء وحدة جديدة وتطبيقها على جميع الصفوف." },
      );
    } else {
      list.push(
        { value: "apply_first", label: "تطبيق أول وحدة", desc: `تطبيق أول وحدة متاحة على الصفوف الناقصة.` },
      );
      if (missingCount > 0) {
        list.push(
          { value: "create_missing", label: "إنشاء الوحدات الناقصة", desc: `إنشاء ${missingCount} وحدة غير موجودة في النظام.` },
        );
      }
      list.push(
        { value: "link_all", label: "ربط الكل بأول وحدة", desc: "ربط جميع وحدات الملف غير الموجودة بأول وحدة متاحة." },
      );
    }
    return list;
  }, [hasNoUnits, missingCount, allUnits.length]);

  const projections = useMemo(() => ({
    apply_first: { rows: hasNoUnits ? rowsCount : rowsCount },
    apply_specific: { rows: hasNoUnits ? rowsCount : rowsCount },
    create_new: { rows: hasNoUnits ? rowsCount : rowsCount, units: 1 },
    create_missing: { rows: missingRowsCount, units: missingCount },
    link_all: { rows: missingRowsCount },
  }), [hasNoUnits, rowsCount, missingRowsCount, missingCount]);

  async function executeAction() {
    if (hasNoUnits) {
      const targetValue = allUnits[0]?.name || "";
      if (generalAction === "apply_first") {
        wizard.applyValueToRows("unit_name", targetValue, wizard.workingRows, "الوحدة", "unit-all");
      } else if (generalAction === "apply_specific") {
        if (specificUnit) wizard.applyValueToRows("unit_name", specificUnit, wizard.workingRows, "الوحدة", "unit-all");
      } else if (generalAction === "create_new") {
        const name = specificUnit || "وحدة";
        const created = await wizard.createMissingUnit(name);
        if (created?.name) wizard.applyValueToRows("unit_name", created.name, wizard.workingRows, "الوحدة", "unit-all");
      }
    } else {
      if (generalAction === "create_missing") {
        wizard.createAllMissingUnits();
      } else if (generalAction === "apply_first") {
        wizard.applyQuickUnitFix();
      } else if (generalAction === "apply_specific") {
        if (specificUnit) {
          wizard.setQuickUnitValue(specificUnit);
          setTimeout(() => wizard.applyQuickUnitFix(), 0);
        } else {
          wizard.applyQuickUnitFix();
        }
      } else if (generalAction === "create_new") {
        const name = specificUnit || "وحدة";
        wizard.createAndApplyUnit(name, name);
      } else if (generalAction === "link_all") {
        if (specificUnit) {
          wizard.setQuickUnitValue(specificUnit);
          setTimeout(() => wizard.applyQuickUnitFix(), 0);
        } else {
          wizard.applyQuickUnitFix();
        }
      }
    }
    setApplied(true);
  }

  const needsSpecificUnit = generalAction === "apply_specific" || generalAction === "create_new" || generalAction === "link_all";

  if (applied) return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-black text-emerald-900">تم تطبيق قاعدة الوحدات</div>
        <div className="text-xs font-bold text-emerald-700 mt-0.5">يمكنك تعديل الاختيار أو المتابعة.</div>
      </div>
      <button
        type="button"
        onClick={() => setApplied(false)}
        className="shrink-0 rounded-xl border border-emerald-300 bg-bg-surface px-4 py-2 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[0.98]"
      >
        تغيير الاختيار
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-sm">
      <h4 className="text-base font-black text-text-primary font-display mb-4">
        {hasNoUnits ? "تطبيق وحدة على الصفوف" : "قاعدة عامة لجميع الوحدات"}
      </h4>
      <p className="mt-1 text-sm font-bold text-text-secondary font-title mb-4">
        {hasNoUnits
          ? "لم نجد عمود وحدة واضح في الملف. اختر خيارا لتطبيق وحدة على جميع الصفوف."
          : `${rowsCount} صف يحتاج وحدة. اختر كيفية التعامل مع الوحدات غير الموجودة.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {actions.map((action) => {
          const active = generalAction === action.value;
          const proj = projections[action.value];
          return (
            <button
              key={action.value}
              type="button"
              onClick={() => { setGeneralAction(action.value); setApplied(false); setSpecificUnit(""); }}
              className={`rounded-xl border p-4 text-right transition-all duration-200 text-sm ${
                active
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                  : "border-border-normal bg-bg-surface hover:border-border-strong hover:shadow-sm"
              }`}
            >
              <div className="font-black text-text-primary">{action.label}</div>
              <div className="mt-1 text-xs font-semibold text-text-secondary leading-relaxed">{action.desc}</div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-black">
                {proj.rows > 0 && (
                  <span className={`rounded-lg px-2 py-0.5 tabular-nums ${
                    active ? "bg-primary/10 text-primary" : "bg-bg-overlay text-text-secondary"
                  }`}>
                    {proj.rows} صف
                  </span>
                )}
                {proj.units > 0 && (
                  <span className={`rounded-lg px-2 py-0.5 tabular-nums ${
                    active ? "bg-emerald-100 text-emerald-700" : "bg-bg-overlay text-text-secondary"
                  }`}>
                    {proj.units} وحدة جديدة
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {needsSpecificUnit && (
        <div className="mt-3 flex items-center gap-3">
          <select
            value={specificUnit}
            onChange={(e) => setSpecificUnit(e.target.value)}
            className="rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-border-strong focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
          >
            <option value="">{generalAction === "create_new" ? "اسم الوحدة الجديدة" : "اختر وحدة"}</option>
            {allUnits.map((unit) => (
              <option key={unit.id} value={unit.name}>{unit.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        {!applied ? (
          <button
            type="button"
            onClick={executeAction}
            disabled={needsSpecificUnit && !specificUnit}
            className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-40"
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
              onClick={() => setApplied(false)}
              className="rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-sm font-black text-text-primary shadow-sm transition hover:bg-bg-overlay active:scale-[0.98]"
            >
              تغيير الاختيار
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function UnitFixPanel({ wizard, rowsCount }) {
  const fileUnits = wizard.fileUnitOptions || [];
  const missingUnits = wizard.missingUnits || [];
  const [createNames, setCreateNames] = useState({});
  const [selectedUnits, setSelectedUnits] = useState({});
  const [resolvedKeys, setResolvedKeys] = useState(new Set());
  const [resolvingKey, setResolvingKey] = useState(null);
  const [appliedQuickFix, setAppliedQuickFix] = useState(false);
  const [expanded, setExpanded] = useState(fileUnits.length > 0);

  const markResolved = useCallback((key) => {
    setResolvedKeys((prev) => new Set(prev).add(key));
    setResolvingKey((prev) => prev === key ? null : prev);
  }, []);

  const resolvedCount = resolvedKeys.size + (appliedQuickFix ? 1 : 0);
  const totalCount = fileUnits.length;

  // When the file actually carries a unit column we let the user resolve each
  // distinct file unit directly (create / use / link). The "apply one unit to
  // all rows" general rule only makes sense when the file has NO unit column.
  const hasFileUnits = fileUnits.length > 0;

  return (
    <div className="space-y-4">
      {!hasFileUnits && (
        <UnitGeneralRule wizard={wizard} rowsCount={rowsCount} fileUnits={fileUnits} missingUnits={missingUnits} />
      )}

      {hasFileUnits && (
        <div className="rounded-2xl border border-border-normal bg-bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-sm font-black text-text-primary hover:bg-bg-overlay transition"
          >
            <span>وحدات الملف ({totalCount}) — أنشئ كل وحدة أو اربطها بوحدة موجودة</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>

          {expanded && (
            <div className="border-t border-border-subtle p-5">
              {fileUnits.length > 0 && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-bg-overlay">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${totalCount ? (resolvedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-text-secondary whitespace-nowrap">{resolvedCount} / {totalCount} تم</span>
                </div>
              )}

              <div className="divide-y divide-border-subtle rounded-2xl border border-border-normal bg-bg-overlay/40">
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
                              <span className="text-sm font-black text-text-primary">{entry.name}</span>
                              <div className="mt-0.5 text-xs font-bold text-emerald-700">{chosenText}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setResolvedKeys((prev) => { const n = new Set(prev); n.delete(entry.name); return n; })}
                            className="rounded-lg border border-border-normal bg-bg-surface px-3 py-1 text-[10px] font-black text-text-secondary hover:bg-bg-overlay transition"
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
                        <span className="text-base font-black text-text-primary font-display">{entry.name}</span>
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${entry.exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {entry.exists ? "موجودة في النظام" : "غير موجودة"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-text-secondary">
                        {entry.rows.length} صف {entry.sample ? `- مثال: ${entry.sample}` : ""}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-[11px] font-black text-text-secondary">إنشاء أو استخدام بهذا الاسم</label>
                      <div className="flex gap-2">
                        <input
                          value={createName}
                          onChange={(event) => setCreateNames((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                          className="min-w-0 flex-1 rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-border-strong focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
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
                      <label className="text-[11px] font-black text-text-secondary">أو اربطها بوحدة موجودة</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedUnit}
                          onChange={(event) => setSelectedUnits((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                          className="min-w-0 flex-1 rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-border-strong focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
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
                          className="shrink-0 rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-primary shadow-sm transition hover:bg-bg-overlay hover:border-border-strong active:scale-[0.98] disabled:opacity-40"
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
            </div>
          )}
        </div>
      )}

      <details className="rounded-2xl border border-border-normal bg-bg-overlay/60 p-4">
        <summary className="cursor-pointer text-sm font-black text-text-primary">خيارات متقدمة</summary>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <select
            value={wizard.quickUnitValue}
            onChange={(event) => wizard.setQuickUnitValue(event.target.value)}
            className="w-full rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-border-strong focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
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
                className="rounded-xl border border-amber-200 bg-bg-surface px-5 py-2.5 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-50 active:scale-[0.98] disabled:opacity-40"
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
    <div className="grid gap-3 rounded-2xl border border-border-normal bg-bg-overlay/60 p-4.5 shadow-inner">
      <select
        value={wizard.quickWarehouseValue}
        onChange={(event) => wizard.setQuickWarehouseValue(event.target.value)}
        className="w-full rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-sm font-bold outline-none shadow-sm transition hover:border-slate-350 focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
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
        className="w-full rounded-xl border border-border-normal bg-bg-surface py-3 text-sm font-black text-text-primary shadow-sm transition hover:bg-bg-overlay hover:border-border-strong active:scale-[0.98]"
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
  const title = isUnit ? "إصلاح الوحدات" : isWarehouse ? "إصلاح المخازن" : "إصلاح قرارات المخزون";
  const helper = rows.length
    ? `${rows.length} صف يحتاج قرارا هنا.`
    : "لا توجد صفوف تحتاج إصلاحا هنا.";

  return (
    <div className="space-y-5">
      <div className={`grid gap-4 ${isUnit ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="flex flex-col justify-between rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-text-primary font-display">{title}</h3>
            <p className="mt-1.5 text-sm font-medium text-text-secondary font-title">{helper}</p>
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

      {isUnit ? <UnitFixPanel wizard={wizard} rowsCount={rows.length || wizard.workingRows?.length || 0} /> : null}

      {isWarehouse ? (
        <WarehouseChoicePanel
          wizard={wizard}
          title="مخازن الملف"
          helper="أنشئ المخزن بنفس الاسم أو باسم مختلف، أو اربطه بمخزن موجود في النظام."
        />
      ) : null}

      {!resolved && (
        <StepTable
          wizard={wizard}
          rows={rows}
          columns={isUnit ? ["code", "name", "unit_name"] : ["code", "name", "store_name", "warehouse_id", "storage_plan"]}
          title={title}
          helper={helper}
          showActions={false}
          height={360}
        />
      )}
    </div>
  );
}
