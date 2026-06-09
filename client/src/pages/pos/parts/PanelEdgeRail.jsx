import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Thin vertical bar that sits on the inner edge of the POS invoice panel.
 * Doubles as a drag-to-resize grip (when expanded) and hosts the collapse/expand
 * toggle. `panelSide` is which side of the screen the panel occupies so the
 * chevron points the right way ("right" in list view, "left" in grid view).
 */
export default function PanelEdgeRail({ collapsed, onToggle, onResizeStart, panelSide = "right" }) {
  const CollapseIcon = panelSide === "right" ? ChevronRight : ChevronLeft;
  const ExpandIcon = panelSide === "right" ? ChevronLeft : ChevronRight;
  const Icon = collapsed ? ExpandIcon : CollapseIcon;
  return (
    <div
      onMouseDown={collapsed ? undefined : onResizeStart}
      title={collapsed ? "إظهار لوحة الفاتورة" : "اسحب لتغيير عرض اللوحة"}
      className={`relative z-30 shrink-0 w-2.5 self-stretch bg-white border-x border-slate-100 ${collapsed ? "" : "cursor-col-resize hover:bg-emerald-50"}`}
    >
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={collapsed ? "إظهار لوحة الفاتورة" : "طي لوحة الفاتورة"}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 flex h-12 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
