import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, PieChart, Database, Box, Users, Building,
  Warehouse, ShoppingCart, ReceiptText, CircleDollarSign,
  Wallet, TrendingDown, TrendingUp, Receipt, ArrowRightLeft,
  Settings, LogOut, Radar, ChevronDown, Search, PackageSearch,
  FileSpreadsheet, Boxes, ClipboardList, Landmark, Tags, ShieldCheck,
  Activity, UsersRound, Scale, Menu, ChevronLeft, Truck, Coins, Store, ClipboardCheck,
  BadgePercent, Banknote, HeartHandshake, Briefcase, Fingerprint, CreditCard,
  ArrowUpCircle
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { useCanView } from "../../hooks/usePermission";
import { useUpdateStore } from "../../stores/updateStore";


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
    const base = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
    fetch(`${base}/api/categories`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.data)) setCount(d.data.length); })
      .catch(() => {});
  }, []);
  return count;
}

function PopoverMenu({ module, onItemClick, onMouseEnter, onMouseLeave, updateAvailable }) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute top-0 right-full ml-2 z-50 w-52 rounded-xl border border-zinc-200/80 bg-white py-2 shadow-[0_4px_6px_rgba(15,23,42,0.05),0_12px_40px_rgba(15,23,42,0.08)] animate-in fade-in slide-in-from-left-2 duration-200"
    >
      <div className="px-4 py-2 text-[11px] font-black tracking-wider text-emerald-600 uppercase">{module.title}</div>
      <div className="border-t border-zinc-100 mx-2 my-1" />
      {module.items.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onItemClick}
          className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <div className="relative shrink-0">
            <item.icon className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
            {item.pageKey === "updates" && updateAvailable && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </div>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Sidebar({ collapsed, setCollapsed, branding }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateAvailable = useUpdateStore((state) => state.available);
  const logout = useAuthStore((state) => state.logout);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredModule, setHoveredModule] = useState(null);
  const hoverTimeout = useRef(null);
  const categoryCount = useCategoryCount();
  const canView = usePermissionFilter();

  const PRIMARY_MENU = [
    { path: "/dashboard", label: "مساحة العمل", icon: LayoutDashboard, pageKey: "dashboard" },
    { path: "/pos", label: "نقطة البيع (POS)", icon: Store, highlight: true, pageKey: "pos" },
    { path: "/daily-treasury", label: "الخزينة اليومية", icon: Wallet, pageKey: "daily_treasury" },
    { path: "/analytics", label: "التحليلات والمبيعات", icon: Activity, pageKey: "analytics" },
  ];

  const NAV_MODULES = [
    {
      title: "المبيعات والمشتريات", id: "trade", icon: ShoppingCart,
      items: [
        { path: "/purchases", label: "فواتير المشتريات", icon: PackageSearch, pageKey: "purchases" },
        { path: "/purchases/orders", label: "أوامر الشراء", icon: ClipboardList, pageKey: "purchase_orders" },
        { path: "/purchases/returns", label: "مرتجع المشتريات", icon: ArrowRightLeft, pageKey: "purchase_returns" },
        { path: "/sales/returns", label: "مرتجع المبيعات", icon: ReceiptText, pageKey: "sales_returns" },
        { path: "/operations/branch-transfer", label: "نقل المخزون", icon: Truck, pageKey: "branch_transfer" },
        { path: "/operations/quotations", label: "عروض الأسعار", icon: Receipt, pageKey: "quotations" },
      ],
    },
    {
      title: "الخزينة والمالية", id: "finance", icon: CircleDollarSign,
      items: [
        { path: "/accounts/customers", label: "حسابات العملاء", icon: HeartHandshake, pageKey: "customer_accounts" },
        { path: "/accounts/suppliers", label: "حسابات الموردين", icon: Building, pageKey: "supplier_accounts" },
        { path: "/operations/installments", label: "الأقساط والآجل", icon: Coins, pageKey: "installments" },
        { path: "/revenues", label: "تسجيل الإيرادات", icon: TrendingUp, pageKey: "revenues" },
        { path: "/expenses", label: "تسجيل المصروفات", icon: TrendingDown, pageKey: "expenses" },
        { path: "/withdrawals", label: "تسجيل المسحوبات", icon: Banknote, pageKey: "withdrawals" },
        { path: "/operations/payment-methods", label: "وسائل الدفع", icon: CreditCard, pageKey: "payment_methods" },
        { path: "/operations/bank-operations", label: "البنوك والفيزا", icon: Landmark, pageKey: "bank_operations" },
        { path: "/operations/cheques", label: "إدارة الشيكات", icon: Banknote, pageKey: "cheques" },
      ],
    },
    {
      title: "المخازن والأصناف", id: "inventory", icon: Boxes,
      items: [
        { path: "/definitions/items", label: "قاعدة الأصناف", icon: Box, pageKey: "items" },
        { path: "/definitions/categories", label: "أقسام الأصناف", icon: Tags, pageKey: "categories" },
        { path: "/operations/bulk-price-update", label: "تحديث الأسعار", icon: TrendingUp, pageKey: "bulk_price_update" },
        { path: "/stock/transfer", label: "تحويل مخزني", icon: ArrowRightLeft, pageKey: "stock_transfer" },
        { path: "/stock/physical-count", label: "الجرد الفعلي", icon: FileSpreadsheet, pageKey: "physical_count" },
        { path: "/definitions/promotions", label: "العروض والتخفيضات", icon: BadgePercent, pageKey: "promotions" },
      ],
    },
    {
      title: "تعريفات أساسية", id: "definitions", icon: Database,
      items: [
        { path: "/definitions/branches", label: "الفروع", icon: Store, pageKey: "branches" },
        { path: "/definitions/customers", label: "العملاء", icon: UsersRound, pageKey: "customers" },
        { path: "/definitions/suppliers", label: "الموردين", icon: Briefcase, pageKey: "suppliers" },
        { path: "/definitions/warehouses", label: "المخازن", icon: Warehouse, pageKey: "warehouses" },
        { path: "/definitions/banks", label: "البنوك", icon: Landmark, pageKey: "banks" },
        { path: "/definitions/units", label: "وحدات القياس", icon: Scale, pageKey: "units" },
        { path: "/definitions/financial-categories", label: "أقسام الحركات المالية", icon: Banknote, pageKey: "financial_categories" },
      ],
    },
    {
      title: "إدارة النظام", id: "system", icon: ShieldCheck,
      items: [
        { path: "/reports/center", label: "مركز التقارير", icon: PieChart, pageKey: "reports" },
        { path: "/definitions/users", label: "المستخدمين", icon: Fingerprint, pageKey: "users" },
        { path: "/definitions/employees", label: "الموظفين", icon: UsersRound, pageKey: "employees" },
        { path: "/settings", label: "الإعدادات العامة", icon: Settings, pageKey: "settings" },
        { path: "/updates", label: t('nav.updates'), icon: ArrowUpCircle, pageKey: "updates" },
        { path: "/history", label: "سجل النشاط", icon: ClipboardCheck, pageKey: "history" },
      ],
    },
  ];

  const visiblePrimary = PRIMARY_MENU.filter((item) => canView(item.pageKey));

  const filteredModules = NAV_MODULES.map((module) => {
    const permittedItems = module.items.filter((item) => canView(item.pageKey));
    if (!searchQuery) return { ...module, items: permittedItems };
    const query = searchQuery.toLowerCase();
    if (module.title.toLowerCase().includes(query)) return { ...module, items: permittedItems };
    const items = permittedItems.filter((item) => item.label.toLowerCase().includes(query));
    return { ...module, items };
  }).filter((module) => module.items.length > 0);

  useEffect(() => {
    if (searchQuery || collapsed) return;
    const activeModule = NAV_MODULES.find((module) =>
      module.items.some((item) => item.path === location.pathname || (location.pathname.startsWith(item.path) && item.path !== "/")),
    );
    if (activeModule) setActiveAccordion(activeModule.id);
  }, [location.pathname, searchQuery, collapsed]);

  const handleModuleClick = useCallback((moduleId) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setActiveAccordion((prev) => (prev === moduleId ? null : moduleId));
  }, [collapsed, setCollapsed]);

  const handleModuleHover = useCallback((module) => {
    if (!collapsed) return;
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setHoveredModule(module);
    }, 300);
  }, [collapsed]);

  const handleModuleLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setHoveredModule(null);
  }, []);

  useEffect(() => {
    return () => clearTimeout(hoverTimeout.current);
  }, []);

  return (
    <aside
      data-app-sidebar="true"
      className={`relative z-40 flex shrink-0 h-screen flex-col border-l border-zinc-200/60 bg-white transition-all duration-300 ease-out ${collapsed ? "w-[72px]" : "w-[220px]"}`}
      dir="rtl"
    >
      <div className={`flex items-center justify-between border-b border-zinc-100 ${collapsed ? "px-3 py-5 justify-center" : "px-5 py-5"}`}>
        <div className="flex items-center gap-3">
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
          {!collapsed && (
            <div>
              <h2 className="text-[16px] font-black tracking-tight text-zinc-900 leading-none truncate max-w-[130px]">{branding?.title || "نظام الحجازي"}</h2>
              <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mt-1 truncate max-w-[130px]">{branding?.subtitle || "إدارة التجزئة"}</div>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors ${collapsed ? "absolute -left-[14px] top-5 bg-white shadow-md border border-zinc-200 z-50 h-7 w-7 rounded-full text-zinc-900" : ""}`}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-none">
        {!collapsed && (
          <div className="relative mb-5">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في القوائم..."
              className="w-full rounded-lg bg-zinc-50 border border-zinc-200/60 py-2 pl-2.5 pr-8 text-[12px] font-semibold text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none transition-all"
            />
          </div>
        )}

        <div className="space-y-1 mb-6">
          {visiblePrimary.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm"
                    : item.highlight
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <item.icon strokeWidth={isActive ? 2 : 1.5} className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
                {!collapsed && <span className={`text-[12px] ${isActive ? "font-black" : "font-bold"}`}>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className="space-y-0.5">
          {filteredModules.map((module) => {
            const isExpanded = searchQuery.length > 0 || activeAccordion === module.id;
            const hasActiveItem = module.items.some(
              (item) => location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/"),
            );

            return (
              <div key={module.id} className="relative">
                <button
                  onClick={() => handleModuleClick(module.id)}
                  onMouseEnter={() => handleModuleHover(module)}
                  onMouseLeave={handleModuleLeave}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 transition-all ${
                    isExpanded || hasActiveItem
                      ? "text-zinc-900 bg-zinc-50/80"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  } ${collapsed ? "justify-center px-0 py-2.5" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <module.icon strokeWidth={1.5} className={`h-[17px] w-[17px] shrink-0 ${hasActiveItem ? "text-emerald-600" : isExpanded ? "text-zinc-900" : "text-zinc-400"}`} />
                    {!collapsed && <span className={`text-[12px] ${isExpanded || hasActiveItem ? "font-black" : "font-bold"}`}>{module.title}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180 text-zinc-900" : "text-zinc-400"}`} />
                  )}
                </button>

                {collapsed && hoveredModule?.id === module.id && (
                  <PopoverMenu
                    module={module}
                    onItemClick={() => setHoveredModule(null)}
                    onMouseEnter={() => {
                      clearTimeout(hoverTimeout.current);
                      setHoveredModule(module);
                    }}
                    onMouseLeave={() => setHoveredModule(null)}
                    updateAvailable={updateAvailable}
                  />
                )}

                {!collapsed && (
                  <div
                    className={`grid transition-all duration-200 ease-out ${
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col relative pr-6 pl-2 py-1">
                        <div className="absolute right-[18px] top-2 bottom-2 w-[2px] bg-zinc-100 rounded-full" />
                        {module.items.map((item) => {
                          const isItemActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`relative flex items-center justify-between gap-2 rounded-md px-3 py-1.5 transition-all ${
                                isItemActive
                                  ? "text-zinc-900 font-black bg-zinc-50"
                                  : "text-zinc-500 hover:text-zinc-900 font-semibold"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isItemActive && (
                                  <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 w-1 h-3.5 bg-emerald-500 rounded-full shadow-sm" />
                                )}
                                <span className="text-[11.5px]">{item.label}</span>
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
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={`border-t border-zinc-100 ${collapsed ? "p-2" : "p-3"}`}>
        <div className={`flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 ${collapsed ? "flex-col gap-1.5 p-1.5" : "p-1.5"}`}>
          <Link to="/settings" className={`flex items-center gap-2.5 ${collapsed ? "" : "px-2"}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors">
              <Settings strokeWidth={1.5} className="h-3.5 w-3.5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-zinc-900 truncate max-w-[90px]">{user?.name || "مدير النظام"}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">Admin</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut strokeWidth={1.5} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
