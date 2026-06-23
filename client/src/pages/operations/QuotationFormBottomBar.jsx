import React, { useRef, useEffect, useState } from "react";
import {
  Printer, Save, Loader2, User, Search, Plus, X, Banknote, CreditCard,
  Wallet, Calendar, Layers, Minus, Plus as PlusIcon, Info, ShoppingCart, Wand2,
} from "lucide-react";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { formatNumber } from "../../utils/currency";
import PermissionGate from "../../components/ui/PermissionGate";
import SearchDropdown from "../../components/ui/SearchDropdown";

function formatMoney(v) {
  return formatNumber(v);
}

const PAYMENT_TYPES = [
  { value: 'cash', label: 'نقدي', Icon: Banknote },
  { value: 'bank_transfer', label: 'بنك/فيزا', Icon: CreditCard },
  { value: 'credit', label: 'آجل', Icon: Wallet },
  { value: 'installments', label: 'أقساط', Icon: Calendar },
  { value: 'multi', label: 'متعدد', Icon: Layers },
];

const COLOR_MAP = {
  cash:          { bg: "bg-emerald-50",    text: "text-emerald-600",    border: "border-emerald-200",    activeBg: "bg-emerald-600" },
  bank_transfer: { bg: "bg-blue-50",       text: "text-blue-600",       border: "border-blue-200",       activeBg: "bg-blue-600" },
  credit:        { bg: "bg-amber-50",      text: "text-amber-600",      border: "border-amber-200",      activeBg: "bg-amber-600" },
  installments:  { bg: "bg-violet-50",     text: "text-violet-600",     border: "border-violet-200",     activeBg: "bg-violet-600" },
  multi:         { bg: "bg-slate-50",      text: "text-slate-600",      border: "border-slate-200",      activeBg: "bg-slate-700" },
};

