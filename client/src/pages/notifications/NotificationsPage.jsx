import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, CheckSquare, Filter, X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { useNotificationStore } from "../../stores/notificationStore";
import PermissionGate from "../../components/ui/PermissionGate";
import PageWrapper from "../../components/ui/PageWrapper";
import { usePageTour } from "../../hooks/usePageTour";

const TYPE_OPTS = [
  { value: "all", label: "الكل" },
  { value: "info", label: "معلومات" },
  { value: "warning", label: "تحذير" },
  { value: "error", label: "حرج" },
];

function typeConfig(type) {
  switch (type) {
    case "warning": return {
      bg: "oklch(0.96 0.06 75)",
      text: "oklch(0.52 0.14 72)",
      icon: AlertTriangle,
      label: "تحذير",
    };
    case "error": return {
      bg: "oklch(0.96 0.05 15)",
      text: "oklch(0.50 0.18 15)",
      icon: AlertCircle,
      label: "حرج",
    };
    default: return {
      bg: "oklch(0.94 0.04 278)",
      text: "oklch(0.47 0.14 278)",
      icon: Info,
      label: "معلومات",
    };
  }
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-6 py-5 border-b border-[oklch(0.91_0.01_278)]">
      <div className="w-9 h-9 rounded-full shrink-0 skeleton-pulse" style={{ background: "oklch(0.91 0.015 278)" }} />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 w-48 rounded skeleton-pulse" style={{ background: "oklch(0.91 0.015 278)" }} />
        <div className="h-3 w-72 rounded skeleton-pulse" style={{ background: "oklch(0.93 0.01 278)", animationDelay: "0.15s" }} />
      </div>
      <div className="h-3 w-20 rounded skeleton-pulse shrink-0" style={{ background: "oklch(0.93 0.01 278)", animationDelay: "0.1s" }} />
    </div>
  );
}

