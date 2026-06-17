import React, { useRef, useEffect } from "react";
import {
  AlertTriangle, Printer, Save, PanelRightOpen, User, PauseCircle,
  FilePlus, Plus, X, Banknote, CreditCard, Wallet, Calendar, Layers,
  ChevronDown, Trash2, Loader2, ExternalLink, Search,
} from "lucide-react";
import HeldDropdown from "../../pages/pos/parts/HeldDropdown";
import SearchDropdown from "../ui/SearchDropdown";
import { useIsNarrowViewport } from "../../hooks/useIsNarrowViewport";
import { formatNumber } from "../../utils/currency";

function formatMoney(value, digits = 2) {
  return formatNumber(value, { decimals: digits });
}

function formatBalance(value) {
  return formatNumber(value, { decimals: 3 });
}

const COLOR_MAP = {
  cash:          { bg: "bg-emerald-50",    text: "text-emerald-600",    border: "border-emerald-200",    activeBg: "bg-emerald-600" },
  bank_transfer: { bg: "bg-blue-50",       text: "text-blue-600",       border: "border-blue-200",       activeBg: "bg-blue-600" },
  credit:        { bg: "bg-amber-50",      text: "text-amber-600",      border: "border-amber-200",      activeBg: "bg-amber-600" },
  installments:  { bg: "bg-violet-50",     text: "text-violet-600",     border: "border-violet-200",     activeBg: "bg-violet-600" },
  multi:         { bg: "bg-slate-50",      text: "text-slate-600",      border: "border-slate-200",      activeBg: "bg-slate-700" },
};

