import React, { useCallback } from "react";
import { X, ExternalLink } from "lucide-react";

function defaultDetach(title) {
  if (!window.electronAPI?.createModalWindow) return;
  const contentArea = document.querySelector("[data-modal-content]");
  const footerArea = document.querySelector("[data-modal-footer]");
  const bodyHtml = contentArea?.innerHTML || "";
  const footerHtml = footerArea?.innerHTML || "";
  const contentHtml = bodyHtml + (footerHtml ? `<div class="detach-footer-sep"></div>${footerHtml}` : "");
  console.log('[TitleBar] defaultDetach', { title, bodyLen: bodyHtml.length, footerLen: footerHtml.length });
  window.electronAPI.createModalWindow({
    modalType: "generic",
    state: { title, contentHtml },
  });
}

export default function TitleBar({
  title,
  subtitle,
  icon,
  onClose,
  onDetach,
  showDetach = true,
}) {
  const handleDetach = useCallback(() => {
    if (onDetach) { onDetach(); return; }
    defaultDetach(title);
    onClose?.();
  }, [onDetach, title, onClose]);

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && (
            <p className="truncate text-[11px] font-medium text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {window.electronAPI && showDetach && !window.location.search.includes("detachedModal=1") && (
          <button
            type="button"
            onClick={handleDetach}
            title="فتح في نافذة منفصلة"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
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
