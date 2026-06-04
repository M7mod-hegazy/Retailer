import React from "react";
import { ArrowLeft } from "lucide-react";

/*
 * DocumentHeaderBar — the canonical top header for every invoice-type page.
 *
 * Layout (RTL): [ back ] [ title / subtitle ] [ badges ...]      [ actions ... ]
 *   left cluster  : back button + title block + status/mode badges
 *   right cluster : action buttons in a FIXED order, gap-3
 *
 * The page composes its own <DocumentActionButton> nodes (already wrapped in
 * PermissionGate / conditional rendering) and passes them as `actions`, plus
 * any bespoke nodes (held-invoices dropdown, doc-number inputs) via `extras`
 * rendered in the left cluster after the title.
 *
 * This component owns ONLY layout + the standard back button. It introduces no
 * business behavior — handlers stay in the page.
 */
// Identity-tinted bottom border so each document type keeps its palette cue
// while header size/layout stay uniform.
const ACCENTS = {
  slate: "border-b border-slate-300",
  amber: "border-b border-amber-200",
  emerald: "border-b border-emerald-200",
  "emerald-strong": "border-b-2 border-emerald-500",
  indigo: "border-b border-indigo-200",
  rose: "border-b border-rose-200",
};

export default function DocumentHeaderBar({
  onBack,
  title,
  subtitle,
  badges = [],
  accent = "slate", // identity bottom-border color
  extras = null, // bespoke left-cluster content (doc-no inputs, dropdowns)
  actions = null, // right-cluster action buttons (already composed)
  className = "",
}) {
  return (
    <header
      className={`flex h-14 shrink-0 items-center justify-between ${ACCENTS[accent] || ACCENTS.slate} bg-white px-6 ${className}`}
    >
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {(title || subtitle) && (
          <div className="flex flex-col">
            {title && (
              <h1 className="text-sm font-black text-slate-800">{title}</h1>
            )}
            {subtitle && (
              <span className="text-[11px] font-bold text-slate-400">
                {subtitle}
              </span>
            )}
          </div>
        )}
        {badges.map((b, i) => (
          <span
            key={i}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${b.cls || "border-slate-200 bg-slate-100 text-slate-600"}`}
          >
            {b.label}
          </span>
        ))}
        {extras}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
