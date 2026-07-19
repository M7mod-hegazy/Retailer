import React, { useRef, useEffect } from "react";
import { Printer, Loader2, RotateCcw, ShoppingCart, ExternalLink, Search, X, Plus, Wand2 } from "lucide-react";
import { formatNumber } from "../../utils/currency";
import PermissionGate from "../../components/ui/PermissionGate";
import SearchDropdown from "../../components/ui/SearchDropdown";

function formatMoney(v) {
  return formatNumber(v);
}

export default function PurchaseReturnFormBottomBar({
  cart = [], subtotal = 0, headerDiscount = 0, headerIncrease = 0,
  onHeaderDiscountChange, onHeaderIncreaseChange,
  total = 0,
  settlementType = "cash", onSettlementTypeChange,
  splitCashAmount = "", onSplitCashAmountChange,
  supplier = null,
  supplierBalance = null, netCreditAdjustment = 0, predictedBalance = null, returnCreditEffect = 0,
  supplierQuery = "", onSupplierQueryChange,
  supplierResults = [], onSupplierPick,
  supplierLookupOpen = false, onSupplierLookupOpenChange,
  onSupplierClear, onSupplierCreate,
  isLocked = false, supplierLockedFromPurchase = false, isSaving = false,
  onPrint, onSave, onSupplierInfo,
  mode, isEditMode = false,
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
  }, [forceShow, cart.length]);

  if (!forceShow) return null;

  const itemCount = cart.length;
  const quantityCount = cart.reduce((s, i) => s + Number(i.qty || i.quantity || 0), 0);

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]" style={{ backgroundColor: "var(--primary-100)" }}>
      <div className="flex flex-col">
        {/* Row 1: Supplier + Discount/Increase + Total */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 border-b border-zinc-100" style={{ backgroundColor: "var(--primary-200)" }}>
          <div className="relative shrink-0 z-[70]">
            <div className="flex items-center gap-0.5 rounded-lg bg-bg-surface/80 border border-zinc-200 px-1.5 py-0.5 shadow-sm">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={supplier ? supplierQuery || supplier.name : supplierQuery}
                onChange={(e) => { onSupplierQueryChange?.(e.target.value); onSupplierLookupOpenChange?.(true); }}
                onFocus={() => { if (!supplier) onSupplierQueryChange?.(""); onSupplierLookupOpenChange?.(true); }}
                onBlur={() => setTimeout(() => onSupplierLookupOpenChange?.(false), 200)}
                placeholder={supplier ? supplier.name : "ابحث عن مورد..."}
                disabled={isLocked || supplierLockedFromPurchase}
                className="w-[120px] bg-transparent text-2sm font-bold text-zinc-700 outline-none placeholder:text-zinc-400 disabled:opacity-60"
              />
              {supplier && onSupplierClear && !supplierLockedFromPurchase && (
                <button type="button" onClick={onSupplierClear}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-300 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
              {onSupplierCreate && !supplierLockedFromPurchase && (
                <button type="button" onClick={onSupplierCreate} title="إنشاء مورد"
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-amber-50 hover:text-amber-600 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              )}
              {onSupplierInfo && supplier && (
                <button type="button" onClick={onSupplierInfo} title="بيانات المورد"
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
            {supplierLookupOpen && supplierResults.length > 0 && (
              <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[220px]">
                <SearchDropdown
                  items={supplierResults}
                  onPick={(s) => { onSupplierPick?.(s); onSupplierLookupOpenChange?.(false); }}
                  activeIndex={0}
                  query={supplierQuery || ""}
                  emptyLabel="لم يتم العثور على مورد"
                  dropUp
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 border border-border-normal/40 shrink-0">
            <ShoppingCart className="h-3 w-3 text-zinc-400" />
            <span className="text-2sm font-black text-zinc-800">{itemCount}</span>
            <span className="text-[10px] font-bold text-zinc-500">أصناف</span>
          </div>

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          <label className="flex items-center gap-1 shrink-0 bg-rose-50/50 rounded-lg px-1.5 py-0.5 border border-rose-100/50">
            <input type="number" min="0" step="any" value={headerDiscount || ""}
              disabled={isLocked}
              onChange={e => onHeaderDiscountChange?.(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="min-w-[30px] rounded border border-rose-200 bg-bg-surface px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-rose-400" />
            <span className="text-[10px] font-bold text-rose-600 whitespace-nowrap">خصم</span>
          </label>
          <label className="flex items-center gap-1 shrink-0 bg-emerald-50/50 rounded-lg px-1.5 py-0.5 border border-emerald-100/50">
            <input type="number" min="0" step="any" value={headerIncrease || ""}
              disabled={isLocked}
              onChange={e => onHeaderIncreaseChange?.(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="min-w-[30px] rounded border border-emerald-200 bg-bg-surface px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">زيادة</span>
          </label>
          <span className="h-5 w-px bg-zinc-200 shrink-0" />
          <div className="flex items-baseline gap-1">
            <span className="text-2sm font-bold text-amber-600">المسترجع</span>
            <span className="font-mono text-lg font-black tracking-tight text-amber-700">
              {formatMoney(total)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>
        </div>

        {/* Row 2: Settlement type + split cash + balance */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-1 border-b border-zinc-100" style={{ backgroundColor: "var(--primary-200)" }}>
          <div className="flex items-center gap-0.5 shrink-0">
            {[
              { value: "cash", label: "نقداً" },
              { value: "account", label: "حساب المورد" },
              { value: "split", label: "مختلط" },
            ].map(opt => {
              const noSupplierBlocked = !isLocked && opt.value !== "cash" && !supplier;
              const active = settlementType === opt.value;
              return (
                <button key={opt.value} type="button"
                  onClick={() => !(isLocked || noSupplierBlocked) && onSettlementTypeChange?.(opt.value)}
                  disabled={isLocked || noSupplierBlocked}
                  title={noSupplierBlocked ? "يجب اختيار مورد أولاً" : ""}
                  className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-bold transition-all shrink-0 ${
                    active
                      ? "bg-amber-600 text-white border-transparent shadow-sm"
                      : noSupplierBlocked
                        ? "cursor-not-allowed bg-red-50 border-dashed border-red-300 text-red-400"
                        : "opacity-35 cursor-not-allowed bg-bg-overlay border-border-subtle text-text-muted"
                  }`}>
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="h-4 w-px bg-zinc-200 shrink-0" />

          {settlementType === "split" && total > 0 && (
            <div className="flex items-center gap-1 bg-bg-surface/80 rounded-lg border border-zinc-200 px-2 py-0.5 shadow-sm shrink-0">
              <span className="text-2sm font-bold text-text-secondary">المبلغ النقدي</span>
              <input type="number" min="0" max={total} step="0.01"
                value={splitCashAmount} onChange={e => onSplitCashAmountChange?.(e.target.value)}
                className="w-16 rounded border border-zinc-200 bg-bg-surface px-1 py-0.5 text-center font-mono text-2sm font-black text-zinc-700 outline-none focus:border-amber-400" />
              <button type="button" title="املأ المتبقي"
                onClick={() => onSplitCashAmountChange?.(String(Math.max(0, total)))}
                className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 active:scale-90 transition-all">
                <Wand2 className="h-2.5 w-2.5" />
              </button>
              <span className="text-2sm font-bold text-zinc-500">
                حساب: {formatMoney(Math.max(0, total - (Number(splitCashAmount) || 0)))}
              </span>
            </div>
          )}

          {supplier && supplierBalance !== null && returnCreditEffect > 0 && (
            <div className="mr-auto flex items-center gap-1 text-2sm font-bold">
              <span className={`font-mono font-black ${supplierBalance > 0 ? "text-rose-600" : "text-amber-600"}`}>
                {formatMoney(supplierBalance)}
              </span>
              {netCreditAdjustment !== 0 && (
                <>
                  <span className="text-zinc-300 text-[10px]">←</span>
                  <span className={`font-mono font-black ${netCreditAdjustment > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {netCreditAdjustment > 0 ? "−" : "+"}{formatMoney(Math.abs(netCreditAdjustment))}
                  </span>
                  <span className="text-zinc-300 text-[10px]">←</span>
                  <span className={`font-mono font-black ${(predictedBalance || 0) > 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {formatMoney(predictedBalance)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Row 3: Actions */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1">
          <PermissionGate page="purchase_returns" action="print">
            <button onClick={onPrint} disabled={!total}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-bg-surface/90 px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-all active:scale-[0.95] shadow-sm">
              <Printer className="h-3 w-3" /> طباعة
            </button>
          </PermissionGate>
          <div className="mr-auto" />
          {mode && !isLocked && (
            <PermissionGate page="purchase_returns" action={isEditMode ? "edit" : "add"}>
              <button onClick={onSave} disabled={isSaving || !total}
                className="flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md bg-amber-600 hover:bg-amber-700">
                {isSaving
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...</>
                  : <><RotateCcw className="h-3 w-3" /> {isEditMode ? "حفظ التعديلات" : "حفظ المرتجع"}</>
                }
              </button>
            </PermissionGate>
          )}
        </div>
      </div>
    </div>
  );
}
