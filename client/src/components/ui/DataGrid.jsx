import React, { useState, useRef, useMemo, useCallback } from "react";
import { List } from "react-window";
import { usePerformanceStore } from "../../stores/performanceStore";
import SortTh from "./SortTh";
import { addBodyResizeFlags, removeBodyResizeFlags } from "../../utils/bodyFlags";
import { formatNumber } from "../../utils/currency";

const ROW_HEIGHT = 45;
const VIRTUALIZE_THRESHOLD = 100;

function VirtualRow({ data: { columns, colWidths, colMinWidths, rows, rowKey, onRowClick, rowClass }, index, style }) {
  const row = rows[index];
  return (
    <div
      style={style}
      onClick={() => onRowClick?.(row)}
      className={`flex border-b border-border-subtle hover:bg-bg-overlay transition-colors bg-bg-surface ${rowClass(row)} ${onRowClick ? "cursor-pointer" : ""}`}
    >
      {columns.map((c) => (
        <div
          key={c.id}
          className={`px-1.5 py-1 text-xs text-text-primary border-l border-border-subtle/50 flex items-center overflow-hidden ${(c.cellClass || "text-center").includes("text-center") || (c.cellClass || "").includes("justify-center") ? "justify-center" : ""} ${c.cellClass || "text-center"}`}
          style={{ width: colWidths[c.id], minWidth: Math.min(colWidths[c.id], colMinWidths[c.id] || 40), maxWidth: colWidths[c.id] }}
          title={(row[c.id] || "-")?.toString()}
        >
          {c.render ? c.render(row, index) : (row[c.id] || "-")}
        </div>
      ))}
    </div>
  );
}

