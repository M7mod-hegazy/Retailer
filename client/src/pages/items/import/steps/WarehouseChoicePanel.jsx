import React, { useState } from "react";

export default function WarehouseChoicePanel({ wizard, title = "مخازن الملف", helper = "أنشئ المخزن كما في الملف أو اربطه بمخزن موجود في النظام." }) {
  const [createNames, setCreateNames] = useState({});
  const [selectedWarehouses, setSelectedWarehouses] = useState({});
  const sourceWarehouses = wizard.fileWarehouseOptions || [];

  if (!sourceWarehouses.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-sm">
        لا توجد أسماء مخازن واضحة في الملف. استخدم الجدول بالأسفل لاختيار المخزن لكل صف.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-black text-slate-900 font-display">{title}</h4>
          <p className="mt-1 text-sm font-bold text-slate-500 font-title">{helper}</p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
          {sourceWarehouses.length} مخزن من الملف
        </span>
      </div>

      <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/40">
        {sourceWarehouses.map((entry) => {
          const createName = createNames[entry.name] ?? entry.name;
          const selectedWarehouseId = selectedWarehouses[entry.name] || "";
          return (
            <div key={entry.name} className="grid gap-3 p-4 xl:grid-cols-[minmax(190px,1fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)] xl:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-black text-slate-900 font-display">{entry.name}</span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${entry.exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {entry.exists ? "موجود في النظام" : "غير موجود"}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  {entry.rows.length} صف - إجمالي الكمية {entry.quantity}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-slate-500">إنشاء باسم</label>
                <div className="flex gap-2">
                  <input
                    value={createName}
                    onChange={(event) => setCreateNames((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => wizard.createAndApplyWarehouse(entry.name, createName)}
                    disabled={wizard.categorySyncing || !String(createName || "").trim()}
                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40"
                  >
                    {entry.exists ? "استخدام" : "إنشاء واستخدام"}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-slate-500">أو اختر مخزن موجود</label>
                <div className="flex gap-2">
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => setSelectedWarehouses((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">اختر مخزن</option>
                    {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => wizard.applyFileWarehouseChoice(entry.name, selectedWarehouseId, "مخزن بديل")}
                    disabled={!selectedWarehouseId}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
                  >
                    استخدامه
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
