import { useCallback } from "react";

export function openField(el) {
  if (!el) return;
  el.focus();
  if (el.tagName === "SELECT") {
    el.showPicker?.();
  } else {
    try { el.select(); } catch { /* number inputs don't support .select() in all browsers */ }
  }
}

export function useFieldNavigation() {
  const handleKeyDown = useCallback((e, { nextRef, prevRef, onEnter } = {}) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (prevRef?.current) openField(prevRef.current);
      } else if (onEnter) {
        onEnter();
      } else if (nextRef?.current) {
        openField(nextRef.current);
      }
    } else if (e.key === "ArrowLeft") {
      // RTL: left = forward (next field)
      e.preventDefault();
      if (nextRef?.current) openField(nextRef.current);
    } else if (e.key === "ArrowRight") {
      // RTL: right = backward (prev field)
      e.preventDefault();
      if (prevRef?.current) openField(prevRef.current);
    }
  }, []);

  return handleKeyDown;
}
