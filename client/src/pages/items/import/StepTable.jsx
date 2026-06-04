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
  selected: "الصفوف المحددة فقط",
  invalid: "الصفوف التي تحتاج إصلاحا",
  visible: "الصفوف المعروضة في الفلتر",
  duplicates: "صفوف التكرار فقط",
  all: "كل صفوف الاستيراد",
};

function TableInput({ row, field, wizard }) {
  const meta = FIELD_META[field] || { type: "text" };
  const value = row[field] ?? "";
  const common = "w-full rounded-xl border border-slate-200/40 bg-transparent px-3 py-2 text-sm font-bold outline-none transition-all hover:bg-slate-50/50 hover:border-slate-300 focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-100 shadow-sm";

  if (field === "code" || meta.readOnly) {
    return <span className="block truncate px-3 py-2 font-mono text-sm font-black text-slate-500 bg-slate-50/60 rounded-xl border border-slate-100">{value || "-"}</span>;
  }

  if (meta.type === "unit") {
    return (
      <select value={value} onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)} className={common} title="تغيير وحدة هذا الصف فقط">
        <option value="">اختر وحدة</option>
        {wizard.units?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
      </select>
    );
  }

  if (meta.type === "warehouse") {
    return (
      <select value={wizard.resolvedWarehouseId(wizard.warehouses, row)} onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)} className={common} title="تغيير مخزن هذا الصف فقط">
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
              <span className="text-[11px] font-black text-slate-400 font-mono">صف {item.__rowNumber}</span>
              <select value={wizard.explicitWarehouseId(wizard.warehouses, item)} onChange={(event) => wizard.updateRowValue(item.__rowNumber, "warehouse_id", event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold shadow-sm">
                <option value="">مخزن</option>
                {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    return <span className="rounded-lg bg-slate-100 border border-slate-200/50 px-2.5 py-1.5 text-xs font-black text-slate-500 shadow-sm">{wizard.productStoragePolicy(row) === "combine" ? "دمج الكميات" : "صف مستقل"}</span>;
  }

  if (meta.type === "category") {
    return <span className="block truncate px-3 py-2 text-sm font-black text-slate-700 bg-slate-50/30 rounded-xl border border-slate-100">{wizard.categoryLabelForRow(row)}</span>;
  }

  return (
    <input
      type={meta.type === "number" ? "number" : "text"}
      value={value}
      onChange={(event) => wizard.updateRowValue(row.__rowNumber, field, event.target.value)}
      className={common}
      title="تعديل قيمة هذا الصف فقط"
    />
  );
}

function Row({ index, style, rows, columns, wizard, showActions }) {
  const row = rows[index];
  if (!row) return null;
  const selected = wizard.selectedRows.has(row.__rowNumber);
  const hasError = wizard.issuesForRow(row.__rowNumber).some((issue) => issue.severity === "error");
  const action = wizard.rowAction(row);
  const actionPreview = wizard.changePreviewForRow(row)?.[0] || "سيتم تجاهل الصف عند اختيار التخطي.";

  return (
    <div style={style} className={`grid border-b border-slate-100 text-right transition-colors duration-150 ${selected ? "bg-sky-50/50" : hasError ? "bg-rose-50/70" : "bg-white hover:bg-slate-50/40"}`} dir="rtl">
      <div className="flex min-w-max items-stretch">
        <div className="sticky right-0 z-10 flex w-[124px] shrink-0 items-center gap-3 border-l border-slate-150 bg-inherit px-4">
          <input type="checkbox" checked={selected} onChange={() => wizard.toggleRowSelection(row.__rowNumber)} className="h-4.5 w-4.5 rounded-lg border-slate-350 text-slate-900 accent-slate-900 transition focus:ring-slate-900 focus:ring-offset-0 cursor-pointer" title="تحديد الصف للعمليات الجماعية" />
          <span className="text-xs font-black text-slate-500 font-mono">صف {row.__rowNumber}</span>
        </div>

        {showActions ? (
          <div className="flex w-[240px] shrink-0 flex-col justify-center gap-1.5 border-l border-slate-150 px-3 bg-inherit">
            <select
              value={action}
              disabled={row.__status === "invalid"}
              onChange={(event) => wizard.setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black shadow-sm outline-none transition focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 cursor-pointer"
              title="اختيار ما سيحدث لهذا الصف عند التنفيذ"
            >
              <option value="insert">{ACTION_LABELS.insert}</option>
              <option value="update">{ACTION_LABELS.update}</option>
              <option value="warehouse_stock">{ACTION_LABELS.warehouse_stock}</option>
              <option value="skip">{ACTION_LABELS.skip}</option>
            </select>
            <div className="truncate text-[10px] font-bold text-slate-400 font-title" title={actionPreview}>{actionPreview}</div>
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
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => rows.slice((safePage - 1) * pageSize, safePage * pageSize), [pageSize, rows, safePage]);
  const rowStart = rows.length ? (safePage - 1) * pageSize + 1 : 0;
  const rowEnd = rows.length ? rowStart + pageRows.length - 1 : 0;
  const bulkTargetRows = wizard.rowsForScope(wizard.bulkField, wizard.bulkScope) || [];
  const bulkTargetCount = bulkTargetRows.length;
  const bulkValueIsEmpty = String(wizard.bulkValue ?? "").trim() === "";

  useEffect(() => {
    setPage(1);
  }, [pageSize, rows.length, wizard.rowFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-card duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div>
          <h3 className="text-base font-black text-slate-900 font-display">{title}</h3>
          {helper ? <p className="mt-0.5 text-xs font-medium text-slate-500 font-title">{helper}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["all", "كل الصفوف", wizard.filterCounts.all],
            ["errors", "أخطاء", wizard.filterCounts.errors],
            ["duplicates", "تكرار", wizard.filterCounts.duplicates],
            ["unmapped", "مراجعة", wizard.filterCounts.unmapped],
            ["ready", "جاهز", wizard.filterCounts.ready],
          ].map(([key, label, count]) => (
            <button 
              key={key} 
              type="button" 
              onClick={() => { wizard.setRowFilter(key); setPage(1); }} 
              className={`rounded-xl border px-3.5 py-2 text-xs font-black transition-all duration-200 shadow-sm hover:translate-y-[-1px] ${
                wizard.rowFilter === key 
                  ? "border-slate-900 bg-slate-900 text-white shadow-slate-900/10" 
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`} 
              title={`عرض ${label}`}
            >
              {label} {count}
            </button>
          ))}
          
          <button 
            type="button" 
            onClick={() => wizard.selectRows(pageRows)} 
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]" 
            title={`تحديد الصفوف ${rowStart}-${rowEnd}`}
          >
            تحديد المعروض
          </button>
          <button 
            type="button" 
            onClick={() => wizard.removeRows(wizard.selectedRowsList)} 
            disabled={!wizard.selectedRowsList.length} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-250 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 shadow-sm transition-all duration-200 hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none" 
            title="إزالة الصفوف المحددة من الاستيراد"
          >
            <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
          </button>
          <button 
            type="button" 
            onClick={wizard.restoreRemovedRows} 
            disabled={!wizard.removedRows.size} 
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-250 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none" 
            title="إرجاع الصفوف التي حذفتها"
          >
            <RotateCcw className="h-3.5 w-3.5" /> استعادة المحذوف
          </button>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-white px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[180px_1fr_190px_160px_auto] items-center">
          <select 
            value={wizard.bulkField} 
            onChange={(event) => wizard.setBulkField(event.target.value)} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold shadow-sm outline-none transition focus:border-slate-900 hover:border-slate-350 cursor-pointer" 
            title="الحقل الذي سيتم تغييره جماعيا"
          >
            {wizard.BULK_FIELDS.map((field) => <option key={field} value={field}>{FIELD_META[field]?.label || field}</option>)}
          </select>

          {wizard.bulkField === "unit_name" ? (
            <select 
              value={wizard.bulkValue} 
              onChange={(event) => wizard.setBulkValue(event.target.value)} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold shadow-sm outline-none transition focus:border-slate-900 hover:border-slate-350 cursor-pointer" 
              title="الوحدة الجديدة"
            >
              <option value="">اختر وحدة</option>
              {wizard.units?.map((unit) => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
            </select>
          ) : wizard.bulkField === "warehouse_id" ? (
            <select 
              value={wizard.bulkValue} 
              onChange={(event) => wizard.setBulkValue(event.target.value)} 
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold shadow-sm outline-none transition focus:border-slate-900 hover:border-slate-350 cursor-pointer" 
              title="المخزن الجديد"
            >
              <option value="">اختر مخزن</option>
              {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          ) : (
            <input 
              value={wizard.bulkValue} 
              onChange={(event) => wizard.setBulkValue(event.target.value)} 
              className="w-full rounded-xl border border-slate-200 bg-white px-4.5 py-3 text-sm font-bold shadow-sm outline-none transition focus:border-slate-900 hover:border-slate-350" 
              placeholder="القيمة الجديدة" 
              title="القيمة التي سيتم تطبيقها" 
            />
          )}

          <select 
            value={wizard.bulkScope} 
            onChange={(event) => wizard.setBulkScope(event.target.value)} 
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold shadow-sm outline-none transition focus:border-slate-900 hover:border-slate-350 cursor-pointer" 
            title="نطاق الصفوف التي ستتغير"
          >
            {Object.entries(BULK_SCOPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <button 
            type="button" 
            onClick={() => wizard.applyValueToRows(wizard.bulkField, wizard.bulkValue, bulkTargetRows, "التعديل")} 
            disabled={bulkValueIsEmpty || !bulkTargetCount} 
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40" 
            title={`سيغير ${bulkTargetCount} صف`}
          >
            تطبيق على {bulkTargetCount}
          </button>

          <div className="rounded-xl bg-slate-100 border border-slate-200/50 px-4 py-3 text-center text-xs font-black text-slate-550 font-mono shadow-inner">
            {rows.length} صف
          </div>
        </div>
        <div className="mt-3 text-xs font-bold text-slate-400 font-title leading-none">
          تطبيق جماعي: سيغير حقل <span className="font-black text-slate-600">{FIELD_META[wizard.bulkField]?.label || wizard.bulkField}</span> في <span className="font-black text-slate-655">{BULK_SCOPE_LABELS[wizard.bulkScope]}</span>.
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="flex border-b border-slate-200 bg-slate-50 text-right text-xs font-black text-slate-550">
            <div className="sticky right-0 z-20 w-[124px] shrink-0 border-l border-slate-200 bg-slate-50 px-4 py-3.5 shadow-sm">الصف</div>
            {showActions ? <div className="w-[240px] shrink-0 border-l border-slate-200 px-4 py-3.5 shadow-sm">ما سيحدث عند التنفيذ</div> : null}
            {columns.map((field) => {
              const active = wizard.sortConfig?.key === field;
              return (
                <div key={field} className="relative shrink-0 select-none border-l border-slate-200 px-4 py-3.5" style={{ width: wizard.getColumnWidth(field) }}>
                  <button type="button" onClick={() => wizard.toggleSort(field)} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors" title="فرز حسب هذا العمود">
                    {FIELD_META[field]?.label || field}
                    {active ? (wizard.sortConfig.dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-25" />}
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
            <div className="px-6 py-12 text-center text-sm font-bold text-slate-400 font-title">لا توجد صفوف في هذا العرض</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="text-xs font-bold text-slate-500 font-mono">
          تعرض الآن الصفوف {rowStart}-{rowEnd} من {rows.length}. الصفحة {safePage} من {totalPages}.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-black text-slate-500 font-title cursor-pointer">
            عدد الصفوف
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black shadow-sm outline-none transition focus:border-slate-900 cursor-pointer">
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40">الأولى</button>
            <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40">السابق</button>
            <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-550 shadow-inner font-mono">{safePage} / {totalPages}</span>
            <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40">التالي</button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40">الأخيرة</button>
          </div>
        </div>
      </div>
    </div>
  );
}
