import React from "react";
import StepTable from "../StepTable";

export default function Step7Existing({ wizard }) {
  const actionCounts = wizard.exactExistingRows.reduce(
    (counts, row) => {
      const action = wizard.rowAction(row);
      return { ...counts, [action]: (counts[action] || 0) + 1 };
    },
    { update: 0, warehouse_stock: 0, skip: 0 }
  );
  const bulkActions = [
    {
      action: "update",
      label: "تحديث كل الموجود",
      helper: "يغير بيانات الصنف ويضبط المخزون حسب الصف.",
    },
    {
      action: "warehouse_stock",
      label: "استلام مخزون فقط",
      helper: "لا يغير بيانات الصنف، ويحدث الكمية في المخزن فقط.",
    },
    {
      action: "skip",
      label: "تخطي كل الموجود",
      helper: "لا يكتب أي تغيير لهذه الصفوف عند التنفيذ.",
    },
  ];
  const numberText = (value) => Number(value || 0).toLocaleString("ar-EG");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 font-display">الأصناف الموجودة بالفعل</h3>
            <p className="mt-1.5 text-sm font-medium text-slate-500 font-title">
              {wizard.exactExistingRows.length} صف يطابق صنفا موجودا. اختر هل تحدث بياناته، تستلم مخزونه فقط، أو تتخطاه.
            </p>
          </div>
          {wizard.lastAppliedFix ? (
            <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 ring-1 ring-emerald-250/20">
              آخر تطبيق جماعي: {wizard.lastAppliedFix.label}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 shadow-inner">
          {bulkActions.map((item) => {
            const active = actionCounts[item.action] === wizard.exactExistingRows.length && wizard.exactExistingRows.length > 0;
            return (
              <div key={item.action} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => wizard.applyExistingRowsAction(item.action)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-black transition-all duration-200 active:scale-[0.98] ${
                    active
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                      : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {actionCounts[item.action] || 0}
                  </span>
                </button>
                <div className="px-1 text-center text-[10px] font-bold leading-normal text-slate-400 font-title">{item.helper}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3.5">
        {wizard.exactExistingRows.slice(0, 6).map((row) => {
          const action = wizard.rowAction(row);
          const currentStock = wizard.currentStockForRow?.(row) ?? Number(row.__existing?.stock_quantity || 0);
          const fileStock = Number(row.stock_quantity || 0);
          const targetWarehouse = wizard.warehouseNameForRow?.(row) || "المخزن المختار";
          return (
            <div key={row.__rowNumber} className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-base font-black text-sky-950 font-display">{row.name}</div>
                  <div className="mt-0.5 text-xs font-bold text-sky-750 font-mono">صف {row.__rowNumber} - {row.code}</div>
                </div>
                <div className="w-full sm:w-auto sm:min-w-[240px]">
                  <label className="mb-1.5 block text-xs font-black text-sky-850 font-title">إجراء هذا الصف</label>
                  <select 
                    value={action} 
                    onChange={(event) => wizard.setActions((prev) => ({ ...prev, [row.__rowNumber]: event.target.value }))} 
                    className="w-full rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 text-sm font-black outline-none shadow-sm focus:border-sky-555 focus:ring-4 focus:ring-sky-100"
                  >
                    <option value="update">تحديث بيانات الصنف</option>
                    <option value="skip">تخطي الصف</option>
                    <option value="warehouse_stock">استلام مخزون فقط</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400">المخزون الحالي في النظام</div>
                  <div className="mt-1 text-lg font-black text-slate-900 font-display">{numberText(currentStock)}</div>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="text-[10px] font-black text-sky-600">كمية الملف</div>
                  <div className="mt-1 text-lg font-black text-sky-950 font-display">{numberText(fileStock)}</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="text-[10px] font-black text-emerald-700">سيتم ضبط مخزون</div>
                  <div className="mt-1 truncate text-sm font-black text-emerald-950 font-display">{targetWarehouse} إلى {numberText(fileStock)}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {wizard.changePreviewForRow(row).slice(0, 6).map((message, index) => (
                  <div key={index} className="rounded-xl bg-white/95 border border-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm leading-normal">
                    {message}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <StepTable wizard={wizard} rows={wizard.exactExistingRows} columns={["code", "name", "barcode", "unit_name", "warehouse_id", "sale_price", "purchase_price"]} title="كل الأصناف الموجودة" helper="استخدم عمود ما سيحدث لتغيير إجراء الصف، أو الأزرار الجماعية لتغيير كل الصفوف الموجودة مرة واحدة." showActions height={360} />
    </div>
  );
}
