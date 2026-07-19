import React from "react";
import { ChevronLeft } from "lucide-react";

// Horizontal RTL pipeline header for document chains and lifecycles
// (عرض سعر ← أمر شراء ← فاتورة استلام / مستلم ← مودع ← محصَّل).
// Doubles as navigation/filter when stages carry onClick.
//
// stages: [{ key, label, desc?, count?, icon?, active?, tone?, onClick? }]
const TONE_ACTIVE = {
  primary: "bg-primary text-white shadow-card",
  success: "bg-success text-white shadow-card",
  warning: "bg-warning text-white shadow-card",
  danger:  "bg-danger text-white shadow-card",
};

export default function FlowStepper({ stages = [], className = "" }) {
  return (
    <div dir="rtl" className={`flex items-stretch gap-1.5 overflow-x-auto py-1 ${className}`}>
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        const activeCls = TONE_ACTIVE[stage.tone || "primary"];
        const clickable = typeof stage.onClick === "function";
        return (
          <React.Fragment key={stage.key || i}>
            {i > 0 && (
              <div className="flex items-center shrink-0 text-text-muted">
                <ChevronLeft className="h-4 w-4" />
              </div>
            )}
            <button
              type="button"
              onClick={stage.onClick}
              disabled={!clickable}
              className={`flex min-w-[110px] flex-1 shrink-0 flex-col items-start gap-0.5 rounded-2xl border px-3 py-2 text-start transition-all ${
                stage.active
                  ? `border-transparent ${activeCls}`
                  : "border-border bg-bg-surface hover:bg-bg-base"
              } ${clickable ? "cursor-pointer active:scale-[0.98]" : "cursor-default"}`}
            >
              <span className="flex w-full items-center gap-1.5">
                {Icon && <Icon className={`h-4 w-4 shrink-0 ${stage.active ? "" : "text-text-muted"}`} />}
                <span className={`text-[12px] font-black truncate ${stage.active ? "" : "text-text-primary"}`}>
                  {stage.label}
                </span>
                {stage.count != null && (
                  <span
                    className={`mr-auto rounded-full px-2 py-0.5 text-[10px] font-black ${
                      stage.active ? "bg-bg-surface/20" : "bg-bg-base text-text-secondary"
                    }`}
                  >
                    {stage.count}
                  </span>
                )}
              </span>
              {stage.desc && (
                <span className={`text-[10px] font-bold leading-tight ${stage.active ? "opacity-80" : "text-text-muted"}`}>
                  {stage.desc}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
