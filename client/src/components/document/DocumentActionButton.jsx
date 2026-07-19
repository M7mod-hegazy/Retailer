import React from "react";

/*
 * DocumentActionButton — the single canonical action button for every
 * invoice-type document page (POS sale, purchase, returns, branch transfer,
 * quotation, etc).
 *
 * It codifies the flat invoice toolbar style that all of those pages already
 * use by hand: h-9, rounded-sm, text-sm, font-black, gap-2, icon + label.
 *
 * Variants encode the ACTION (identical color everywhere):
 *   - print  : neutral white/slate outline (Print / Preview)
 *   - delete : rose (Cancel / Delete / Void / Discard)
 *   - edit   : indigo (Unlock / Edit)
 *   - today  : amber outline (Today's documents quick-access)
 *   - ghost  : light slate outline (misc secondary)
 *
 * The PRIMARY (save/submit) button keeps each document's IDENTITY color via
 * the `identity` prop, so purchase vs return vs transfer stay distinguishable.
 */

// Per-action fixed styling (color encodes the action, same on every page).
const VARIANTS = {
  print:
    "px-4 text-sm border border-border-strong bg-bg-surface text-text-primary hover:bg-bg-overlay",
  delete:
    "px-4 text-sm border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
  edit:
    "px-6 text-sm bg-indigo-600 text-white hover:bg-indigo-700",
  today:
    "px-4 text-sm border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  ghost:
    "px-4 text-sm border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-overlay",
};

// Identity colors for the PRIMARY save/submit button (one per document type).
const IDENTITY = {
  amber: "bg-amber-700 hover:bg-amber-800",
  emerald: "bg-emerald-700 hover:bg-emerald-800",
  indigo: "bg-indigo-600 hover:bg-indigo-700",
  slate: "bg-slate-900 hover:bg-slate-900",
  "slate-900": "bg-slate-900 hover:bg-slate-900",
  rose: "bg-rose-600 hover:bg-rose-700",
};

const BASE =
  "flex h-9 items-center gap-2 rounded-sm font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export default function DocumentActionButton({
  variant = "primary",
  identity = "slate",
  icon: Icon,
  children,
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const isPrimary = variant === "primary";
  const variantClasses = isPrimary
    ? `px-6 text-sm text-white ${IDENTITY[identity] || IDENTITY.slate}`
    : VARIANTS[variant] || VARIANTS.ghost;

  const classes = [BASE, variantClasses, className].filter(Boolean).join(" ");

  return (
    <button {...props} className={classes} disabled={disabled || loading}>
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}
      {children}
    </button>
  );
}
