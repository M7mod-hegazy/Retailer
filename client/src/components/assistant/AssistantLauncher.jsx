import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X } from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";

const DISMISS_KEY = "retailer.assistant.bubbleDismissed";

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "true"; } catch { return false; }
}

function writeDismissed(val) {
  try { localStorage.setItem(DISMISS_KEY, String(val)); } catch { /* noop */ }
}

export default function AssistantLauncher() {
  const { t } = useTranslation();
  const location = useLocation();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);

  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    setDismissed(readDismissed());
  }, [isOpen]);

  const onDashboard = location.pathname === "/" || location.pathname.startsWith("/dashboard");
  const visible = onDashboard && !dismissed && !isOpen;

  const handleOpen = useCallback(() => {
    writeDismissed(true);
    setDismissed(true);
    open("assistant");
  }, [open]);

  const handleDismiss = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    writeDismissed(true);
    setDismissed(true);
    useAssistantStore.getState().dismissBubble();
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="assistant-bubble"
        dir="rtl"
        initial={{ opacity: 0, y: 16, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="fixed bottom-6 end-6 z-50"
      >
        <div className="relative">
          <button
            onClick={handleOpen}
            className="flex items-center gap-2.5 rounded-full bg-primary px-4 py-3 text-white shadow-[0_8px_30px_rgb(0,0,0,0.18)] transition-transform hover:scale-105"
          >
            <Bot strokeWidth={2.2} className="h-5 w-5" />
            <span className="text-[13px] font-black">{t("assistant.bubble")}</span>
          </button>

          <button
            onClick={handleDismiss}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t("assistant.dismiss")}
            className="absolute -top-1.5 -start-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bg-surface text-[var(--text-muted)] shadow-md ring-2 ring-primary transition-colors hover:bg-[var(--danger)] hover:text-white hover:ring-[var(--danger)]"
          >
            <X strokeWidth={3} className="h-2.5 w-2.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
