import React from "react";
import { KeyRound } from "lucide-react";

export default function TokenKey({ label = "Bot Token", accent = "var(--primary)" }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2" style={{ borderColor: accent }}>
      <KeyRound className="h-4 w-4 shrink-0" style={{ color: accent }} />
      <span className="text-[11px] font-mono font-bold text-text-secondary truncate" dir="ltr">{label}</span>
    </div>
  );
}
