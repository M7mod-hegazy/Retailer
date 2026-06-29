import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUiStore } from '../../stores/uiStore';
import { ChevronLeft } from 'lucide-react';
import { addBodyResizeFlags, removeBodyResizeFlags, resetBodyFlags } from '../../utils/bodyFlags';

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
    addBodyResizeFlags();
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
      removeBodyResizeFlags();
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      removeBodyResizeFlags();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [setSidebarWidth]);

  // Safety reset: if the window loses focus mid-drag (alt-tab, hide), body
  // flags may not be cleaned up because mouseup may never fire on document.
  useEffect(() => {
    const onBlur = () => resetBodyFlags();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const isHidden = effectiveMode === 'hidden';
  const isRail = effectiveMode === 'rail';

  // Hover-to-peek: when the sidebar is collapsed (rail) or hidden, hovering it
  // floats the full sidebar as an overlay without shifting the layout. A small
  // close delay prevents flicker when moving between the rail/tab and the overlay.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef(null);
  const openPeek = useCallback(() => { clearTimeout(peekTimer.current); setPeek(true); }, []);
  const closePeek = useCallback(() => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(false), 140); }, []);
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  useEffect(() => { if (effectiveMode === 'full') setPeek(false); }, [effectiveMode]);

  return (
    <div className="flex h-screen bg-base text-primary font-sans overflow-hidden selection:bg-emerald-200" dir="rtl">

      {!isHidden && (
        <div
          onMouseEnter={isRail ? openPeek : undefined}
          onMouseLeave={isRail ? closePeek : undefined}
          className="flex shrink-0"
        >
          <Sidebar
            mode={effectiveMode}
            width={isRail ? RAIL_WIDTH : sidebarWidth}
            onSetMode={handleSetMode}
            onResizeMouseDown={isRail ? undefined : handleResizeMouseDown}
            branding={branding}
          />
        </div>
      )}

      {/* Hidden: distinct re-open tab near the top (hover to peek the full menu) */}
      {isHidden && (
        <button
          onClick={() => handleSetMode('full')}
          onMouseEnter={openPeek}
          onMouseLeave={closePeek}
          className="group fixed right-0 top-24 z-50 flex flex-col items-center gap-2 rounded-l-xl border border-r-0 border-normal bg-surface px-1.5 py-3 shadow-md hover:bg-overlay transition-colors"
          style={{ background: "var(--bg-surface)" }}
          title="إظهار القائمة"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-muted group-hover:text-primary transition-colors" />
          <span className="[writing-mode:vertical-rl] text-[10px] font-black tracking-wider text-muted group-hover:text-primary transition-colors">القائمة</span>
        </button>
      )}

      {/* Hover-peek overlay: floats the full sidebar over content without shifting it */}
      {peek && (isRail || isHidden) && (
        <div
          onMouseEnter={openPeek}
          onMouseLeave={closePeek}
          className="fixed right-0 top-0 z-[55] h-screen bg-sidebar shadow-2xl animate-fade-in"
          style={{ width: sidebarWidth, background: "var(--bg-sidebar)" }}
        >
          <Sidebar
            mode="full"
            width={sidebarWidth}
            onSetMode={(m) => { setPeek(false); handleSetMode(m); }}
            branding={branding}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen relative overflow-hidden bg-base">
        <Topbar />

        <main className="relative flex-1 h-0 overflow-y-auto flex flex-col pointer-events-auto">
          {/* Themed ambient aura — accent-tinted glows that give every theme (esp.
              dark ones) atmospheric depth instead of a flat fill. Driven by the
              active theme's translucent tokens so it recolours per theme. */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div
              className="pointer-events-none absolute top-[-10%] right-[-5%] w-[800px] h-[600px] rounded-full blur-[130px]"
              style={{ background: "radial-gradient(circle, var(--primary-glow), transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full blur-[130px]"
              style={{ background: "radial-gradient(circle, var(--info-light), transparent 70%)" }}
            />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
