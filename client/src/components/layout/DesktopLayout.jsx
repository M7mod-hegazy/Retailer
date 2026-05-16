import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ChevronLeft } from 'lucide-react';

const MIN_WIDTH = 160;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 220;

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
  const [sidebarHidden, setSidebarHidden] = useLocalStorageState('retailer.sidebar.hidden', false);
  const [sidebarWidth, setSidebarWidth] = useLocalStorageState('retailer.sidebar.width', DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

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

  return (
    <div className="flex h-screen bg-[#F4F4F5] text-zinc-900 font-sans overflow-hidden selection:bg-emerald-200" dir="rtl">

      {!sidebarHidden && (
        <Sidebar
          width={sidebarWidth}
          onHide={() => setSidebarHidden(true)}
          onResizeMouseDown={handleResizeMouseDown}
          branding={branding}
        />
      )}

      {sidebarHidden && (
        <button
          onClick={() => setSidebarHidden(false)}
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
