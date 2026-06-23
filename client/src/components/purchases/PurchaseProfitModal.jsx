import React, { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, XCircle } from "lucide-react";
import api from "../../services/api";
import TitleBar from "../ui/TitleBar";
import { useDetach } from "../../hooks/useDetach";

function fmt(n) {
  return Number(n ?? 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toFixed(1)}%`;
}

export default function PurchaseProfitModal({ lines, onClose }) {
  const { handleDetach } = useDetach("purchase-profit", {
    onClose, getState: () => ({ lines }), actions: {},
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lines?.length) { setLoading(false); return; }
    setLoading(true);
    api.post("/api/pricing/profit-analysis", {
      lines: lines.map(l => ({
        item_id: l.item_id,
        quantity: l.quantity,
        unit_cost: l.unit_cost,
        unit_price: l.selling_price,
        wholesale_price: l.wholesale_price,
      })),
    })
      .then(r => setData(r.data.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [lines]);

  const totalProfit = data?.reduce((s, r) => s + (r.total_profit ?? 0), 0) ?? 0;
  const totalCost   = data?.reduce((s, r) => s + r.cost * r.qty, 0) ?? 0;
  const overallMargin = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <TitleBar title="تحليل الربح المتوقع" onClose={onClose} onDetach={handleDetach} />

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جارٍ الحساب…</div>
          ) : !data?.length ? (
            <div className="py-12 text-center text-slate-400 text-sm">لا توجد أصناف</div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <div className="text-[11px] text-emerald-500 font-bold uppercase mb-1">الربح الإجمالي</div>
                  <div className="font-black text-xl text-emerald-700">{fmt(totalProfit)}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">ج.م</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <div className="text-[11px] text-blue-500 font-bold uppercase mb-1">هامش الربح</div>
                  <div className="font-black text-xl text-blue-700">{overallMargin !== null ? `${overallMargin}%` : "—"}</div>
                  <div className="text-[11px] text-blue-400 mt-0.5">من التكلفة</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold uppercase mb-1">إجمالي التكلفة</div>
                  <div className="font-black text-xl text-slate-700">{fmt(totalCost)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">ج.م</div>
                </div>
              </div>

              {/* Per-item table */}
              <table className="w-full text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 text-[11px] uppercase font-bold">
                    <th className="px-3 py-2">الصنف</th>
                    <th className="px-3 py-2 text-center">كمية</th>
                    <th className="px-3 py-2">تكلفة</th>
                    <th className="px-3 py-2">بيع</th>
                    <th className="px-3 py-2">ربح/وحدة</th>
                    <th className="px-3 py-2">هامش</th>
                    <th className="px-3 py-2">إجمالي الربح</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${r.below_min ? "bg-rose-50" : r.below_target ? "bg-amber-50" : "hover:bg-slate-50"}`}>
                      <td className="px-3 py-2 font-semibold text-slate-700 max-w-[160px] truncate">{r.item_name}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{r.qty}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{fmt(r.cost)}</td>
                      <td className="px-3 py-2 font-mono">{r.selling > 0 ? fmt(r.selling) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 font-mono font-bold">{r.selling > 0 ? fmt(r.profit) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 font-bold">
                        {r.margin_pct !== null ? (
                          <span className={r.below_min ? "text-rose-600" : r.below_target ? "text-amber-600" : "text-emerald-600"}>
                            {pct(r.margin_pct)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono font-black text-slate-800">
                        {r.selling > 0 ? fmt(r.total_profit) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.below_min && <AlertTriangle size={13} className="text-rose-500" />}
                        {!r.below_min && r.below_target && <AlertTriangle size={13} className="text-amber-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {data.some(r => r.below_min) && (
                <div className="mt-4 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <XCircle size={13} />
                  بعض الأصناف تحت الحد الأدنى المسموح للهامش
                </div>
              )}
              {data.some(r => r.below_target) && !data.some(r => r.below_min) && (
                <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} />
                  بعض الأصناف تحت هامش الربح المستهدف
                </div>
              )}

              <p className="mt-4 text-[11px] text-slate-400 text-center">
                * الأرقام تقديرية بناءً على سعر البيع الحالي. الأرباح الفعلية قد تختلف.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
