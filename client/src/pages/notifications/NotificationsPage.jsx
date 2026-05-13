import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CheckSquare } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import PermissionGate from "../../components/ui/PermissionGate";
import Button from "../../components/ui/Button";
import PageWrapper from "../../components/ui/PageWrapper";

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

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
      toast.error(t("إشعارات", "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

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
        <PermissionGate page="notifications" action="edit">
          <Button variant="ghost" onClick={markAllAsRead}>
            <CheckSquare className="w-4 h-4" /> تحديد الكل كمقروء
          </Button>
        </PermissionGate>
      </div>

      <div className="glass-panel overflow-hidden rounded-[24px]">
        {loading ? (
          <div className="p-8 text-center text-text-secondary">جاري التحميل...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">لا توجد تنبيهات حالياً</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {notifications.map((note) => (
              <div 
                key={note.id} 
                className={`flex items-start gap-4 p-5 transition-all ${note.is_read ? "bg-transparent opacity-70" : "bg-info/10"}`}
              >
                    <div className={`mt-1 h-3 w-3 rounded-full ${note.is_read ? "bg-border-normal" : "bg-info-DEFAULT badge-pulse"}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold ${note.is_read ? "text-text-secondary" : "text-text-primary"}`}>{note.title}</h3>
                    <span className="text-xs text-text-muted" dir="ltr">{new Date(note.created_at).toLocaleString('ar-EG')}</span>
                  </div>
                  <p className="mb-2 text-sm text-text-secondary">{note.message}</p>
                  
                  {!note.is_read && (
                    <PermissionGate page="notifications" action="edit">
                      <button 
                        onClick={() => markAsRead(note.id)}
                        className="text-xs font-medium text-info-DEFAULT hover:underline"
                      >
                        تحديد كمقروء
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
