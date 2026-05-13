import React from "react";

export default function ProgressBar({ value = 0, max = 100, color = "blue", showLabel = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    blue: "from-info-DEFAULT to-primary",
    green: "from-primary-300 to-primary",
    red: "from-danger-DEFAULT to-danger-600",
    yellow: "from-warning-DEFAULT to-amber-300",
  };
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${colors[color] || colors.blue}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? <p className="mt-1 text-xs text-text-secondary">{pct.toFixed(0)}%</p> : null}
    </div>
  );
}
