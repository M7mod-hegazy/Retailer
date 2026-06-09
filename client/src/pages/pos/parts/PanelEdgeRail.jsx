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
      className="group relative z-30 shrink-0 self-stretch w-4 flex flex-col items-center bg-slate-50 border-x border-slate-200 cursor-col-resize hover:bg-emerald-50 transition-colors"
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="طي لوحة الفاتورة"
        className="mt-2.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <CollapseIcon className="h-4 w-4" />
      </button>
      <span className="my-auto flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors pointer-events-none">
        <GripVertical className="h-5 w-5" />
      </span>
    </div>
  );
}
