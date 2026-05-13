import React from "react";

export default function ReturnLinePicker({ lines = [], selected = {}, onToggle, onQuantityChange }) {
  return (
    <div className="space-y-2">
      {lines.map((line) => (
        <label
          key={line.id}
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/8"
        >
          <span className="text-sm text-slate-100">
            {line.item_name || `Item #${line.item_id}`} - المسموح: {line.returnable_quantity ?? line.quantity}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max={line.returnable_quantity ?? line.quantity}
              className="w-20 rounded-xl border border-white/10 bg-slate-950/40 px-2 py-1 text-sm text-white"
              value={selected[line.id]?.quantity || 1}
              disabled={!selected[line.id]}
              onChange={(event) => onQuantityChange?.(line, Number(event.target.value))}
            />
            <input
              type="checkbox"
              checked={Boolean(selected[line.id])}
              onChange={() => onToggle(line)}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
          </div>
        </label>
      ))}
    </div>
  );
}
