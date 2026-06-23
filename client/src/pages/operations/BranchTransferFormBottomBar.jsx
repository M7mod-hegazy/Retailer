import React, { useRef, useEffect } from "react";
import { Printer, Package, CheckCircle2, Loader2, Warehouse, Settings, ChevronDown } from "lucide-react";
import { formatNumber } from "../../utils/currency";
import PermissionGate from "../../components/ui/PermissionGate";

export default function BranchTransferFormBottomBar({
  totalQty, totalCost, totalSell,
  isReceive = false,
  onSave, onPrint,
  isSaving = false, linesLength = 0,
  hasErrors = false,
  partnerBranch = "",
  forceShow = false,
  branches = [],
  onPartnerBranchChange,
  onManageBranches,
}) {
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    const setVar = (v) => document.documentElement.style.setProperty("--bottom-bar-h", v);
    if (!forceShow || !el) { setVar("0px"); return () => setVar("0px"); }
    const update = () => setVar(`${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); setVar("0px"); };
  }, [forceShow, totalQty]);

  if (!forceShow) return null;

  const theme = isReceive
    ? { primary: "emerald", gradient: "from-emerald-500 to-teal-700" }
    : { primary: "indigo", gradient: "from-indigo-600 to-blue-700" };

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col">
        {/* Row 1: Totals + Branch */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100">
            <Package className="h-3 w-3 text-zinc-400" />
            <span className="text-2sm font-black text-zinc-800">{formatNumber(totalQty, { decimals: 0 })}</span>
            <span className="text-[10px] font-bold text-zinc-500">إجمالي الكميات</span>
          </div>
          <span className="h-4 w-px bg-zinc-200" />
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-bold text-zinc-500">التكلفة</span>
            <span className="font-mono text-sm font-black tracking-tight text-slate-700">
              {formatNumber(totalCost)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>
          <span className="h-4 w-px bg-zinc-200" />
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-bold text-zinc-500">إجمالي البيع</span>
            <span className="font-mono text-sm font-black tracking-tight text-amber-600">
              {formatNumber(totalSell)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>
          <span className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-1 min-w-0 flex-[2]">
            <span className="text-[10px] font-bold text-zinc-500 shrink-0 whitespace-nowrap">
              {isReceive ? "الفرع المُرسل:" : "الفرع المُستلم:"}
            </span>
            <div className="relative min-w-0 flex-1 max-w-[160px]">
              <select
                value={partnerBranch}
                onChange={e => onPartnerBranchChange?.(e.target.value)}
                className="w-full appearance-none rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-2sm font-bold text-zinc-700 outline-none focus:border-indigo-400 focus:bg-white cursor-pointer truncate"
              >
                <option value="">اختر...</option>
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
            </div>
            {onManageBranches && (
              <button
                type="button"
                onClick={onManageBranches}
                title="إدارة الفروع"
                className="flex shrink-0 items-center justify-center w-5 h-5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors"
              >
                <Settings className="w-2.5 h-2.5 text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 bg-white">
          <PermissionGate page="branch_transfer" action="print">
            <button onClick={onPrint}
              disabled={isSaving || !linesLength || !partnerBranch || hasErrors}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-all disabled:opacity-40 active:scale-[0.95] shadow-sm">
              <Printer className="h-3 w-3" /> طباعة
            </button>
          </PermissionGate>
          <div className="mr-auto" />
          <PermissionGate page="branch_transfer" action="add">
            <button onClick={onSave}
              disabled={isSaving || !linesLength || !partnerBranch || hasErrors}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md ${
                isReceive ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}>
              {isSaving
                ? <><Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...</>
                : <><CheckCircle2 className="h-3 w-3" /> حفظ المستند</>
              }
            </button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
