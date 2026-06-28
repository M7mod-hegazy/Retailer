import React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";

/**
 * Dismissable floating bubble shown on the dashboard only. The always-available
 * entry point is the Topbar icon; this bubble adds discoverability and can be
 * hidden for the session.
 */
export default function AssistantLauncher() {
  const { t } = useTranslation();
  const location = useLocation();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);
  const dismissed = useAssistantStore((s) => s.bubbleDismissed);
  const dismissBubble = useAssistantStore((s) => s.dismissBubble);

  const onDashboard = location.pathname === "/" || location.pathname.startsWith("/dashboard");
  const visible = onDashboard && !dismissed && !isOpen;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          dir="rtl"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="fixed bottom-6 end-6 z-50 flex items-center gap-1"
        >
          <button
            onClick={() => open("assistant")}
            className="flex items-center gap-2.5 rounded-[1.25rem] bg-primary px-4 py-3 text-white shadow-[0_8px_30px_rgb(0,0,0,0.18)] transition-transform hover:scale-105"
          >
            <Sparkles strokeWidth={2.2} className="h-5 w-5" />
            <span className="text-[13px] font-black">{t("assistant.bubble")}</span>
          </button>
          <button
            onClick={dismissBubble}
            aria-label={t("assistant.dismiss")}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
          >
            <X strokeWidth={2.5} className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
