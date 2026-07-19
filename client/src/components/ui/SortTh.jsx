import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function SortTh({
  label,
  className = "",
  sortKey,
  width,
  minWidth,
  onResizeStart,
  resizableKey,
  sortConfig,
  onSort,
  helpText,
}) {
  const mw = minWidth || 40;
  const justify = (className.includes("hdr-center") || className.includes("text-center")) ? "justify-center" : "justify-between";
  return (
    <th
      className={`relative select-none border-l border-border-normal/80 px-2 py-2 bg-bg-overlay text-[10px] font-black uppercase tracking-widest text-text-secondary whitespace-nowrap transition-colors ${className} ${sortKey && onSort ? "cursor-pointer hover:bg-bg-overlay" : ""}`}
      style={{ width, minWidth: mw, maxWidth: width }}
      onClick={() => onSort && sortKey && onSort(sortKey)}
      title={helpText || undefined}
    >
      <div className={`flex items-center ${justify} overflow-hidden`}>
        <span className="truncate">{label}</span>
        {sortKey && sortConfig?.key === sortKey && (
          <span className="shrink-0 mr-1 text-text-primary">
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
