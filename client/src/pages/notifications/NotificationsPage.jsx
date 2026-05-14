import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, CheckSquare, Trash2, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useNotificationStore } from "../../stores/notificationStore";
import PermissionGate from "../../components/ui/PermissionGate";
import Button from "../../components/ui/Button";
import PageWrapper from "../../components/ui/PageWrapper";

const SAFE_LINK_PREFIXES = [
  "/invoices",
  "/purchases",
  "/stock",
  "/suppliers",
  "/customers",
  "/shifts",
  "/definitions",
  "/notifications",
  "/history",
  "/reports",
  "/payments",
  "/expenses",
];

const TYPE_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "info", label: "معلومات" },
  { value: "warning", label: "تحذير" },
  { value: "error", label: "خطأ" },
];

const TYPE_COLORS = {
  info: "bg-info/10 text-info-DEFAULT border-info/30",
  warning: "bg-warning/10 text-warning-DEFAULT border-warning/30",
  error: "bg-error/10 text-error-DEFAULT border-error/30",
};

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const navigate = useNavigate();

  const { markAsRead, markAllAsRead, dismissNotification, deleteAllRead } = useNotificationStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/notifications");
      if (res.data?.success) {
        setNotifications(res.data.data || []);
      }
    } catch (err) {
      toast.error("فشل تحميل التنبيهات");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    await markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await dismissNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const handleDeleteAllRead = async () => {
    await deleteAllRead();
    setNotifications((prev) => prev.filter((n) => !n.is_read));
  };

  const handleRowClick = async (note) => {
    // Always mark as read
    if (!note.is_read) {
      await markAsRead(note.id);
      setNotifications((prev) => prev.map((n) => (n.id === note.id ? { ...n, is_read: 1 } : n)));
    }
    // Navigate only if link is safe
    if (note.link && SAFE_LINK_PREFIXES.some((prefix) => note.link.startsWith(prefix))) {
      navigate(note.link);
    }
  };

  const filtered = typeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === typeFilter);

  const readCount = notifications.filter((n) => n.is_read).length;

  return (
    <PageWrapper className={`mx-auto max-w-5xl px-4 py-4 ${isRTL ? "text-right" : "text-left"}`}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/12 text-info-DEFAULT">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">التنبيهات</h1>
            <p className="page-subtitle">تابع الأحداث الحرجة ورسائل التشغيل في مكان واحد.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field text-sm h-9 px-3 py-1 rounded-lg"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Delete all read */}
          <PermissionGate page="notifications" action="delete">
            {readCount > 0 && (
              <Button
                variant="ghost"
                onClick={handleDeleteAllRead}
                className="text-error-DEFAULT hover:bg-error/10"
              >
                <Trash2 className="w-4 h-4" />
                حذف المقروءة ({readCount})
              </Button>
            )}
          </PermissionGate>

          {/* Mark all read */}
          <PermissionGate page="notifications" action="edit">
            <Button variant="ghost" onClick={handleMarkAllAsRead}>
              <CheckSquare className="w-4 h-4" /> تحديد الكل كمقروء
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[24px]">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">لا توجد تنبيهات حالياً</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((note) => (
              <div
                key={note.id}
                onClick={() => handleRowClick(note)}
                className={`flex items-start gap-4 p-5 transition-all cursor-pointer hover:bg-surface-hover ${
                  note.is_read ? "bg-transparent opacity-70" : "bg-info/10"
                }`}
              >
                <div
                  className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${
                    note.is_read ? "bg-border-normal" : "bg-info-DEFAULT badge-pulse"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3
                        className={`font-semibold truncate ${
                          note.is_read ? "text-text-secondary" : "text-text-primary"
                        }`}
                      >
                        {note.title}
                      </h3>
                      {note.type && note.type !== "info" && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                            TYPE_COLORS[note.type] || TYPE_COLORS.info
                          }`}
                        >
                          {note.type === "warning" ? "تحذير" : note.type === "error" ? "خطأ" : note.type}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted flex-shrink-0" dir="ltr">
                      {new Date(note.created_at).toLocaleString("ar-EG")}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-text-secondary">{note.message}</p>

                  <div className="flex items-center gap-3">
                    {!note.is_read && (
                      <PermissionGate page="notifications" action="edit">
                        <button
                          onClick={(e) => handleMarkAsRead(e, note.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-info-DEFAULT hover:underline"
                        >
                          <Check className="w-3 h-3" />
                          تعليم كمقروء
                        </button>
                      </PermissionGate>
                    )}
                    <PermissionGate page="notifications" action="delete">
                      <button
                        onClick={(e) => handleDelete(e, note.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-error-DEFAULT hover:underline"
                      >
                        <Trash2 className="w-3 h-3" />
                        حذف
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
