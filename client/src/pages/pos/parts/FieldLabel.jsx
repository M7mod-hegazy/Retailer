import React from "react";

// Small numbered step label used above POS entry fields (code / qty / price / discount).
export default function FieldLabel({ step, children, isActive }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {step && (
        <span className={`inline-flex h-[18px] w-[18px] items-center justify-center border text-[9px] font-black leading-none shrink-0 transition-all duration-150 ${
          isActive ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 text-zinc-500"
        }`}>
          {step}
        </span>
      )}
      <span className={`text-[11px] font-black uppercase tracking-[0.12em] leading-none transition-colors ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>{children}</span>
    </div>
  );
}
