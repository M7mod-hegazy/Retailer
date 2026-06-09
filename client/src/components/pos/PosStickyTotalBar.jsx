import React from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { useIsNarrowViewport } from "../../hooks/useIsNarrowViewport";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

/**
 * Always-visible compact total bar for the POS page on small/square screens.
 *
 * Purely additive: it overlays the bottom of the work area only when the viewport
 * is narrow and there are cart lines, so the "إجمالي المستحق" total and the primary
 * action stay reachable even when the full summary card scrolls out of view.
 * On wide screens it renders nothing and the layout is unchanged.
 */
export default function PosStickyTotalBar({
  total,
  itemCount,
  quantityCount,
  hasErrors = false,
  errorCount = 0,
  disabled = false,
  onPrimary,
  primaryLabel = "طباعة ومراجعة",
  maxWidth = 1100,
}) {
  const narrow = useIsNarrowViewport(maxWidth);
  if (!narrow || !itemCount) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-2.5 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">الإجمالي المستحق</span>
          <span className="font-mono text-[22px] font-black tracking-tight text-white leading-none mt-1">
            {formatMoney(total)}
            <span className="text-[10px] font-bold text-white/40 mr-1">ج.م</span>
          </span>
        </div>

        <div className="flex flex-col items-center rounded-lg bg-white/5 px-2.5 py-1 leading-none">
          <span className="font-mono text-sm font-black text-white">{itemCount}</span>
          <span className="text-[9px] font-bold text-white/50">صنف</span>
        </div>
        {quantityCount != null && (
          <div className="flex flex-col items-center rounded-lg bg-white/5 px-2.5 py-1 leading-none">
            <span className="font-mono text-sm font-black text-white">{quantityCount}</span>
            <span className="text-[9px] font-bold text-white/50">كمية</span>
          </div>
        )}

        <button
          type="button"
          onClick={onPrimary}
          disabled={disabled}
          className={`mr-auto flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-black text-white transition-all disabled:opacity-50 active:scale-[0.98]
            ${hasErrors ? "bg-rose-600" : "bg-emerald-600 hover:bg-emerald-500"}`}
        >
          {hasErrors ? <AlertTriangle className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
          {primaryLabel}
          {hasErrors && errorCount > 0 && (
            <span className="rounded-full bg-rose-400/90 px-1.5 py-0.5 text-[9px] font-black">{errorCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}
