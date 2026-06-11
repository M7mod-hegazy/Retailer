import React, { useMemo, useState } from "react";
import StepTable from "../StepTable";
import WarehouseChoicePanel from "./WarehouseChoicePanel";
import { normalizeKey } from "../../../../utils/excelImportExport";

export default function Step6Duplicates({ wizard }) {
  const rows = wizard.workingRows.filter((row) => wizard.duplicateRowNumbers.has(row.__rowNumber) || row.__combinedRows?.length);
  const [showAll, setShowAll] = useState(false);

  const duplicateGroups = wizard.duplicateGroups || [];

  const displayedGroups = useMemo(() => {
    return showAll ? duplicateGroups : duplicateGroups.slice(0, 12);
  }, [duplicateGroups, showAll]);

  function isDistributed(row) {
    const key = duplicateKeyForRow(row);
    const policy = wizard.duplicatePolicies[key];
    return policy === "warehouse" || (!policy && wizard.duplicateMode === "warehouse");
  }

  function isCombined(row) {
    const key = duplicateKeyForRow(row);
    const policy = wizard.duplicatePolicies[key];
    return policy === "combine" || (!policy && wizard.duplicateMode === "combine");
  }

  function policyForGroup(row) {
    const key = normalizeKey(wizard.duplicateKeyForRow ? wizard.duplicateKeyForRow(row) : (row.code || row.barcode || row.name));
    if (wizard.duplicatePolicies[key]) return wizard.duplicatePolicies[key];
    return wizard.duplicateMode;
  }

  function duplicateKeyForRow(row) {
    return wizard.duplicateKeyForRow ? wizard.duplicateKeyForRow(row) : normalizeKey(row.code || row.barcode || row.name);
  }

  function handleGroupDecision(row, policy) {
    wizard.setDuplicatePolicyForGroup(row, policy);
  }

  function undoGroupDecision(row) {
    const key = duplicateKeyForRow(row);
    if (!key) return;
    wizard.setDuplicatePolicies((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 font-display">تكرارات المخزون</h3>
            <p className="mt-1.5 text-sm font-semibold text-slate-500 font-title">
              وجدنا {duplicateGroups.length} صنف ظهر في أكثر من صف. لكل مجموعة اختر: <strong>دمج الكميات</strong> في صف واحد، أو <strong>توزيع</strong> كل صف على مخزن منفصل.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            <span className={`h-2 w-2 rounded-full ${wizard.duplicateMode === "warehouse" ? "bg-indigo-500" : "bg-slate-500"}`} />
            القرار العام الحالي: {wizard.duplicateMode === "warehouse" ? "توزيع على المخازن" : "دمج الكميات"}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          <button
            type="button"
            onClick={() => wizard.applyDuplicatePolicyToAll("combine")}
            className={`w-full rounded-xl py-3.5 text-sm font-black transition-all duration-200 ${wizard.duplicateMode === "combine" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"}`}
          >
            دمج كل التكرارات
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            يجمع كميات نفس الصنف في صف واحد ويستخدم مخزنا واحدا.
          </div>
          <div className="h-px bg-slate-200/60" />
          <button
            type="button"
            onClick={() => wizard.applyDuplicatePolicyToAll("warehouse")}
            className={`w-full rounded-xl py-3.5 text-sm font-black transition-all duration-200 ${wizard.duplicateMode === "warehouse" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"}`}
          >
            توزيع كل التكرارات على المخازن
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            يحافظ على كل صف مخزون، وكل صف يحتاج مخزنا موجودا أو منشأ الآن.
          </div>
        </div>
      </div>

      <WarehouseChoicePanel
        wizard={wizard}
        title="مخازن التوزيع من الملف"
        helper="لكل مخزن من الملف: أنشئه واستخدمه، غيّر اسمه قبل الإنشاء، أو اربطه بمخزن موجود في النظام."
      />

      {/* Per-group decision cards */}
      {duplicateGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 font-display">قرارات كل منتج مكرر</h3>
            <button
              type="button"
              onClick={() => setShowAll((p) => !p)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all"
            >
              {showAll ? "عرض أقل" : `عرض الكل (${duplicateGroups.length})`}
            </button>
          </div>

          {displayedGroups.map((group) => {
            const row = group[0];
            const policy = policyForGroup(row);
            const key = duplicateKeyForRow(row);
            const isOverridden = key && wizard.duplicatePolicies[key] !== undefined;
            const totalQty = group.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0);

            return (
              <div key={row.__rowNumber} className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 ${policy === "warehouse" ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white hover:shadow-md"}`}>
                <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-black text-slate-900 font-display">{row.name || row.code}</span>
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${policy === "warehouse" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                        {policy === "warehouse" ? "موزع على عدة مخازن" : "مدمج (كمية واحدة)"}
                      </span>
                      {isOverridden && (
                        <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-200">
                          قرار فردي
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
                      <span>{group.length} صفوف</span>
                      <span>إجمالي الكمية: {totalQty}</span>
                    </div>

                    {/* Row details */}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {group.map((item) => (
                        <div key={item.__rowNumber} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-black text-slate-400">صف {item.__rowNumber}</span>
                            <span className="text-xs font-black text-slate-700">{item.store_name || "مخزن الملف"}</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">الكمية</span>
                            <span className="text-sm font-black text-slate-900">{Number(item.stock_quantity || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-3">
                    <div className="text-xs font-black text-slate-600 mb-1">اختر قرار هذه المجموعة:</div>
                    <button
                      type="button"
                      onClick={() => handleGroupDecision(row, "combine")}
                      className={`w-full rounded-xl py-3 text-xs font-black transition-all duration-200 ${policy === "combine" ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 ring-2 ring-slate-900" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"}`}
                    >
                      دمج هذا الصنف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGroupDecision(row, "warehouse")}
                      className={`w-full rounded-xl py-3 text-xs font-black transition-all duration-200 ${policy === "warehouse" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 ring-2 ring-indigo-400" : "border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 active:scale-[0.98]"}`}
                    >
                      توزيع هذا الصنف
                    </button>
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => undoGroupDecision(row)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-[0.98]"
                      >
                        تراجع عن القرار الفردي (استخدم العام)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StepTable wizard={wizard} rows={rows} columns={["code", "name", "stock_quantity", "warehouse_id", "storage_plan"]} title="صفوف التكرار" helper="راجع المخزن والكمية بعد اختيار الدمج أو التوزيع. عمود ما سيحدث يوضح أثر كل صف عند التنفيذ." showActions height={360} />
    </div>
  );
}
