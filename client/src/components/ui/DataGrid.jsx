import React, { useState, useRef, useMemo, useCallback } from "react";
import { List } from "react-window";
import SortTh from "./SortTh";

const ROW_HEIGHT = 45;
const VIRTUALIZE_THRESHOLD = 100;

function VirtualRow({ data: { columns, colWidths, rows, rowKey, onRowClick, rowClass }, index, style }) {
  const row = rows[index];
  return (
    <div
      style={style}
      onClick={() => onRowClick?.(row)}
      className={`flex border-b border-slate-100 hover:bg-slate-50 transition-colors bg-white ${rowClass(row)} ${onRowClick ? "cursor-pointer" : ""}`}
    >
      {columns.map((c) => (
        <div
          key={c.id}
          className={`px-2 py-2 text-sm text-slate-800 border-l border-slate-100/50 flex items-center ${c.cellClass || "text-center"}`}
          style={{ width: colWidths[c.id], minWidth: colWidths[c.id], maxWidth: colWidths[c.id], wordBreak: "break-word", overflowWrap: "break-word" }}
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
  containerClass = "flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-200",
  virtualized = false,
  height = 500,
}) {
  const getRowKey = useCallback((row, idx) => {
    if (typeof rowKey === "function") return rowKey(row, idx);
    return row[rowKey] ?? idx;
  }, [rowKey]);

  const defaultWidths = {};
  columns.forEach((c) => (defaultWidths[c.id] = c.width || 120));

  const [colWidths, setColWidths] = useState(defaultWidths);
  const [internalSortConfig, setInternalSortConfig] = useState({ key: null, dir: "asc" });
  const listRef = useRef(null);
  const scrollRef = useRef(null);

  const currentSort = externalSortConfig !== undefined ? externalSortConfig : internalSortConfig;

  const resizingCol = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onResizeStart = (e, key) => {
    if (e.cancelable !== false) { e.preventDefault(); e.stopPropagation(); }
    resizingCol.current = key;
    startX.current = e.clientX;
    startWidth.current = colWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (moveEvent) => {
      if (!resizingCol.current) return;
      const diff = startX.current - moveEvent.clientX;
      setColWidths((prev) => ({ ...prev, [resizingCol.current]: Math.max(startWidth.current + diff, 40) }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
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

  const totalWidth = useMemo(() => columns.reduce((sum, c) => sum + (colWidths[c.id] || 120), 0), [columns, colWidths]);
  const useVirtual = virtualized && sortedData.length > VIRTUALIZE_THRESHOLD;

  // Sync horizontal scroll between header and list
  const handleScroll = useCallback(({ scrollOffset }) => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollOffset;
  }, []);

  const handleHeaderScroll = useCallback((e) => {
    if (listRef.current) listRef.current.scrollTo(e.target.scrollLeft);
  }, []);

  if (sortedData.length === 0) {
    return (
      <div className={containerClass}>
        <div className="flex h-full w-full select-none flex-col items-center justify-center py-10 opacity-40 min-h-[200px]">
          {emptyIcon && <div className="mb-4 text-slate-400">{emptyIcon}</div>}
          <span className="text-sm font-black tracking-widest text-slate-500">{emptyMessage}</span>
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
          className="overflow-x-auto border-b border-slate-200/80"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <div className="flex bg-slate-50/90 text-slate-500 sticky top-0 z-10 shadow-sm" style={{ width: totalWidth, minWidth: "100%" }}>
            {columns.map((c) => (
              <SortTh
                key={c.id}
                label={c.header}
                sortKey={c.sortable ? c.id : null}
                width={colWidths[c.id]}
                onResizeStart={onResizeStart}
                resizableKey={c.id}
                sortConfig={currentSort}
                onSort={c.sortable ? toggleSort : null}
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
          itemData={{ columns, colWidths, rows: sortedData, rowKey, onRowClick, rowClass }}
          overscanCount={10}
        >
          {VirtualRow}
        </List>
        {renderExpandedRow && <div style={{ display: "none" }} />}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <table className={`w-full text-sm border-collapse min-w-max ${className}`}>
        <thead className="bg-slate-50/90 text-slate-500 sticky top-0 z-10 shadow-sm border-b border-slate-200/80">
          <tr>
            {columns.map((c) => (
              <SortTh
                key={c.id}
                label={c.header}
                sortKey={c.sortable ? c.id : null}
                width={colWidths[c.id]}
                onResizeStart={onResizeStart}
                resizableKey={c.id}
                sortConfig={currentSort}
                onSort={c.sortable ? toggleSort : null}
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
                className={`group border-b border-slate-100 hover:bg-slate-50 transition-colors bg-white ${rowClass(row)} ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`px-2 py-2 text-sm text-slate-800 border-l border-slate-100/50 truncate align-middle ${c.cellClass || "text-center"}`}
                    style={{ maxWidth: colWidths[c.id] }}
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
      </table>
    </div>
  );
}
