import React, { useRef, useEffect } from "react";
import { Printer, Loader2, Save, ShoppingCart, Banknote, Wallet, Layers, User, Plus, Building2, Lock, Wand2, AlertCircle } from "lucide-react";
import { formatNumber } from "../../utils/currency";
import PermissionGate from "../../components/ui/PermissionGate";
import SearchDropdown from "../../components/ui/SearchDropdown";

function formatMoney(v) {
  return formatNumber(v, { decimals: 3 });
}

// Purchase payment modes — mirrors the expanded sidebar (cash / multi / credit).
// `credit` requires a supplier (added to the supplier's balance).
const PAYMENT_PILLS = [
  { value: "cash",   label: "نقدي",  Icon: Banknote, requiresSupplier: false },
  { value: "multi",  label: "متعدد", Icon: Layers,   requiresSupplier: false },
  { value: "credit", label: "آجل",   Icon: Wallet,   requiresSupplier: true  },
];

export default function PurchaseFormBottomBar({
  lines = [], totals = { sub: 0, total: 0 },
  discount = 0, increase = 0,
  onDiscountChange, onIncreaseChange,
  paymentMode = "cash", onPaymentModeChange,
  paymentMethods = [], multiAmounts = {}, onMultiAmountsChange,
  multiTotal = 0, multiBalanced = false,
  creditEffect = 0, supplierBalanceAfter = 0,
  isLocked = false, isSaving = false,
  onPrint, onSave,
  isEditMode = false, isAmendMode = false, isEditDirty = false,
  canSave = false,
  forceShow = false,
  // Supplier
  supplier = null,
  supplierQuery = "",
  onSupplierQueryChange,
  filteredSuppliers = [],
  supplierLookupOpen = false,
  onSupplierLookupToggle,
  activeSupplierIndex = 0,
  onPickSupplier,
  onAddSupplier,
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
  }, [forceShow, lines.length, supplier, paymentMode]);

  if (!forceShow) return null;

  const itemCount = lines.length;
  const quantityCount = lines.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const isCreditMode = paymentMode === "credit" || paymentMode === "future_due";
  const needsSupplier = isCreditMode && !supplier;
  // Current standing balance derived from parent's edit-aware after-balance.
  const curBal = supplierBalanceAfter - creditEffect;

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]" style={{ backgroundColor: "var(--primary-100)" }}>
      <div className="flex flex-col">

        {/* ═══════════ Row 1: Supplier (first) + total + counts + discount/increase ═══════════ */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 border-b border-zinc-100">

          {/* Supplier search — first on the line */}
          <div className="relative flex items-center gap-1.5 shrink-0">
            <div className="relative z-[70]">
              <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={supplierQuery}
                onChange={(e) => onSupplierQueryChange?.(e.target.value)}
                onFocus={() => onSupplierLookupToggle?.(true)}
                onBlur={() => setTimeout(() => onSupplierLookupToggle?.(false), 200)}
                placeholder={supplier ? supplier.name : "المورد (ابحث)..."}
                disabled={isLocked}
                style={needsSupplier ? undefined : { background: "var(--bg-input)", color: "var(--text-primary)" }}
                className={`w-[180px] border rounded-lg py-1 pl-3 pr-9 text-2sm font-bold outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
                  needsSupplier
                    ? "border-amber-400 bg-amber-50 text-amber-800 placeholder:text-amber-500 focus:border-amber-600"
                    : "border-zinc-200 focus:border-[var(--primary)]"
                }`}
              />
              {supplierLookupOpen && !isLocked && (
                <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[220px]">
                  <SearchDropdown
                    items={filteredSuppliers}
                    onPick={onPickSupplier}
                    activeIndex={activeSupplierIndex}
                    emptyLabel="لم يتم العثور على مورد"
                    dropUp
                  />
                </div>
              )}
            </div>
            {!isLocked && (
              <button onClick={onAddSupplier} title="إضافة مورد جديد"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white/70 text-zinc-600 hover:bg-white transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            {supplier && (
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5 shrink-0">
                <Building2 className="h-3 w-3 text-orange-500 shrink-0" />
                <span className="text-[11px] font-black text-orange-800 truncate max-w-[110px]">{supplier.name}</span>
              </div>
            )}
          </div>

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          {/* Grand total */}
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-2sm font-bold text-[var(--primary)]">الإجمالي</span>
            <span className="font-mono text-lg font-black tracking-tight text-[var(--primary-600)]">{formatMoney(totals.total)}</span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>

          {/* Counts */}
          <div className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 border border-white/40 shrink-0">
            <ShoppingCart className="h-3 w-3 text-zinc-400" />
            <span className="text-2sm font-black text-zinc-800">{itemCount}</span>
            <span className="text-[10px] font-bold text-zinc-500">صنف</span>
          </div>
          {quantityCount > 0 && (
            <div className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 border border-white/40 shrink-0">
              <span className="text-2sm font-black text-zinc-800">{quantityCount}</span>
              <span className="text-[10px] font-bold text-zinc-500">كمية</span>
            </div>
          )}

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          {/* Discount */}
          <label className="flex items-center gap-1 shrink-0 bg-rose-50/50 rounded-lg px-1.5 py-0.5 border border-rose-100/50">
            <input type="number" min="0" step="any" value={discount || ""}
              disabled={isLocked}
              onChange={e => onDiscountChange?.(Math.min(totals.sub, Math.max(0, Number(e.target.value) || 0)))}
              placeholder="0"
              className="min-w-[34px] rounded border border-rose-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-rose-400" />
            <span className="text-[10px] font-bold text-rose-600 whitespace-nowrap">خصم</span>
          </label>

          {/* Increase */}
          <label className="flex items-center gap-1 shrink-0 rounded-lg px-1.5 py-0.5 border bg-blue-50/50 border-blue-100/50">
            <input type="number" min="0" step="any" value={increase || ""}
              disabled={isLocked}
              onChange={e => onIncreaseChange?.(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="min-w-[34px] rounded border border-blue-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-blue-400" />
            <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">إضافة</span>
          </label>

          {/* Subtotal pushed to the edge */}
          <div className="mr-auto flex items-center gap-1 text-2sm text-zinc-400 shrink-0">
            <span className="font-bold">فرعي</span>
            <span className="font-mono font-black text-zinc-600">{formatMoney(totals.sub)}</span>
          </div>
        </div>

        {/* ═══════════ Row 2: Payment pills + per-mode inputs (single wrapping row) ═══════════ */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-1.5 border-b border-zinc-100" style={{ backgroundColor: "var(--primary-200)" }}>

          {/* Payment type pills */}
          <div className="flex items-center gap-0.5 shrink-0">
            {PAYMENT_PILLS.map(({ value, label, Icon, requiresSupplier }) => {
              const noSupplierBlocked = requiresSupplier && !supplier;
              const active = paymentMode === value || (value === "credit" && isCreditMode);
              return (
                <button key={value} type="button"
                  onClick={() => !(isLocked || noSupplierBlocked) && onPaymentModeChange?.(value)}
                  disabled={isLocked || noSupplierBlocked}
                  title={noSupplierBlocked ? "يجب اختيار مورد أولاً" : label}
                  className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-all shrink-0 ${
                    active
                      ? "bg-[var(--primary)] text-white border-transparent shadow-sm"
                      : noSupplierBlocked
                        ? "cursor-not-allowed bg-red-50 border-dashed border-red-300 text-red-400"
                        : "border-[var(--primary-100)] text-[var(--primary)] bg-[var(--primary-50)] hover:shadow-sm"
                  }`}>
                  {noSupplierBlocked ? <AlertCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {label}
                </button>
              );
            })}
          </div>

          <span className="h-4 w-px bg-zinc-200 shrink-0" />

          {/* ── Cash: immediate ── */}
          {paymentMode === "cash" && (
            <div className="flex items-center gap-1 bg-white/80 rounded-lg border border-zinc-200 px-2 py-1 shadow-sm shrink-0">
              <Banknote className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-bold text-zinc-600 whitespace-nowrap">سداد فوري — خصم من الخزينة</span>
            </div>
          )}

          {/* ── Credit / future due: added to supplier balance ── */}
          {isCreditMode && (
            <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg border border-amber-200 px-2 py-1 shadow-sm shrink-0">
              <Wallet className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              {supplier ? (
                <span className="text-[11px] font-bold text-amber-800 whitespace-nowrap">
                  إضافة <span className="font-mono font-black">{formatMoney(creditEffect)}</span> لرصيد {supplier.name}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">اختر مورد للشراء الآجل</span>
              )}
            </div>
          )}

          {/* ── Multi: per-method inputs + distribution check ── */}
          {paymentMode === "multi" && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-white/80 rounded-lg border border-zinc-200 px-2 py-1 shadow-sm">
              {paymentMethods.length === 0 ? (
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">لا توجد وسائل دفع مُعرّفة</span>
              ) : (
                paymentMethods.map(m => (
                  <div key={m.id} className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[11px] font-bold text-zinc-600 whitespace-nowrap">{m.name}:</span>
                    <input type="number" min="0" step="0.01" value={multiAmounts[m.id] || ""}
                      disabled={isLocked || ((m.type === "credit" || m.category === "credit") && !supplier)}
                      onChange={(e) => onMultiAmountsChange?.(prev => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder="0"
                      className="w-[64px] rounded border border-zinc-200 bg-white/70 px-1 py-0.5 text-center text-2sm font-bold text-zinc-700 outline-none focus:border-[var(--primary)] transition-colors" />
                    <button type="button" title="املأ المتبقي"
                      onClick={() => {
                        const other = Object.entries(multiAmounts)
                          .filter(([id]) => String(id) !== String(m.id))
                          .reduce((s, [, v]) => s + Number(v || 0), 0);
                        const fill = Math.max(0, totals.total - other);
                        onMultiAmountsChange?.(prev => ({ ...prev, [m.id]: String(fill) }));
                      }}
                      className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 active:scale-90 transition-all">
                      <Wand2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))
              )}
              <span className={`px-2 py-0.5 rounded text-2sm font-black shrink-0 ${multiBalanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {formatMoney(multiTotal)}/{formatMoney(totals.total)}
              </span>
            </div>
          )}

          {/* ── Smart live supplier balance change ── */}
          {supplier && (
            <div className="mr-auto flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">الرصيد الحالي</span>
                <span className={`text-2sm font-mono font-black ${curBal > 0.005 ? "text-rose-600" : curBal < -0.005 ? "text-emerald-600" : "text-slate-700"}`}>{formatMoney(curBal)}</span>
              </div>
              {creditEffect > 0 && lines.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 shrink-0">
                  <span className="text-[10px] font-bold text-amber-600">التغير</span>
                  <span className="text-2sm font-mono font-black text-amber-700">+{formatMoney(creditEffect)}</span>
                  <span className="h-3.5 w-px bg-amber-300/60" />
                  <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">بعد الفاتورة</span>
                  <span className={`text-2sm font-mono font-black ${supplierBalanceAfter > 0.005 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(supplierBalanceAfter)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════ Row 3: Actions ═══════════ */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
          <PermissionGate page="purchases" action="print">
            <button onClick={onPrint} disabled={!lines.length}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-all active:scale-[0.95] shadow-sm">
              <Printer className="h-3 w-3" /> طباعة
            </button>
          </PermissionGate>
          <div className="mr-auto" />
          {!isLocked && (
            <PermissionGate page="purchases" action={isEditMode ? "edit" : "add"}>
              <button onClick={onSave} disabled={isSaving || !canSave}
                className="flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md bg-[var(--primary)] hover:bg-[var(--primary-600)]">
                {isSaving
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...</>
                  : <><Save className="h-3 w-3" /> {isAmendMode ? "إصدار تعديل" : isEditMode ? "حفظ التعديلات" : "حفظ الفاتورة"}</>
                }
              </button>
            </PermissionGate>
          )}
        </div>

      </div>
    </div>
  );
}
