import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUiStore } from '../../stores/uiStore';
import { ChevronLeft } from 'lucide-react';

const MIN_WIDTH = 150;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 220;
const RAIL_WIDTH = 64;

const MODE_KEY = 'retailer.sidebar.mode';
const LEGACY_HIDDEN_KEY = 'retailer.sidebar.hidden';
const VALID_MODES = ['full', 'rail', 'hidden'];

// Resolve the initial sidebar mode, migrating from the legacy boolean `hidden` flag.
function readInitialMode() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (VALID_MODES.includes(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_HIDDEN_KEY);
    if (legacy !== null) return JSON.parse(legacy) ? 'hidden' : 'full';
  } catch {}
  return 'full';
}

function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored);
    } catch {
      return defaultValue;
    }
  });

  const setAndPersist = useCallback((value) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key]);

  return [state, setAndPersist];
}

export default function DesktopLayout({ children, branding }) {
  const [sidebarMode, setSidebarMode] = useLocalStorageState(MODE_KEY, readInitialMode());
  const [sidebarWidth, setSidebarWidth] = useLocalStorageState('retailer.sidebar.width', DEFAULT_WIDTH);
  const location = useLocation();
  const posAutoRail = useUiStore((s) => s.posAutoRail);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Auto-rail: on the POS page (with the opt-in setting on) the sidebar collapses
  // to the icon rail without touching the persisted user preference. The user can
  // still expand it for the duration of the visit via posOverride.
  const onPos = location.pathname.startsWith('/pos');
  const autoRailActive = onPos && posAutoRail;
  const [posOverride, setPosOverride] = useState(null);
  useEffect(() => { if (!autoRailActive) setPosOverride(null); }, [autoRailActive]);

  const effectiveMode = autoRailActive ? (posOverride ?? 'rail') : sidebarMode;
  const handleSetMode = useCallback((m) => {
    if (autoRailActive) setPosOverride(m);
    else setSidebarMode(m);
  }, [autoRailActive, setSidebarMode]);

  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    function onMouseMove(e) {
      if (!draggingRef.current) return;
      // RTL: sidebar on the right; drag left = expand, drag right = shrink
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      setSidebarWidth(newWidth);
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [setSidebarWidth]);

  const isHidden = effectiveMode === 'hidden';
  const isRail = effectiveMode === 'rail';

  return (
    <div className="flex h-screen bg-[#F4F4F5] text-zinc-900 font-sans overflow-hidden selection:bg-emerald-200" dir="rtl">

      {!isHidden && (
        <Sidebar
          mode={effectiveMode}
          width={isRail ? RAIL_WIDTH : sidebarWidth}
          onSetMode={handleSetMode}
          onResizeMouseDown={isRail ? undefined : handleResizeMouseDown}
          branding={branding}
        />
      )}

      {isHidden && (
        <button
          onClick={() => handleSetMode('full')}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 h-12 w-5 bg-white border border-zinc-200 border-r-0 rounded-l-lg shadow-md flex items-center justify-center hover:bg-zinc-50 transition-colors"
          title="إظهار القائمة"
        >
          <ChevronLeft className="h-3 w-3 text-zinc-500" />
        </button>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen relative overflow-hidden bg-[#F4F4F5]">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="pointer-events-none absolute top-[-10%] right-[-5%] w-[800px] h-[600px] bg-blue-100/30 rounded-full blur-[120px] mix-blend-multiply" />
          <div className="pointer-events-none absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[120px] mix-blend-multiply" />
        </div>

        <Topbar />

        <main className="relative z-10 flex-1 h-0 overflow-y-auto flex flex-col pointer-events-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
