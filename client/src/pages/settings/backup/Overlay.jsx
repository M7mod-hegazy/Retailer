import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// Animated, centered modal shell used by all backup dialogs.
export default function Overlay({ open, title, subtitle, icon, accent = "slate", onClose, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const accentRing = {
    slate: "text-slate-600 bg-slate-100",
    rose: "text-rose-600 bg-rose-100",
    emerald: "text-emerald-600 bg-emerald-100",
    sky: "text-sky-600 bg-sky-100",
  }[accent] || "text-slate-600 bg-slate-100";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 font-sans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            dir="rtl"
            className={`relative w-full ${maxWidth} max-h-[88vh] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-2xl flex flex-col`}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div className="flex items-start gap-3">
                {icon && (
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${accentRing}`}>
                    {icon}
                  </div>
                )}
                <div>
                  <div className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</div>
                  {subtitle && <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{subtitle}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
