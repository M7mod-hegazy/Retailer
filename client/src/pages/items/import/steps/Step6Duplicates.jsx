import React, { useMemo, useState, useRef, useCallback } from "react";
import { CheckCircle2, AlertTriangle, CornerDownLeft, RotateCcw, Search, Layers, Warehouse } from "lucide-react";
import StepTable from "../StepTable";
import WarehouseChoicePanel from "./WarehouseChoicePanel";
import { normalizeKey } from "../../../../utils/excelImportExport";

function getKey(wizard, row) {
  return normalizeKey(wizard.duplicateKeyForRow ? wizard.duplicateKeyForRow(row) : (row.code || row.barcode || row.name));
}

export default function Step6Duplicates({ wizard }) {
  const rows = wizard.workingRows.filter((row) => wizard.duplicateRowNumbers.has(row.__rowNumber) || row.__combinedRows?.length);
  const [showAll, setShowAll] = useState(false);
  const duplicateGroups = wizard.duplicateGroups || [];
  const confirmed = wizard.duplicatesConfirmed;

  const [pendingMode, setPendingMode] = useState(null);
  const [pendingMap, setPendingMap] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const confirmRef = useRef(null);

  const effectiveMode = pendingMode != null ? pendingMode : wizard.duplicateMode;

  function effectivePolicy(key) {
    if (pendingMap[key] !== undefined) return pendingMap[key];
    return effectiveMode;
  }

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return duplicateGroups;
    return duplicateGroups.filter((g) => {
      const row = g[0];
      return (
        String(row.name || "").toLowerCase().includes(q) ||
        String(row.code || "").toLowerCase().includes(q) ||
        String(row.barcode || "").toLowerCase().includes(q)
      );
    });
  }, [duplicateGroups, searchQuery]);

  const decidedCount = duplicateGroups.filter((g) => {
    const key = getKey(wizard, g[0]);
    return pendingMap[key] !== undefined || effectiveMode != null;
  }).length;

  const hasPending = pendingMode != null || Object.keys(pendingMap).length > 0;
  const allDecided = duplicateGroups.length > 0 && decidedCount === duplicateGroups.length;

  function handleBulk(policy) {
    setPendingMode(policy);
    setPendingMap({});
  }

  function handleGroup(row, policy) {
    const key = getKey(wizard, row);
    setPendingMap((prev) => ({ ...prev, [key]: policy }));
    if (pendingMode != null) setPendingMode(null);
  }

  function handleClearGroup(row) {
    const key = getKey(wizard, row);
    setPendingMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleResetAll() {
    setPendingMode(null);
    setPendingMap({});
  }

  const handleConfirm = useCallback(() => {
    if (!allDecided || confirming) return;
    setConfirming(true);
    setTimeout(() => {
      if (pendingMode != null) {
        wizard.setDuplicateMode(pendingMode);
        wizard.setDuplicatePolicies({});
      }
      Object.entries(pendingMap).forEach(([key, policy]) => {
        const group = duplicateGroups.find((g) => getKey(wizard, g[0]) === key);
        if (group) wizard.setDuplicatePolicyForGroup(group[0], policy);
      });
      wizard.setDuplicatesConfirmed(true);
      setPendingMode(null);
      setPendingMap({});
      setConfirming(false);
      confirmRef.current?.blur();
    }, 350);
  }, [allDecided, confirming, pendingMode, pendingMap, duplicateGroups, wizard]);

  function handleChangeDecisions() {
    wizard.setDuplicatesConfirmed(false);
    setPendingMode(null);
    setPendingMap({});
  }

  function handleConfirmKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirm();
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-xl font-black text-slate-900 font-display">تكرارات المخزون</h3>
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black ring-1 ${
                confirmed
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : allDecided
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
              }`}>
                {confirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {confirmed ? "مؤكد" : `${decidedCount} / ${duplicateGroups.length} مقرر`}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-500 font-title">
              وجدنا {duplicateGroups.length} صنف ظهر في أكثر من صف. لكل مجموعة اختر: <strong>دمج الكميات</strong> في صف واحد، أو <strong>توزيع</strong> كل صف على مخزن منفصل.
            </p>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            <span className={`h-2 w-2 rounded-full ${effectiveMode === "warehouse" ? "bg-indigo-500" : "bg-slate-500"}`} />
            القرار العام: {effectiveMode === "warehouse" ? "توزيع على المخازن" : "دمج الكميات"}
            {pendingMode != null && <span className="text-[10px] text-amber-600 font-bold">(معلق)</span>}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          <button
            type="button"
            onClick={() => handleBulk("combine")}
            className={`w-full rounded-xl py-3.5 text-sm font-black transition-all duration-200 inline-flex items-center justify-center gap-2 ${
              pendingMode === "combine"
                ? "ring-2 ring-emerald-400 bg-emerald-700 text-white shadow-md"
                : effectiveMode === "combine" && pendingMode == null
                ? "bg-primary text-white shadow-md shadow-slate-900/10"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
            }`}
          >
            {pendingMode === "combine" ? <CheckCircle2 className="h-4 w-4" /> : null}
            دمج كل التكرارات
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            يجمع كميات نفس الصنف في صف واحد ويستخدم مخزنا واحدا.
          </div>
          <div className="h-px bg-slate-200/60" />
          <button
            type="button"
            onClick={() => handleBulk("warehouse")}
            className={`w-full rounded-xl py-3.5 text-sm font-black transition-all duration-200 inline-flex items-center justify-center gap-2 ${
              pendingMode === "warehouse"
                ? "ring-2 ring-indigo-400 bg-indigo-600 text-white shadow-md"
                : effectiveMode === "warehouse" && pendingMode == null
                ? "bg-primary text-white shadow-md shadow-slate-900/10"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
            }`}
          >
            {pendingMode === "warehouse" ? <CheckCircle2 className="h-4 w-4" /> : null}
            توزيع كل التكرارات على المخازن
          </button>
          <div className="text-center text-[10px] font-bold leading-normal text-slate-500">
            يحافظ على كل صف مخزون، وكل صف يحتاج مخزنا موجودا أو منشأ الآن.
          </div>
          <div className="h-px bg-slate-200/60" />
          {confirmed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-black text-emerald-800">تم تأكيد جميع القرارات</span>
              </div>
              <button
                type="button"
                onClick={handleChangeDecisions}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-3 w-3 inline-block ml-1" />
                تغيير
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {hasPending && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700">
                    {decidedCount}/{duplicateGroups.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-[10px] font-black text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    إلغاء الكل
                  </button>
                </div>
              )}
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                onKeyDown={handleConfirmKeyDown}
                disabled={!allDecided || confirming}
                tabIndex={0}
                className={`w-full rounded-xl px-4 py-3 text-xs font-black text-white shadow-md transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-2 ${confirming ? "bg-emerald-600 scale-[0.97]" : "bg-primary hover:bg-primary-600"}`}
              >
                {confirming ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 animate-bounce" />
                    جارٍ الحفظ…
                  </>
                ) : (
                  <>
                    <CornerDownLeft className="h-4 w-4" />
                    تأكيد القرارات
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {duplicateGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-black font-display" style={{ color: "var(--text-primary)" }}>قرارات كل منتج مكرر</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم أو كود..."
                  className="rounded-xl border py-2 pr-9 pl-3 text-xs font-bold outline-none transition w-44 focus:w-56"
                  style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAll((p) => !p)}
                className="rounded-xl border px-4 py-2 text-xs font-black transition-all"
                style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}
              >
                {showAll ? "عرض أقل" : `عرض الكل (${duplicateGroups.length})`}
              </button>
            </div>
          </div>

          {/* Confirmed choices summary */}
          {confirmed && (
            <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--success-border)", backgroundColor: "var(--success-bg)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success-text)" }} />
                <span className="text-sm font-black" style={{ color: "var(--success-text)" }}>ملخص القرارات المؤكدة</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { policy: "combine", label: "دمج الكميات", Icon: Layers, groups: duplicateGroups.filter((g) => (wizard.duplicatePolicies[getKey(wizard, g[0])] || wizard.duplicateMode) === "combine") },
                  { policy: "warehouse", label: "توزيع على المخازن", Icon: Warehouse, groups: duplicateGroups.filter((g) => (wizard.duplicatePolicies[getKey(wizard, g[0])] || wizard.duplicateMode) === "warehouse") },
                ].map(({ label, Icon, groups: policyGroups }) => (
                  policyGroups.length > 0 && (
                    <div key={label} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-secondary)" }} />
                        <span className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>{label}</span>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-black" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}>{policyGroups.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {policyGroups.slice(0, 8).map((g) => (
                          <span key={g[0].__rowNumber} className="rounded-lg px-2 py-1 text-[10px] font-bold truncate max-w-[140px]" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-secondary)" }}>
                            {g[0].name || g[0].code}
                          </span>
                        ))}
                        {policyGroups.length > 8 && (
                          <span className="rounded-lg px-2 py-1 text-[10px] font-black" style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}>+{policyGroups.length - 8}</span>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {searchQuery && filteredGroups.length === 0 && (
            <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border-normal)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>لا توجد نتائج لـ "{searchQuery}"</p>
            </div>
          )}

          {(showAll ? filteredGroups : filteredGroups.slice(0, 3)).map((group) => {
            const row = group[0];
            const key = getKey(wizard, row);
            const policy = effectivePolicy(key);
            const isPending = pendingMap[key] !== undefined || pendingMode != null;
            const hasIndividualOverride = pendingMap[key] !== undefined;
            const totalQty = group.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0);
            const isChosen = pendingMap[key] !== undefined || pendingMode != null;

            return (
              <div key={row.__rowNumber} className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 ${
                confirmed
                  ? "border-emerald-200 bg-emerald-50/20"
                  : isChosen
                  ? policy === "warehouse"
                    ? "border-indigo-300 bg-indigo-50/40 ring-2 ring-indigo-200"
                    : "border-emerald-300 bg-emerald-50/40 ring-2 ring-emerald-200"
                  : "border-slate-200 bg-white hover:shadow-md"
              }`}>
                <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-black text-slate-900 font-display">{row.name || row.code}</span>
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ring-1 ${
                        policy === "warehouse"
                          ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                          : "bg-slate-100 text-slate-600 ring-slate-200"
                      }`}>
                        {isChosen || confirmed ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {policy === "warehouse" ? "موزع على عدة مخازن" : "مدمج (كمية واحدة)"}
                      </span>
                      {hasIndividualOverride && (
                        <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-200">
                          قرار فردي
                        </span>
                      )}
                      {confirmed && (
                        <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">
                          مؤكد
                        </span>
                      )}
                      {!confirmed && isPending && (
                        <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-200">
                          معلق
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
                      <span>{group.length} صفوف</span>
                      <span>إجمالي الكمية: {totalQty}</span>
                    </div>

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

                  {!confirmed && (
                    <div className="flex flex-col justify-center gap-3">
                      <div className="text-xs font-black text-slate-600 mb-1">اختر قرار هذه المجموعة:</div>
                      <button
                        type="button"
                        onClick={() => handleGroup(row, "combine")}
                        className={`w-full rounded-xl py-3 text-xs font-black transition-all duration-200 inline-flex items-center justify-center gap-2 ${
                          pendingMap[key] === "combine"
                            ? "bg-emerald-700 text-white shadow-md ring-2 ring-emerald-300"
                            : pendingMap[key] !== "warehouse" && pendingMode == null && wizard.duplicatePolicies[key] === "combine"
                            ? "bg-primary text-white shadow-md shadow-slate-900/10"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                        }`}
                      >
                        {pendingMap[key] === "combine" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        دمج هذا الصنف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGroup(row, "warehouse")}
                        className={`w-full rounded-xl py-3 text-xs font-black transition-all duration-200 inline-flex items-center justify-center gap-2 ${
                          pendingMap[key] === "warehouse"
                            ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400"
                            : pendingMap[key] !== "combine" && pendingMode == null && wizard.duplicatePolicies[key] === "warehouse"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 ring-2 ring-indigo-400"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 active:scale-[0.98]"
                        }`}
                      >
                        {pendingMap[key] === "warehouse" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        توزيع هذا الصنف
                      </button>
                      {pendingMap[key] !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleClearGroup(row)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-[0.98]"
                        >
                          تراجع عن القرار الفردي
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StepTable wizard={wizard} rows={rows} columns={["code", "name", "stock_quantity", "warehouse_id", "storage_plan"]} title="صفوف التكرار" helper="راجع المخزن والكمية بعد اختيار الدمج أو التوزيع. عمود ما سيحدث يوضح أثر كل صف عند التنفيذ." showActions height={360} />

      {/* Sticky bottom bar — always visible when there are duplicates */}
      {duplicateGroups.length > 0 && (
        <div className="sticky bottom-4 z-30 rounded-2xl border px-5 py-4 shadow-elevated backdrop-blur-md transition-all duration-300"
          style={{
            borderColor: confirmed ? "var(--border-normal, #e2e8f0)" : "var(--border-warning, #fcd34d)",
            backgroundColor: confirmed
              ? "color-mix(in srgb, var(--bg-elevated, white) 92%, transparent)"
              : "color-mix(in srgb, #fffbeb 92%, transparent)"
          }}
        >
          {confirmed ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-sm font-black text-emerald-900">تم تأكيد القرارات</span>
                  <p className="text-[11px] font-bold text-emerald-700">
                    جميع قرارات التكرار مؤكدة. يمكنك المتابعة للخطوة التالية.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleChangeDecisions}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                تغيير القرارات
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AlertTriangle className={`h-5 w-5 shrink-0 ${hasPending ? "text-amber-600" : "text-amber-500"}`} />
                <div className="min-w-0">
                  <span className="text-sm font-black text-amber-900">
                    {hasPending ? "قرارات معلقة" : "لم تختر قرارات التكرار بعد"}
                  </span>
                  <p className="text-[11px] font-bold text-amber-700">
                    {hasPending
                      ? `اخترت ${decidedCount} من ${duplicateGroups.length} مجموعة. اضغط تأكيد لتطبيق القرارات.`
                      : `اختر قراراً لكل مجموعة مكررة ثم اضغط تأكيد.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasPending && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    إلغاء الكل
                  </button>
                )}
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={handleConfirm}
                  onKeyDown={handleConfirmKeyDown}
                  disabled={!allDecided || confirming}
                  tabIndex={0}
                  className={`rounded-xl px-6 py-2.5 text-xs font-black text-white shadow-md transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2 ${confirming ? "bg-emerald-600 scale-[0.97]" : "bg-primary hover:bg-primary-600"}`}
                >
                  {confirming ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 animate-bounce" />
                      جارٍ الحفظ…
                    </>
                  ) : (
                    <>
                      <CornerDownLeft className="h-4 w-4" />
                      تأكيد القرارات
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
