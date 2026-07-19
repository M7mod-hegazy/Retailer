import React, { useCallback } from "react";
import { X, ExternalLink } from "lucide-react";

export default function TitleBar({
  title,
  subtitle,
  icon,
  onClose,
  onDetach,
  showDetach = true,
}) {
  const handleDetach = useCallback(() => {
    onDetach?.();
  }, [onDetach]);

  // Only offer detach when the modal can actually be reconstructed as React
  // (i.e. an onDetach handler was supplied). The old fallback cloned innerHTML
  // into a "generic" window, which produced a dead snapshot whose buttons and
  // form state didn't work — show nothing rather than a broken affordance.
  const canDetach = Boolean(onDetach);

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border-normal bg-bg-overlay px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-overlay text-text-secondary">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-text-primary">{title}</h3>
          {subtitle && (
            <p className="truncate text-[11px] font-medium text-text-secondary">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {window.electronAPI && showDetach && canDetach && !window.location.search.includes("detachedModal=1") && (
          <button
            type="button"
            onClick={handleDetach}
            title="فتح في نافذة منفصلة"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-border-normal hover:text-text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-sm bg-red-600 text-white transition-colors hover:bg-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
