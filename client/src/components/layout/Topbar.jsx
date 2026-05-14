import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, LayoutGrid, Coins } from "lucide-react";
import { useNotificationStore } from "../../stores/notificationStore";
import { useUiStore } from "../../stores/uiStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { ROUTES } from "../../constants/routes";

const routeLabelMatchers = [
  { match: ROUTES.DASHBOARD, label: "لوحة التحكم" },
  { match: ROUTES.POS, label: "نقطة البيع" },
  { match: "/definitions", label: "البيانات الأساسية" },
  { match: ROUTES.PURCHASES, label: "المشتريات" },
  { match: ROUTES.PAYMENTS, label: "المدفوعات والتحصيل" },
  { match: ROUTES.EXPENSES, label: "المصروفات" },
  { match: ROUTES.REVENUES, label: "الإيرادات" },
  { match: "/stock", label: "المخزون" },
  { match: "/operations", label: "العمليات" },
  { match: ROUTES.REPORTS, label: "مركز التقارير" },
  { match: ROUTES.SETTINGS, label: "إعدادات النظام" },
];

export default function Topbar() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const items = useNotificationStore((state) => state.items);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const openGlobalSearch = useUiStore((state) => state.openGlobalSearch);
  const settings = useAppSettingsStore((state) => state.settings);
  const location = useLocation();
  const navigate = useNavigate();
  const [openBell, setOpenBell] = useState(false);
  const bellRef = useRef(null);

  const SAFE_PREFIXES = [
    "/invoices", "/purchases", "/stock", "/suppliers", "/customers",
    "/shifts", "/definitions", "/notifications", "/history", "/reports",
    "/payments", "/expenses",
  ];

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `منذ ${Math.max(1, Math.floor(diff / 60))} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(dateStr));
  }

  const unreadItems = useMemo(
    () => items.filter((n) => !n.is_read).slice(0, 10),
    [items]
  );

  const today = useMemo(() => {
    return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  }, []);

  const currentLabel = routeLabelMatchers.find((entry) => location.pathname.startsWith(entry.match))?.label || "العمل اليومي";

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!openBell) return;
    function handleClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpenBell(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openBell]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); openGlobalSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openGlobalSearch]);

  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-zinc-200/60 bg-white px-6 transition-all z-30 relative">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <LayoutGrid strokeWidth={1.5} className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-[15px] font-black tracking-tight text-zinc-900 leading-none">{currentLabel}</h1>
          <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{today}</p>
        </div>
      </div>

      <button onClick={openGlobalSearch} className="group mx-6 hidden max-w-md flex-1 items-center gap-2.5 rounded-lg bg-zinc-50 border border-zinc-200/60 px-3.5 py-1.5 hover:bg-white hover:border-zinc-300 transition-all md:flex">
        <Search strokeWidth={1.5} className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
        <span className="flex-1 text-right text-[12px] font-bold text-zinc-400 group-hover:text-zinc-600 transition-colors">البحث السريع (Ctrl+K)...</span>
      </button>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-bold text-zinc-600 sm:flex">
          <Coins strokeWidth={1.5} className="h-3.5 w-3.5 text-zinc-400" />
          <span>{settings.currency_symbol || "EGP"}</span>
        </div>

        <div className="relative" ref={bellRef}>
          <button onClick={() => setOpenBell(!openBell)} className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors">
            <Bell strokeWidth={1.5} className={`h-4 w-4 ${unreadCount ? "text-emerald-500" : ""}`} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border-2 border-white text-[8px] font-black text-white">{unreadCount}</span>}
          </button>

          {openBell && (
            <div className="absolute end-0 top-10 z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
                <span className="text-[13px] font-black text-zinc-800">الإشعارات</span>
                {unreadItems.length > 0 && (
                  <button
                    onClick={() => { markAllAsRead(); setOpenBell(false); }}
                    className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {unreadItems.length === 0 ? (
                  <p className="py-8 text-center text-[12px] font-bold text-zinc-400">لا توجد إشعارات جديدة</p>
                ) : (
                  unreadItems.map((notif) => (
                    <div
                      key={notif.id}
                      className="group flex cursor-pointer items-start gap-2.5 border-b border-zinc-50 px-4 py-3 hover:bg-zinc-50 transition-colors"
                      onClick={() => {
                        markAsRead(notif.id);
                        setOpenBell(false);
                        const safe = notif.link && SAFE_PREFIXES.some((p) => notif.link.startsWith(p));
                        if (safe) navigate(notif.link);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[12px] font-black text-zinc-800">
                          {notif.emoji ? `${notif.emoji} ` : ""}{notif.title}
                        </p>
                        {notif.body && (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500">{notif.body}</p>
                        )}
                        <p className="mt-1 text-[10px] font-bold text-zinc-400">{timeAgo(notif.created_at)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                        title="تحديد كمقروء"
                        className="mt-0.5 shrink-0 text-zinc-300 hover:text-emerald-500 transition-colors text-[14px] leading-none"
                      >
                        ✓
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-zinc-100 px-4 py-2.5 text-center">
                <button
                  onClick={() => { setOpenBell(false); navigate("/notifications"); }}
                  className="text-[12px] font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  عرض الكل
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