export default function QuotationFormBottomBar({
  totals, cart = [],
  selectedCustomer, customerQuery, onCustomerQueryChange, onCustomerPick,
  showCustomerList, onShowCustomerListChange, filteredCustomers = [],
  onCustomerCreate, onCustomerClear,
  paymentType, onPaymentChange,
  increase, onIncreaseChange, increaseMode, onIncreaseModeChange,
  decrease, onDecreaseChange, decreaseMode, onDecreaseModeChange,
  taxEnabled, onTaxEnabledChange, taxRate, taxFeatureOn,
  onSave, onPrint,
  isSaving = false,
  banks = [], selectedBankId, onBankChange,
  multiCash, onMultiCashChange, multiCredit, onMultiCreditChange,
  amountPaid, onAmountPaidChange,
  installmentDueDate, onInstallmentDueDateChange,
  customPayMethods = [], multiCustomAmounts = {}, onMultiCustomAmountsChange,
  onCustomerRef,
  forceShow = false,
}) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
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
  const quantityCount = cart.reduce((s, i) => s + Number(i.qty || 0), 0);
  const hasCustomer = !!selectedCustomer;
  const isPaymentDisabled = (type) =>
    ["credit", "installments", "bank_transfer"].includes(type) && !hasCustomer;

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col">
        {/* Row 1: Customer + counts + subtotal */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 border-b border-zinc-100 bg-white">
          {/* Customer search */}
          <div ref={searchRef} className="relative shrink-0">
            <div className="flex items-center gap-0.5 rounded-lg bg-white border border-zinc-200 px-1.5 py-0.5 shadow-sm">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={customerQuery ?? (hasCustomer ? selectedCustomer.name : "")}
                onChange={(e) => { onCustomerQueryChange?.(e.target.value); onShowCustomerListChange?.(true); }}
                onFocus={() => { if (!hasCustomer) onCustomerQueryChange?.(""); onShowCustomerListChange?.(true); }}
                onBlur={() => setTimeout(() => onShowCustomerListChange?.(false), 200)}
                placeholder={hasCustomer ? selectedCustomer.name : "ابحث عن عميل..."}
                className="w-[120px] bg-transparent text-2sm font-bold text-zinc-700 outline-none placeholder:text-zinc-400"
              />
              {hasCustomer && onCustomerClear && (
                <button type="button" onClick={onCustomerClear}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-300 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
              {onCustomerCreate && (
                <button type="button" onClick={onCustomerCreate} title="إنشاء عميل"
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
            {showCustomerList && filteredCustomers.length > 0 && (
              <div className="absolute right-0 bottom-full mb-1 z-[70] min-w-[220px]">
                <SearchDropdown
                  items={filteredCustomers}
                  onPick={(c) => { onCustomerPick?.(c); onShowCustomerListChange?.(false); }}
                  activeIndex={0}
                  query={customerQuery || ""}
                  emptyLabel="لم يتم العثور على عميل"
                />
              </div>
            )}
          </div>

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          <div className="flex items-center gap-1 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100">
            <ShoppingCart className="h-3 w-3 text-zinc-400" />
            <span className="text-2sm font-black text-zinc-800">{itemCount}</span>
            <span className="text-[10px] font-bold text-zinc-500">أصناف</span>
          </div>
          {quantityCount > 0 && (
            <div className="flex items-center gap-1 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100">
              <span className="text-2sm font-black text-zinc-800">{quantityCount}</span>
              <span className="text-[10px] font-bold text-zinc-500">كمية</span>
            </div>
          )}

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          <div className="flex items-baseline gap-1">
            <span className="text-2sm font-bold text-zinc-400">الفرعي</span>
            <span className="font-mono text-sm font-black text-zinc-600">{formatMoney(totals.subtotal)}</span>
          </div>
        </div>

        {/* Row 2: Increase/Decrease + Tax + Total */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 bg-zinc-50/60 border-b border-zinc-100">
          <label className="flex items-center gap-1 shrink-0 bg-blue-50/50 rounded-lg px-1.5 py-0.5 border border-blue-100/50">
            <input type="number" min="0"
              value={increaseMode === 'pct' && totals.subtotal > 0
                ? parseFloat(((increase / totals.subtotal) * 100).toFixed(2))
                : increase || ""}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value || 0));
                increaseMode === 'pct' && totals.subtotal > 0
                  ? onIncreaseChange(parseFloat(((val / 100) * totals.subtotal).toFixed(4)))
                  : onIncreaseChange(val);
              }}
              placeholder="0"
              className="min-w-[30px] rounded border border-blue-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-blue-400 transition-colors" />
            <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">زيادة</span>
            {onIncreaseModeChange && (
              <button type="button" onClick={() => onIncreaseModeChange(increaseMode === 'pct' ? 'flat' : 'pct')}
                className={`px-1 py-0.5 rounded text-[9px] font-black border transition-colors shrink-0 ${
                  increaseMode === 'pct'
                    ? "bg-blue-200 border-blue-300 text-blue-800"
                    : "border-blue-200 text-blue-500 hover:bg-blue-100"
                }`}>
                {increaseMode === 'pct' ? '%' : 'ج'}
              </button>
            )}
          </label>
          <label className="flex items-center gap-1 shrink-0 bg-rose-50/50 rounded-lg px-1.5 py-0.5 border border-rose-100/50">
            <input type="number" min="0"
              value={decreaseMode === 'pct' && totals.subtotal > 0
                ? parseFloat(((decrease / totals.subtotal) * 100).toFixed(2))
                : decrease || ""}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value || 0));
                decreaseMode === 'pct' && totals.subtotal > 0
                  ? onDecreaseChange(parseFloat(((val / 100) * totals.subtotal).toFixed(4)))
                  : onDecreaseChange(val);
              }}
              placeholder="0"
              className="min-w-[30px] rounded border border-rose-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-rose-400 transition-colors" />
            <span className="text-[10px] font-bold text-rose-600 whitespace-nowrap">نقصان</span>
            {onDecreaseModeChange && (
              <button type="button" onClick={() => onDecreaseModeChange(decreaseMode === 'pct' ? 'flat' : 'pct')}
                className={`px-1 py-0.5 rounded text-[9px] font-black border transition-colors shrink-0 ${
                  decreaseMode === 'pct'
                    ? "bg-rose-200 border-rose-300 text-rose-800"
                    : "border-rose-200 text-rose-500 hover:bg-rose-100"
                }`}>
                {decreaseMode === 'pct' ? '%' : 'ج'}
              </button>
            )}
          </label>
          {taxFeatureOn && (
            <label className="flex items-center gap-1 shrink-0 bg-indigo-50/50 rounded-lg px-1.5 py-0.5 border border-indigo-100/50">
              <input type="checkbox" checked={taxEnabled === null ? true : Boolean(taxEnabled)}
                onChange={(e) => onTaxEnabledChange?.(e.target.checked ? 1 : 0)}
                className="accent-indigo-600 h-3 w-3" />
              <span className="text-[10px] font-bold text-indigo-600 whitespace-nowrap">ضريبة ({taxRate}%)</span>
              <span className="text-2sm font-black text-indigo-600">+{formatMoney(totals.taxAmount)}</span>
            </label>
          )}
          <span className="h-5 w-px bg-zinc-200 shrink-0" />
          <div className="flex items-baseline gap-1">
            <span className="text-2sm font-bold text-zinc-400">الصافي</span>
            <span className="font-mono text-lg font-black tracking-tight text-zinc-900">
              {formatMoney(totals.total)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
          </div>
        </div>

        {/* Row 3: Payment method pills */}
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 px-3 py-1 bg-zinc-50/60 border-b border-zinc-100">
          {PAYMENT_TYPES.map(({ value, label, Icon: _Icon }) => {
            const isDisabled = isPaymentDisabled(value);
            const isActive = paymentType === value;
            const c = COLOR_MAP[value] || COLOR_MAP.cash;
            return (
              <button key={value} type="button"
                onClick={() => !isDisabled && onPaymentChange?.(value)}
                disabled={isDisabled}
                title={isDisabled ? "متاح للعملاء المسجلين فقط" : label}
                className={`rounded-lg border px-1 py-0.5 text-[10px] font-bold transition-all shrink-0
                  ${isActive
                    ? `${c.activeBg} text-white border-transparent shadow-sm`
                    : isDisabled
                      ? "opacity-35 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400"
                      : `${c.bg} ${c.text} ${c.border} hover:shadow-sm bg-white`
                  }`}>
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Payment sub-forms */}
        {paymentType === "bank_transfer" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50/30 border-b border-blue-100/50">
            <CreditCard className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <select value={selectedBankId} onChange={e => onBankChange?.(e.target.value)}
              className="rounded border border-blue-200 bg-white px-2 py-0.5 text-2sm font-bold text-slate-700 outline-none focus:border-blue-500">
              <option value="">اختر البنك / البطاقة</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        {paymentType === "credit" && selectedCustomer && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50/30 border-b border-amber-100/50">
            <Wallet className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-2sm font-bold text-amber-800">سيتم إضافة {formatMoney(totals.total)} إلى رصيد {selectedCustomer.name}</span>
          </div>
        )}
        {paymentType === "installments" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 bg-violet-50/30 border-b border-violet-100/50">
            <label className="flex items-center gap-1 shrink-0">
              <span className="text-2sm font-bold text-slate-600">دفعة مقدم</span>
              <input type="number" min="0" value={amountPaid} onChange={e => onAmountPaidChange?.(e.target.value)}
                className="w-20 rounded border border-violet-200 bg-white px-1 py-0.5 text-center font-mono text-2sm font-black text-slate-800 outline-none focus:border-violet-500" />
            </label>
            <label className="flex items-center gap-1 shrink-0">
              <span className="text-2sm font-bold text-slate-600">تاريخ الاستحقاق</span>
              <input type="date" value={installmentDueDate} onChange={e => onInstallmentDueDateChange?.(e.target.value)}
                className="w-28 rounded border border-violet-200 bg-white px-1 py-0.5 text-2sm font-bold text-slate-700 outline-none focus:border-violet-500" />
            </label>
            {selectedCustomer && (
              <span className="text-2sm font-black text-violet-800">
                المتبقي: {formatMoney(Math.max(0, totals.total - Number(amountPaid || 0)))} على {selectedCustomer.name}
              </span>
            )}
          </div>
        )}
        {paymentType === "multi" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 bg-slate-50/60 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <label className="flex items-center gap-1 shrink-0">
                <span className="text-2sm font-bold text-slate-600">💵 نقدي</span>
                <input type="number" min="0" value={multiCash} onChange={e => onMultiCashChange?.(e.target.value)} placeholder="0"
                  className="w-16 rounded border border-emerald-200 bg-white px-1 py-0.5 text-center font-mono text-2sm font-black text-slate-800 outline-none focus:border-emerald-400" />
                <button type="button" title="املأ المتبقي" onClick={() => { const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); const cr = Number(multiCredit||0); onMultiCashChange?.(String(Math.max(0, totals.total - c - cr))); }}
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 active:scale-90">
                  <Wand2 className="h-2.5 w-2.5" />
                </button>
              </label>
              {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                <label key={m.id} className="flex items-center gap-1 shrink-0">
                  <span className="text-2sm font-bold text-slate-600 whitespace-nowrap">{m.icon} {m.name}</span>
                  <input type="number" min="0" value={multiCustomAmounts[m.id] || ""} onChange={e => onMultiCustomAmountsChange?.(prev => ({...prev, [m.id]: e.target.value}))} placeholder="0"
                    className="w-16 rounded border border-violet-200 bg-white px-1 py-0.5 text-center font-mono text-2sm font-black text-slate-800 outline-none focus:border-violet-400" />
                  <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const cr = Number(multiCredit||0); const others = customPayMethods.filter(mm => !mm.name?.includes('بنك') && !mm.name?.includes('تحويل') && mm.icon !== '🏦' && mm.id !== m.id).reduce((s, mm) => s + Number(multiCustomAmounts[mm.id]||0), 0); onMultiCustomAmountsChange?.(prev => ({...prev, [m.id]: String(Math.max(0, totals.total - ca - others - cr))})); }}
                    className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 active:scale-90">
                    <Wand2 className="h-2.5 w-2.5" />
                  </button>
                </label>
              ))}
              <label className="flex items-center gap-1 shrink-0">
                <span className={`text-2sm font-bold ${selectedCustomer?.id ? 'text-amber-700' : 'text-slate-400'}`}>📋 آجل</span>
                <input type="number" min="0" value={multiCredit} onChange={e => onMultiCreditChange?.(e.target.value)} placeholder="0"
                  disabled={!selectedCustomer?.id}
                  className={`w-16 rounded border px-1 py-0.5 text-center font-mono text-2sm font-black outline-none ${selectedCustomer?.id ? 'border-amber-200 bg-amber-50 text-amber-900 focus:border-amber-400' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}`} />
                <button type="button" title="املأ المتبقي" onClick={() => { const ca = Number(multiCash||0); const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0); onMultiCreditChange?.(String(Math.max(0, totals.total - ca - c))); }}
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 active:scale-90">
                  <Wand2 className="h-2.5 w-2.5" />
                </button>
              </label>
            </div>
            {(() => {
              const c = customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').reduce((s, m) => s + Number(multiCustomAmounts[m.id]||0), 0);
              const entered = (Number(multiCash)||0) + c + (Number(multiCredit)||0);
              return (
                <span className={`text-2sm font-black ${Math.abs(entered - totals.total) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatMoney(entered)} / {formatMoney(totals.total)}
                </span>
              );
            })()}
          </div>
        )}

        {/* Row 4: Actions */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 bg-white">
          <PermissionGate page="quotations" action="print">
            <button onClick={onPrint}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-all active:scale-[0.95] shadow-sm">
              <Printer className="h-3 w-3" /> معاينة
            </button>
          </PermissionGate>
          <div className="mr-auto" />
          <PermissionGate page="quotations" action="add">
            <button onClick={onSave} disabled={isSaving}
              className="flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md bg-primary hover:bg-primary-600">
              {isSaving
                ? <><Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...</>
                : <><Save className="h-3 w-3" /> حفظ العرض</>
              }
              <ShortcutKbd id="quotation.save" className="rounded bg-white/20 px-1 text-[9px] font-mono" />
            </button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
