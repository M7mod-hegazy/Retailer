import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function SortTh({
  label,
  className = "",
  sortKey,
  width,
  onResizeStart,
  resizableKey,
  sortConfig,
  onSort,
}) {
  return (
    <th
      className={`relative select-none border-l border-slate-200/80 px-2 py-3 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap transition-colors ${className} ${sortKey && onSort ? "cursor-pointer hover:bg-slate-100" : ""}`}
      style={{ width, minWidth: width, maxWidth: width }}
      onClick={() => onSort && sortKey && onSort(sortKey)}
    >
      <div className="flex items-center justify-between overflow-hidden">
        <span className="truncate">{label}</span>
        {sortKey && sortConfig?.key === sortKey && (
          <span className="shrink-0 mr-1 text-slate-800">
            {sortConfig.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      {onResizeStart && resizableKey && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-indigo-300 z-10 touch-none"
          onMouseDown={(e) => onResizeStart(e, resizableKey)}
        />
      )}
    </th>
  );
}
