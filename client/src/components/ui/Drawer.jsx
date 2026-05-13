import React from "react";

export default function Drawer({ open, onClose, title, children, position = "right" }) {
  if (!open) return null;
  const side = position === "right" ? "right-0" : "left-0";
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(28,22,13,0.28)] backdrop-blur-sm" onClick={onClose} />
      <div className={`glass-elevated absolute ${side} top-0 flex h-full w-80 animate-slide-in flex-col`}>
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-5">
          <h3 className="text-xl font-black tracking-[-0.02em] text-text-primary">{title}</h3>
          <button onClick={onClose} className="btn-icon h-10 w-10 text-text-secondary transition hover:text-text-primary" aria-label="إغلاق">
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
