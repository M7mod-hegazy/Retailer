import React, { useState, useCallback } from "react";
import { CheckCircle2, Warehouse, Loader2 } from "lucide-react";

export default function WarehouseChoicePanel({ wizard, title = "مخازن الملف", helper = "أنشئ المخزن كما في الملف أو اربطه بمخزن موجود في النظام." }) {
  const [createNames, setCreateNames] = useState({});
  const [selectedWarehouses, setSelectedWarehouses] = useState({});
  const [resolvedKeys, setResolvedKeys] = useState(new Set());
  const [resolvingKey, setResolvingKey] = useState(null);
  const sourceWarehouses = wizard.fileWarehouseOptions || [];

  const markResolved = useCallback((key) => {
    setResolvedKeys((prev) => new Set(prev).add(key));
    setResolvingKey((prev) => prev === key ? null : prev);
  }, []);

  if (!sourceWarehouses.length) {
    return (
      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 text-sm font-bold text-text-secondary shadow-sm">
        لا توجد أسماء مخازن واضحة في الملف. استخدم الجدول بالأسفل لاختيار المخزن لكل صف.
      </div>
    );
  }

  const resolvedCount = resolvedKeys.size;
  const totalCount = sourceWarehouses.length;

  return (
    <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-black text-text-primary font-display">{title}</h4>
          <p className="mt-1 text-sm font-bold text-text-secondary font-title">{helper}</p>
        </div>
        <span className="rounded-xl border border-border-normal bg-bg-overlay px-3 py-2 text-xs font-black text-text-secondary">
          {sourceWarehouses.length} مخزن من الملف
        </span>
      </div>

      {/* Decision progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-bg-overlay">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${resolvedCount ? (resolvedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-black text-text-secondary whitespace-nowrap">{resolvedCount} / {totalCount} تم</span>
      </div>

      <div className="mt-4 divide-y divide-border-subtle rounded-2xl border border-border-normal bg-bg-overlay/40">
        {sourceWarehouses.map((entry) => {
          const isResolved = resolvedKeys.has(entry.name);
          const createName = createNames[entry.name] ?? entry.name;
          const selectedWarehouseId = selectedWarehouses[entry.name] || "";
          const isResolving = resolvingKey === entry.name && wizard.categorySyncing;

          if (isResolved) {
            const chosenText = selectedWarehouses[entry.name]
              ? `مرتبط بمخزن: ${wizard.warehouses.find((w) => String(w.id) === String(selectedWarehouses[entry.name]))?.name || selectedWarehouses[entry.name]}`
              : `سيُنشأ باسم: ${createNames[entry.name] || entry.name}`;
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
            <div key={entry.name} className="grid gap-3 p-4 xl:grid-cols-[minmax(190px,1fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)] xl:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-black text-text-primary font-display">{entry.name}</span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${entry.exists ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {entry.exists ? "موجود في النظام" : "غير موجود"}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-text-secondary">
                  {entry.rows.length} صف - إجمالي الكمية {entry.quantity}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-text-secondary">إنشاء باسم</label>
                <div className="flex gap-2">
                  <input
                    value={createName}
                    onChange={(event) => setCreateNames((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-border-normal bg-bg-surface px-3 py-2 text-xs font-bold outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setResolvingKey(entry.name);
                      await wizard.createAndApplyWarehouse(entry.name, createName);
                      markResolved(entry.name);
                    }}
                    disabled={wizard.categorySyncing || !String(createName || "").trim()}
                    className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white transition hover:bg-primary-600 active:scale-[0.98] disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {entry.exists ? "استخدام" : "إنشاء واستخدام"}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-[11px] font-black text-text-secondary">أو اختر مخزن موجود</label>
                <div className="flex gap-2">
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => setSelectedWarehouses((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                    className="min-w-0 flex-1 rounded-xl border border-border-normal bg-bg-surface px-3 py-2 text-xs font-bold outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">اختر مخزن</option>
                    {wizard.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      setResolvingKey(entry.name);
                      wizard.applyFileWarehouseChoice(entry.name, selectedWarehouseId, "مخزن بديل");
                      markResolved(entry.name);
                    }}
                    disabled={!selectedWarehouseId}
                    className="shrink-0 rounded-xl border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-primary transition hover:bg-bg-overlay active:scale-[0.98] disabled:opacity-40"
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
