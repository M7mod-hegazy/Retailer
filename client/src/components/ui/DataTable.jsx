import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { usePerformanceStore } from "../../stores/performanceStore";

export default function DataTable({ 
  columns, 
  data, 
  onRowClick,
  rowSelection,
  setRowSelection,
  columnVisibility,
  setColumnVisibility,
  globalFilter,
  setGlobalFilter,
  loading
}) {
  const animateRows = usePerformanceStore((s) => s.settings.dataTableAnimations);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnVisibility,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: "onChange",
    columnResizeDirection: "rtl", 
  });

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-right border-collapse min-w-[500px]">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();
                
                const isFixedColumn = header.column.id === 'index' || header.column.id === 'actions';
                const styleObj = isFixedColumn ? { width: header.column.columnDef.size, position: "relative" } : { position: "relative" };

                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={styleObj}
                    className="px-4 md:px-6 py-4 md:py-5 text-[11px] font-black uppercase tracking-widest select-none group transition-colors"
                  >
                    <div 
                      className={`flex items-center gap-2 ${canSort ? "cursor-pointer" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      
                      {canSort && (
                        <div className="transition-colors" style={{ color: "var(--text-muted)" }}>
                          {isSorted === "asc" ? (
                            <ChevronUp className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                          ) : isSorted === "desc" ? (
                            <ChevronDown className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
                          ) : (
                            <ChevronsUpDown className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      )}
                    </div>

                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute left-0 top-1/4 h-1/2 rounded-full cursor-col-resize z-10 transition-all ${
                          header.column.getIsResizing() ? "w-1.5" : "w-1 opacity-0 group-hover:opacity-100"
                        }`}
                        style={{ backgroundColor: header.column.getIsResizing() ? "var(--text-primary)" : "var(--border-normal)" }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        {animateRows ? (
          <motion.tbody
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
            className="divide-y"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black animate-pulse" style={{ color: "var(--text-muted)" }}>
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black" style={{ color: "var(--text-muted)" }}>
                  لا توجد سجلات مطابقة
                </td>
              </tr>
            ) : (
              <AnimatePresence>
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    layout
                    variants={{
                      hidden: { opacity: 0, scale: 0.98, x: 20 },
                      show: { opacity: 1, scale: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
                    }}
                    whileHover={{ x: -4 }}
                    onClick={() => onRowClick?.(row.original)}
                    className="group transition-all cursor-pointer relative"
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-overlay)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isFixedColumn = cell.column.id === 'index' || cell.column.id === 'actions';
                      return (
                        <td key={cell.id} className="px-4 md:px-6 py-4 md:py-5" style={isFixedColumn ? { width: cell.column.columnDef.size } : {}}>
                          <span className={`text-sm font-bold ${cell.column.id === 'code' ? 'font-mono tracking-wider' : ''}`} style={{ color: "var(--text-secondary)" }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </motion.tbody>
        ) : (
          <tbody style={{ backgroundColor: "var(--bg-surface)" }}>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black" style={{ color: "var(--text-muted)" }}>
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black" style={{ color: "var(--text-muted)" }}>
                  لا توجد سجلات مطابقة
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className="group cursor-pointer relative"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-overlay)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isFixedColumn = cell.column.id === 'index' || cell.column.id === 'actions';
                    return (
                      <td key={cell.id} className="px-4 md:px-6 py-4 md:py-5" style={isFixedColumn ? { width: cell.column.columnDef.size } : {}}>
                        <span className={`text-sm font-bold ${cell.column.id === 'code' ? 'font-mono tracking-wider' : ''}`} style={{ color: "var(--text-secondary)" }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}