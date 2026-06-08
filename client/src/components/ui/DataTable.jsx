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
    <div className="w-full">
      <table className="w-full text-right border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-slate-100 bg-white">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();
                
                // Only enforce specific widths for index and action columns
                const isFixedColumn = header.column.id === 'index' || header.column.id === 'actions';
                const styleObj = isFixedColumn ? { width: header.column.columnDef.size, position: "relative" } : { position: "relative" };

                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={styleObj}
                    className="px-6 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest select-none group transition-colors hover:bg-slate-50"
                  >
                    <div 
                      className={`flex items-center gap-2 ${canSort ? "cursor-pointer" : ""}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      
                      {canSort && (
                        <div className="text-slate-300 group-hover:text-slate-600 transition-colors">
                          {isSorted === "asc" ? (
                            <ChevronUp className="h-4 w-4 text-zinc-900" />
                          ) : isSorted === "desc" ? (
                            <ChevronDown className="h-4 w-4 text-zinc-900" />
                          ) : (
                            <ChevronsUpDown className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resizing Handle */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute left-0 top-1/4 h-1/2 w-1 rounded-full cursor-col-resize z-10 transition-all ${
                          header.column.getIsResizing() ? "bg-zinc-900 w-1.5" : "bg-slate-200 hover:bg-slate-400 group-hover:opacity-100 opacity-0"
                        }`}
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
            className="divide-y divide-slate-50 bg-white"
          >
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black animate-pulse text-slate-400">
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black text-slate-400">
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
                    className="group transition-all cursor-pointer hover:bg-slate-50/80 hover:shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] hover:z-10 relative"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isFixedColumn = cell.column.id === 'index' || cell.column.id === 'actions';
                      return (
                        <td key={cell.id} className="px-6 py-5" style={isFixedColumn ? { width: cell.column.columnDef.size } : {}}>
                          <span className={`text-sm font-bold text-slate-700 ${cell.column.id === 'code' ? 'font-mono tracking-wider' : ''}`}>
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
          <tbody className="divide-y divide-slate-50 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black text-slate-400">
                  جاري تحميل البيانات...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-24 text-center text-sm font-black text-slate-400">
                  لا توجد سجلات مطابقة
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className="group cursor-pointer hover:bg-slate-50/80 relative"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isFixedColumn = cell.column.id === 'index' || cell.column.id === 'actions';
                    return (
                      <td key={cell.id} className="px-6 py-5" style={isFixedColumn ? { width: cell.column.columnDef.size } : {}}>
                        <span className={`text-sm font-bold text-slate-700 ${cell.column.id === 'code' ? 'font-mono tracking-wider' : ''}`}>
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
