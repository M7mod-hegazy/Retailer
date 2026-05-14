import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';

export default function DesktopLayout({ children, branding }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#F4F4F5] text-zinc-900 font-sans overflow-hidden selection:bg-emerald-200" dir="rtl">
      
      {/* ─── NATIVE FLEX SIDEBAR (NO FIXED OVERLAPPING) ─── */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        branding={branding}
      />

      {/* ─── MAIN APP CONTENT SHELL ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative overflow-hidden bg-[#F4F4F5]">
        
        {/* Dynamic App Environment Background Elements */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="pointer-events-none absolute top-[-10%] right-[-5%] w-[800px] h-[600px] bg-blue-100/30 rounded-full blur-[120px] mix-blend-multiply" />
          <div className="pointer-events-none absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[120px] mix-blend-multiply" />
        </div>

        {/* Global Topbar - Native Flush Header */}
        <Topbar />

        {/* Dynamic Page Injection */}
        <main className="relative z-10 flex-1 h-0 overflow-y-auto flex flex-col pointer-events-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
