import React from "react";
import { X } from "lucide-react";

const registry = {};

// Standard prop contract for a detached "filter/picker" modal. Most detachable
// modals follow it, so they need no bespoke (de)serialize — just the short
// `registerModal(type, Component)` form below.
//
// - `open`           always true (the modal IS the window)
// - `initialFilters` the committed state captured by the parent's getState();
//                    the modal seeds its useState from these (e.g.
//                    `useState(initialFilters?.dateFrom ?? default)`)
// - `onClose`        closes the child window (also notifies the parent for symmetry)
// - `onNavigate`     fallback navigate-parent channel (most modals call
//                    window.electronAPI.navigateParent directly instead)
// - `sendAction`     raw escape hatch for any custom child→parent message
export function defaultDeserialize(state, sendAction) {
  const { token, ...rest } = state || {};
  return {
    ...rest,
    open: true,
    initialFilters: rest,
    initialState: rest,
    sendAction,
    onClose: () => {
      window.electronAPI?.closeModalWindow?.();
      sendAction?.("close");
    },
    onNavigate: (path) => {
      window.electronAPI?.navigateParent?.(path);
      sendAction?.("navigate", path);
    },
  };
}

const passthroughSerialize = (props) => props;

// registerModal(type, Component)                       -> standard contract
// registerModal(type, Component, serialize, deserialize) -> custom mapping
export function registerModal(type, component, serialize, deserialize) {
  registry[type] = {
    component,
    serialize: serialize ?? passthroughSerialize,
    deserialize: deserialize ?? defaultDeserialize,
  };
}

export function getModalRegistration(type) {
  return registry[type] || null;
}

export function isModalRegistered(type) {
  return Boolean(registry[type]);
}

// ── Generic fallback ─────────────────────────────────────────────────────
// Used when a Modal without modalType is detached. Shows title and message.
registerModal("generic", GenericDetachedModal);

function GenericDetachedModal({ title, contentHtml }) {
  return (
    <div className="flex h-dvh flex-col bg-bg-surface">
      <div className="flex shrink-0 items-center justify-between border-b border-border-normal bg-bg-overlay px-4 py-3">
        <h3 className="truncate text-sm font-bold text-text-primary">
          {title || "نافذة منفصلة"}
        </h3>
        <button
          type="button"
          onClick={() => window.electronAPI?.closeModalWindow?.()}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-border-normal hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {contentHtml ? (
        <div className="flex-1 overflow-y-auto p-5" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-text-secondary">هذه النافذة لا تدعم الفصل بعد</p>
        </div>
      )}
    </div>
  );
}

export { registry };
