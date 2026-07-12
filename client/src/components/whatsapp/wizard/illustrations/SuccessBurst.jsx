import React from "react";
import { Check } from "lucide-react";

export default function SuccessBurst({ accent = "var(--success-text)" }) {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: accent }} />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-card" style={{ background: accent }}>
        <Check className="h-8 w-8" />
      </span>
    </div>
  );
}
