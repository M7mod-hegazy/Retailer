import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function SmartTooltip({ children, content, side = "top" }) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Calculate center position above the element
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top - 10, // 10px spacing
      });
    }
  }, [isVisible]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isVisible && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{
                  position: "fixed",
                  left: coords.x,
                  top: coords.y,
                  transform: "translate(-50%, -100%)", // Center horizontally, place above
                  zIndex: 9999,
                }}
                className="pointer-events-none"
              >
                <div className="relative flex items-center justify-center">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl px-4 py-2.5 text-xs font-bold text-white shadow-2xl shadow-slate-900/40 max-w-[200px] text-center whitespace-normal leading-relaxed ring-1 ring-inset ring-white/10">
                    {content}
                  </div>
                  {/* Subtle Triangle Pointer */}
                  <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-slate-900/90 backdrop-blur-xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
