import { useCallback, useEffect, useRef } from "react";

/**
 * Hook that makes any modal detachable.
 *
 * @param {object} options
 * @param {string} options.modalType  — registry key (e.g. "confirm-dialog")
 * @param {Function} options.serialize — () => serializable state object
 * @param {object} options.bounds  — { x, y, width, height } or null
 * @param {object} options.actions  — { actionName: handlerFn, ... }
 *   Handlers for actions the child window sends back via sendModalAction.
 * @returns {{ onDetach: Function, childIdRef: React.MutableRefObject }}
 */
export default function useDetachModal({ modalType, serialize, bounds, actions = {} }) {
  const childIdRef = useRef(null);

  const onDetach = useCallback(() => {
    if (!window.electronAPI?.createModalWindow) return;
    const state = serialize ? serialize() : {};
    window.electronAPI.createModalWindow({ modalType, state, bounds }).then((res) => {
      if (res?.success) childIdRef.current = res.childId;
    });
  }, [modalType, serialize, bounds]);

  useEffect(() => {
    if (!window.electronAPI?.onModalAction) return;
    const cleanup = window.electronAPI.onModalAction(({ action, data }) => {
      const handler = actions[action];
      if (handler) handler(data);
    });
    return () => cleanup?.();
  }, [actions]);

  return { onDetach, childIdRef };
}