function NotifRow({ note, onMarkRead, onDelete, index }) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const cfg = typeConfig(note.type);
  const Icon = cfg.icon;
  const isUnread = !note.is_read;

  const handleDelete = async (e) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => onDelete(note.id), 280);
  };

  const handleMarkRead = async (e) => {
    e.stopPropagation();
    onMarkRead(note.id);
  };

  const handleClick = async () => {
    if (isUnread) onMarkRead(note.id);
    if (note.link?.startsWith("/history")) {
      navigate(note.link);
    } else {
      navigate(`/history?notif_id=${note.id}`);
    }
  };

  const delay = `${Math.min(index, 12) * 35}ms`;

  return (
    <div
      onClick={handleClick}
      className={`notif-row group relative flex items-start gap-4 px-6 py-5 cursor-pointer border-b border-[oklch(0.91_0.01_278)] transition-all duration-200 hover:bg-[oklch(0.975_0.01_278)] ${leaving ? "notif-leave" : "notif-enter"} ${isUnread ? "notif-unread" : "opacity-60"}`}
      style={{ animationDelay: delay }}
    >
      {/* Unread indicator line */}
      {isUnread && (
        <div className="absolute right-0 top-4 bottom-4 w-0.5 rounded-l" style={{ background: "oklch(0.47 0.14 278)" }} />
      )}

      {/* Type icon circle */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: cfg.bg }}
      >
        <Icon size={16} style={{ color: cfg.text }} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-semibold truncate ${isUnread ? "text-[oklch(0.18_0.02_278)]" : "text-[oklch(0.45_0.03_278)]"}`}>
              {note.title}
            </span>
            {note.type && note.type !== "info" && (
              <span
                className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.text }}
              >
                {cfg.label}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[oklch(0.55_0.04_278)] shrink-0 mt-0.5 font-mono" dir="ltr">
            {new Date(note.created_at).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>

        {note.message && (
          <p className="text-sm text-[oklch(0.45_0.05_278)] leading-relaxed mb-2">{note.message}</p>
        )}

        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {isUnread && (
            <PermissionGate page="notifications" action="edit">
              <button
                onClick={handleMarkRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[oklch(0.47_0.14_278)] hover:underline"
              >
                <Check size={11} strokeWidth={2.5} />
                تعليم مقروء
              </button>
            </PermissionGate>
          )}
          <PermissionGate page="notifications" action="delete">
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[oklch(0.50_0.18_15)] hover:underline"
            >
              <Trash2 size={11} strokeWidth={2.5} />
              حذف
            </button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  usePageTour('notifications');
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { markAsRead, markAllAsRead, dismissNotification, deleteAllRead } = useNotificationStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/notifications");
        if (res.data?.success) setNotifications(res.data.data || []);
      } catch {
        toast.error("فشل تحميل الإشعارات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleMarkRead = async (id) => {
    await markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const handleDelete = async (id) => {
    await dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const handleDeleteAllRead = async () => {
    await deleteAllRead();
    setNotifications(prev => prev.filter(n => !n.is_read));
  };

  const filtered = typeFilter === "all" ? notifications : notifications.filter(n => n.type === typeFilter);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const readCount = notifications.filter(n => n.is_read).length;

  return (
    <>
      <style>{`
        @keyframes notif-row-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes notif-row-out {
          from { opacity: 1; max-height: 120px; transform: translateX(0); }
          to   { opacity: 0; max-height: 0; transform: translateX(40px); padding-top: 0; padding-bottom: 0; border: none; }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .notif-enter {
          animation: notif-row-in 320ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .notif-leave {
          animation: notif-row-out 280ms cubic-bezier(0.4,0,1,1) both;
          overflow: hidden;
        }
        .notif-unread {
          background: oklch(0.975 0.008 278);
        }
        .skeleton-pulse {
          animation: shimmer 1.4s ease-in-out infinite;
          background-image: linear-gradient(90deg, oklch(0.91 0.015 278) 0%, oklch(0.95 0.008 278) 50%, oklch(0.91 0.015 278) 100%);
          background-size: 800px 100%;
        }
        @media (prefers-reduced-motion: reduce) {
          .notif-enter, .notif-leave, .skeleton-pulse { animation: none !important; }
        }
      `}</style>

      <PageWrapper className={`mx-auto max-w-3xl px-4 py-6 ${isRTL ? "text-right" : "text-left"}`} data-help-root="notifications">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap" data-help="page-header">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.94 0.04 278)" }}
            >
              <Bell size={20} style={{ color: "oklch(0.47 0.14 278)" }} strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[oklch(0.18_0.02_278)] leading-tight">الإشعارات</h1>
              <p className="text-sm text-[oklch(0.50_0.05_278)] mt-0.5">
                {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type filter */}
            <div className="flex items-center rounded-xl overflow-hidden border border-[oklch(0.88_0.02_278)] bg-[oklch(0.975_0.005_278)]">
              {TYPE_OPTS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className="px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                  style={{
                    background: typeFilter === opt.value ? "oklch(0.47 0.14 278)" : "transparent",
                    color: typeFilter === opt.value ? "oklch(0.99 0.003 278)" : "oklch(0.45 0.05 278)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {(unreadCount > 0 || readCount > 0) && (
          <div className="flex items-center gap-3 mb-4 px-1" data-help="bulk-actions">
            <PermissionGate page="notifications" action="edit">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
                  style={{ background: "oklch(0.94 0.04 278)", color: "oklch(0.47 0.14 278)" }}
                >
                  <CheckSquare size={13} strokeWidth={2} />
                  تعليم الكل مقروء
                </button>
              )}
            </PermissionGate>
            <PermissionGate page="notifications" action="delete">
              {readCount > 0 && (
                <button
                  onClick={handleDeleteAllRead}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150"
                  style={{ background: "oklch(0.96 0.05 15)", color: "oklch(0.50 0.18 15)" }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                  حذف المقروءة ({readCount})
                </button>
              )}
            </PermissionGate>
          </div>
        )}

        {/* Feed */}
        <div
          className="rounded-2xl overflow-hidden" data-help="notification-feed"
          style={{
            background: "oklch(1 0 0)",
            border: "1px solid oklch(0.91 0.015 278)",
            boxShadow: "0 1px 3px oklch(0.47 0.14 278 / 0.06), 0 8px 24px oklch(0.47 0.14 278 / 0.04)",
          }}
        >
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "oklch(0.94 0.04 278)" }}
              >
                <Bell size={24} style={{ color: "oklch(0.47 0.14 278)" }} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[oklch(0.45_0.05_278)]">
                {typeFilter !== "all" ? "لا توجد إشعارات من هذا النوع" : "لا توجد إشعارات"}
              </p>
            </div>
          ) : (
            filtered.map((note, i) => (
              <NotifRow
                key={note.id}
                note={note}
                index={i}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-[oklch(0.60_0.04_278)] mt-4">
            {filtered.length} إشعار
          </p>
        )}
      </PageWrapper>
    </>
  );
}
