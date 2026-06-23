import { useCallback, useEffect, useRef } from "react";

// Excel-like keyboard navigation for invoice line-item grids, driven entirely by DOM
// data-attributes so it works regardless of how each page renders its table.
//
// Tag every editable cell input/select with:
//   data-grid-cell data-row={rowIndex} data-col="quantity|unit_price|..."
// Wrap the table in an element and pass its ref as `containerRef`.
//
// Behaviour:
//   ArrowUp / ArrowDown     → same column, previous / next row
//   ArrowLeft / ArrowRight  → previous / next editable column (RTL-aware; for text inputs
//                             only jumps once the caret reaches the cell edge)
//   Enter                   → next cell (then wraps to first cell of the next row)
//   focus                   → selects the cell's text so typing overwrites it
//
// Returns { focusCell, focusLastRowQty } for callers to drive focus (e.g. after adding a row).
// Pass `entryRef` (the product-search input) to make focusLastRowQty TOGGLE: pressing the
// shortcut while already inside the grid jumps focus back to the entry input.
export function useGridNavigation(containerRef, { qtyCol = "quantity", entryRef = null } = {}) {
  const colsRef = useRef([]);

  const cellSelector = (row, col) =>
    `[data-grid-cell][data-row="${row}"][data-col="${cssEscape(col)}"]`;

  const focusCell = useCallback((row, col) => {
    const root = containerRef.current;
    if (!root) return null;
    const el = root.querySelector(cellSelector(row, col));
    if (el) {
      el.focus();
      selectAll(el);
    }
    return el;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ordered list of column keys present in a given row (DOM order).
  const colsInRow = useCallback((row) => {
    const root = containerRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll(`[data-grid-cell][data-row="${row}"]`))
      .map((el) => el.getAttribute("data-col"))
      .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxRow = useCallback(() => {
    const root = containerRef.current;
    if (!root) return -1;
    let max = -1;
    root.querySelectorAll("[data-grid-cell][data-row]").forEach((el) => {
      const r = Number(el.getAttribute("data-row"));
      if (r > max) max = r;
    });
    return max;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusLastRowQty = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    // Toggle: if a grid cell already has focus, jump back to the product-search input.
    if (entryRef?.current && root.contains(document.activeElement)) {
      entryRef.current.focus();
      try { entryRef.current.select?.(); } catch { /* number inputs */ }
      return;
    }
    // Otherwise focus the last-added row's qty cell (defer a tick for freshly-added rows).
    setTimeout(() => {
      const r = maxRow();
      if (r < 0) { entryRef?.current?.focus(); return; }
      const cols = colsInRow(r);
      const target = cols.includes(qtyCol) ? qtyCol : cols[0];
      if (target) focusCell(r, target);
    }, 30);
  }, [containerRef, entryRef, qtyCol, maxRow, colsInRow, focusCell]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    function moveCol(row, col, dir) {
      const cols = colsInRow(row);
      const i = cols.indexOf(col);
      if (i === -1) return;
      const next = cols[i + dir];
      if (next) focusCell(row, next);
      else if (dir > 0) focusCell(row + 1, cols[0]); // wrap to next row start
    }

    function onKeyDown(e) {
      const el = e.target;
      if (!el.matches || !el.matches("[data-grid-cell]")) return;
      const row = Number(el.getAttribute("data-row"));
      const col = el.getAttribute("data-col");
      const isRTL = (document.documentElement.dir || document.dir) === "rtl";

      if (e.key === "ArrowDown") { e.preventDefault(); focusCell(row + 1, col); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); focusCell(row - 1, col); return; }

      if (e.key === "Enter") {
        e.preventDefault();
        const cols = colsInRow(row);
        const i = cols.indexOf(col);
        if (i < cols.length - 1) focusCell(row, cols[i + 1]);
        else focusCell(row + 1, cols[0]);
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const forward = isRTL ? e.key === "ArrowLeft" : e.key === "ArrowRight";
        // For text inputs, let the caret move until it reaches the edge.
        if (el.tagName === "INPUT" && el.type !== "number") {
          try {
            const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
            const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
            if (forward && !atEnd) return;
            if (!forward && !atStart) return;
          } catch { /* selection unsupported → navigate */ }
        }
        e.preventDefault();
        moveCol(row, col, forward ? 1 : -1);
        return;
      }
    }

    function onFocusIn(e) {
      const el = e.target;
      if (el.matches && el.matches("[data-grid-cell]")) selectAll(el);
    }

    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("focusin", onFocusIn);
    return () => {
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusin", onFocusIn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, colsInRow, focusCell]);

  return { focusCell, focusLastRowQty };
}

function selectAll(el) {
  if (el.tagName === "SELECT") return;
  if (typeof el.select === "function") {
    try { el.select(); } catch { /* number inputs in some browsers */ }
  }
}

function cssEscape(v) {
  if (window.CSS && CSS.escape) return CSS.escape(v);
  return String(v).replace(/["\\]/g, "\\$&");
}
