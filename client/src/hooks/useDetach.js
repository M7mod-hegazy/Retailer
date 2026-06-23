import { useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { registerIpcHandler, initGlobalIpcListener } from "../components/detached/ipcRegistry";
import { isModalRegistered } from "../components/detached/modalRegistry";

initGlobalIpcListener();

// Open any registered modal type as a detached child window. Always injects the
// auth token so the child window can authenticate API calls. Use this instead of
// calling window.electronAPI.createModalWindow directly so token/state handling
// stays uniform across every call site (parent modals AND nested sub-modals).
export function openDetachedModal(modalType, state = {}, bounds) {
  if (!window.electronAPI?.createModalWindow) return;
  if (import.meta.env?.DEV && !isModalRegistered(modalType)) {
    console.error(
      `[detach] modalType "${modalType}" is not registered in registerDetachedModals.js — ` +
      `the detached window will show "نوع النافذة غير معروف". Add a registerModal("${modalType}", …) entry.`,
    );
  }
  window.electronAPI.createModalWindow({
    modalType,
    state: { ...state, token: useAuthStore.getState().token },
    bounds,
  });
}

export function useDetach(modalType, { onClose, getState, getBounds, actions }) {
  // Catch registration drift at mount (dev only) so a missing registry entry is
  // surfaced immediately instead of at click time as the Arabic error screen.
  useEffect(() => {
    if (import.meta.env?.DEV && !isModalRegistered(modalType)) {
      console.error(
        `[detach] useDetach("${modalType}") has no matching registration in ` +
        `registerDetachedModals.js. Detaching this modal will fail.`,
      );
    }
  }, [modalType]);

  const onCloseRef = useRef(onClose);
  const actionsRef = useRef(actions);
  onCloseRef.current = onClose;
  actionsRef.current = actions;

  useEffect(() => {
    const cleanups = [
      registerIpcHandler("close", () => onCloseRef.current?.()),
    ];
    Object.entries(actions ?? {}).forEach(
      ([action, fn]) => cleanups.push(registerIpcHandler(action, fn)),
    );
    return () => cleanups.forEach(fn => fn());
  }, []);

  const handleDetach = useCallback(function handleDetach() {
    if (!window.electronAPI?.createModalWindow) return;
    openDetachedModal(modalType, getState?.() ?? {}, getBounds?.());
    onCloseRef.current?.();
  }, [modalType, getState, getBounds]);

  return { handleDetach };
}
