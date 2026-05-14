import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { History, Search, ChevronRight, ChevronLeft } from "lucide-react";
import api from "../../services/api";
import PageWrapper from "../../components/ui/PageWrapper";
import { useAuthStore } from "../../stores/authStore";

const ACTION_OPTIONS = [
  { value: "", label: "الكل" },
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
  create: "إنشاء", edit: "تعديل", void: "إلغاء", cancel: "رفض",
  login: "تسجيل دخول", delete: "حذف", transfer: "تحويل", adjust: "تسوية",
  update: "تحديث", amend: "تعديل",
};

const RESOURCE_OPTIONS = [
  { value: "", label: "الكل" },
  { value: "invoices", label: "الفواتير" },
  { value: "purchases", label: "المشتريات" },
  { value: "stock", label: "المخزون" },
  { value: "payments", label: "المدفوعات" },
  { value: "settings", label: "الإعدادات" },
  { value: "users", label: "المستخدمين" },
  { value: "auth", label: "المصادقة" },
  { value: "returns", label: "المرتجعات" },
];

const RESOURCE_LABELS = {
  invoices: "الفواتير", purchases: "المشتريات", stock: "المخزون",
  payments: "المدفوعات", settings: "الإعدادات", users: "المستخدمين",
  auth: "المصادقة", returns: "المرتجعات", shifts: "الورديات",
  "purchase-orders": "أوامر الشراء", expenses: "المصروفات", revenues: "الإيرادات",
};

export default function HistoryPage() {
  const { t } = useTranslation();
  const { user, permissions } = useAuthStore();

  // Permission check
  const canView =
    user?.role === "dev" ||
    user?.role === "admin" ||
    (Array.isArray(permissions?.history) && permissions.history.includes("view"));

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [page, setPage] = useState(1);

  const PER_PAGE = 50;

  // Fetch users for dropdown
  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
    enabled: canView,
  });
  const users = usersData?.data || usersData || [];

  // Fetch audit logs
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", search, from, to, userId, action, resource, page],
    queryFn: () =>
      api
        .get("/api/audit-logs", {
          params: {
            search: search || undefined,
            from: from || undefined,
            to: to || undefined,
            user_id: userId || undefined,
            action: action || undefined,
            resource: resource || undefined,
            page,
            per_page: PER_PAGE,
          },
        })
        .then((r) => r.data),
    enabled: canView,
    keepPreviousData: true,
  });

  const logs = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.pages || 1;

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setUserId("");
    setAction("");
    setResource("");
    setPage(1);
  };

  if (!canView) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-black text-zinc-900 mb-2">غير مصرح</h2>
          <p className="text-zinc-500">ليس لديك صلاحية لعرض سجل النشاط.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="mx-auto max-w-7xl px-4 py-4" dir="rtl">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">سجل النشاط</h1>
            <p className="page-subtitle">تتبع جميع العمليات والتغييرات التي جرت في النظام.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-[20px] p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">بحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في الوصف..."
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* From date */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-sm font-semibold text-zinc-800 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          {/* To date */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-sm font-semibold text-zinc-800 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          {/* User filter */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">المستخدم</label>
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-sm font-semibold text-zinc-800 focus:border-zinc-400 focus:outline-none"
            >
              <option value="">الكل</option>
              {Array.isArray(users) && users.map((u) => (
                <option key={u.id} value={u.id}>{u.username || u.name}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">نوع الإجراء</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-sm font-semibold text-zinc-800 focus:border-zinc-400 focus:outline-none"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Resource filter */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-bold text-zinc-500 mb-1">القسم</label>
            <select
              value={resource}
              onChange={(e) => { setResource(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-sm font-semibold text-zinc-800 focus:border-zinc-400 focus:outline-none"
            >
              {RESOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-black text-white hover:bg-zinc-700 transition-colors"
          >
            بحث
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            إعادة تعيين
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-[20px]">
        {isLoading || isFetching ? (
          <div className="p-10 text-center text-zinc-400 font-bold">جاري التحميل...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-zinc-400 font-bold">لا توجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-wider">الوصف</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-wider">المستخدم</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-wider">القسم</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-zinc-500 uppercase tracking-wider">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-4 py-3 text-zinc-800 font-semibold max-w-xs">
                      {log.description
                        ? <span className="line-clamp-2">{log.description}</span>
                        : <span className="text-zinc-400 text-xs">
                            {ACTION_LABELS[log.action] || log.action || "—"}
                            {log.resource ? ` · ${RESOURCE_LABELS[log.resource] || log.resource}` : ""}
                          </span>
                      }
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-semibold whitespace-nowrap">
                      {log.username || log.full_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-black text-zinc-600">
                        {RESOURCE_LABELS[log.resource] || log.resource || RESOURCE_LABELS[log.action] || log.action || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs font-semibold whitespace-nowrap" dir="ltr">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("ar-EG")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 bg-white/60">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              السابق
            </button>
            <span className="text-xs font-black text-zinc-600">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              التالي
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Count info */}
      {!isLoading && total > 0 && (
        <p className="mt-3 text-xs text-zinc-400 font-semibold text-center">
          إجمالي النتائج: {total} سجل
        </p>
      )}
    </PageWrapper>
  );
}
