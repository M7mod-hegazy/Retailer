import React from "react";
import { AlertTriangle, Printer, Save, PanelRightOpen, User, CircleDollarSign } from "lucide-react";
import { useIsNarrowViewport } from "../../hooks/useIsNarrowViewport";

function formatMoney(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function Stat({ label, value, tone = "default" }) {
  const toneCls = tone === "discount" ? "text-rose-600" : tone === "add" ? "text-blue-600" : "text-slate-800";
  return (
    <div className="flex flex-col items-center leading-none shrink-0">
      <span className={`font-mono text-sm font-black ${toneCls}`}>{value}</span>
      <span className="text-[9px] font-bold text-slate-400 mt-1 whitespace-nowrap">{label}</span>
    </div>
  );
}

/**
 * Compact, info-rich action bar shown at the bottom of the POS work area when the
 * invoice panel is collapsed (or the viewport is narrow). It mirrors the panel's
 * essentials — customer, counts, subtotal/discount, due total — and exposes the
 * primary controls (expand panel, save, print/review) in a single low-profile row.
 *
 * Styled as a light glass bar to match the app's Topbar / overall light theme.
 * Renders nothing on wide screens when the panel is open.
 */
export default function PosStickyTotalBar({
  total,
  subtotal,
  discount = 0,
  increase = 0,
  itemCount,
  quantityCount,
  customerName,
  paymentLabel,
  hasErrors = false,
  errorCount = 0,
  disabled = false,
  saving = false,
  onPrint,
  onSave,
  onExpand,
  primaryLabel = "طباعة ومراجعة",
  maxWidth = 1100,
  forceShow = false,
}) {
  const narrow = useIsNarrowViewport(maxWidth);
  if ((!narrow && !forceShow) || !itemCount) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/90 backdrop-blur-xl shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.15)]"
    >
      <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto scrollbar-none">
        {/* Expand panel */}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="إظهار لوحة الفاتورة"
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
          >
            <PanelRightOpen className="h-5 w-5" />
          </button>
        )}

        {/* Due total */}
        <div className="flex flex-col leading-none shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">الإجمالي المستحق</span>
          <span className="font-mono text-[22px] font-black tracking-tight text-slate-900 leading-none mt-1">
            {formatMoney(total)}
            <span className="text-[10px] font-bold text-slate-400 mr-1">ج.م</span>
          </span>
        </div>

        <div className="h-9 w-px bg-slate-200 shrink-0" />

        {/* Stats */}
        <Stat label="صنف" value={itemCount} />
        {quantityCount != null && <Stat label="كمية" value={quantityCount} />}
        {subtotal != null && <Stat label="فرعي" value={formatMoney(subtotal, 0)} />}
        {discount > 0 && <Stat label="خصم" value={`-${formatMoney(discount, 0)}`} tone="discount" />}
        {increase > 0 && <Stat label="رسوم" value={`+${formatMoney(increase, 0)}`} tone="add" />}

        {/* Customer + payment chips */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600 max-w-[140px]">
            <User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">{customerName || "زبون نقدي"}</span>
          </span>
          {paymentLabel && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-black text-slate-600">
              <CircleDollarSign className="h-3 w-3 text-slate-400 shrink-0" />
              {paymentLabel}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mr-auto flex items-center gap-2 shrink-0">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={disabled}
              title="حفظ الفاتورة (F9)"
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-40 active:scale-[0.98]"
            >
              <Save className="h-4 w-4" /> حفظ
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            disabled={disabled}
            title="طباعة ومراجعة المستند (F12)"
            className={`flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.98] shadow-sm
              ${hasErrors ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {hasErrors ? <AlertTriangle className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
            {primaryLabel}
            {hasErrors && errorCount > 0 && (
              <span className="rounded-full bg-rose-400/90 px-1.5 py-0.5 text-[9px] font-black">{errorCount}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
