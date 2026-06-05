import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, RotateCcw, Trash2 } from "lucide-react";
import { List } from "react-window";
import { FIELD_META } from "./useImportWizard";

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ACTION_LABELS = {
  insert: "إضافة صنف جديد",
  update: "تحديث بيانات الصنف",
  warehouse_stock: "استلام مخزون فقط",
  skip: "تخطي الصف",
};

const BULK_SCOPE_LABELS = {
  selected: "المحدد في هذا الجدول",
  invalid: "الناقص في هذا الجدول",
  visible: "المعروض حاليا",
  duplicates: "التكرار في هذا الجدول",
  all: "كل صفوف هذا الجدول",
};

function TableInput({ row, field, wizard }) {
  const meta = FIELD_META[field] || { type: "text" };
  const value = row[field] ?? "";
  const common = "w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm font-bold outline-none transition hover:border-slate-300 focus:border-slate-900 focus:ring-4 focus:ring-slate-100";

  if (field === "code" || meta.readOnly) {
    return <span className="block truncate rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm font-black text-slate-500">{value || "-"}</span>;
  }

  if (meta.type === "unit") {
    return (
      <select value={value} onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)} className={common}>
        <option value="">اختر وحدة</option>
        {wizard.units?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
      </select>
    );
  }

  if (meta.type === "warehouse") {
    return (
      <select value={wizard.resolvedWarehouseId(wizard.warehouses, row)} onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)} className={common}>
        <option value="">اختر مخزن</option>
        {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
      </select>
    );
  }

  if (meta.type === "storage_plan") {
    if (row.__duplicatePolicy === "warehouse" && Array.isArray(row.__warehouseDistribution)) {
      return (
        <div className="space-y-1.5 px-2 py-1">
          {row.__warehouseDistribution.map((item) => (
            <div key={item.__rowNumber} className="grid grid-cols-[48px_1fr] items-center gap-1.5">
              <span className="font-mono text-[11px] font-black text-slate-400">صف {item.__rowNumber}</span>
              <select value={wizard.explicitWarehouseId(wizard.warehouses, item)} onChange={(event) => wizard.updateRowValue(item.__rowNumber, "warehouse_id", event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold">
                <option value="">مخزن</option>
                {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    return <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-500">{wizard.productStoragePolicy(row) === "combine" ? "دمج الكميات" : "صف مستقل"}</span>;
  }

  if (meta.type === "category") {
    return <span className="block truncate rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">{wizard.categoryLabelForRow(row)}</span>;
  }

  return (
    <input
      type={meta.type === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)}
      className={common}
    />
  );
}

function Row({ index, style, rows, columns, wizard, showActions }) {
  const row = rows[index];
  if (!row) return null;
  const selected = wizard.selectedRows.has(row.__rowNumber);
  const hasError = wizard.issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error");
  const action = wizard.rowAction(row);
  const actionPreview = wizard.changePreviewForRow(row)?.[0] || "لن يتم تغيير الصف عند اختيار التخطي.";

  return (
    <div style={style} className={`grid border-b border-slate-100 text-right transition ${selected ? "bg-sky-50" : hasError ? "bg-rose-50/70" : "bg-white hover:bg-slate-50"}`} dir="rtl">
      <div className="flex min-w-max items-stretch">
        <div className="sticky right-0 z-10 flex w-[124px] shrink-0 items-center gap-3 border-l border-slate-100 bg-inherit px-4">
          <input type="checkbox" checked={selected} onChange={() => wizard.toggleRowSelection(row.__rowNumber)} className="h-4 w-4 rounded accent-slate-900" title="تحديد الصف للعمليات الجماعية" />
          <span className="font-mono text-xs font-black text-slate-500">صف {row.__rowNumber}</span>
        </div>

        {showActions ? (
          <div className="flex w-[240px] shrink-0 flex-col justify-center gap-1.5 border-l border-slate-100 bg-inherit px-3">
            <select
              value={action}
              disabled={row.__status === "invalid"}
              onChange={(event) => wizard.setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black outline-none transition focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              title="ما سيحدث لهذا الصف عند التنفيذ"
            >
              <option value="insert">{ACTION_LABELS.insert}</option>
              <option value="update">{ACTION_LABELS.update}</option>
              <option value="warehouse_stock">{ACTION_LABELS.warehouse_stock}</option>
              <option value="skip">{ACTION_LABELS.skip}</option>
            </select>
            <div className="truncate text-[10px] font-bold text-slate-400" title={actionPreview}>{actionPreview}</div>
          </div>
        ) : null}

        {columns.map((field) => (
          <div key={field} className="flex shrink-0 items-center border-l border-slate-100 px-1.5" style={{ width: wizard.getColumnWidth(field) }}>
            <TableInput row={row} field={field} wizard={wizard} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StepTable({ wizard, rows, columns, title, helper, showActions = true, height = 520 }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [tableFilter, setTableFilter] = useState("all");

  const tableCounts = useMemo(() => {
    const hasError = (row) => wizard.issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error");
    const hasIssue = (row) => wizard.issuesForRow(row.__rowNumber).length > 0;
    const isDuplicate = (row) => wizard.duplicateRowNumbers?.has(row.__rowNumber) || row.__combinedRows?.length;
    return {
      all: rows.length,
      errors: rows.filter(hasError).length,
      duplicates: rows.filter(isDuplicate).length,
      unmapped: rows.filter(hasIssue).length,
      ready: rows.filter((row) => !hasError(row)).length,
    };
  }, [rows, wizard]);

  const displayedRows = useMemo(() => {
    if (tableFilter === "errors") return rows.filter((row) => wizard.issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error"));
    if (tableFilter === "duplicates") return rows.filter((row) => wizard.duplicateRowNumbers?.has(row.__rowNumber) || row.__combinedRows?.length);
    if (tableFilter === "unmapped") return rows.filter((row) => wizard.issuesForRow(row.__rowNumber).length > 0);
    if (tableFilter === "ready") return rows.filter((row) => !wizard.issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error"));
    return rows;
  }, [rows, tableFilter, wizard]);

  const totalPages = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => displayedRows.slice((safePage - 1) * pageSize, safePage * pageSize), [displayedRows, pageSize, safePage]);
  const rowStart = displayedRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const rowEnd = displayedRows.length ? rowStart + pageRows.length - 1 : 0;
  const selectedTableRows = useMemo(() => rows.filter((row) => wizard.selectedRows.has(row.__rowNumber)), [rows, wizard.selectedRows]);
  const bulkTargetRows = useMemo(() => {
    if (wizard.bulkScope === "selected") return selectedTableRows;
    if (wizard.bulkScope === "invalid") return rows.filter((row) => wizard.issuesFor(row.__rowNumber, wizard.bulkField).some((issue) => issue.severity === "error"));
    if (wizard.bulkScope === "duplicates") return rows.filter((row) => wizard.duplicateRowNumbers?.has(row.__rowNumber) || row.__combinedRows?.length);
    if (wizard.bulkScope === "visible") return displayedRows;
    return rows;
  }, [displayedRows, rows, selectedTableRows, wizard]);
  const bulkTargetCount = bulkTargetRows.length;
  const bulkValueIsEmpty = String(wizard.bulkValue ?? "").trim() === "";

  useEffect(() => {
    setPage(1);
  }, [displayedRows.length, pageSize, tableFilter]);

  useEffect(() => {
    if (rows.length && !displayedRows.length && tableFilter !== "all") {
      setTableFilter("all");
    }
  }, [displayedRows.length, rows.length, tableFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
        <div>
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          {helper ? <p className="mt-1 text-xs font-bold text-slate-500">{helper}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["all", "كل الصفوف", tableCounts.all],
            ["errors", "أخطاء", tableCounts.errors],
            ["duplicates", "تكرار", tableCounts.duplicates],
            ["unmapped", "مراجعة", tableCounts.unmapped],
            ["ready", "جاهز", tableCounts.ready],
          ].map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTableFilter(key); setPage(1); }}
              className={`rounded-xl border px-3.5 py-2 text-xs font-black shadow-sm transition ${tableFilter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              title={`عرض ${label} داخل هذا الجدول فقط`}
            >
              {label} {count}
            </button>
          ))}
          <button type="button" onClick={() => wizard.selectRows(pageRows)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm hover:bg-slate-50" title={`تحديد الصفوف ${rowStart}-${rowEnd}`}>
            تحديد المعروض
          </button>
          <button type="button" onClick={() => wizard.removeRows(selectedTableRows)} disabled={!selectedTableRows.length} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 shadow-sm disabled:opacity-40" title="يحذف الصفوف المحددة داخل هذا الجدول فقط">
            <Trash2 className="h-3.5 w-3.5" /> حذف المحدد {selectedTableRows.length ? selectedTableRows.length : ""}
          </button>
          <button type="button" onClick={wizard.restoreRemovedRows} disabled={!wizard.removedRows.size} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-700 shadow-sm disabled:opacity-40">
            <RotateCcw className="h-3.5 w-3.5" /> استعادة المحذوف
          </button>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-white px-5 py-4">
        <div className="grid items-center gap-3 sm:grid-cols-2 md:grid-cols-[180px_1fr_190px_160px_auto]">
          <select value={wizard.bulkField} onChange={(event) => wizard.setBulkField(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-slate-900">
            {wizard.BULK_FIELDS.map((field) => <option key={field} value={field}>{FIELD_META[field]?.label || field}</option>)}
          </select>

          {wizard.bulkField === "unit_name" ? (
            <select value={wizard.bulkValue} onChange={(event) => wizard.setBulkValue(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-slate-900">
              <option value="">اختر وحدة</option>
              {wizard.units?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
            </select>
          ) : wizard.bulkField === "warehouse_id" ? (
            <select value={wizard.bulkValue} onChange={(event) => wizard.setBulkValue(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-slate-900">
              <option value="">اختر مخزن</option>
              {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          ) : (
            <input value={wizard.bulkValue} onChange={(event) => wizard.setBulkValue(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-slate-900" placeholder="القيمة الجديدة" />
          )}

          <select value={wizard.bulkScope} onChange={(event) => wizard.setBulkScope(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-slate-900">
            {Object.entries(BULK_SCOPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <button type="button" onClick={() => wizard.applyValueToRows(wizard.bulkField, wizard.bulkValue, bulkTargetRows, "التعديل")} disabled={bulkValueIsEmpty || !bulkTargetCount} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-40">
            تطبيق على {bulkTargetCount}
          </button>

          <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-xs font-black text-slate-500">
            {displayedRows.length} / {rows.length} صف
          </div>
        </div>
        <div className="mt-3 text-xs font-bold text-slate-500">
          الفلتر والتطبيق الجماعي يعملان داخل هذا الجدول فقط. الحقل: <span className="font-black text-slate-700">{FIELD_META[wizard.bulkField]?.label || wizard.bulkField}</span>، النطاق: <span className="font-black text-slate-700">{BULK_SCOPE_LABELS[wizard.bulkScope]}</span>.
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="flex border-b border-slate-200 bg-slate-50 text-right text-xs font-black text-slate-500">
            <div className="sticky right-0 z-20 w-[124px] shrink-0 border-l border-slate-200 bg-slate-50 px-4 py-3.5">الصف</div>
            {showActions ? <div className="w-[240px] shrink-0 border-l border-slate-200 px-4 py-3.5">ما سيحدث عند التنفيذ</div> : null}
            {columns.map((field) => {
              const active = wizard.sortConfig?.key === field;
              return (
                <div key={field} className="relative shrink-0 select-none border-l border-slate-200 px-4 py-3.5" style={{ width: wizard.getColumnWidth(field) }}>
                  <button type="button" onClick={() => wizard.toggleSort(field)} className="inline-flex items-center gap-1.5 hover:text-slate-800" title="فرز حسب هذا العمود">
                    {FIELD_META[field]?.label || field}
                    {active ? (wizard.sortConfig.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />}
                  </button>
                  <button type="button" onMouseDown={(event) => wizard.startResize(event, field)} className="absolute left-0 top-0 h-full w-2 cursor-col-resize hover:bg-slate-300" title="تغيير عرض العمود" />
                </div>
              );
            })}
          </div>
          {pageRows.length ? (
            <List
              rowComponent={Row}
              rowCount={pageRows.length}
              rowHeight={showActions ? 102 : 84}
              rowProps={{ rows: pageRows, columns, wizard, showActions }}
              overscanCount={8}
              style={{ height, width: "100%" }}
            />
          ) : (
            <div className="px-6 py-12 text-center text-sm font-bold text-slate-400">لا توجد صفوف في هذا العرض</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        <div className="text-xs font-bold text-slate-500">
          تعرض الآن الصفوف {rowStart}-{rowEnd} من {displayedRows.length}. الصفحة {safePage} من {totalPages}.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500">
            عدد الصفوف
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 disabled:opacity-40">الأولى</button>
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 disabled:opacity-40">السابق</button>
          <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500">{safePage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 disabled:opacity-40">التالي</button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 disabled:opacity-40">الأخيرة</button>
        </div>
      </div>
    </div>
  );
}
