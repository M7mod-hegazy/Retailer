import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TitleBar from "./TitleBar";

export default function Modal({ open, title, onClose, onDetach: userOnDetach, children, maxWidth = "max-w-xl", modalType, modalState, showDetach = true }) {
  const [chromeInset, setChromeInset] = useState({ right: 0, top: 0 });
  const modalRef = useRef(null);
  const isDetached = typeof window !== 'undefined' && window.location.search.includes("detachedModal=1");

  // A modal can be detached only when the caller wires it up: either a custom
  // onDetach handler, or a registered modalType the detached window can rebuild
  // as real React. Without one of those, detaching would produce a dead HTML
  // snapshot, so we don't offer it at all (see TitleBar.canDetach).
  const canDetach = Boolean(userOnDetach || modalType);

  function handleDetach() {
    if (userOnDetach) { userOnDetach(); return; }
    if (!window.electronAPI || !modalType) return;
    const el = modalRef.current;
    const rect = el?.getBoundingClientRect();

    window.electronAPI.createModalWindow({
      modalType,
      state: modalState || { title, contentHtml: null },
      bounds: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined,
    });
    onClose?.();
  }

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
      {open && !isDetached && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-0 left-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 pb-6 pt-20 backdrop-blur-sm"
          style={{ right: chromeInset.right, top: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${maxWidth} flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-slate-900/5`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <TitleBar title={title} onClose={onClose} onDetach={canDetach ? handleDetach : undefined} showDetach={showDetach} />
            )}
            <div data-modal-content className="flex-1 overflow-y-auto p-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
      {open && isDetached && (
        <div className="flex h-dvh flex-col overflow-hidden bg-white">
          {title && (
            <TitleBar title={title} onClose={onClose} showDetach={false} />
          )}
          <div data-modal-content className="flex-1 overflow-y-auto p-5">
            {children}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
