import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X, ShieldCheck, AlertTriangle, ArrowUpCircle, ChevronDown } from "lucide-react";
import { useCommsStore } from "../../stores/commsStore";

const TYPE_META = {
  info: { Icon: Megaphone, accent: "var(--primary)" },
  critical: { Icon: AlertTriangle, accent: "var(--danger)" },
  update: { Icon: ArrowUpCircle, accent: "var(--warning-text)" },
};

function AllAnnouncementsModal({ items, onClose, onRead, t }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-start justify-center p-6 pt-20 backdrop-blur-sm"
      style={{ background: "var(--bg-overlay)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border shadow-modal"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border-subtle)" }}>
          <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{t("announcements.title")}</span>
          <button
            onClick={onClose}
            aria-label={t("assistant.dismiss")}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--scroll-thumb) transparent" }}>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm font-bold" style={{ color: "var(--text-muted)" }}>{t("announcements.empty")}</p>
          ) : (
            items.map((a) => {
              const { Icon, accent } = TYPE_META[a.type] || TYPE_META.info;
              return (
                <div
                  key={a.id}
                  onMouseEnter={() => !a.read && onRead(a.id)}
                  className="rounded-xl border p-4 transition-all duration-200"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                    borderInlineStartWidth: 3,
                    borderInlineStartColor: accent,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <ShieldCheck className="h-3 w-3 shrink-0" style={{ color: "var(--primary)" }} />
                        <span className="text-[10px] font-black" style={{ color: "var(--primary)" }}>{t("assistant.developer")}</span>
                        {!a.read && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: accent }}>
                            {t("announcements.new")}
                          </span>
                        )}
                      </div>
                      {a.title && <p className="text-[13px] font-black leading-snug mb-0.5" style={{ color: "var(--text-primary)" }}>{a.title}</p>}
                      <p className="text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a.body}</p>
                    </div>
                    <div className="shrink-0 w-5" />
                  </div>
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
  const announcements = useCommsStore((s) => s.announcements);
  const syncAnnouncements = useCommsStore((s) => s.syncAnnouncements);
  const dismissAnnouncement = useCommsStore((s) => s.dismissAnnouncement);
  const markRead = useCommsStore((s) => s.markAnnouncementRead);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    syncAnnouncements();
    const id = setInterval(syncAnnouncements, 60000);
    return () => clearInterval(id);
  }, [syncAnnouncements]);

  const visible = announcements.filter((a) => !a.dismissed && a.active !== false);
  if (visible.length === 0) return null;

  const showViewAll = visible.length > 1;

  return (
    <div className="max-w-7xl mx-auto w-full px-6 md:px-12 mb-4 space-y-2" dir="rtl">
      <AnimatePresence>
        {visible.slice(0, showViewAll ? 1 : visible.length).map((a) => {
          const { Icon, accent } = TYPE_META[a.type] || TYPE_META.info;
          const isExpanded = expandedId === a.id;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 250, damping: 22 }}
              onMouseEnter={() => !a.read && markRead(a.id)}
              className="rounded-2xl border shadow-card transition-all duration-200 hover:shadow-elevated overflow-hidden"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
                borderInlineStartWidth: 4,
                borderInlineStartColor: accent,
              }}
            >
              <div className="flex items-start gap-4 px-5 py-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="text-[11px] font-black" style={{ color: "var(--text-secondary)" }}>{t("assistant.developer")}</span>
                    {!a.read && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-black text-white shadow-sm"
                        style={{ background: accent }}
                      >
                        {t("announcements.new")}
                      </span>
                    )}
                  </div>

                  {a.title && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      className="w-full text-right"
                    >
                      <p
                        className="text-sm font-black leading-snug transition-colors"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {a.title}
                      </p>
                    </button>
                  )}

                  <div className={`overflow-hidden transition-all duration-200 ${a.title ? 'mt-1' : ''}`}>
                    <p
                      className={`text-[13px] font-semibold leading-relaxed transition-all duration-200 ${
                        a.title && !isExpanded ? 'line-clamp-1' : ''
                      }`}
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.body}
                    </p>
                    {a.title && a.body.length > 80 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                        className="mt-0.5 flex items-center gap-1 text-[11px] font-black transition-colors hover:opacity-70"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        {isExpanded ? "عرض أقل" : "عرض المزيد"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-1 shrink-0">
                  {showViewAll && !a.title && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="rounded-lg px-2 py-1 text-[11px] font-black transition-colors whitespace-nowrap"
                      style={{ color: "var(--primary)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {t("announcements.viewAll")}
                    </button>
                  )}
                  <button
                    onClick={() => dismissAnnouncement(a.id)}
                    aria-label={t("assistant.dismiss")}
                    className="rounded-lg p-1.5 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {showViewAll && a.title && (
                <div
                  className="flex items-center justify-center border-t px-5 py-2.5"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-[11px] font-black transition-colors hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("announcements.viewAll")} ({visible.length})
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
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
    </div>
  );
}