export default function PosStickyTotalBar({
  total, subtotal, discount = 0, increase = 0,
  itemCount, quantityCount,
  onDiscountChange, discountMode, onDiscountModeChange,
  onIncreaseChange, increaseMode, onIncreaseModeChange,
  paymentType, paymentTypes = [],
  onPaymentChange,
  amountReceived, onAmountReceivedChange,
  banks = [], selectedBankId, onBankChange,
  amountPaid, onAmountPaidChange,
  multiCash, onMultiCashChange, multiCredit, onMultiCreditChange,
  customPayMethods = [], multiCustomAmounts = {}, onMultiCustomAmountChange,
  customerName, customerId, customerBalance = 0,
  onCustomerLookup, onCustomerCreate, onCustomerClear, onCustomerInfo,
  quickCustomers = [], onCustomerQuickSelect,
  displayBalance,
  customerQuery, onCustomerQueryChange,
  customerLookupOpen, onCustomerLookupOpenChange,
  activeCustomerIndex, customerResults = [],
  onCustomerPick, onCustomerKeyDown,
  hasErrors = false, errorCount = 0,
  disabled = false, isSaving = false, canHold = false,
  onHold, onPrint, onSave, onSaveOnly, onCancel,
  onExpand, onNewInvoice,
  heldInvoices = [], heldDropdownOpen, onHeldToggle,
  onResumeHeld, onDiscardHeld, onCloseHeld,
  primaryLabel = "طباعة ومراجعة",
  maxWidth = 1100,
  forceShow = false,
  activeTaxRate = 0,
  hasNotes = false,
}) {
  const narrow = useIsNarrowViewport(maxWidth);
  const searchRef = useRef(null);
  const rootRef = useRef(null);

  // Publish the bar's live height as a CSS var so the product/cart scroll areas
  // can reserve matching bottom padding and never sit underneath the fixed bar.
  useEffect(() => {
    const el = rootRef.current;
    const setVar = (v) => document.documentElement.style.setProperty("--pos-bottom-bar-h", v);
    if (!forceShow || !el) { setVar("0px"); return () => setVar("0px"); }
    const update = () => setVar(`${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); setVar("0px"); };
  }, [forceShow, itemCount]);

  useEffect(() => {
    if (customerLookupOpen && searchRef.current) {
      const handleClickOutside = (e) => {
        if (searchRef.current && !searchRef.current.contains(e.target)) {
          onCustomerLookupOpenChange?.(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [customerLookupOpen, onCustomerLookupOpenChange]);

  const hasCustomer = !!customerId;

  // Only show the bottom bar when the invoice panel is collapsed (forceShow is
  // driven by the panel's effective-collapsed state). When the panel is open,
  // the bar must never appear — even on narrow screens (where the user manually
  // re-opened the panel) — so visibility keys off forceShow alone, not `narrow`.
  if (!forceShow) return null;

  const heldColor = (() => {
    if (!heldInvoices.length) return "";
    const yellowHours = 2, redHours = 8;
    const now = Date.now();
    const maxAge = Math.max(...heldInvoices.map((h) => (now - new Date(h.heldAt).getTime()) / 3_600_000));
    if (maxAge >= redHours) return "bg-red-50 text-red-700 border-red-200";
    if (maxAge >= yellowHours) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  })();

  // ─── Empty state: no products yet ───
  if (!itemCount) {
    return (
      <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-2 px-3 py-1.5">
          {/* Customer search */}
          <div ref={searchRef} className="relative shrink-0">
            <div className="flex items-center gap-0.5 rounded-lg bg-white border border-zinc-200 px-1.5 py-0.5 shadow-sm">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={customerQuery ?? (hasCustomer ? customerName : "")}
                onChange={(e) => { onCustomerQueryChange?.(e.target.value); onCustomerLookupOpenChange?.(true); }}
                onFocus={() => { if (!hasCustomer) { onCustomerQueryChange?.(""); } onCustomerLookupOpenChange?.(true); }}
                onBlur={() => { setTimeout(() => onCustomerLookupOpenChange?.(false), 200); }}
                onKeyDown={onCustomerKeyDown}
                placeholder={hasCustomer ? customerName : "ابحث عن عميل..."}
                className="w-[85px] bg-transparent text-2sm font-bold text-zinc-700 outline-none placeholder:text-zinc-400"
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
              {hasCustomer && onCustomerInfo && (
                <button type="button" onClick={onCustomerInfo} title="بيانات العميل"
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
            {customerLookupOpen && customerResults.length > 0 && (
              <div className="absolute right-0 bottom-full mb-1 z-[70] min-w-[220px]">
                <SearchDropdown
                  items={customerResults}
                  onPick={(c) => { onCustomerPick?.(c); onCustomerLookupOpenChange?.(false); }}
                  activeIndex={activeCustomerIndex}
                  query={customerQuery || ""}
                  emptyLabel="لم يتم العثور على عميل"
                />
              </div>
            )}
          </div>

          {/* Quick customer buttons */}
          {!hasCustomer && quickCustomers.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {quickCustomers.map((c) => (
                <button key={c.id} type="button" onClick={() => onCustomerQuickSelect?.(c)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 text-2sm font-bold text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors whitespace-nowrap">
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Held invoices */}
          {heldInvoices.length > 0 && onHeldToggle && (
            <div className="relative shrink-0">
              <button type="button" onClick={onHeldToggle}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-2sm font-black transition-all shadow-sm ${heldColor}`}>
                <PauseCircle className="h-3 w-3" />
                <span>{heldInvoices.length}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${heldDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {heldDropdownOpen && onResumeHeld && onDiscardHeld && onCloseHeld && (
                <HeldDropdown heldInvoices={heldInvoices} onResume={onResumeHeld} onDiscard={onDiscardHeld} onClose={onCloseHeld} />
              )}
            </div>
          )}

          {/* New invoice */}
          {onNewInvoice && (
            <button type="button" onClick={onNewInvoice} title="فاتورة جديدة"
              className="flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-2sm font-black text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-[0.95] shadow-sm">
              <FilePlus className="h-3 w-3" /> جديدة
            </button>
          )}

          <span className="mr-auto text-2sm text-zinc-400">أضف منتجات لبدء الفاتورة</span>
        </div>
      </div>
    );
  }

  if (!narrow && !forceShow) return null;

  const isPaymentDisabled = (type) =>
    ["credit", "installments", "bank_transfer"].includes(type) && !hasCustomer;

  const creditEffect =
    paymentType === "credit" ? total
      : paymentType === "installments" ? Math.max(0, total - Number(amountPaid || 0))
        : paymentType === "multi" ? Number(multiCredit || 0)
          : 0;

  const bal = displayBalance ?? customerBalance;
  const projected = bal + creditEffect;

  const multiEntered =
    paymentType === "multi"
      ? (Number(multiCash || 0) + Number(multiCredit || 0) + customPayMethods.reduce((s, m) => s + Number(multiCustomAmounts[m.id] || 0), 0))
      : 0;
  const multiBalanced = paymentType === "multi" && Math.abs(multiEntered - total) < 0.01;

  const canDoPayment = !isSaving && !disabled;

  const balanceLabel = paymentType === "installments" ? "الإضافة للأقساط"
    : paymentType === "multi" ? "الإضافة للآجل"
      : "الإضافة للرصيد";

  const afterLabel = paymentType === "installments" ? "الرصيد بعد الأقساط"
    : paymentType === "multi" ? "الرصيد بعد الآجل"
      : "الرصيد بعد الفاتورة";

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-x-0 bottom-0 z-[60] bg-white border-t border-zinc-200/70 shadow-[0_-6px_30px_-10px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col">

        {/* ═══════════════ Row 1: Customer + Summary + Discount/Increase ═══════════════ */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-1 border-b border-zinc-100 bg-white">

          {/* ─── Customer search (moved up) ─── */}
          <div ref={searchRef} className="relative shrink-0">
            <div className="flex items-center gap-0.5 rounded-lg bg-white border border-zinc-200 px-1.5 py-0.5 shadow-sm">
              <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={customerQuery ?? (hasCustomer ? customerName : "")}
                onChange={(e) => { onCustomerQueryChange?.(e.target.value); onCustomerLookupOpenChange?.(true); }}
                onFocus={() => { if (!hasCustomer) { onCustomerQueryChange?.(""); } onCustomerLookupOpenChange?.(true); }}
                onBlur={() => { setTimeout(() => onCustomerLookupOpenChange?.(false), 200); }}
                onKeyDown={onCustomerKeyDown}
                placeholder={hasCustomer ? customerName : "ابحث عن عميل..."}
                className="w-[85px] bg-transparent text-2sm font-bold text-zinc-700 outline-none placeholder:text-zinc-400"
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
              {hasCustomer && onCustomerInfo && (
                <button type="button" onClick={onCustomerInfo} title="بيانات العميل"
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
            {customerLookupOpen && customerResults.length > 0 && (
              <div className="absolute right-0 bottom-full mb-1 z-[70] min-w-[220px]">
                <SearchDropdown
                  items={customerResults}
                  onPick={(c) => { onCustomerPick?.(c); onCustomerLookupOpenChange?.(false); }}
                  activeIndex={activeCustomerIndex}
                  query={customerQuery || ""}
                  emptyLabel="لم يتم العثور على عميل"
                />
              </div>
            )}
          </div>

          {/* ─── Quick customer buttons ─── */}
          {!hasCustomer && quickCustomers.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {quickCustomers.map((c) => (
                <button key={c.id} type="button" onClick={() => onCustomerQuickSelect?.(c)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 text-2sm font-bold text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors whitespace-nowrap">
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          {/* ─── Total ─── */}
          {onExpand && (
            <button type="button" onClick={onExpand}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-mono text-lg font-black tracking-tight text-zinc-900">
              {formatMoney(total)}
            </span>
            <span className="text-[9px] font-bold text-zinc-400">ج.م</span>
            {activeTaxRate > 0 && (
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[8px] font-black text-blue-700">
                +{activeTaxRate}%
              </span>
            )}
            {hasNotes && (
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" title="توجد ملاحظة" />
            )}
          </div>

          <div className="flex items-center gap-1 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100 shrink-0">
            <span className="text-2sm font-black text-zinc-800">{itemCount}</span>
            <span className="text-[10px] font-bold text-zinc-700 whitespace-nowrap">
              {quantityCount > 0 ? "أصناف" : "صنف"}
            </span>
          </div>

          {quantityCount > 0 && (
            <div className="flex items-center gap-1 bg-zinc-50 rounded-lg px-1.5 py-0.5 border border-zinc-100 shrink-0">
              <span className="text-2sm font-black text-zinc-800">{quantityCount}</span>
              <span className="text-[10px] font-bold text-zinc-700 whitespace-nowrap">كمية</span>
            </div>
          )}

          <span className="h-5 w-px bg-zinc-200 shrink-0" />

          {/* ─── Discount input ─── */}
          {onDiscountChange && (
            <label className="flex items-center gap-1 shrink-0 bg-amber-50/50 rounded-lg px-1.5 py-0.5 border border-amber-100/50">
              <input type="number" min="0"
                value={discountMode === "pct" && subtotal > 0
                  ? parseFloat(((discount / subtotal) * 100).toFixed(2))
                  : discount || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value || 0));
                  if (discountMode === "pct" && subtotal > 0) {
                    onDiscountChange(parseFloat(((val / 100) * subtotal).toFixed(4)));
                  } else {
                    onDiscountChange(val);
                  }
                }}
                placeholder="0"
                className="w-10 rounded border border-amber-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-amber-400 transition-colors" />
              <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">خصم</span>
              {onDiscountModeChange && (
                <button type="button" onClick={() => onDiscountModeChange(discountMode === "pct" ? "flat" : "pct")}
                  className={`px-1 py-0.5 rounded text-[9px] font-black border transition-colors shrink-0 ${
                    discountMode === "pct"
                      ? "bg-amber-200 border-amber-300 text-amber-800"
                      : "border-amber-200 text-amber-500 hover:bg-amber-100"
                  }`}>
                  {discountMode === "pct" ? "%" : "ج"}
                </button>
              )}
            </label>
          )}

          {/* ─── Increase input ─── */}
          {onIncreaseChange && (
            <label className="flex items-center gap-1 shrink-0 bg-blue-50/50 rounded-lg px-1.5 py-0.5 border border-blue-100/50">
              <input type="number" min="0"
                value={increaseMode === "pct" && subtotal > 0
                  ? parseFloat(((increase / subtotal) * 100).toFixed(2))
                  : increase || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value || 0));
                  if (increaseMode === "pct" && subtotal > 0) {
                    onIncreaseChange(parseFloat(((val / 100) * subtotal).toFixed(4)));
                  } else {
                    onIncreaseChange(val);
                  }
                }}
                placeholder="0"
                className="w-10 rounded border border-blue-200 bg-white px-1 py-0.5 text-center text-2sm font-black text-zinc-700 outline-none focus:border-blue-400 transition-colors" />
              <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap">إضافة</span>
              {onIncreaseModeChange && (
                <button type="button" onClick={() => onIncreaseModeChange(increaseMode === "pct" ? "flat" : "pct")}
                  className={`px-1 py-0.5 rounded text-[9px] font-black border transition-colors shrink-0 ${
                    increaseMode === "pct"
                      ? "bg-blue-200 border-blue-300 text-blue-800"
                      : "border-blue-200 text-blue-500 hover:bg-blue-100"
                  }`}>
                  {increaseMode === "pct" ? "%" : "ج"}
                </button>
              )}
            </label>
          )}

          {/* ─── Subtotal (pushed right) ─── */}
          {subtotal != null && (
            <div className="mr-auto flex items-center gap-1 text-2sm text-zinc-400 shrink-0">
              <span className="font-bold">فرعي</span>
              <span className="font-mono font-black text-zinc-600">{formatMoney(subtotal, 0)}</span>
            </div>
          )}
        </div>

        {/* ═══════════════ Row 2: Payment method buttons + balance ═══════════════ */}
        <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 px-3 py-1 bg-zinc-50/60 border-b border-zinc-100">
          <div className="flex items-center gap-0.5">
            {paymentTypes.filter(({ type }) => !(type === "bank_transfer" && banks.length === 0)).map(({ type, label, Icon: _Icon }) => {
              const isDisabled = isPaymentDisabled(type);
              const isActive = paymentType === type;
              const c = COLOR_MAP[type] || COLOR_MAP.cash;
              return (
                <button key={type} type="button"
                  onClick={() => !isDisabled && onPaymentChange?.(type)}
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

          {hasCustomer && (
            <div className="mr-auto flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  الرصيد الحالي
                </span>
                <span className={`text-sm font-black font-mono ${bal > 0 ? "text-rose-600" : "text-slate-800"}`}>
                  {formatBalance(bal)}
                </span>
              </div>
              {creditEffect > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1">
                  <span className="text-[10px] font-bold text-amber-600">
                    {paymentType === "installments" ? "الإضافة للأقساط" : paymentType === "multi" ? "الإضافة للآجل" : "الإضافة للرصيد"}
                  </span>
                  <span className="text-sm font-black font-mono text-amber-700">+{formatBalance(creditEffect)}</span>
                  <span className="h-4 w-px bg-amber-300/60" />
                  <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">
                    {paymentType === "installments" ? "الرصيد بعد الأقساط" : paymentType === "multi" ? "الرصيد بعد الآجل" : "الرصيد بعد الفاتورة"}
                  </span>
                  <span className={`text-sm font-black font-mono ${projected > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatBalance(projected)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════ Row 3: Payment inputs ═══════════════ */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-1 bg-zinc-50/60 border-b border-zinc-100">

          {paymentType === "cash" && onAmountReceivedChange && (
            <div className="flex items-center gap-1 bg-white rounded-lg border border-zinc-200 px-1.5 py-0.5 shadow-sm shrink-0">
              <span className="text-[11px] font-bold text-zinc-700">المبلغ:</span>
              <input type="number" min="0" value={amountReceived || ""}
                onChange={(e) => onAmountReceivedChange(e.target.value)} placeholder="0"
                className="w-12 rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-center text-[11px] font-bold text-zinc-700 outline-none focus:border-emerald-400 transition-colors" />
              {Number(amountReceived) > 0 && (
                <span className={`text-[11px] font-bold ${Number(amountReceived) >= total ? "text-emerald-700" : "text-rose-600"}`}>
                  {Number(amountReceived) >= total ? "تمام" : `باقي ${formatMoney(Math.abs(Number(amountReceived) - total), 0)}`}
                </span>
              )}
            </div>
          )}

          {paymentType === "bank_transfer" && onBankChange && (
            <div className="flex items-center gap-1 bg-white rounded-lg border border-zinc-200 px-1.5 py-0.5 shadow-sm shrink-0">
              <span className="text-[11px] font-bold text-zinc-700">بنك:</span>
              <select value={selectedBankId || ""} onChange={(e) => onBankChange(e.target.value)}
                className="max-w-[100px] rounded border border-zinc-200 bg-white px-1 py-0.5 text-[11px] font-bold text-zinc-700 outline-none focus:border-blue-400 transition-colors">
                <option value="">اختر</option>
                {banks.filter(Boolean).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {paymentType === "installments" && (
            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-zinc-200 px-1.5 py-0.5 shadow-sm shrink-0">
              <span className="text-[11px] font-bold text-zinc-700">الدفعة:</span>
              <input type="number" min="0" value={amountPaid || ""}
                onChange={(e) => onAmountPaidChange?.(e.target.value)} placeholder="0"
                className="w-10 rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-center text-[11px] font-bold text-zinc-700 outline-none focus:border-violet-400 transition-colors" />
              <span className="text-[11px] font-bold text-violet-800">
                قسط {formatMoney(Math.max(0, total - Number(amountPaid || 0)))}
              </span>
              <span className="text-[10px] font-bold text-zinc-400">وسّع اللوحة لجدولة الأقساط</span>
            </div>
          )}

          {paymentType === "credit" && (
            <div className="flex items-center gap-1 bg-amber-50 rounded-lg px-1.5 py-0.5 border border-amber-100 shrink-0">
              <Wallet className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-800 whitespace-nowrap">
                {hasCustomer
                  ? `إضافة ${formatMoney(total)} لرصيد ${customerName}`
                  : "اختر عميل للبيع الآجل"}
              </span>
            </div>
          )}

          {paymentType === "multi" && (
            <div className="flex items-center gap-1 bg-white rounded-lg border border-zinc-200 px-2 py-1 shadow-sm shrink-0">
              <span className="text-2sm font-bold text-emerald-800">نقدي:</span>
              <input type="number" min="0" value={multiCash || ""}
                onChange={(e) => onMultiCashChange?.(e.target.value)} placeholder="0"
                className="w-14 rounded border border-emerald-200 bg-emerald-50/30 px-1 py-1 text-center text-2sm font-bold text-zinc-700 outline-none focus:border-emerald-400 transition-colors" />
              {customPayMethods.filter(m => !m.name?.includes('بنك') && !m.name?.includes('تحويل') && m.icon !== '🏦').map(m => (
                <div key={m.id} className="flex items-center gap-0.5">
                  <span className="text-2sm font-bold text-violet-800 whitespace-nowrap">{m.icon} {m.name}:</span>
                  <input type="number" min="0" value={multiCustomAmounts[m.id] || ""}
                    onChange={(e) => onMultiCustomAmountChange?.(m.id, e.target.value)} placeholder="0"
                    className="w-14 rounded border border-violet-200 bg-violet-50/30 px-1 py-1 text-center text-2sm font-bold text-zinc-700 outline-none focus:border-violet-400 transition-colors" />
                </div>
              ))}
              <span className="text-2sm font-bold text-amber-800">آجل:</span>
              <input type="number" min="0" value={multiCredit || ""}
                onChange={(e) => onMultiCreditChange?.(e.target.value)}
                disabled={!hasCustomer} placeholder={hasCustomer ? "0" : "—"}
                className="w-14 rounded border border-amber-200 bg-amber-50/30 px-1 py-1 text-center text-2sm font-bold text-zinc-700 outline-none focus:border-amber-400 transition-colors disabled:opacity-40" />
              <span className={`px-2 py-1 rounded text-2sm font-bold ${multiBalanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {formatMoney(multiEntered)}/{formatMoney(total)}
              </span>
            </div>
          )}

          {!["cash","bank_transfer","installments","credit","multi"].includes(paymentType) && (
            <div className="flex items-center gap-1 bg-white rounded-lg border border-zinc-200 px-1.5 py-0.5 shadow-sm shrink-0">
              <span className="text-[11px] font-bold text-zinc-700">المبلغ:</span>
              <input type="number" min="0" value={amountReceived || ""}
                onChange={(e) => onAmountReceivedChange?.(e.target.value)} placeholder="0"
                className="w-12 rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-center text-[11px] font-bold text-zinc-700 outline-none focus:border-emerald-400 transition-colors" />
            </div>
          )}
        </div>

        {/* ═══════════════ Row 4: Actions ═══════════════ */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white">
          {heldInvoices.length > 0 && onHeldToggle && (
            <div className="relative shrink-0">
              <button type="button" onClick={onHeldToggle}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-2sm font-black transition-all shadow-sm ${heldColor}`}>
                <PauseCircle className="h-3 w-3" />
                <span>{heldInvoices.length}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${heldDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {heldDropdownOpen && onResumeHeld && onDiscardHeld && onCloseHeld && (
                <HeldDropdown heldInvoices={heldInvoices} onResume={onResumeHeld} onDiscard={onDiscardHeld} onClose={onCloseHeld} />
              )}
            </div>
          )}

          {onNewInvoice && (
            <button type="button" onClick={onNewInvoice} title="فاتورة جديدة"
              className="flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-2sm font-black text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-[0.95] shadow-sm">
              <FilePlus className="h-3 w-3" /> جديدة
            </button>
          )}

          {onCancel && (
            <button type="button" onClick={onCancel} disabled={!itemCount}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 text-2sm font-black text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all disabled:opacity-40 active:scale-[0.95] shadow-sm">
              <Trash2 className="h-3 w-3" /> إلغاء
            </button>
          )}

          {onHold && (
            <button type="button" onClick={onHold} disabled={!canHold} title="تعليق"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all disabled:opacity-30 active:scale-[0.95] shadow-sm">
              <PauseCircle className="h-3 w-3" />
            </button>
          )}

          <div className="mr-auto" />

          {onSaveOnly && (
            <button type="button" onClick={onSaveOnly} disabled={!canDoPayment}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-all disabled:opacity-40 active:scale-[0.95] shadow-sm">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              حفظ فقط
            </button>
          )}

          {onSave && (
            <button type="button" onClick={onSave} disabled={!canDoPayment}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-2sm font-black text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-all disabled:opacity-40 active:scale-[0.95] shadow-sm">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              حفظ <kbd className="rounded bg-zinc-100 px-1 text-[9px] text-zinc-400 font-mono">F9</kbd>
            </button>
          )}

          <button type="button" onClick={onPrint} disabled={!canDoPayment}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-2sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.95] shadow-md ${
              hasErrors ? "bg-rose-600 hover:bg-rose-500" : "bg-primary hover:bg-primary-600"
            }`}>
            {isSaving
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : hasErrors
                ? <AlertTriangle className="h-3 w-3" />
                : <Printer className="h-3 w-3" />
            }
            {primaryLabel}
            <kbd className="rounded bg-white/20 px-1 text-[9px] font-mono">F12</kbd>
            {hasErrors && errorCount > 0 && (
              <span className="rounded-full bg-rose-400/90 px-1.5 py-[2px] text-[8px] font-black">{errorCount}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
