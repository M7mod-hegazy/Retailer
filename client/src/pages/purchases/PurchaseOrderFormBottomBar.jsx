import React, { useRef, useEffect } from "react";
import { Printer, Save, Loader2, Tag, Package } from "lucide-react";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { formatNumber } from "../../utils/currency";
import DocumentActionButton from "../../components/document/DocumentActionButton";
import PermissionGate from "../../components/ui/PermissionGate";

function formatMoney(v) {
  return formatNumber(v);
}

export default function PurchaseOrderFormBottomBar({
  totals, discount, increase,
  onDiscountChange, onIncreaseChange,
  itemCount, quantityCount,
  onSave, onPrint,
  isSaving = false, isEditMode = false,
  linesLength = 0,
  forceShow = false,
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
  }, [forceShow, itemCount]);

  if (!forceShow) return null;

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col">
        {/* Row 1: Counts + subtotal */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100">
            <Package className="h-3 w-3 text-zinc-400" />
            <span className="text-2sm font-black text-zinc-800">{itemCount}</span>
            <span className="text-[10px] font-bold text-zinc-500">أصناف</span>
          </div>
          {quantityCount > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100">
              <span className="text-2sm font-black text-zinc-800">{quantityCount}</span>
              <span className="text-[10px] font-bold text-zinc-500">كمية</span>
            </div>
          )}
          <span className="h-5 w-px bg-zinc-200" />
          <span className="text-2sm font-bold text-zinc-400">المجموع الفرعي</span>
          <span className="font-mono text-sm font-black text-zinc-700">{formatMoney(totals.sub)}</span>
        </div>

        {/* Row 2: Discount/Increase + total */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 bg-zinc-50/60 border-b border-zinc-100">
          <label className="flex items-center gap-1 shrink-0 bg-amber-50/50 rounded-lg px-1.5 py-0.5 border border-amber-100/50">
            <input type="number" min="0"
              value={discount || ""}
              onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value || 0)))}
              placeholder="0"
              className="min-w-[30px] rounded border border-amber-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-amber-400 transition-colors" />
            <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">خصم</span>
          </label>
          <label className="flex items-center gap-1 shrink-0 bg-blue-50/50 rounded-lg px-1.5 py-0.5 border border-blue-100/50">
            <input type="number" min="0"
              value={increase || ""}
              onChange={(e) => onIncreaseChange(Math.max(0, Number(e.target.value || 0)))}
              placeholder="0"
              className="min-w-[30px] rounded border border-blue-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-blue-400 transition-colors" />
            <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">إضافة</span>
          </label>
          <span className="h-5 w-px bg-zinc-200" />
          <div className="flex items-baseline gap-1">
            <Tag className="h-3 w-3 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-500">الإجمالي النهائي</span>
            <span className="font-mono text-lg font-black tracking-tight text-emerald-700">
              {formatMoney(totals.total)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>
        </div>

        {/* Row 3: Actions */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 bg-white">
          <PermissionGate page="purchase_orders" action="print">
            <button onClick={onPrint} disabled={!linesLength}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-all disabled:opacity-40 active:scale-[0.95] shadow-sm">
              <Printer className="h-3 w-3" /> طباعة
            </button>
          </PermissionGate>
          <div className="mr-auto" />
          <PermissionGate page="purchase_orders" action="add">
            <button onClick={onSave} disabled={isSaving || !linesLength}
              className="flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md bg-primary hover:bg-primary-600">
              {isSaving
                ? <><Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...</>
                : <><Save className="h-3 w-3" /> {isEditMode ? "حفظ التعديلات" : "اعتماد وإرسال الطلب"}</>
              }
              <ShortcutKbd id="form.save" className="rounded bg-white/20 px-1 text-[9px] font-mono" />
            </button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
