import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Drawer({ open, onClose, title, children, position = "right" }) {
  const isRight = position === "right";
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[rgba(28,22,13,0.28)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: isRight ? "100%" : "-100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRight ? "100%" : "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`glass-elevated absolute ${isRight ? "right-0" : "left-0"} top-0 flex h-full w-80 flex-col`}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-5">
              <h3 className="text-xl font-black tracking-[-0.02em] text-text-primary">{title}</h3>
              <button onClick={onClose} className="btn-icon h-10 w-10 text-text-secondary transition hover:text-text-primary" aria-label="إغلاق">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
