import { forwardRef } from "react";

/**
 * Always-visible warehouse / stock table for the item-entry row.
 *
 * Shows every store's count at once (no hidden popover) so the user can always
 * see all balances and click any row to switch. At least 3 rows tall; scrolls
 * when there are more. Fully theme-driven (no hard-coded colors).
 *
 * Keyboard: ↑/↓ move the selection between rows; any other key (Enter/Tab) is
 * delegated to `onKeyDown` so the host page's field navigation still advances —
 * the field is never "skipped" because the table stays visible and clickable.
 *
 * @param {string|number|null} value selected warehouse id
 * @param {Array<{id:any,name:string,qty:number,tone?:'low'|'out'|'insufficient'}>} options
 * @param {(id:string)=>void} onChange
 * @param {string} [emptyLabel] message shown when options is empty
 * @param {(e:KeyboardEvent)=>void} [onKeyDown] host field-navigation delegate
 * @param {number} [rows] minimum visible rows (default 3)
 */
const ROW_H = 30;

const WarehouseSelect = forwardRef(function WarehouseSelect(
  { value, options = [], onChange, emptyLabel = "اختر صنفاً أولاً", onKeyDown, rows = 3, className = "" },
  ref
) {
  const hasOptions = options.length > 0;

  const toneChip = (o) => {
    const isSel = String(o.id) === String(value);
    if (o.tone === "insufficient" || o.tone === "out") return "text-rose-700 bg-rose-100";
    if (o.tone === "low") return "text-amber-700 bg-amber-100";
    return isSel ? "text-emerald-700 bg-emerald-100" : "";
  };

  const move = (dir) => {
    if (!hasOptions) return;
    const idx = options.findIndex((o) => String(o.id) === String(value));
    const next = options[Math.min(options.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + dir))];
    if (next) onChange?.(String(next.id));
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); return; }
    onKeyDown?.(e);
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ minHeight: ROW_H * rows, maxHeight: ROW_H * 5 }}
      className={`wh-table custom-scrollbar flex flex-col ${className}`}
    >
      {!hasOptions ? (
        <div className="wh-empty flex flex-1 items-center justify-center px-2 py-3 text-[11px] font-bold text-center">
          {emptyLabel}
        </div>
      ) : (
        options.map((o) => {
          const isSel = String(o.id) === String(value);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange?.(String(o.id))}
              style={{ minHeight: ROW_H }}
              className={`wh-row flex items-center gap-2 px-2 py-1.5 text-right transition-colors ${isSel ? "is-selected" : ""}`}
            >
              <span className={`wh-dot h-2.5 w-2.5 rounded-full shrink-0`} />
              <span className="flex-1 truncate text-[11px] font-bold">{o.name}</span>
              <span className={`number-fmt text-[11px] rounded px-1 shrink-0 ${toneChip(o)}`}>{o.qty}</span>
            </button>
          );
        })
      )}
    </div>
  );
});

export default WarehouseSelect;
