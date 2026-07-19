import React from "react";

export default function PhoneFrame({ accent = "var(--primary)", children, className = "" }) {
  return (
    <div className={`phone-frame w-56 rounded-[28px] border-4 bg-bg-surface shadow-card overflow-hidden ${className}`} style={{ borderColor: accent }}>
      <div className="flex justify-center py-1.5" style={{ background: accent }}>
        <div className="h-1.5 w-10 rounded-full bg-bg-surface/60" />
      </div>
      <div className="p-3 space-y-2 min-h-[140px] bg-bg-base">
        {children}
      </div>
    </div>
  );
}
