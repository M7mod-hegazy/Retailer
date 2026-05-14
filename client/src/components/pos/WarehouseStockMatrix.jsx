import React from 'react';
import { Package, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function WarehouseStockMatrix({ 
  warehouses, 
  selectedWarehouseId, 
  onSelect, 
  selectedItem 
}) {
  // If no item is selected, we just show a placeholder or disabled state
  if (!selectedItem) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-500">سحب المخزون من المستودع</label>
        <div className="flex items-center min-h-[46px] px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm font-bold opacity-60 pointer-events-none">
          حدد صنفاً لعرض أصدة المستودعات
        </div>
      </div>
    );
  }

  const stockDistribution = React.useMemo(() => {
    if (selectedItem.stock_by_warehouse) {
      return selectedItem.stock_by_warehouse;
    }
    // No per-warehouse data available — show zeros
    const dist = {};
    warehouses.forEach((w) => { dist[w.id] = 0; });
    return dist;
  }, [selectedItem.id, warehouses]);

  return (
    <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-500">سحب المخزون من المستودع</label>
        <span className="text-[10px] font-black tracking-widest text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full" style={{ fontFamily: "Outfit" }}>MATRIX ACTIVE</span>
      </div>
      
      {/* Scrollable Matrix Block */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none border border-slate-200 shadow-inner">
        {warehouses.map((warehouse) => {
          const qty = stockDistribution[warehouse.id] || 0;
          const isSelected = String(warehouse.id) === String(selectedWarehouseId);
          
          let statusStyle = "border-slate-200 bg-white text-slate-600 hover:border-slate-300";
          let badgeStyle = "bg-slate-100 text-slate-500";
          let icon = null;

          if (isSelected) {
             statusStyle = "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500";
             badgeStyle = "bg-emerald-500 text-white";
             icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />;
          } else {
            if (qty <= 0) {
              statusStyle = "border-rose-100 bg-rose-50/30 text-rose-400 hover:border-rose-300 hover:bg-rose-50 opacity-70";
              badgeStyle = "bg-rose-100 text-rose-600";
              icon = <AlertCircle className="w-3.5 h-3.5 text-rose-400 mr-1.5" />;
            } else if (qty < 5) {
              badgeStyle = "bg-amber-100 text-amber-700";
            }
          }

          return (
            <button
              key={warehouse.id}
              onClick={() => onSelect(String(warehouse.id))}
              type="button"
              className={`flex-shrink-0 flex items-center justify-between min-w-[130px] px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer ${statusStyle}`}
            >
              <div className="flex items-center">
                {icon || <Package className="w-3.5 h-3.5 text-slate-400 mr-1.5" opacity={isSelected ? 0 : 1} />}
                <span className="text-[12px] font-bold truncate max-w-[80px]" title={warehouse.name}>{warehouse.name}</span>
              </div>
              <span className={`text-[12px] font-black px-2 py-0.5 rounded-md min-w-[28px] text-center ${badgeStyle}`} style={{ fontFamily: "Outfit" }}>
                {qty}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
