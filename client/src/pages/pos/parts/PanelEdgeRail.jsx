import React from "react";
import { ChevronLeft, ChevronRight, GripVertical, Receipt } from "lucide-react";

/**
 * Control that sits on the inner edge of the POS invoice panel.
 *
 * - Expanded: a clearly grabbable vertical grip (drag to resize the panel) with a
 *   collapse button at the top.
 * - Collapsed: a distinct dark, labeled tab ("لوحة الفاتورة") so it is visually
 *   unmistakable from the global navigation sidebar's plain chevron tab.
 *
 * `panelSide` is which side of the screen the panel occupies so the chevrons point
 * the right way ("right" in list view, "left" in grid view).
 */
export default function PanelEdgeRail({ collapsed, onToggle, onResizeStart, panelSide = "right" }) {
  const ExpandIcon = panelSide === "right" ? ChevronLeft : ChevronRight;
  const CollapseIcon = panelSide === "right" ? ChevronRight : ChevronLeft;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="إظهار لوحة الفاتورة"
        className="group relative z-30 shrink-0 self-stretch w-11 flex flex-col items-center justify-center gap-3 bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
      >
        <ExpandIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
        <span className="flex items-center gap-2 [writing-mode:vertical-rl] rotate-180 text-[11px] font-black tracking-wider">
          <Receipt className="h-3.5 w-3.5" />
          لوحة الفاتورة
        </span>
      </button>
    );
  }

  return (
    <div
      onMouseDown={onResizeStart}
      title="اسحب لتغيير عرض اللوحة"
      className="group relative z-30 shrink-0 self-stretch w-5 flex items-center justify-center bg-slate-50 border-x border-slate-200 cursor-col-resize hover:bg-emerald-50 transition-colors"
    >
      {/* grip dots signal the strip is draggable to resize */}
      <span className="pointer-events-none absolute top-3 text-slate-300 group-hover:text-emerald-400 transition-colors"><GripVertical className="h-4 w-4" /></span>
      <span className="pointer-events-none absolute bottom-3 text-slate-300 group-hover:text-emerald-400 transition-colors"><GripVertical className="h-4 w-4" /></span>

      {/* clear, centered collapse toggle */}
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="طي لوحة الفاتورة"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
      >
        <CollapseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
