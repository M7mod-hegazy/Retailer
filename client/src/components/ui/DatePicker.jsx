import React from "react";

export default function DatePicker({ label, value, onChange, required, min, max, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="block text-sm font-medium text-text-primary">{label}</label>}
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        min={min}
        max={max}
        className="input w-full text-sm transition-colors"
      />
    </div>
  );
}
