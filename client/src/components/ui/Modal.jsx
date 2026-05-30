import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function Modal({ open, title, onClose, children, maxWidth = "max-w-xl" }) {
  const [chromeInset, setChromeInset] = useState({ right: 0, top: 0 });

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const measure = () => {
      const sidebar = document.querySelector("[data-app-sidebar='true']");
      const main = document.querySelector("main");
      const sidebarRect = sidebar?.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();
      const touchesRightEdge = sidebarRect && sidebarRect.right >= window.innerWidth - 2 && sidebarRect.width > 40;

      setChromeInset({
        right: touchesRightEdge ? Math.max(0, Math.round(window.innerWidth - sidebarRect.left)) : 0,
        top: mainRect ? Math.max(0, Math.round(mainRect.top)) : 0,
      });
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    const sidebar = document.querySelector("[data-app-sidebar='true']");
    const main = document.querySelector("main");
    if (sidebar) resizeObserver.observe(sidebar);
    if (main) resizeObserver.observe(main);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-0 left-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 pb-6 pt-4 backdrop-blur-[2px]"
          style={{ right: chromeInset.right, top: chromeInset.top }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${maxWidth} flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-slate-900/5`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
                {onClose && (
                  <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
