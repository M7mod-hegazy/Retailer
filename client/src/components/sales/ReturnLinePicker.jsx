import React, { useRef } from "react";
import { useFieldNavigation } from "../../hooks/useFieldNavigation";

export default function ReturnLinePicker({ lines = [], selected = {}, onToggle, onQuantityChange }) {
  const handleKeyDown = useFieldNavigation();
  const qtyRef = useRef(null);
  const checkboxRef = useRef(null);
  const submitBtnRef = useRef(null);
  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <label
          key={line.id}
          className="flex items-center justify-between rounded-2xl border border-border-normal/10 bg-bg-surface/5 p-3 transition hover:bg-bg-surface/8"
        >
          <span className="text-sm text-slate-100 flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              {(line.item_code || line.code) && <span className="font-mono text-[11px] text-text-muted bg-bg-surface/10 px-1.5 py-0.5 rounded">{line.item_code || line.code}</span>}
              {line.item_name || `Item #${line.item_id}`}
            </span>
            <span className="text-[11px] text-text-muted">المسموح: {line.returnable_quantity ?? line.quantity}</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={i === 0 ? qtyRef : undefined}
              type="number"
              min="1"
              max={line.returnable_quantity ?? line.quantity}
              className="w-20 rounded-xl border border-border-normal/10 bg-slate-950/40 px-2 py-1 text-sm text-white"
              value={selected[line.id]?.quantity || 1}
              disabled={!selected[line.id]}
              onChange={(event) => onQuantityChange?.(line, Number(event.target.value))}
              onKeyDown={i === 0 ? e => handleKeyDown(e, { nextRef: checkboxRef, onEnter: () => onToggle(line) }) : undefined}
            />
            <input
              ref={i === 0 ? checkboxRef : undefined}
              type="checkbox"
              checked={Boolean(selected[line.id])}
              onChange={() => onToggle(line)}
              className="h-4 w-4 rounded border-border-normal/20 bg-transparent"
              onKeyDown={i === 0 ? e => handleKeyDown(e, { nextRef: qtyRef, prevRef: qtyRef }) : undefined}
            />
          </div>
        </label>
      ))}
    </div>
  );
}
