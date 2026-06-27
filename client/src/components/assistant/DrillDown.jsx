import React from "react";
import { ArrowLeft, X } from "lucide-react";

export default function DrillDown({ item, onBack, onNavigate, t }) {
  if (!item) return null;

  return (
    <div className="rounded-2xl border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <button onClick={onBack} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>{item.name}</span>
        </div>
      </div>
      <div className="space-y-1.5 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        {Object.entries(item).filter(([k]) => k !== "id" && typeof item[k] !== "object").map(([key, val]) => (
          <div key={key} className="flex justify-between py-0.5 border-b last:border-0" style={{ borderColor: "var(--border-normal)" }}>
            <span>{key}</span>
            <span className="font-black" style={{ color: "var(--text-primary)" }}>{String(val ?? "—")}</span>
          </div>
        ))}
      </div>
      {item.route && (
        <button onClick={() => onNavigate(item.route)}
          className="mt-2 w-full rounded-xl bg-primary py-1.5 text-[11px] font-black text-white">
          {t?.("drillDown.goToPage") || "افتح الصفحة"}
        </button>
      )}
    </div>
  );
}
