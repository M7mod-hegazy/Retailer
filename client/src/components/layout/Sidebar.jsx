import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown, Search, LogOut, Settings, Radar, PanelRightClose, PanelRightOpen, ChevronsRight, ShoppingBag,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useUpdateStore } from "../../stores/updateStore";
import { PRIMARY_MENU, NAV_MODULES } from "../../constants/navigation";

function usePermissionFilter() {
  const { user, permissions } = useAuthStore();
  return (pageKey) => {
    if (!pageKey) return true;
    if (!user) return false;
    if (user.role === "dev" || user.role === "admin") return true;
    if (pageKey === "updates") return !!user.can_view_updates;
    return Array.isArray(permissions?.[pageKey]) && permissions[pageKey].includes("view");
  };
}

function useCategoryCount() {
  const [count, setCount] = useState(null);
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const token = useAuthStore.getState().token;
    const base = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5000");
    fetch(`${base}/api/categories`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.data)) setCount(d.data.length); })
      .catch(() => {});
  }, []);
  return count;
}

function SidebarItem({ item, location, updateAvailable, categoryCount }) {
  const isItemActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
  return (
    <Link
      to={item.path}
      className={`relative flex items-center justify-between gap-2 rounded-md px-3 py-1.5 transition-all ${
        isItemActive ? "text-zinc-900 font-black bg-zinc-50" : "text-zinc-500 hover:text-zinc-900 font-semibold"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isItemActive && (
          <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 w-1 h-3.5 bg-emerald-500 rounded-full shadow-sm" />
        )}
        <span className="text-[11.5px] truncate">{item.label}</span>
        {item.pageKey === "updates" && updateAvailable && (
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
        )}
      </div>
      {item.path === "/definitions/items" && categoryCount !== null && (
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
          isItemActive ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
        }`}>
          {categoryCount}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ width, mode = "full", onSetMode, onResizeMouseDown, branding }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateAvailable = useUpdateStore((state) => state.available);
  const logout = useAuthStore((state) => state.logout);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const categoryCount = useCategoryCount();
  const canView = usePermissionFilter();

  const visiblePrimary = PRIMARY_MENU.filter((item) => canView(item.pageKey));

  const filteredModules = NAV_MODULES.map((module) => {
    const permittedItems = module.items.filter((item) => canView(item.pageKey));
    if (!searchQuery) return { ...module, items: permittedItems };
    const query = searchQuery.toLowerCase();
    const items = permittedItems.filter((item) => item.label.toLowerCase().includes(query));
    return { ...module, items };
  }).filter((module) => module.items.length > 0);

  useEffect(() => {
    if (searchQuery) return;
    const activeModule = NAV_MODULES.find((module) =>
      module.items.some((item) => item.path === location.pathname || (location.pathname.startsWith(item.path) && item.path !== "/")),
    );
    if (activeModule) setActiveAccordion(activeModule.id);
  }, [location.pathname, searchQuery]);

  const handleModuleClick = useCallback((moduleId) => {
    setActiveAccordion((prev) => (prev === moduleId ? null : moduleId));
  }, []);

  // ── Rail (icon-only) mode ──────────────────────────────────────────────────
  if (mode === "rail") {
    const isPathActive = (path) => location.pathname === path || (location.pathname.startsWith(path) && path !== "/");
    return (
      <aside
        data-app-sidebar="true"
        data-sidebar-mode="rail"
        className="relative z-40 flex shrink-0 h-screen flex-col items-center border-l border-zinc-200/60 bg-white py-3"
        style={{ width }}
        dir="rtl"
      >
        {/* Header: logo + expand */}
        <div className="flex flex-col items-center gap-2 pb-3 border-b border-zinc-100 w-full">
          {branding?.logoUrl && branding?.showOnSidebar ? (
            <img src={branding.logoUrl} alt={branding?.title || "Logo"} className="h-9 w-9 rounded-xl object-contain bg-white" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-emerald-400">
              <Radar strokeWidth={2} className="h-5 w-5" />
            </div>
          )}
          <button
            onClick={() => onSetMode?.("full")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="توسيع القائمة"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        </div>

        {/* Icons */}
        <nav className="flex-1 overflow-y-auto scrollbar-none w-full flex flex-col items-center gap-1.5 py-3">
          {visiblePrimary.map((item) => {
            const active = isPathActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  active ? "bg-zinc-950 text-emerald-400 shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <item.icon strokeWidth={active ? 2 : 1.5} className="h-[18px] w-[18px]" />
                {item.pageKey === "updates" && updateAvailable && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}

          <div className="my-1.5 h-px w-7 bg-zinc-100" />

          {filteredModules.map((module) => {
            const active = module.items.some((item) => isPathActive(item.path));
            return (
              <button
                key={module.id}
                onClick={() => { setActiveAccordion(module.id); onSetMode?.("full"); }}
                title={module.title}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  active ? "bg-zinc-50 text-emerald-600" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <module.icon strokeWidth={1.5} className="h-[18px] w-[18px]" />
              </button>
            );
          })}
        </nav>

        {/* Footer: settings, hide */}
        <div className="flex flex-col items-center gap-1.5 pt-3 border-t border-zinc-100 w-full">
          <Link
            to="/settings"
            title="الإعدادات"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <Settings strokeWidth={1.5} className="h-4 w-4" />
          </Link>
          <button
            onClick={() => onSetMode?.("hidden")}
            title="إخفاء القائمة"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      data-app-sidebar="true"
      className="relative z-40 flex shrink-0 h-screen flex-col border-l border-zinc-200/60 bg-white"
      style={{ width }}
      dir="rtl"
    >
      {/* Drag-to-resize handle on left edge */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-400/40 active:bg-emerald-400/60 transition-colors z-50"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-5">
        <div className="flex items-center gap-3 min-w-0">
          {branding?.logoUrl && branding?.showOnSidebar ? (
            <img
              src={branding.logoUrl}
              alt={branding?.title || "Logo"}
              className="h-9 w-9 shrink-0 rounded-xl object-contain bg-white"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-emerald-400">
              <Radar strokeWidth={2} className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-black tracking-tight text-zinc-900 leading-none truncate">{branding?.title || "نظام الحجازي"}</h2>
            <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mt-1 truncate">{branding?.subtitle || "إدارة التجزئة"}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => onSetMode?.("rail")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="تصغير إلى شريط الأيقونات"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSetMode?.("hidden")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="إخفاء القائمة"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-none">
        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في القوائم..."
            className="w-full rounded-lg bg-zinc-50 border border-zinc-200/60 py-2 pl-2.5 pr-8 text-2sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none transition-all"
          />
        </div>

        {/* Primary menu */}
        <div className="space-y-1 mb-6">
          {visiblePrimary.map((item) => {
            const isActive = location.pathname === item.path;
            if (item.highlight) {
              const isSalesActive = location.pathname === "/sales";
              return (
                <div key={item.path} className={`flex items-stretch rounded-lg overflow-hidden transition-all ${
                  isActive ? "bg-zinc-950 shadow-sm" : "bg-emerald-50 hover:bg-emerald-100"
                }`}>
                  <Link
                    to={item.path}
                    className={`flex flex-1 items-center gap-3 px-3 py-2.5 min-w-0 ${
                      isActive ? "text-white" : "text-emerald-700"
                    }`}
                  >
                    <item.icon strokeWidth={isActive ? 2 : 1.5} className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-2sm truncate ${isActive ? "font-black" : "font-bold"}`}>{item.label}</span>
                      {!isActive && <span className="text-[9px] text-emerald-500 font-bold">اختصار لوحة المفاتيح <kbd className="rounded px-0.5 bg-emerald-100 text-emerald-600 font-mono text-[8px]">F2</kbd></span>}
                    </div>
                  </Link>
                  <Link
                    to="/sales"
                    title="فواتير المبيعات"
                    className={`flex items-center justify-center w-9 shrink-0 border-r transition-colors ${
                      isActive
                        ? "border-zinc-800 text-emerald-400 hover:bg-zinc-800"
                        : isSalesActive
                          ? "border-emerald-300 bg-emerald-200 text-emerald-800"
                          : "border-emerald-200 text-emerald-500 hover:bg-emerald-200 hover:text-emerald-800"
                    }`}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            }
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <item.icon strokeWidth={isActive ? 2 : 1.5} className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
                <span className={`text-2sm truncate ${isActive ? "font-black" : "font-bold"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Module accordions */}
        <div className="space-y-0.5">
          {filteredModules.map((module) => {
            const isExpanded = searchQuery.length > 0 || activeAccordion === module.id;
            const hasActiveItem = module.items.some(
              (item) => location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/"),
            );

            return (
              <div key={module.id}>
                <button
                  onClick={() => handleModuleClick(module.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 transition-all ${
                    isExpanded || hasActiveItem
                      ? "text-zinc-900 bg-zinc-50/80"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <module.icon strokeWidth={1.5} className={`h-[17px] w-[17px] shrink-0 ${hasActiveItem ? "text-emerald-600" : isExpanded ? "text-zinc-900" : "text-zinc-400"}`} />
                    <span className={`text-2sm truncate ${isExpanded || hasActiveItem ? "font-black" : "font-bold"}`}>{module.title}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180 text-zinc-900" : "text-zinc-400"}`} />
                </button>

                {isExpanded && (
                  <div>
                    <div className="flex flex-col relative pr-6 pl-2 py-1">
                      <div className="absolute right-[18px] top-2 bottom-2 w-[2px] bg-zinc-100 rounded-full" />
                      {(() => {
                        const FAMILY_LABELS = { sales: "المبيعات", purchases: "المشتريات", other: "أخرى" };
                        const hasFamilies = module.items.some((i) => i.family);
                        if (!hasFamilies) {
                          return module.items.map((item) => <SidebarItem key={item.path} item={item} location={location} updateAvailable={updateAvailable} categoryCount={categoryCount} />);
                        }
                        // Group items preserving order, emit a label at each family boundary
                        const rows = [];
                        let lastFamily = null;
                        module.items.forEach((item) => {
                          if (item.family && item.family !== lastFamily) {
                            rows.push(
                              <div key={`fam-${item.family}`} className="flex items-center gap-2 px-3 pt-2 pb-0.5">
                                <span className="text-[9px] font-black tracking-widest uppercase text-zinc-400">{FAMILY_LABELS[item.family] ?? item.family}</span>
                                <div className="flex-1 h-px bg-zinc-100" />
                              </div>
                            );
                            lastFamily = item.family;
                          }
                          rows.push(<SidebarItem key={item.path} item={item} location={location} updateAvailable={updateAvailable} categoryCount={categoryCount} />);
                        });
                        return rows;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-1.5">
          <Link to="/settings" className="flex items-center gap-2.5 px-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors">
              <Settings strokeWidth={1.5} className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black text-zinc-900 truncate max-w-[90px]">{user?.name || "مدير النظام"}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">Admin</span>
            </div>
          </Link>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut strokeWidth={1.5} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
