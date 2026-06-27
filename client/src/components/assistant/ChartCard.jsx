import React, { useMemo } from "react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"];

export default function ChartCard({ data, label }) {
  const maxVal = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  if (!data || data.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {data.slice(0, 10).map((d, i) => {
          const pct = (d.value / maxVal) * 100;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end h-full">
              <span className="text-[9px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>
                {d.value.toLocaleString("en-US")}
              </span>
              <div
                className="w-full rounded-t-sm transition-all hover:opacity-80"
                style={{ height: `${Math.max(pct, 4)}%`, background: COLORS[i % COLORS.length], minHeight: 4 }}
                title={d.label}
              />
              <span className="mt-0.5 text-[8px] font-bold text-center leading-tight truncate w-full" style={{ color: "var(--text-muted)" }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      {label && <p className="mt-2 text-[10px] font-bold text-center" style={{ color: "var(--text-muted)" }}>{label}</p>}
    </div>
  );
}