export default function DataGrid({
  columns = [],
  data = [],
  emptyMessage = "لا توجد بيانات",
  emptyIcon = null,
  rowKey = "id",
  rowClass = () => "",
  onRowClick = null,
  renderExpandedRow = null,
  sortConfig: externalSortConfig,
  onSort: externalOnSort,
  className = "",
  containerClass = "flex-1 overflow-x-auto overflow-y-auto bg-bg-surface scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-border-normal",
  virtualized = false,
  height = 500,
  totals = null,
}) {
  const getRowKey = useCallback((row, idx) => {
    if (typeof rowKey === "function") return rowKey(row, idx);
    return row[rowKey] ?? idx;
  }, [rowKey]);

  const defaultWidths = {};
  const colMinWidths = {};
  columns.forEach((c) => {
    defaultWidths[c.id] = c.width || 120;
    colMinWidths[c.id] = c.minWidth || 40;
  });

  const [colWidths, setColWidths] = useState(defaultWidths);
  const [internalSortConfig, setInternalSortConfig] = useState({ key: null, dir: "asc" });
  const listRef = useRef(null);
  const scrollRef = useRef(null);
  const footerScrollRef = useRef(null);

  const currentSort = externalSortConfig !== undefined ? externalSortConfig : internalSortConfig;

  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizeStart = (e, key) => {
    if (e.cancelable !== false) { e.preventDefault(); e.stopPropagation(); }
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key] || 100;
    addBodyResizeFlags();
    const onMouseMove = (moveEvent) => {
      if (!resizingCol.current) return;
      const diff = startX.current - moveEvent.clientX;
      const minW = colMinWidths[resizingCol.current] || 40;
      setColWidths((prev) => ({ ...prev, [resizingCol.current]: Math.max(startWidth.current + diff, minW) }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      removeBodyResizeFlags();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toggleSort = useCallback((key) => {
    if (externalOnSort) {
      externalOnSort(key);
    } else {
      setInternalSortConfig((prev) =>
        prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
      );
    }
  }, [externalOnSort]);

  const sortedData = useMemo(() => {
    if (externalSortConfig !== undefined) return data;
    if (!currentSort.key) return data;
    return [...data].sort((a, b) => {
      const col = columns.find((c) => c.id === currentSort.key);
      let valA = a[currentSort.key];
      let valB = b[currentSort.key];
      if (col?.sortValue) { valA = col.sortValue(a); valB = col.sortValue(b); }
      const numA = Number(valA);
      const numB = Number(valB);
      const isNum = !isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "" && valA != null && valB != null;
      if (isNum) return currentSort.dir === "asc" ? numA - numB : numB - numA;
      valA = String(valA || "");
      valB = String(valB || "");
      return currentSort.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
    });
  }, [data, currentSort, columns, externalSortConfig]);

  const globalVirtualizeLists = usePerformanceStore((s) => s.settings.virtualizeLists);
  const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + (colWidths[c.id] || 120), 0), [columns, colWidths]);
  const useVirtual = (virtualized || globalVirtualizeLists) && sortedData.length > VIRTUALIZE_THRESHOLD;

  // Sync horizontal scroll between header and list
  const handleScroll = useCallback(({ scrollOffset }) => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollOffset;
    if (footerScrollRef.current) footerScrollRef.current.scrollLeft = scrollOffset;
  }, []);

  const handleHeaderScroll = useCallback((e) => {
    if (listRef.current) listRef.current.scrollTo(e.target.scrollLeft);
    if (footerScrollRef.current) footerScrollRef.current.scrollLeft = e.target.scrollLeft;
  }, []);

  if (sortedData.length === 0) {
    return (
      <div className={containerClass}>
        <div className="flex h-full w-full select-none flex-col items-center justify-center py-10 opacity-40 min-h-[200px]">
          {emptyIcon && <div className="mb-4 text-text-muted">{emptyIcon}</div>}
          <span className="text-sm font-black tracking-widest text-text-secondary">{emptyMessage}</span>
        </div>
      </div>
    );
  }

  if (useVirtual) {
    return (
      <div className={containerClass} style={{ overflow: "hidden" }}>
        {/* Fixed header with horizontal scroll */}
        <div
          ref={scrollRef}
          onScroll={handleHeaderScroll}
          className="overflow-x-auto border-b border-border-normal/80"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <div className="flex bg-bg-overlay/90 text-text-secondary sticky top-0 z-10 shadow-sm" style={{ width: totalWidth, minWidth: "100%" }}>
            {columns.map((c) => (
              <SortTh
                key={c.id}
                label={c.header}
                sortKey={c.sortable ? c.id : null}
                width={colWidths[c.id]}
                minWidth={c.minWidth || 40}
                onResizeStart={onResizeStart}
                resizableKey={c.id}
                sortConfig={currentSort}
                onSort={c.sortable ? toggleSort : null}
                helpText={c.desc}
                className={c.headerClass || "text-center"}
              />
            ))}
          </div>
        </div>
        {/* Virtualized rows */}
        <List
          ref={listRef}
          height={height}
          itemCount={sortedData.length}
          itemSize={ROW_HEIGHT}
          width="100%"
          onScroll={handleScroll}
          itemData={{ columns, colWidths, colMinWidths, rows: sortedData, rowKey, onRowClick, rowClass }}
          overscanCount={10}
        >
          {VirtualRow}
        </List>
        {renderExpandedRow && <div style={{ display: "none" }} />}
        {totals && Object.keys(totals).length > 0 && (
          <div
            ref={footerScrollRef}
            className="overflow-x-auto border-t-2 border-primary bg-bg-surface"
            style={{ overflowX: "hidden", overflowY: "hidden" }}
          >
            <div className="flex text-text-primary" style={{ width: totalWidth, minWidth: "100%" }}>
              {columns.map((c, colIdx) => {
                const val = totals[c.id];
                const hasVal = val != null && !isNaN(Number(val));
                return (
                  <div
                    key={c.id}
                    className={`px-1.5 py-2.5 text-center border-l border-border-subtle/50 last:border-l-0 flex items-center justify-center overflow-hidden ${c.cellClass || ""}`}
                    style={{ width: colWidths[c.id], minWidth: Math.min(colWidths[c.id], colMinWidths[c.id] || 40), maxWidth: colWidths[c.id] }}
                  >
                    {hasVal ? (
                      <span className="text-sm font-black tabular-nums" dir="ltr">{formatNumber(val)}</span>
                    ) : (
                      colIdx === 0 ? <span className="text-[11px] font-bold text-text-secondary">الإجمالي</span> : null
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <table className={`w-full text-sm border-collapse min-w-max ${className}`}>
        <thead className="bg-bg-overlay/90 text-text-secondary sticky top-0 z-10 shadow-sm border-b border-border-normal/80">
          <tr>
            {columns.map((c) => (
              <SortTh
                key={c.id}
                label={c.header}
                sortKey={c.sortable ? c.id : null}
                width={colWidths[c.id]}
                minWidth={c.minWidth || 40}
                onResizeStart={onResizeStart}
                resizableKey={c.id}
                sortConfig={currentSort}
                onSort={c.sortable ? toggleSort : null}
                helpText={c.desc}
                className={c.headerClass || "text-center"}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => (
            <React.Fragment key={getRowKey(row, i)}>
              <tr
                onClick={() => onRowClick?.(row)}
                className={`group border-b border-border-subtle hover:bg-bg-overlay transition-colors bg-bg-surface ${rowClass(row)} ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`px-1.5 py-1 text-xs text-text-primary border-l border-border-subtle/50 truncate align-middle ${c.cellClass || "text-center"}`}
                    style={{ maxWidth: colWidths[c.id], minWidth: Math.min(colWidths[c.id], colMinWidths[c.id] || 40) }}
                    title={(row[c.id] ?? "") !== "" ? String(row[c.id]) : "-"}
                  >
                    {c.render ? c.render(row, i) : ((row[c.id] ?? "") !== "" ? row[c.id] : "-")}
                  </td>
                ))}
              </tr>
              {renderExpandedRow && renderExpandedRow(row, i)}
            </React.Fragment>
          ))}
        </tbody>
        {totals && Object.keys(totals).length > 0 && (
          <tfoot className="sticky bottom-0 z-10 border-t-2 border-primary bg-bg-surface shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <tr>
              {columns.map((c, colIdx) => {
                const val = totals[c.id];
                const hasVal = val != null && !isNaN(Number(val));
                return (
                  <td
                    key={c.id}
                    className={`px-1.5 py-2.5 text-center border-l border-border-subtle/50 last:border-l-0 align-middle ${c.cellClass || ""}`}
                    style={{ maxWidth: colWidths[c.id], minWidth: Math.min(colWidths[c.id], colMinWidths[c.id] || 40) }}
                  >
                    {hasVal ? (
                      <span className="text-sm font-black text-text-primary tabular-nums" dir="ltr">
                        {formatNumber(val)}
                      </span>
                    ) : (
                      colIdx === 0 ? <span className="text-[11px] font-bold text-text-secondary">الإجمالي</span> : null
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

