import React from "react";
import StepTable from "../StepTable";

export default function Step7Existing({ wizard }) {
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
          <button 
            type="button" 
            onClick={() => wizard.applyExistingRowsAction("update")} 
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
          >
            تحديث كل الموجود
          </button>
          <div className="text-[10px] font-bold text-slate-400 font-title text-center leading-normal">يغير بيانات الصنف ويحدث المخزون حسب الصف.</div>
          <button 
            type="button" 
            onClick={() => wizard.applyExistingRowsAction("skip")} 
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]"
          >
            تخطي كل الموجود
          </button>
          <div className="text-[10px] font-bold text-slate-400 font-title text-center leading-normal">لا يكتب أي تغيير لهذه الصفوف عند التنفيذ.</div>
        </div>
      </div>

      <div className="grid gap-3.5">
        {wizard.exactExistingRows.slice(0, 6).map((row) => {
          const action = wizard.rowAction(row);
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
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {wizard.changePreviewForRow(row).slice(0, 5).map((message, index) => (
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
