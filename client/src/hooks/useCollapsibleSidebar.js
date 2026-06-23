import { useState, useEffect, useCallback, useRef } from "react";
import { useIsNarrowViewport } from "./useIsNarrowViewport";

export default function useCollapsibleSidebar(options = {}) {
  const {
    storageKeyPrefix = "retailer.invoice",
    defaultWidth = 340,
    minWidth = 290,
    maxWidth = 620,
    narrowThreshold = 1100,
  } = options;

  const WIDTH_KEY = `${storageKeyPrefix}.panelWidth`;
  const COLLAPSED_KEY = `${storageKeyPrefix}.panelCollapsed`;

  const [panelWidth, setPanelWidth] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem(WIDTH_KEY)); return (typeof v === "number" && v >= minWidth && v <= maxWidth) ? v : defaultWidth; }
    catch { return defaultWidth; }
  });
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) === true; }
    catch { return false; }
  });
  const [panelManualOpen, setPanelManualOpen] = useState(false);
  const panelNarrow = useIsNarrowViewport(narrowThreshold);
  const panelEffectiveCollapsed = panelManualOpen ? false : (panelCollapsed || panelNarrow);

  useEffect(() => { try { localStorage.setItem(WIDTH_KEY, JSON.stringify(panelWidth)); } catch {} }, [panelWidth, WIDTH_KEY]);
  useEffect(() => { try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(panelCollapsed)); } catch {} }, [panelCollapsed, COLLAPSED_KEY]);

  const collapsePanel = useCallback(() => { setPanelManualOpen(false); setPanelCollapsed(true); }, []);
  const expandPanel = useCallback(() => { setPanelManualOpen(true); setPanelCollapsed(false); }, []);
  const togglePanel = useCallback(() => { (panelEffectiveCollapsed ? expandPanel : collapsePanel)(); }, [panelEffectiveCollapsed, expandPanel, collapsePanel]);

  const panelResizingRef = useRef(false);
  const startPanelResize = useCallback((e, edge) => {
    e.preventDefault();
    panelResizingRef.current = true;
    const startX = e.clientX;
    const startW = panelWidth;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMove = (mv) => {
      if (!panelResizingRef.current) return;
      const raw = mv.clientX - startX;
      const delta = edge === "left" ? -raw : raw;
      setPanelWidth(Math.min(maxWidth, Math.max(minWidth, startW + delta)));
    };
    const onUp = () => {
      panelResizingRef.current = false;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth, minWidth, maxWidth]);

  return {
    panelWidth,
    panelCollapsed,
    panelEffectiveCollapsed,
    panelManualOpen,
    panelNarrow,
    collapsePanel,
    expandPanel,
    togglePanel,
    startPanelResize,
  };
}
