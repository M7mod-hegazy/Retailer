import React from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";

// Sortable, optionally resizable table header cell used by the POS cart and the
// detailed-search grid.
export default function SortTh({ label, sortKey, sortConfig, onSort, width, onResizeStart, resizableKey, className = "" }) {
  const active = sortConfig.key === sortKey;
  return (
    <th
      className={`relative select-none px-2 py-2 text-right text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors ${className}`}
      style={{ width: width ? `${width}px` : undefined, minWidth: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
    >
      <div className="inline-flex items-center gap-1 cursor-pointer" onClick={() => onSort && onSort(sortKey)}>
        {label}
        {onSort && (active
          ? sortConfig.dir === "asc" ? <ChevronUp className="h-3 w-3 text-slate-900" /> : <ChevronDown className="h-3 w-3 text-slate-900" />
          : <ArrowUpDown className="h-3 w-3 opacity-20" />)}
      </div>
      {resizableKey && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(e, resizableKey)}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-400 z-10 transition-colors"
        />
      )}
    </th>
  );
}
