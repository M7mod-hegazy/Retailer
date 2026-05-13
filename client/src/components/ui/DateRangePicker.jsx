import React from "react";

export default function DateRangePicker({ startLabel = "من", endLabel = "إلى", startValue, endValue, onStartChange, onEndChange, className = "" }) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <div className="space-y-1">
        <label className="block text-xs text-text-secondary">{startLabel}</label>
        <input type="date" value={startValue || ""} onChange={(e) => onStartChange?.(e.target.value)} className="input text-sm" />
      </div>
      <div className="space-y-1">
        <label className="block text-xs text-text-secondary">{endLabel}</label>
        <input type="date" value={endValue || ""} onChange={(e) => onEndChange?.(e.target.value)} className="input text-sm" />
      </div>
    </div>
  );
}
