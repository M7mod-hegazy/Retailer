import React from "react";

export default function Checkbox({ label, checked, onChange, disabled, className = "" }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 ${disabled ? "opacity-50" : ""} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border-normal/20 bg-bg-surface/5 text-primary focus:ring-primary/40"
      />
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
