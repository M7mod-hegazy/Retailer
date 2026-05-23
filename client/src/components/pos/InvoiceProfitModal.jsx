import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Modal from "../ui/Modal";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function formatPct(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function InvoiceProfitModal({ open, onClose, lines, items }) {
  const analysis = useMemo(() => {
    if (!lines || !lines.length) return null;

    let totalRevenue = 0;
    let totalCost = 0;

    const lineDetails = lines.map((line) => {
      const item = items?.find((e) => e.id === line.item_id);
      const qty = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const lineDiscount = Number(line.line_discount || 0);
      const purchase = Number(item?.purchase_price || 0);

      const revenue = Math.max(0, unitPrice * qty - lineDiscount);
      const cost = purchase * qty;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : null;

      totalRevenue += revenue;
      totalCost += cost;

      return { line, item, qty, unitPrice, purchase, revenue, cost, profit, margin };
    });

    const netProfit = totalRevenue - totalCost;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null;

    return { lineDetails, totalRevenue, totalCost, netProfit, netMargin };
  }, [lines, items]);

  return (
    <Modal open={open} onClose={onClose} title="تحليل ربح الفاتورة الحالية" maxWidth="max-w-3xl">
      <div className="flex flex-col gap-4" dir="rtl">
        {!analysis ? (
          <div className="py-10 text-center text-[13px] font-bold text-slate-400">
            الفاتورة فارغة — أضف أصنافاً لعرض تحليل الربح
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي البيع</span>
                <span className="text-[15px] font-black font-mono text-slate-800">{formatMoney(analysis.totalRevenue)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي التكلفة</span>
                <span className="text-[15px] font-black font-mono text-slate-600">{formatMoney(analysis.totalCost)}</span>
              </div>
              <div className={`flex flex-col gap-1 rounded-xl border p-3 ${analysis.netProfit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${analysis.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>صافي الربح</span>
                <span className={`text-[15px] font-black font-mono ${analysis.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatMoney(analysis.netProfit)}
                </span>
              </div>
              <div className={`flex flex-col gap-1 rounded-xl border p-3 ${
                analysis.netMargin === null ? "border-slate-200 bg-slate-50"
                : analysis.netMargin >= 20 ? "border-emerald-200 bg-emerald-50"
                : analysis.netMargin >= 10 ? "border-amber-200 bg-amber-50"
                : "border-rose-200 bg-rose-50"
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  analysis.netMargin === null ? "text-slate-400"
                  : analysis.netMargin >= 20 ? "text-emerald-600"
                  : analysis.netMargin >= 10 ? "text-amber-600"
                  : "text-rose-600"
                }`}>هامش الربح %</span>
                <span className={`text-[15px] font-black font-mono ${
                  analysis.netMargin === null ? "text-slate-500"
                  : analysis.netMargin >= 20 ? "text-emerald-700"
                  : analysis.netMargin >= 10 ? "text-amber-700"
                  : "text-rose-700"
                }`}>
                  {analysis.netMargin !== null ? `${formatPct(analysis.netMargin)}%` : "—"}
                </span>
              </div>
            </div>

            {/* Per-line breakdown */}
            <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: 340 }}>
              <table className="w-full text-[12px]" dir="rtl">
                <thead className="sticky top-0 bg-slate-800 text-white">
                  <tr>
                    <th className="px-3 py-2.5 text-right font-black">الصنف</th>
                    <th className="px-3 py-2.5 text-right font-black">الكمية</th>
                    <th className="px-3 py-2.5 text-right font-black">سعر البيع</th>
                    <th className="px-3 py-2.5 text-right font-black">سعر الشراء</th>
                    <th className="px-3 py-2.5 text-right font-black">إيراد الصنف</th>
                    <th className="px-3 py-2.5 text-right font-black">ربح الصنف</th>
                    <th className="px-3 py-2.5 text-right font-black">هامش %</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.lineDetails.map(({ line, qty, unitPrice, purchase, revenue, profit, margin }, idx) => {
                    const Icon = profit > 0 ? TrendingUp : profit < 0 ? TrendingDown : Minus;
                    const color = profit > 0 ? "text-emerald-600" : profit < 0 ? "text-rose-600" : "text-slate-400";
                    return (
                      <tr key={`${line.item_id}-${idx}`} className="border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 font-black text-slate-800 max-w-[160px] truncate">{line.item_name || line.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 text-center">{qty}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{formatMoney(unitPrice)}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{formatMoney(purchase)}</td>
                        <td className="px-3 py-2 font-mono font-black text-slate-700">{formatMoney(revenue)}</td>
                        <td className={`px-3 py-2 font-mono font-black ${color}`}>
                          <div className="flex items-center gap-1">
                            <Icon className="h-3 w-3 shrink-0" />
                            {formatMoney(profit)}
                          </div>
                        </td>
                        <td className={`px-3 py-2 font-mono font-black ${color}`}>
                          {margin !== null ? `${formatPct(margin)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
