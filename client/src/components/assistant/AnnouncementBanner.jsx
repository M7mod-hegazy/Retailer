import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X, ShieldCheck, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { useCommsStore } from "../../stores/commsStore";

const TYPE_META = {
  info: { Icon: Megaphone, accent: "var(--primary)" },
  critical: { Icon: AlertTriangle, accent: "var(--danger, #dc2626)" },
  update: { Icon: ArrowUpCircle, accent: "var(--warning, #d97706)" },
};

function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.info;
}

function AllAnnouncementsModal({ items, onClose, onRead, t }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 p-6 pt-20 backdrop-blur-[2px]"
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border shadow-2xl"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border-normal)" }}>
          <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{t("announcements.title")}</span>
          <button onClick={onClose} aria-label={t("assistant.dismiss")} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <p className="py-8 text-center text-[13px] font-bold" style={{ color: "var(--text-muted)" }}>{t("announcements.empty")}</p>
          ) : (
            items.map((a) => {
              const { Icon, accent } = typeMeta(a.type);
              return (
                <div
                  key={a.id}
                  onMouseEnter={() => !a.read && onRead(a.id)}
                  className="rounded-2xl border p-3.5"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: accent }} />
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-black text-primary">{t("assistant.developer")}</span>
                    {!a.read && (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black text-white" style={{ background: accent }}>
                        {t("announcements.new")}
                      </span>
                    )}
                  </div>
                  {a.title && <p className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>{a.title}</p>}
                  <p className="text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.body}</p>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AnnouncementBanner() {
  const { t } = useTranslation();
  const location = useLocation();
  const announcements = useCommsStore((s) => s.announcements);
  const syncAnnouncements = useCommsStore((s) => s.syncAnnouncements);
  const dismissAnnouncement = useCommsStore((s) => s.dismissAnnouncement);
  const markRead = useCommsStore((s) => s.markAnnouncementRead);
  const bannerAnnouncement = useCommsStore((s) => s.bannerAnnouncement);
  const [showAll, setShowAll] = useState(false);

  const onDashboard = location.pathname === "/" || location.pathname.startsWith("/dashboard");

  useEffect(() => {
    syncAnnouncements();
    const id = setInterval(syncAnnouncements, 60000);
    return () => clearInterval(id);
  }, [syncAnnouncements]);

  if (!onDashboard) return null;
  const banner = bannerAnnouncement();
  if (!banner && !showAll) return null;

  const { Icon, accent } = banner ? typeMeta(banner.type) : typeMeta("info");

  return (
    <>
      <AnimatePresence>
        {banner && (
          <motion.div
            dir="rtl"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed inset-x-0 top-24 z-40 mx-auto flex w-[min(680px,92vw)] items-start gap-3 rounded-[1.25rem] border bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl"
            style={{ borderColor: "var(--border-normal)", borderInlineStartWidth: 4, borderInlineStartColor: accent }}
            onMouseEnter={() => !banner.read && markRead(banner.id)}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-black text-primary">{t("assistant.developer")}</span>
              </div>
              {banner.title && <p className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>{banner.title}</p>}
              <p className="line-clamp-2 text-[12px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{banner.body}</p>
              <button onClick={() => setShowAll(true)} className="mt-1 text-[11px] font-black text-primary hover:underline">
                {t("announcements.viewAll")}
              </button>
            </div>
            <button onClick={() => dismissAnnouncement(banner.id)} aria-label={t("assistant.dismiss")} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAll && (
          <AllAnnouncementsModal
            items={announcements.filter((a) => !a.dismissed)}
            onClose={() => setShowAll(false)}
            onRead={markRead}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );
}
