import { useCallback } from "react";

function openField(el) {
  if (!el) return;
  el.focus();
  if (el.tagName === "SELECT") {
    el.showPicker?.();
  } else if (el.select) {
    el.select();
  }
}

export function useFieldNavigation() {
  const handleKeyDown = useCallback((e, { nextRef, prevRef, onEnter } = {}) => {
    if (e.key !== "Enter") return;
    const isReverse = e.shiftKey;
    e.preventDefault();
    if (isReverse) {
      if (prevRef?.current) openField(prevRef.current);
    } else if (onEnter) {
      onEnter();
    } else if (nextRef?.current) {
      openField(nextRef.current);
    }
  }, []);

  return handleKeyDown;
}
