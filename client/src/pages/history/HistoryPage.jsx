import React, { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search, X, ChevronRight, ChevronLeft, SlidersHorizontal, Lock } from "lucide-react";
import api from "../../services/api";
import PageWrapper from "../../components/ui/PageWrapper";
import { useAuthStore } from "../../stores/authStore";

const ACTION_OPTIONS = [
  { value: "", label: "كل الإجراءات" },
  { value: "create", label: "إنشاء" },
  { value: "edit", label: "تعديل" },
  { value: "void", label: "إلغاء" },
  { value: "cancel", label: "رفض" },
  { value: "login", label: "تسجيل دخول" },
  { value: "delete", label: "حذف" },
  { value: "transfer", label: "تحويل" },
  { value: "adjust", label: "تسوية" },
];

const ACTION_LABELS = {
  create: "إنشاء", edit: "تعديل", update: "تحديث", void: "إلغاء",
  cancel: "رفض", login: "دخول", delete: "حذف", transfer: "تحويل",
  adjust: "تسوية", amend: "تعديل",
};

const ACTION_COLORS = {
  create: "bg-emerald-50 text-emerald-700",
  edit: "bg-blue-50 text-blue-700",
  update: "bg-blue-50 text-blue-700",
  void: "bg-red-50 text-red-700",
  cancel: "bg-red-50 text-red-700",
  delete: "bg-red-50 text-red-700",
  login: "bg-violet-50 text-violet-700",
  transfer: "bg-amber-50 text-amber-700",
  adjust: "bg-amber-50 text-amber-700",
  amend: "bg-blue-50 text-blue-700",
};

const RESOURCE_OPTIONS = [
  { value: "", label: "كل الأقسام" },
  { value: "invoices", label: "الفواتير" },
  { value: "purchases", label: "المشتريات" },
  { value: "stock", label: "المخزون" },
  { value: "payments", label: "المدفوعات" },
  { value: "settings", label: "الإعدادات" },
  { value: "users", label: "المستخدمين" },
  { value: "auth", label: "المصادقة" },
  { value: "returns", label: "المرتجعات" },
  { value: "expenses", label: "المصروفات" },
  { value: "revenues", label: "الإيرادات" },
  { value: "customers", label: "العملاء" },
  { value: "suppliers", label: "الموردين" },
  { value: "items", label: "الأصناف" },
];

const RESOURCE_LABELS = {
  invoices: "الفواتير", purchases: "المشتريات", stock: "المخزون",
  payments: "المدفوعات", settings: "الإعدادات", users: "المستخدمين",
  auth: "المصادقة", returns: "المرتجعات", shifts: "الورديات",
  "purchase-orders": "أوامر الشراء", expenses: "المصروفات", revenues: "الإيرادات",
  categories: "الفئات", reports: "التقارير", customers: "العملاء",
  suppliers: "الموردين", warehouses: "المستودعات", items: "الأصناف",
  treasuries: "الخزائن", banks: "البنوك", employees: "الموظفين",
  loyalty: "برنامج الولاء", promotions: "العروض", cheques: "الشيكات",
  expenseCategories: "فئات المصروفات", revenueCategories: "فئات الإيرادات",
  branches: "الفروع", warehouses: "المستودعات", units: "الوحدات",
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SkeletonRow({ style }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[oklch(0.92_0.005_278)]" style={style}>
      <div className="h-9 w-9 rounded-xl bg-[oklch(0.93_0.008_278)] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[oklch(0.93_0.008_278)] rounded-full animate-pulse w-3/4" />
        <div className="h-3 bg-[oklch(0.95_0.005_278)] rounded-full animate-pulse w-1/3" />
      </div>
      <div className="h-3 w-24 bg-[oklch(0.95_0.005_278)] rounded-full animate-pulse" />
      <div className="h-3 w-20 bg-[oklch(0.95_0.005_278)] rounded-full animate-pulse" />
    </div>
  );
}

