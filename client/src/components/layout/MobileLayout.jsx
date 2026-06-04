import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Home, Layers3, ReceiptText, Search, ShoppingCart } from "lucide-react";
import { useNotificationStore } from "../../stores/notificationStore";
import { useUiStore } from "../../stores/uiStore";
import PageWrapper from "../ui/PageWrapper";

const bottomNav = [
  { to: "/dashboard", label: "الرئيسية", Icon: Home },
  { to: "/pos", label: "نقطة البيع", Icon: ShoppingCart },
  { to: "/payments", label: "الفواتير", Icon: ReceiptText },
  { to: "/settings", label: "المزيد", Icon: Layers3 },
];

export default function MobileLayout({ children, branding }) {
  const location = useLocation();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const openGlobalSearch = useUiStore((state) => state.openGlobalSearch);

  return (
    <div className="flex min-h-screen flex-col text-text-primary">
      <header className="glass-panel sticky top-0 z-40 mx-3 mt-3 flex items-center justify-between gap-3 px-4 py-3" style={{ background: "var(--bg-topbar)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div>
          {branding?.logoUrl && branding?.showOnSidebar ? (
            <img
              src={branding.logoUrl}
              alt={branding?.title || "Logo"}
              className="mb-1 h-8 max-w-[8rem] rounded-md object-contain"
            />
          ) : null}
          <div className="text-xs uppercase tracking-[0.25em] text-text-secondary">{branding?.title || "ElHegazi Retailer"}</div>
          <div className="text-base font-bold">{branding?.subtitle || "Retailer Suite"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-icon text-text-secondary" onClick={openGlobalSearch}>
            <Search className="h-5 w-5" />
          </button>
          <Link to="/notifications" className="btn-icon relative text-text-secondary">
            <Bell className={`h-5 w-5 ${unreadCount > 0 ? "animate-bell-ring text-warning-DEFAULT" : ""}`} />
            {unreadCount > 0 && (
              <span className="badge-pulse absolute -end-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-DEFAULT px-1 text-[11px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-24 pt-4">
        <PageWrapper>{children}</PageWrapper>
      </main>

      <nav className="glass-elevated fixed inset-x-3 bottom-3 z-50 flex items-end justify-around rounded-[24px] px-2 py-2" style={{ background: "var(--bg-topbar)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        {bottomNav.map(({ to, label, Icon }) => {
          const active = location.pathname === to;
          const isPos = to === "/pos";
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center transition-all duration-200 ${
                active
                  ? isPos
                    ? "-translate-y-2 bg-primary text-white shadow-glow"
                    : "text-primary"
                  : "text-text-secondary"
              }`}
              style={!active ? { background: "transparent" } : to === "/settings" ? { background: "var(--primary-50)" } : undefined}
            >
              <span className={`flex ${isPos ? "h-11 w-11 rounded-full border border-white/10" : "h-9 w-9"} items-center justify-center ${active && isPos ? "bg-white/10" : ""}`}>
                <Icon className={`transition-transform ${isPos ? "h-7 w-7" : "h-5 w-5"} ${active ? "scale-110" : ""}`} />
              </span>
              <span className="text-[11px] font-medium">{label}</span>
              {active ? <span className="absolute inset-x-4 -top-1 h-0.5 rounded-full bg-primary/80" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
