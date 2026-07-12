import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, LayoutGrid, Coins, ChevronLeft, LogOut, HelpCircle, TrendingUp, ArrowRight, Bot } from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";
import { useAuthStore } from "../../stores/authStore";
import { useQuitOrLogoutStore } from "../../stores/quitOrLogoutStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { usePerformanceStore } from "../../stores/performanceStore";
import { useUiStore } from "../../stores/uiStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useHelpStore } from "../../stores/helpStore";
import { useShortcut } from "../../shortcuts/useShortcut";
import ShortcutKbd from "../../shortcuts/ShortcutKbd";
import { ROUTES } from "../../constants/routes";
import { PRIMARY_MENU, NAV_MODULES } from "../../constants/navigation";
import helpContent from "../../help/helpContent";
import { getHelpPageKey } from "../../help/routeHelp";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import { motion, AnimatePresence } from "framer-motion";

const EXTRA_BREADCRUMB_PARENTS = [
  { match: /^\/definitions\/items\/import$/, parents: [{ label: "البيانات الأساسية", path: "/definitions" }, { label: "الأصناف", path: "/definitions/items" }], current: "استيراد الأصناف" },
  { match: /^\/pos$/, parents: [{ label: "فواتير المبيعات", path: "/sales" }], current: "نقطة البيع (POS)" },
  { match: /^\/invoices\//, parents: [{ label: "فواتير المبيعات", path: "/sales" }, { label: "نقطة البيع (POS)", path: "/pos" }] },
  { match: /^\/purchases\/new$/, parent: { label: "فواتير المشتريات", path: "/purchases" }, current: "فاتورة جديدة" },
  { match: /^\/purchases\/(?!new$|orders|returns)/, parent: { label: "فواتير المشتريات", path: "/purchases" } },
  { match: /^\/purchases\/orders\/new$/, parents: [{ label: "طلبات التوريد", path: "/purchases/orders" }], current: "طلب توريد جديد" },
  { match: /^\/purchases\/orders\/\d+\/edit$/, parents: [{ label: "طلبات التوريد", path: "/purchases/orders" }], current: "تعديل أمر التوريد" },
  { match: /^\/purchases\/orders$/, current: "طلبات التوريد" },
  { match: /^\/operations\/quotations\/new$/, parents: [{ label: "عرض سعر", path: "/operations/quotations" }], current: "عرض سعر جديد" },
  { match: /^\/operations\/branch-transfer\/new$/, parents: [{ label: "نقل المخزون بين الفروع", path: "/operations/branch-transfer" }], current: "تحويل جديد" },
  { match: /^\/operations\/quotations$/, current: "عرض سعر" },
  { match: /^\/sales\/returns\/new$/, parent: { label: "مرتجع المبيعات", path: "/sales/returns" }, current: "جديد" },
  { match: /^\/sales\/returns\/amend$/, parent: { label: "مرتجع المبيعات", path: "/sales/returns" }, current: "تعديل" },
  { match: /^\/pos\/sales-returns\/\d+$/, parent: { label: "مرتجع المبيعات", path: "/sales/returns" }, current: "تفاصيل المرتجع" },
  { match: /^\/purchases\/returns\/new$/, parent: { label: "مرتجع المشتريات", path: "/purchases/returns" }, current: "جديد" },
  { match: /^\/purchases\/returns\/amend$/, parent: { label: "مرتجع المشتريات", path: "/purchases/returns" }, current: "تعديل" },
  { match: /^\/purchases\/returns\/\d+$/, parent: { label: "مرتجع المشتريات", path: "/purchases/returns" }, current: "تفاصيل المرتجع" },
  { match: /^\/sync\/config$/, parents: [{ label: "المزامنة مع المتجر", path: "/sync" }], current: "إعداد المزامنة" },
  { match: /^\/sync$/, current: "المزامنة مع المتجر" },
  // Cashflow ledger — accessible only via DailyTreasuryPage button, not from sidebar nav
  { match: /^\/daily-treasury\/cashflow$/, parents: [{ label: "الخزينة اليومية", path: "/daily-treasury" }], current: "كشف الحركات التفصيلي" },
];

function useBreadcrumbs(pathname, dynamicBreadcrumb) {
  return useMemo(() => {
    const root = { label: "الرئيسية", path: "/dashboard" };
    if (pathname === "/dashboard" || pathname === "/") return [root];

    // Handle known dynamic sub-routes (e.g. /pos/invoices/:id)
    for (const entry of EXTRA_BREADCRUMB_PARENTS) {
      if (entry.match.test(pathname)) {
        const parents = entry.parents || (entry.parent ? [entry.parent] : []);
        const crumbs = [root, ...parents];
        if (dynamicBreadcrumb) crumbs.push({ label: dynamicBreadcrumb.label, path: dynamicBreadcrumb.path });
        else if (entry.current) crumbs.push({ label: entry.current, path: pathname });
        return crumbs;
      }
    }

    const allItems = [];
    PRIMARY_MENU.forEach((item) => allItems.push({ ...item, moduleTitle: null }));
    NAV_MODULES.forEach((mod) => mod.items.forEach((item) => allItems.push({ ...item, moduleTitle: mod.title, moduleId: mod.id })));

    let best = null;
    for (const item of allItems) {
      if (item.path === "/dashboard") continue;
      if (pathname === item.path || pathname.startsWith(item.path + "/")) {
        if (!best || item.path.length > best.path.length) best = item;
      }
    }

    if (!best) {
      const seg = "/" + pathname.split("/").filter(Boolean)[0];
      for (const item of allItems) {
        if (item.path === "/dashboard") continue;
        if (item.path.startsWith(seg)) {
          if (!best || item.path.length < best.path.length) best = item;
        }
      }
    }

    const reportsCenter = allItems.find((item) => item.path === "/reports/center");
    if (pathname.startsWith("/reports/") && pathname !== "/reports/center" && reportsCenter) {
      const crumbs = [root, { label: reportsCenter.label, path: reportsCenter.path }];
      if (dynamicBreadcrumb) {
        crumbs.push({ label: dynamicBreadcrumb.label, path: dynamicBreadcrumb.path });
      } else if (best && best.path !== reportsCenter.path) {
        crumbs.push({ label: best.label, path: best.path });
      }
      return crumbs;
    }

    if (!best) return dynamicBreadcrumb ? [root, { label: dynamicBreadcrumb.label, path: dynamicBreadcrumb.path }] : [root];
    const crumbs = [root];
    crumbs.push({ label: best.label, path: best.path });
    if (dynamicBreadcrumb) crumbs.push({ label: dynamicBreadcrumb.label, path: dynamicBreadcrumb.path });
    return crumbs;
  }, [pathname, dynamicBreadcrumb]);
}

const routeLabelMatchers = [
  { match: ROUTES.DASHBOARD, label: "مركز القيادة" },
  { match: ROUTES.POS, label: "نقطة البيع" },
  { match: "/definitions", label: "البيانات الأساسية" },
  { match: "/sales", label: "فواتير المبيعات" },
  { match: ROUTES.PURCHASES, label: "المشتريات" },
  { match: ROUTES.PAYMENTS, label: "المدفوعات والتحصيل" },
  { match: ROUTES.EXPENSES, label: "المصروفات" },
  { match: ROUTES.REVENUES, label: "الإيرادات" },
  { match: "/stock", label: "المخزون" },
  { match: "/operations/items", label: "سجل حركة الأصناف" },
  { match: "/operations", label: "العمليات" },
  { match: ROUTES.REPORTS, label: "التقارير" },
  { match: ROUTES.SETTINGS, label: "النظام" },
];

// ─── Resolve a readable label for any pathname ───────────────────────────────
function resolvePathLabel(pathname) {
  if (!pathname || pathname === "/" || pathname === "/dashboard") return "الرئيسية";
  // Check EXTRA_BREADCRUMB_PARENTS first for specific labels
  for (const entry of EXTRA_BREADCRUMB_PARENTS) {
    if (entry.match.test(pathname)) {
      const current = entry.current;
      if (current) return current;
      const parents = entry.parents || (entry.parent ? [entry.parent] : []);
      if (parents.length) return parents[parents.length - 1].label;
    }
  }
  // Fall back to routeLabelMatchers
  const match = routeLabelMatchers.find((e) => pathname.startsWith(e.match));
  return match?.label || null;
}

export default function Topbar() {
  const _logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const items = useNotificationStore((state) => state.items);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const openGlobalSearch = useUiStore((state) => state.openGlobalSearch);
  const dynamicBreadcrumb = useUiStore((state) => state.dynamicBreadcrumb);
  const settings = useAppSettingsStore((state) => state.settings);
  const location = useLocation();
  const navigate = useNavigate();
  const { togglePageTour, isTourVisible, activeTourPageKey } = useHelpStore();
  const [openBell, setOpenBell] = useState(false);
  const [hoveredCrumb, setHoveredCrumb] = useState(null);
  const bellRef = useRef(null);

  // ── Back-navigation history tracking ──
  // Keep a stack of distinct visited paths to resolve the previous page label.
  const historyStack = useRef([]);

  useEffect(() => {
    const current = location.pathname;
    const stack = historyStack.current;
    if (stack.length === 0 || stack[stack.length - 1] !== current) {
      historyStack.current = [...stack.slice(-9), current];
    }
  }, [location.pathname]);

  const prevPath = historyStack.current.length >= 2
    ? historyStack.current[historyStack.current.length - 2] : null;
  const prevLabel = prevPath ? resolvePathLabel(prevPath) : null;
  const canGoBack = Boolean(prevLabel);

  const handleBack = useCallback(() => {
    if (!canGoBack) return;
    historyStack.current = historyStack.current.slice(0, -1);
    navigate(-1);
  }, [canGoBack, navigate]);

  const currentPageKey = useMemo(() => getHelpPageKey(location.pathname), [location.pathname]);

  const hasHelpContent = currentPageKey && Boolean(helpContent[currentPageKey]);

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `منذ ${Math.max(1, Math.floor(diff / 60))} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short" }).format(new Date(dateStr));
  }

  const unreadItems = useMemo(() => items.filter((n) => !n.is_read).slice(0, 10), [items]);
  const today = useMemo(() => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long" }).format(new Date()), []);
  const currentLabel = routeLabelMatchers.find((entry) => location.pathname.startsWith(entry.match))?.label || "العمل اليومي";
  const breadcrumbs = useBreadcrumbs(location.pathname, dynamicBreadcrumb);

  const notifPollInterval = usePerformanceStore((s) => s.settings.notificationPollInterval);

  useEffect(() => {
    if (!notifPollInterval) return;
    let id = null;
    const start = () => { if (id == null) { fetchNotifications(); id = setInterval(fetchNotifications, notifPollInterval); } };
    const stop = () => { if (id != null) { clearInterval(id); id = null; } };
    const onVisibility = () => { document.hidden ? stop() : start(); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [fetchNotifications, notifPollInterval]);

  useEffect(() => {
    if (!openBell) return;
    function handleClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpenBell(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openBell]);


  useShortcut("global.search", () => openGlobalSearch());

  return (
    <header className="shrink-0 sticky top-0 z-50 px-6 py-4" dir="rtl">
      
      {/* Floating Glass Pill */}
      <div className="flex h-16 items-center justify-between px-4 sm:px-5 backdrop-blur-2xl border border-white/80 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]" style={{ backgroundColor: 'var(--bg-topbar)' }}>
        
        {/* Left: Logo & Breadcrumbs */}
        <div className="flex items-center gap-3 sm:gap-6">
          
          <Link to="/dashboard" className="hidden sm:flex items-center justify-center w-10 h-10 bg-white border border-zinc-200/80 rounded-[14px] shadow-sm shrink-0 transition-transform hover:scale-105 overflow-hidden">
            {settings?.logo_url ? (
              <img src={resolveImageUrl(settings.logo_url)} alt="App Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-white">
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>
            )}
          </Link>

          <div className="hidden sm:block w-px h-6 bg-zinc-200/60" />

          <div className="hidden lg:flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-zinc-900 leading-none mb-1.5">{currentLabel}</h1>
            <span className="text-[11px] font-bold text-zinc-400 tracking-widest">{today}</span>
          </div>

          <div className="hidden lg:block w-px h-8 bg-zinc-200/60" />

          {/* Back Navigation Button — always visible; expands to show prev page label when active */}
          <button
            onClick={handleBack}
            disabled={!canGoBack}
            aria-label="رجوع للصفحة السابقة"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: canGoBack ? 7 : 0,
              height: 32,
              minWidth: 32,
              maxWidth: canGoBack ? 220 : 32,
              paddingInline: canGoBack ? 10 : 0,
              overflow: "hidden",
              flexShrink: 0,
              marginInlineEnd: 4,
              border: "1px solid var(--border-normal)",
              borderRadius: 12,
              background: "var(--bg-surface)",
              color: canGoBack ? "var(--text-secondary)" : "var(--text-muted)",
              opacity: canGoBack ? 1 : 0.4,
              cursor: canGoBack ? "pointer" : "default",
              transition: "max-width 260ms cubic-bezier(0.4,0,0.2,1), padding 260ms cubic-bezier(0.4,0,0.2,1), gap 260ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease, color 150ms ease",
            }}
          >
            {/* Icon — always centered when pill is collapsed */}
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, flexShrink: 0 }}>
              <ArrowRight strokeWidth={2.2} style={{ width: 15, height: 15 }} />
            </span>
            {/* Label — fades in after width opens */}
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              opacity: canGoBack ? 1 : 0,
              transition: "opacity 180ms ease 80ms",
              lineHeight: 1,
              letterSpacing: "-0.01em",
              paddingInlineEnd: 2,
            }}>
              {prevLabel || ""}
            </span>
          </button>

          <div className="flex items-center gap-1.5" onMouseLeave={() => setHoveredCrumb(null)}>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-zinc-300 font-light text-sm mx-1 shrink-0 select-none"
                    >
                      /
                    </motion.div>
                  )}
                  {crumb.path && !isLast ? (
                    <Link
                      to={crumb.path}
                      onMouseEnter={() => setHoveredCrumb(i)}
                      className="relative px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors rounded-lg z-10"
                    >
                      {hoveredCrumb === i && (
                        <motion.div 
                          layoutId="crumb-hover"
                          className="absolute inset-0 bg-zinc-100 rounded-lg -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10">{crumb.label}</span>
                    </Link>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white shadow-md border border-white/20"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                      <span className="text-xs font-black tracking-wide">{crumb.label}</span>
                    </motion.div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Center/Right: Actions */}
        <div className="flex items-center gap-3">
          
          <button 
            onClick={openGlobalSearch} 
            className="group flex items-center gap-2.5 rounded-xl bg-zinc-50/50 border border-zinc-200/60 px-4 py-2 hover:bg-white hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <Search strokeWidth={2} className="h-4 w-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
            <span className="hidden md:block text-xs font-bold text-zinc-400 group-hover:text-zinc-600 transition-colors">بحث</span>
            <ShortcutKbd id="global.search" className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-mono font-black text-zinc-400 bg-zinc-100 border border-zinc-200 rounded" />
          </button>

          {/* Profit Toggle — only on POS page */}
          {location.pathname.startsWith("/pos") && (() => {
            const showProfit = (() => { try { return localStorage.getItem("retailer.pos.showProfit") === "true"; } catch { return false; } })();
            return (
              <button
                onClick={() => {
                  const next = !showProfit;
                  try { localStorage.setItem("retailer.pos.showProfit", String(next)); } catch {}
                  window.dispatchEvent(new CustomEvent("pos:toggleProfit", { detail: { show: next } }));
                }}
                title={showProfit ? "إخفاء عمود الربح" : "إظهار عمود الربح"}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                  showProfit
                    ? "bg-primary text-white shadow-lg"
                    : "bg-zinc-50/50 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:shadow-sm"
                }`}
              >
                <TrendingUp strokeWidth={2} className="h-4.5 w-4.5" />
              </button>
            );
          })()}

          {/* Help Button — toggles tour for this page on/off */}
          {hasHelpContent && (
            <button
              onClick={() => currentPageKey && togglePageTour(currentPageKey)}
              title={isTourVisible && activeTourPageKey === currentPageKey ? 'إيقاف المساعدة' : 'ابدأ جولة هذه الصفحة'}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                isTourVisible && activeTourPageKey === currentPageKey
                  ? "bg-primary text-white shadow-lg"
                  : "bg-zinc-50/50 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:shadow-sm"
              }`}
            >
              <HelpCircle strokeWidth={2} className="h-4.5 w-4.5" />
            </button>
          )}

          {/* Assistant & Support launcher */}
          <button
            onClick={() => useAssistantStore.getState().open("assistant")}
            title="المساعد والدعم"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50/50 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:shadow-sm transition-all"
          >
            <Bot strokeWidth={2} className="h-4.5 w-4.5" />
          </button>

          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setOpenBell(!openBell)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                openBell ? "bg-primary text-white shadow-lg" : "bg-zinc-50/50 border border-zinc-200/60 text-zinc-600 hover:bg-white hover:shadow-sm"
              }`}
            >
              <Bell strokeWidth={2} className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-white text-[9px] font-black text-white shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {openBell && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="absolute end-0 top-12 z-50 w-[340px] rounded-[1.5rem] border border-zinc-200/80 bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 bg-zinc-50/30">
                    <span className="text-sm font-black text-zinc-900 tracking-tight">التنبيهات</span>
                    {unreadItems.length > 0 && (
                      <button onClick={() => { markAllAsRead(); setOpenBell(false); }} className="text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-accent transition-colors bg-white px-2 py-1 rounded-md border border-zinc-200 shadow-sm">
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-[320px] overflow-y-auto">
                    {unreadItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                        <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center border border-zinc-100">
                          <Bell className="w-5 h-5 text-zinc-300" />
                        </div>
                        <p className="text-xs font-bold text-zinc-400">صندوق الإشعارات فارغ</p>
                      </div>
                    ) : (
                      unreadItems.map((notif) => (
                        <div
                          key={notif.id}
                          className="group relative flex cursor-pointer items-start gap-3 border-b border-zinc-50 px-5 py-4 hover:bg-zinc-50 transition-colors"
                          onClick={() => {
                            markAsRead(notif.id);
                            setOpenBell(false);
                            // If the link already points to history with a log_id, use it directly
                            if (notif.link?.startsWith("/history")) {
                              navigate(notif.link);
                            } else {
                              // Otherwise navigate to history and let it find the closest audit log by time
                              navigate(`/history?notif_id=${notif.id}`);
                            }
                          }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 scale-y-0 group-hover:scale-y-100 origin-center transition-transform" />
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="truncate text-sm font-black text-zinc-900 leading-tight">
                              {notif.emoji ? `${notif.emoji} ` : ""}{notif.title}
                            </p>
                            {notif.body && <p className="mt-1 line-clamp-2 text-[11px] font-bold text-zinc-500 leading-relaxed">{notif.body}</p>}
                            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">{timeAgo(notif.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="border-t border-zinc-100 p-2 bg-zinc-50/50">
                    <button onClick={() => { setOpenBell(false); navigate("/notifications"); }} className="w-full py-2.5 text-xs font-black text-zinc-500 hover:text-zinc-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-zinc-200">
                      عرض جميع الإشعارات
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile / Logout Pill */}
          <div className="flex items-center gap-1 bg-zinc-50/50 border border-zinc-200/60 rounded-xl p-1 shadow-sm">
            <span className="hidden sm:block text-xs font-black text-zinc-800 px-2 truncate max-w-[100px]">
              {user?.name?.split(" ")[0] || "User"}
            </span>
            <button
              onClick={() => useQuitOrLogoutStore.getState().showModal('topbar')}
              title="تسجيل الخروج"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-primary hover:text-white hover:shadow-sm transition-all group"
            >
              <LogOut strokeWidth={2} className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