function LogRow({ log, index }) {
  const resourceLabel = RESOURCE_LABELS[log.resource] || log.resource;
  const actionLabel = ACTION_LABELS[log.action] || log.action;
  const actionColor = ACTION_COLORS[log.action] || "bg-zinc-100 text-zinc-600";
  const initial = (log.username || log.full_name || "؟")[0]?.toUpperCase();

  return (
    <div
      className="log-row group flex items-center gap-4 px-6 py-4 border-b border-[oklch(0.935_0.005_278)] hover:bg-[oklch(0.965_0.01_278)] transition-all duration-150 cursor-default"
      style={{ "--row-index": index, animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Icon circle */}
      <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-[oklch(0.94_0.018_278)] flex items-center justify-center text-base select-none">
        {log.description?.match(/^\p{Emoji}/u)?.[0] || "📋"}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[oklch(0.22_0.01_278)] leading-snug line-clamp-1">
          {log.description
            ? log.description.replace(/^\p{Emoji}\s*/u, "")
            : `${actionLabel}${resourceLabel ? ` · ${resourceLabel}` : ""}`}
        </p>
        {log.resource && (
          <p className="text-xs text-[oklch(0.52_0.02_278)] mt-0.5">{resourceLabel}</p>
        )}
      </div>

      {/* Action badge */}
      {log.action && (
        <span className={`hidden sm:inline-flex flex-shrink-0 items-center rounded-lg px-2 py-0.5 text-xs font-bold ${actionColor}`}>
          {actionLabel}
        </span>
      )}

      {/* Actor */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <div className="h-6 w-6 rounded-full bg-[oklch(0.47_0.14_278)] flex items-center justify-center text-white text-[10px] font-black">
          {initial}
        </div>
        <span className="hidden md:block text-xs font-medium text-[oklch(0.45_0.02_278)] whitespace-nowrap">
          {log.username || log.full_name || "—"}
        </span>
      </div>

      {/* Timestamp */}
      <time
        dir="ltr"
        className="flex-shrink-0 text-xs font-mono text-[oklch(0.55_0.015_278)] whitespace-nowrap"
      >
        {log.created_at
          ? new Intl.DateTimeFormat("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(log.created_at))
          : "—"}
      </time>
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="filter-chip-in inline-flex items-center gap-1 rounded-full bg-[oklch(0.47_0.14_278)] px-2.5 py-1 text-xs font-bold text-white">
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function HistoryPage() {
  const { user, permissions } = useAuthStore();

  const canView =
    user?.role === "dev" ||
    user?.role === "admin" ||
    (Array.isArray(permissions?.history) && permissions.history.includes("view"));

  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = useDebounce(searchInput, 400);

  useEffect(() => { setPage(1); }, [search, from, to, userId, action, resource]);

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
    enabled: canView,
  });
  const users = usersData?.data || usersData || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", search, from, to, userId, action, resource, page],
    queryFn: () =>
      api.get("/api/audit-logs", {
        params: {
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
          user_id: userId || undefined,
          action: action || undefined,
          resource: resource || undefined,
          page,
          per_page: 50,
        },
      }).then((r) => r.data),
    enabled: canView,
    keepPreviousData: true,
  });

  const logs = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.pages || 1;

  const activeChips = [
    search && { label: `"${search}"`, clear: () => setSearchInput("") },
    from && { label: `من ${from}`, clear: () => setFrom("") },
    to && { label: `إلى ${to}`, clear: () => setTo("") },
    userId && { label: users.find(u => String(u.id) === userId)?.username || "مستخدم", clear: () => setUserId("") },
    action && { label: ACTION_LABELS[action] || action, clear: () => setAction("") },
    resource && { label: RESOURCE_LABELS[resource] || resource, clear: () => setResource("") },
  ].filter(Boolean);

  const clearAll = useCallback(() => {
    setSearchInput(""); setFrom(""); setTo(""); setUserId(""); setAction(""); setResource(""); setPage(1);
  }, []);

  if (!canView) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[oklch(0.94_0.018_278)] flex items-center justify-center">
            <Lock className="h-8 w-8 text-[oklch(0.47_0.14_278)]" />
          </div>
          <h2 className="text-xl font-black text-[oklch(0.22_0.01_278)]">غير مصرح</h2>
          <p className="text-sm text-[oklch(0.52_0.02_278)]">ليس لديك صلاحية لعرض سجل النشاط.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="max-w-7xl mx-auto px-4 py-6" dir="rtl">
      <style>{`
        @keyframes row-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chip-in {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        .log-row {
          animation: row-in 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--row-delay, 0ms);
        }
        .filter-chip-in {
          animation: chip-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .log-row, .filter-chip-in { animation: none; }
        }
      `}</style>

      {/* Zone header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[oklch(0.47_0.14_278)] flex items-center justify-center shadow-sm">
              <History className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[oklch(0.22_0.01_278)] leading-none">سجل النشاط</h1>
              <p className="text-xs text-[oklch(0.52_0.02_278)] mt-1">
                {total > 0 ? `${total.toLocaleString("ar-EG")} حدث مسجّل` : "تتبع جميع العمليات في النظام"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setFiltersOpen(f => !f)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-200 ${
              filtersOpen || activeChips.length > 0
                ? "bg-[oklch(0.47_0.14_278)] text-white"
                : "bg-[oklch(0.94_0.018_278)] text-[oklch(0.47_0.14_278)] hover:bg-[oklch(0.90_0.025_278)]"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            تصفية
            {activeChips.length > 0 && (
              <span className="h-4 w-4 rounded-full bg-white text-[oklch(0.47_0.14_278)] text-[10px] font-black flex items-center justify-center">
                {activeChips.length}
              </span>
            )}
          </button>
        </div>

        {/* Search always visible */}
        <div className="mt-4 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[oklch(0.60_0.02_278)] pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="ابحث في الأحداث..."
            className="w-full rounded-xl border border-[oklch(0.88_0.015_278)] bg-white py-2.5 pr-10 pl-4 text-sm font-medium text-[oklch(0.22_0.01_278)] placeholder:text-[oklch(0.65_0.015_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.47_0.14_278)]/20 transition-all"
          />
          {searchInput && (
            <button onClick={() => setSearchInput("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.60_0.02_278)] hover:text-[oklch(0.35_0.05_278)] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded filters */}
      {filtersOpen && (
        <div className="mb-4 rounded-2xl border border-[oklch(0.88_0.015_278)] bg-white p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)] mb-1.5">من</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full rounded-lg border border-[oklch(0.88_0.015_278)] bg-[oklch(0.975_0.005_278)] px-3 py-1.5 text-xs font-medium text-[oklch(0.22_0.01_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)] mb-1.5">إلى</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full rounded-lg border border-[oklch(0.88_0.015_278)] bg-[oklch(0.975_0.005_278)] px-3 py-1.5 text-xs font-medium text-[oklch(0.22_0.01_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)] mb-1.5">المستخدم</label>
            <select value={userId} onChange={e => setUserId(e.target.value)}
              className="w-full rounded-lg border border-[oklch(0.88_0.015_278)] bg-[oklch(0.975_0.005_278)] px-3 py-1.5 text-xs font-medium text-[oklch(0.22_0.01_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none">
              <option value="">الكل</option>
              {Array.isArray(users) && users.map(u => (
                <option key={u.id} value={u.id}>{u.username || u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)] mb-1.5">الإجراء</label>
            <select value={action} onChange={e => setAction(e.target.value)}
              className="w-full rounded-lg border border-[oklch(0.88_0.015_278)] bg-[oklch(0.975_0.005_278)] px-3 py-1.5 text-xs font-medium text-[oklch(0.22_0.01_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none">
              {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)] mb-1.5">القسم</label>
            <select value={resource} onChange={e => setResource(e.target.value)}
              className="w-full rounded-lg border border-[oklch(0.88_0.015_278)] bg-[oklch(0.975_0.005_278)] px-3 py-1.5 text-xs font-medium text-[oklch(0.22_0.01_278)] focus:border-[oklch(0.47_0.14_278)] focus:outline-none">
              {RESOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeChips.map((chip, i) => (
            <FilterChip key={i} label={chip.label} onRemove={chip.clear} />
          ))}
          <button onClick={clearAll} className="text-xs font-bold text-[oklch(0.52_0.02_278)] hover:text-[oklch(0.35_0.05_278)] transition-colors">
            مسح الكل
          </button>
        </div>
      )}

      {/* Feed */}
      <div className="rounded-2xl border border-[oklch(0.88_0.015_278)] bg-white overflow-hidden">
        {/* Feed header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[oklch(0.92_0.005_278)] bg-[oklch(0.975_0.005_278)]">
          <span className="text-[10px] font-black uppercase tracking-widest text-[oklch(0.55_0.03_278)]">الأحداث</span>
          {isFetching && !isLoading && (
            <span className="text-[10px] font-bold text-[oklch(0.47_0.14_278)] animate-pulse">تحديث...</span>
          )}
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[oklch(0.94_0.018_278)] flex items-center justify-center text-2xl">
              📭
            </div>
            <p className="text-sm font-bold text-[oklch(0.45_0.02_278)]">لا يوجد نشاط في هذه الفترة</p>
            {activeChips.length > 0 && (
              <button onClick={clearAll} className="text-xs font-bold text-[oklch(0.47_0.14_278)] hover:underline">
                إزالة الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div>
            {logs.map((log, i) => (
              <LogRow key={log.id} log={log} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-[oklch(0.92_0.005_278)] bg-[oklch(0.975_0.005_278)]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-[oklch(0.47_0.14_278)] hover:bg-[oklch(0.94_0.018_278)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              السابق
            </button>
            <span className="text-xs font-black text-[oklch(0.35_0.05_278)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-[oklch(0.47_0.14_278)] hover:bg-[oklch(0.94_0.018_278)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              التالي
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
